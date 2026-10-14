import Papa from 'papaparse';
import { Ingredient, SalesRecord, MenuItem } from '../types';
import { businessDateKey, localSaleTimestamp, validCalendarDate } from './businessDate';

/**
 * DATA SHIELD LAYER
 * Prevents "Nightmare CSVs" from breaking the AI by detecting outliers and typos.
 */
export function sanitizeIngredientData(rawRows: any[], historicalData?: Ingredient[]): Ingredient[] {
  return rawRows.map((row, index) => {
    // 1. Filter out DO NOT USE or TEST rows
    const name = String(row.Ingredient_Name || '').trim();
    if (!name || /do not use|test|fake|demo/i.test(name)) {
      return null;
    }

    // 2. Robust Number Parsing (Strips $, commas, and whitespace)
    const parseNum = (val: any) => {
      if (val === null || val === undefined || val === '' || String(val).toUpperCase() === 'NULL') return 0;
      const cleaned = String(val).replace(/[$,\s]/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    };

    // 3. Unit Normalization
    const normalizeUnit = (unit: string) => {
      const u = String(unit || '').toLowerCase().trim();
      if (/lbs?|pound/i.test(u)) return 'lb';
      if (/gal|gallon/i.test(u)) return 'gal';
      if (/kg|kilogram/i.test(u)) return 'kg';
      if (/cs|case/i.test(u)) return 'case';
      if (/oz|ounce/i.test(u)) return 'oz';
      return u;
    };

    const stock = parseNum(row.Stock_Qty);
    const cost = parseNum(row.Unit_Cost_USD);
    const par = parseNum(row.Par_Level);

    // 4. ANOMALY DETECTION (The Shield)
    let isAnomaly = false;
    if (historicalData) {
      const history = historicalData.find(h => h.name.toLowerCase() === name.toLowerCase());
      if (history && history.cost_per_unit > 0) {
        const ratio = cost / history.cost_per_unit;
        if (ratio > 5 || ratio < 0.2) {
          isAnomaly = true;
        }
      }
    }

    return {
      id: `ing_${index}_${Date.now()}`,
      name: name,
      category: String(row.Category || 'Uncategorized').trim(),
      current_stock: stock < 0 ? 0 : stock,
      unit: normalizeUnit(row.Unit),
      cost_per_unit: cost,
      min_threshold: par || 10,
      supplier_name: String(row.Supplier || 'General Supplier').trim(),
      restaurant_id: 'rest_001',
    };
  }).filter(row => row !== null) as Ingredient[];
}

export interface SalesIngestionResult {
  parsedCount: number;
  duplicateCount: number;
  salesRecords: SalesRecord[];
  updatedIngredients: Ingredient[];
  deductedIngredientsSummary: Array<{ ingredient_name: string; deducted_qty: number; unit: string; new_stock: number }>;
  errors: string[];
  warnings: string[];
}

export { convertQuantity } from './units';
import { purchaseQuantity } from './culinaryKnowledge';

// Pure preview: callers commit sales and updated stock together only when errors is empty.
export function processSalesIngestion(csvText: string, restaurantId = 'rest_001', ingredients: Ingredient[] = [], menuItems: MenuItem[] = [], existingSales: SalesRecord[] = []): SalesIngestionResult {
  const result: SalesIngestionResult = { parsedCount: 0, duplicateCount: 0, salesRecords: [], updatedIngredients: ingredients.map(i => ({ ...i })), deductedIngredientsSummary: [], errors: [], warnings: [] };
  const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: 'greedy', transformHeader: h => h.trim().toLowerCase().replace(/\s+/g, '_') });
  result.errors.push(...parsed.errors.map(e => `CSV row ${(e.row ?? 0) + 2}: ${e.message}`));
  if (!parsed.data.length) result.errors.push('CSV contains no sales rows');
  const seen = new Set(existingSales.map(s => s.id));
  const occurrences = new Map<string, number>();
  const deductions = new Map<string, number>();
  parsed.data.forEach((row, index) => {
    try {
      const disposition = [row.transaction_type, row.status, row.refund_status, row.void_status].filter(Boolean).join(' ');
      if (/\b(refund(?:ed)?|void(?:ed)?|cancel(?:led|ed)?|return(?:ed)?)\b/i.test(disposition)) {
        throw new Error('Refunds, returns and voids require owner reconciliation; no stock or sales were changed');
      }
      const item = (row.item_name || row.menu_item_name || '').trim();
      const date = (row.sold_at || row.transaction_date || row.date || '').trim();
      const quantityText = (row.quantity_sold ?? row.quantity ?? '').trim();
      const quantity = Number(quantityText);
      if (!item || !date || !quantityText || !Number.isFinite(quantity) || quantity <= 0) throw new Error('Item, date and a positive quantity are required');
      if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(date)) throw new Error('Use an ISO date (YYYY-MM-DD)');
      const time = (row.time || '00:00:00').trim();
      const calendarDate = date.slice(0, 10);
      if (!validCalendarDate(calendarDate)) throw new Error('Invalid sale date');
      if (!date.includes('T') && calendarDate >= businessDateKey(new Date())) throw new Error('Date-only sales rows require a completed Detroit business day; include a timestamp for current-day sales');
      const explicitOffset = /(?:Z|[+-]\d{2}:\d{2})$/i.test(date);
      const soldAt = new Date(explicitOffset ? date : localSaleTimestamp(calendarDate, date.includes('T') ? date.slice(11) : time));
      if (!Number.isFinite(soldAt.getTime())) throw new Error('Invalid sale date');
      const money = (v: string) => Number(v.replace(/[$,\s]/g, ''));
      const totalText = row.gross_sales ?? row.total_amount;
      const priceText = row.unit_price;
      if ((priceText == null || priceText.trim() === '') && (totalText == null || totalText.trim() === '')) throw new Error('unit_price or gross_sales/total_amount is required');
      const price = priceText?.trim() ? money(priceText) : money(totalText!) / quantity;
      const total = totalText?.trim() ? money(totalText) : price * quantity;
      if (![price, total].every(n => Number.isFinite(n) && n >= 0)) throw new Error('Prices must be finite and non-negative');
      if (Math.abs(price * quantity - total) > 0.02) throw new Error('Quantity × unit_price does not match total amount');
      const orderId = (row.order_id || '').trim();
      const identity = JSON.stringify([restaurantId, orderId, soldAt.toISOString(), item.toLowerCase(), quantity, price, total]);
      const occurrence = (occurrences.get(identity) || 0) + 1;
      occurrences.set(identity, occurrence);
      const id = `csv:${identity}:${occurrence}`;
      if (seen.has(id)) { result.duplicateCount++; return; }
      seen.add(id);
      result.salesRecords.push({ id, restaurant_id: restaurantId, order_id: orderId || `row-${index + 2}`, item_name: item, category: row.category, quantity_sold: quantity, unit_price: price, total_amount: total, sold_at: soldAt.toISOString(), transaction_type: row.transaction_type, received_by: row.received_by });
      const menu = menuItems.find(m => m.name.trim().toLowerCase() === item.toLowerCase());
      if (!menu?.recipes?.length) { result.warnings.push(`${item}: no recipe mapping; stock was not deducted`); return; }
      for (const recipe of menu.recipes) {
        const ingredient = ingredients.find(i => i.id === recipe.ingredient_id);
        if (!ingredient) throw new Error(`Missing ingredient for ${item}`);
        if (!Number.isFinite(recipe.quantity_required) || recipe.quantity_required < 0) throw new Error(`Invalid recipe quantity for ${item}`);
        const used = purchaseQuantity(recipe, ingredient, quantity);
        deductions.set(ingredient.id, (deductions.get(ingredient.id) || 0) + used);
      }
    } catch (error) { result.errors.push(`Row ${index + 2}: ${(error as Error).message}`); }
  });
  if (result.errors.length) { result.salesRecords = []; return result; }
  result.parsedCount = result.salesRecords.length;
  for (const ingredient of result.updatedIngredients) {
    const used = deductions.get(ingredient.id);
    if (used == null) continue;
    if (used > ingredient.current_stock) result.warnings.push(`${ingredient.name}: recorded usage exceeds stock on hand`);
    ingredient.current_stock = Math.max(0, Math.round((ingredient.current_stock - used) * 1e6) / 1e6);
    result.deductedIngredientsSummary.push({ ingredient_name: ingredient.name, deducted_qty: used, unit: ingredient.unit, new_stock: ingredient.current_stock });
  }
  return result;
}

