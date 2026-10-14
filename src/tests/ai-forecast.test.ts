import { describe, expect, it } from 'vitest';
import { validateAiDemand } from '../lib/aiForecast';
import { generateSmartPurchaseOrder } from '../lib/forecastEngine';
import type { MenuItem, Ingredient } from '../types';

const menus = [{ id: 'burger', name: 'Burger', selling_price: 10, is_active: true, recipes: [{ ingredient_id: 'bun', quantity_required: 1, unit: 'pcs' }] }] as MenuItem[];
const ingredients = [{ id: 'bun', name: 'Bun', unit: 'pcs', current_stock: 2, cost_per_unit: 0.5 }] as Ingredient[];
const prediction = { menuItemId: 'burger', projectedUnits: 20, explanation: 'Recent weekday demand; limited history.' };
describe('AI forecast data contract', () => {
  it.each([[], [{...prediction, menuItemId:'unknown'}], [{...prediction, projectedUnits:-1}], [{...prediction, projectedUnits:'20'}], [{...prediction, explanation:''}], [prediction,prediction]].map(predictions => ({predictions})))('rejects incomplete or invalid model output %j', ({predictions}) => {
    expect(() => validateAiDemand(JSON.stringify({predictions}), menus, [])).toThrow();
  });
  it('uses model units for revenue and recipe requirements, with recorded prices and stock', () => {
    const demand = validateAiDemand(JSON.stringify({predictions:[prediction]}), menus, []);
    const result = generateSmartPurchaseOrder([], ingredients, menus, 1, 1.1, new Date('2026-09-25T12:00:00Z'), demand);
    expect(result.totalProjectedMenuRevenue).toBe(200);
    expect(result.lines[0].predicted_usage).toBe(22);
    expect(result.lines[0].recommended_order_qty).toBe(20);
    expect(result.totalProjectedSalesValue).toBe(10);
    const changed = generateSmartPurchaseOrder([], ingredients, menus, 1, 1.1, new Date('2026-09-25T12:00:00Z'), [{...demand[0],projectedUnits:40}]);
    expect(changed.totalProjectedMenuRevenue).toBe(400);
    expect(changed.totalProjectedSalesValue).toBe(21);
  });
});
