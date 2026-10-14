import { purchaseQuantity, validateProcurement } from './culinaryKnowledge';
import { validateClosedDates } from './closureCalendar';
import { addCalendarDays, businessDateKey, tomorrowBusinessDate, validCalendarDate } from './businessDate';
import { SalesRecord, Ingredient, MenuItem, ForecastLine, OrderNote } from '../types';

export interface MenuDemandPrediction {
  menuItemId: string;
  menuItemName: string;
  projectedUnits: number;
  confidence: 'none' | 'low' | 'medium' | 'high';
  recordsUsed: number;
  explanation: string;
}

export interface ForecastResult {
  horizonDays: number;
  totalProjectedSalesValue: number;
  totalProjectedMenuRevenue: number;
  totalProjectedMenuUnits: number;
  lines: ForecastLine[];
  generatedOrders: OrderNote[];
  menuDemandPredictions: MenuDemandPrediction[];
  warnings: string[];
  blockingIssues?: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function toDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(date: Date): string {
  return businessDateKey(date);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function normalizeName(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundQuantity(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function stableId(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36).toUpperCase().slice(0, 6).padStart(6, '0');
}

function getTargetDates(horizonDays: number, startDate = new Date()): Date[] {
  return Array.from({ length: horizonDays }, (_, index) =>
    new Date(`${addCalendarDays(businessDateKey(startDate), index + 1)}T12:00:00Z`));
}

function groupSalesByDate(records: SalesRecord[]): Map<string, number> {
  return records.reduce((map, record) => {
    const soldAt = toDate(record.sold_at);
    if (!soldAt) return map;

    const key = businessDateKey(record.sold_at);
    map.set(key, (map.get(key) || 0) + Number(record.quantity_sold || 0));
    return map;
  }, new Map<string, number>());
}

function confidence(recordsUsed: number): 'none' | 'low' | 'medium' | 'high' {
  if (recordsUsed <= 0) return 'none';
  if (recordsUsed < 3) return 'low';
  if (recordsUsed < 6) return 'medium';
  return 'high';
}

function predictMenuDemandForHorizon(
  salesRecords: SalesRecord[],
  menuItem: MenuItem,
  targetDates: Date[],
): MenuDemandPrediction {
  const itemSales = salesRecords.filter(
    (record) => normalizeName(record.item_name) === normalizeName(menuItem.name),
  );

  if (itemSales.length === 0) {
    return {
      menuItemId: menuItem.id,
      menuItemName: menuItem.name,
      projectedUnits: 0,
      confidence: 'none',
      recordsUsed: 0,
      explanation: `No sales history found for ${menuItem.name}; projected 0 instead of guessing.`,
    };
  }

  const salesByDate = groupSalesByDate(itemSales);
  const allDailyQuantities = Array.from(salesByDate.values()).filter((qty) => qty >= 0);
  const allHistoryAverage = allDailyQuantities.length > 0
    ? allDailyQuantities.reduce((sum, qty) => sum + qty, 0) / allDailyQuantities.length
    : 0;

  let projectedUnits = 0;
  let recordsUsed = 0;
  let fallbackDays = 0;

  targetDates.forEach((targetDate) => {
    const targetDay = targetDate.getUTCDay();
    const sameWeekdayQuantities = Array.from(salesByDate.entries())
      .map(([day, qty]) => ({ date: toDate(day), qty }))
      .filter((entry): entry is { date: Date; qty: number } => Boolean(entry.date))
      .filter((entry) => entry.date.getUTCDay() === targetDay)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(-6)
      .map((entry) => entry.qty);

    if (sameWeekdayQuantities.length > 0) {
      projectedUnits += sameWeekdayQuantities.reduce((sum, qty) => sum + qty, 0) / sameWeekdayQuantities.length;
      recordsUsed += sameWeekdayQuantities.length;
      return;
    }

    if (allHistoryAverage > 0) {
      projectedUnits += allHistoryAverage;
      fallbackDays += 1;
    }
  });

  const roundedProjectedUnits = Math.ceil(projectedUnits);
  const finalConfidence = fallbackDays > 0 ? 'low' : confidence(Math.floor(recordsUsed / targetDates.length));
  const explanation = fallbackDays > 0
    ? `Used real sales for ${menuItem.name}, but ${fallbackDays} day(s) lacked matching weekday history, so confidence is low.`
    : `Used last matching weekday sales for ${menuItem.name} across ${recordsUsed} record(s).`;

  return {
    menuItemId: menuItem.id,
    menuItemName: menuItem.name,
    projectedUnits: roundedProjectedUnits,
    confidence: finalConfidence,
    recordsUsed,
    explanation,
  };
}

export function generateSmartPurchaseOrder(
  salesRecords: SalesRecord[],
  ingredients: Ingredient[],
  menuItems: MenuItem[],
  horizonDays = 7,
  safetyStockFactor = 1.2,
  asOf = new Date(),
  demandOverride?: MenuDemandPrediction[],
  closedDates: string[] = [],
): ForecastResult {
  if (!Number.isFinite(asOf.getTime())) throw new Error('Invalid forecast origin');
  const safeHorizonDays = Number.isFinite(horizonDays) && horizonDays > 0 ? Math.floor(horizonDays) : 7;
  const safeSafetyStockFactor = Number.isFinite(safetyStockFactor) && safetyStockFactor > 0 ? safetyStockFactor : 1;
  const calendarDates = getTargetDates(safeHorizonDays, asOf);
  const closed = new Set(validateClosedDates(closedDates));
  const targetDates = calendarDates.filter(date => !closed.has(dateKey(date)));
  if (demandOverride && targetDates.length > 0 && targetDates.length !== calendarDates.length) throw new Error('AI demand must be forecast for open dates only. Use the baseline for a mixed closure horizon.');
  const history = salesRecords.filter(record => {
    const time = toDate(record.sold_at);
    const observed = validCalendarDate(record.sold_at)
      ? record.sold_at < businessDateKey(asOf)
      : time && time.getTime() <= asOf.getTime();
    return observed && Number.isFinite(record.quantity_sold)
      && !closed.has(businessDateKey(record.sold_at)) && record.quantity_sold >= 0 && !/\b(refund(?:ed)?|void(?:ed)?|cancel(?:led|ed)?|return(?:ed)?)\b/i.test(record.transaction_type || '');
  });
  const activeMenuItems = menuItems.filter((menu) => menu.is_active !== false);
  const menuDemandPredictions = !targetDates.length ? activeMenuItems.map(menu => ({menuItemId:menu.id,menuItemName:menu.name,projectedUnits:0,confidence:'none' as const,recordsUsed:0,explanation:'Restaurant closed throughout this forecast period; no purchases suggested.'})) : demandOverride ?? activeMenuItems.map((menu) =>
    predictMenuDemandForHorizon(history, menu, targetDates),
  );
  const projectedDishUnits = new Map(
    menuDemandPredictions.map((prediction) => [prediction.menuItemId, prediction.projectedUnits]),
  );
  const requiredIngredientQty: Record<string, number> = {};
  const warnings = menuDemandPredictions
    .filter((prediction) => prediction.confidence === 'none' || prediction.confidence === 'low')
    .map((prediction) => prediction.explanation);
  const newest = Math.max(...history.map(r=>Date.parse(r.sold_at)));
  const blockingIssues:string[]=[];
  if (targetDates.length !== calendarDates.length) warnings.push(`${calendarDates.length-targetDates.length} closed day(s) excluded from purchasing demand. Dates use Detroit local time.`);
  if (Number.isFinite(newest) && asOf.getTime()-newest>14*DAY_MS) blockingIssues.push('Sales history is over 14 days old. Refresh POS data before approving purchases.');
  if (!history.length) blockingIssues.push('No observed sales history. Import sales before approving purchases.');

  activeMenuItems.forEach((menu) => {
    const projectedUnits = projectedDishUnits.get(menu.id) || 0;
    const observations = history.filter(row => normalizeName(row.item_name) === normalizeName(menu.name));
    if (!observations.length) blockingIssues.push(`${menu.name}: no sales observations. Import history or explicitly record a day with no sales before approval.`);

    if (!menu.recipes || menu.recipes.length === 0) {
      warnings.push(`No recipe mapped for ${menu.name}; cannot calculate ingredient needs.`);
      if(projectedUnits>0) blockingIssues.push(`Recipe missing for ${menu.name}.`);
      return;
    }

    menu.recipes.forEach((recipe) => {
      const ingredient = ingredients.find(i => i.id === recipe.ingredient_id);
      if (!ingredient) { blockingIssues.push('Missing ingredient for ' + menu.name); return; }
      let totalReq: number;
      try { totalReq = purchaseQuantity(recipe, ingredient, projectedUnits); }
      catch (error) { blockingIssues.push((error as Error).message); return; }
      requiredIngredientQty[recipe.ingredient_id] = (requiredIngredientQty[recipe.ingredient_id] || 0) + totalReq;
    });
  });

  const forecastLines: ForecastLine[] = [];
  const supplierOrdersMap: Record<string, Array<{ ingredient_name: string; order_qty: number; unit: string; unit_cost: number; subtotal: number }>> = {};
  let totalProjectedPurchaseCost = 0;

  ingredients.forEach((ingredient) => {
    if (!Number.isFinite(ingredient.current_stock) || ingredient.current_stock < 0 || !Number.isFinite(ingredient.cost_per_unit) || ingredient.cost_per_unit < 0) {
      blockingIssues.push(`${ingredient.name}: invalid stock or unit cost. Correct inventory before approval.`);
      return;
    }
    validateProcurement(ingredient.procurement);
    const rawPredictedUsage = requiredIngredientQty[ingredient.id] || 0;
    const exactUsageWithSafety = rawPredictedUsage * safeSafetyStockFactor;
    const predictedUsageWithSafety = roundQuantity(exactUsageWithSafety);
    const stockShortfall = exactUsageWithSafety - Number(ingredient.current_stock || 0);
    const pack=ingredient.procurement?.pack_size ?? 1;
    const recommendedOrderQty = stockShortfall > 0 ? Math.round(Math.max(1,Math.ceil(Number((stockShortfall/pack).toFixed(12))))*pack*1e6)/1e6 : 0;
    if (!ingredient.procurement?.pack_size && stockShortfall>0) warnings.push(`${ingredient.name}: supplier pack size unknown; quantity rounded to whole stock units. Confirm packaging.`);
    if ((ingredient.procurement?.lead_time_days??0)>safeHorizonDays) warnings.push(`${ingredient.name}: supplier lead time exceeds this forecast horizon; arrange earlier delivery or extend planning.`);
    if (ingredient.procurement?.shelf_life_days && safeHorizonDays>ingredient.procurement.shelf_life_days && recommendedOrderQty>0) warnings.push(`${ingredient.name}: order covers more than its configured planning shelf life. Split deliveries; verify lot dates and storage. This is not food-safety clearance.`);
    const totalEstCost = roundMoney(recommendedOrderQty * Number(ingredient.cost_per_unit || 0));

    totalProjectedPurchaseCost += totalEstCost;

    forecastLines.push({
      id: `fline_${ingredient.id}`,
      forecast_id: `fc_${tomorrowBusinessDate(asOf)}_${safeHorizonDays}`,
      ingredient_id: ingredient.id,
      ingredient_name: ingredient.name,
      unit: ingredient.unit,
      current_stock: ingredient.current_stock,
      predicted_usage: predictedUsageWithSafety,
      recommended_order_qty: recommendedOrderQty,
      unit_cost: ingredient.cost_per_unit,
      total_estimated_cost: totalEstCost,
      supplier_name: ingredient.supplier_name || 'General Supplier',
      pack_size: ingredient.procurement?.pack_size,
    });

    if (recommendedOrderQty > 0) {
      const supplier = ingredient.supplier_name || 'General Wholesale';
      if (!supplierOrdersMap[supplier]) {
        supplierOrdersMap[supplier] = [];
      }

      supplierOrdersMap[supplier].push({
        ingredient_name: ingredient.name,
        order_qty: recommendedOrderQty,
        unit: ingredient.unit,
        unit_cost: ingredient.cost_per_unit,
        subtotal: totalEstCost,
      });
    }
  });

  const generatedOrders: OrderNote[] = Object.keys(supplierOrdersMap).map((supplierName) => {
    const lines = supplierOrdersMap[supplierName];
    const totalAmount = lines.reduce((sum, line) => sum + line.subtotal, 0);
    const poSeed = `${supplierName}:${safeHorizonDays}:${lines.map((line) => `${line.ingredient_name}:${line.order_qty}`).join('|')}`;

    return {
      id: `po_${stableId(poSeed)}`,
      restaurant_id: ingredients[0]?.restaurant_id || 'rest_001',
      supplier_name: supplierName,
      po_number: `PO-BOT-${stableId(poSeed)}`,
      total_amount: roundMoney(totalAmount),
      status: 'Draft',
      created_at: asOf.toISOString(),
      lines,
    };
  });

  const totalProjectedMenuRevenue = menuDemandPredictions.reduce((sum, prediction) => {
    const menu = activeMenuItems.find((item) => item.id === prediction.menuItemId);
    return sum + prediction.projectedUnits * Number(menu?.selling_price || 0);
  }, 0);

  return {
    horizonDays: safeHorizonDays,
    totalProjectedSalesValue: roundMoney(totalProjectedPurchaseCost),
    totalProjectedMenuRevenue: roundMoney(totalProjectedMenuRevenue),
    totalProjectedMenuUnits: menuDemandPredictions.reduce((sum, prediction) => sum + prediction.projectedUnits, 0),
    lines: forecastLines,
    generatedOrders,
    menuDemandPredictions,
    warnings: [...new Set([...warnings,...blockingIssues])],
    blockingIssues: [...new Set(blockingIssues)],
  };
}
