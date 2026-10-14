import { Ingredient, MenuItem, SalesRecord } from '../types';
import { generateSmartPurchaseOrder } from './forecastEngine';
import { detectSupplierPriceCreeps } from './marginEngine';


export interface PriceSpikeAlert {
  detected: boolean;
  originalIngredient: string;
  priceIncreasePct: number;
  recommendedSubstitute: string;
  estimatedMarginSavingsUSD: number;
  confidenceScorePct: number;
  culinaryReasoning: string;
  kitchenPrepTip: string;
  supplierName?: string;
  supplierPhone?: string;
}

export interface VendorDispatchNote {
  vendorName: string;
  items: Array<{ itemName: string; packQuantity: string }>;
}

export interface GeneratedOrderResult {
  priceSpikeAlerts: PriceSpikeAlert[];
  priceSpikeAlert: PriceSpikeAlert;
  vendorDispatchNotes: VendorDispatchNote[];
  formattedSmsText: string;
  forecastSummary: {
    horizonDays: number;
    totalProjectedMenuUnits: number;
    totalProjectedMenuRevenue: number;
    linesToOrder: number;
  };
  _mode: 'rule_engine' | 'gemini';
  aiVerification?: {
    status: 'verified' | 'warning' | 'rejected';
    summary: string;
    auditLog: string[];
  };
}

const SPIKE_THRESHOLD_PCT = 10;

function emptyStableAlert(): PriceSpikeAlert {
  return {
    detected: false,
    originalIngredient: '',
    priceIncreasePct: 0,
    recommendedSubstitute: '',
    estimatedMarginSavingsUSD: 0,
    confidenceScorePct: 0,
    culinaryReasoning: 'Prices are stable relative to baseline.',
    kitchenPrepTip: 'Proceed with baseline vendors.',
  };
}

function buildSubstituteAlerts(ingredients: Ingredient[],menus:MenuItem[],sales:SalesRecord[]):PriceSpikeAlert[] {
  return detectSupplierPriceCreeps(ingredients,menus,sales).map(alert=>({
    detected:true,originalIngredient:alert.ingredient_name,priceIncreasePct:alert.increase_percent,
    recommendedSubstitute:(alert.suggested_substitutes||[]).map(s=>s.name).join(' / '),
    estimatedMarginSavingsUSD:0,confidenceScorePct:0,
    culinaryReasoning:alert.suggested_action+' Alternatives are for chef review; no order savings are asserted.',
    kitchenPrepTip:'Keep the original order until the chef verifies portions and explicitly updates the recipe. No one-for-one swap was applied.',
  }));
}
function formatPackQuantity(qty: number, unit: string): string {
  const rounded = qty >= 10 ? Math.ceil(qty) : Math.round(qty * 10) / 10;
  return `${rounded} ${unit}`;
}

export function generateDailyOrderFromData(params: {
  closedDates?: string[];
  salesRecords: SalesRecord[];
  ingredients: Ingredient[];
  menuItems: MenuItem[];
  restaurantName: string;
  horizonDays?: number;
  safetyBuffer?: number;
  acceptedSubstitutes?: boolean;
  demandMultiplier?: number;
}): GeneratedOrderResult {
  const { salesRecords, ingredients, menuItems, restaurantName, horizonDays = 1, safetyBuffer = 1.1, acceptedSubstitutes = false, demandMultiplier = 1 } = params;
  const safeMultiplier = Number.isFinite(demandMultiplier) && demandMultiplier > 0 ? demandMultiplier : 1;
  const effectiveSafety = safetyBuffer * safeMultiplier;

  const forecast = generateSmartPurchaseOrder(salesRecords, ingredients, menuItems, horizonDays, effectiveSafety, new Date(), undefined, params.closedDates);
  const spikeAlerts = buildSubstituteAlerts(ingredients,menuItems,salesRecords);
  const detected = spikeAlerts.filter((a) => a.detected);
  const priceSpikeAlerts = detected.length > 0 ? detected : [emptyStableAlert()];

  let linesToOrder = forecast.lines.filter((l) => l.recommended_order_qty > 0);
  if (forecast.blockingIssues?.length) throw new Error(forecast.blockingIssues.join('; '));

  const vendorMap = new Map<string, VendorDispatchNote>();
  for (const line of linesToOrder) {
    let itemName = line.ingredient_name;
    let vendorName = line.supplier_name || 'Primary Wholesaler';
    if (!vendorMap.has(vendorName)) vendorMap.set(vendorName, { vendorName, items: [] });
    vendorMap.get(vendorName)!.items.push({ itemName, packQuantity: formatPackQuantity(line.recommended_order_qty, line.unit) });
  }

  const vendorDispatchNotes = Array.from(vendorMap.values());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const deliveryLabel = tomorrow.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  let formattedSmsText: string;
  if (vendorDispatchNotes.length === 0) {
    formattedSmsText = `No items need ordering for ${deliveryLabel}.\n\nOrder Placed By: ${restaurantName}`;
  } else {
    formattedSmsText = vendorDispatchNotes.map((v) => {
      const items = v.items.map((i) => `- ${i.itemName}: ${i.packQuantity}`).join('\n');
      return `TO: ${v.vendorName}\n${items}`;
    }).join('\n\n');
    formattedSmsText += `\n\nTarget Delivery Date: ${deliveryLabel}\nOrder Placed By: ${restaurantName}`;
  }



  return {
    priceSpikeAlerts,
    priceSpikeAlert: priceSpikeAlerts[0] || emptyStableAlert(),
    vendorDispatchNotes,
    formattedSmsText,
    forecastSummary: {
      horizonDays: forecast.horizonDays,
      totalProjectedMenuUnits: forecast.totalProjectedMenuUnits,
      totalProjectedMenuRevenue: forecast.totalProjectedMenuRevenue,
      linesToOrder: linesToOrder.length,
    },
    _mode: 'rule_engine',
  };
}
