import { describe, expect, it } from 'vitest';
import { generateSmartPurchaseOrder } from '../lib/forecastEngine';
import type { Ingredient, MenuItem, SalesRecord } from '../types';

const ingredients: Ingredient[] = [
  {
    id: 'ing_bun',
    restaurant_id: 'rest_1',
    name: 'Bun',
    category: 'Bakery',
    unit: 'pcs',
    current_stock: 0,
    min_threshold: 10,
    cost_per_unit: 0.5,
    supplier_name: 'Bakery Co',
  },
];

const menuItems: MenuItem[] = [
  {
    id: 'menu_burger',
    restaurant_id: 'rest_1',
    name: 'Burger',
    category: 'Entree',
    selling_price: 10,
    target_margin_percent: 65,
    is_active: true,
    recipes: [
      {
        id: 'rec_bun',
        menu_item_id: 'menu_burger',
        ingredient_id: 'ing_bun',
        ingredient_name: 'Bun',
        quantity_required: 1,
        unit: 'pcs',
      },
    ],
  },
];

function sale(id: string, sold_at: string, item_name = 'Burger', quantity_sold = 10): SalesRecord {
  return {
    id,
    restaurant_id: 'rest_1',
    order_id: id,
    item_name,
    unit_price: 10,
    quantity_sold,
    total_amount: quantity_sold * 10,
    sold_at,
  };
}

describe('generateSmartPurchaseOrder accurate backend forecast', () => {
  it('rounds supplier packs from exact demand, never from rounded display quantities',()=>{
    const ingredient={...ingredients[0],unit:'kg',current_stock:0.1,procurement:{pack_size:0.05}};
    const menu={...menuItems[0],recipes:[{...menuItems[0].recipes![0],quantity_required:0.14,unit:'kg'}]};
    const result=generateSmartPurchaseOrder([sale('fraction','2026-09-18T12:00:00Z','Burger',1)],[ingredient],[menu],1,1,new Date('2026-09-24T23:59:59Z'));
    expect(result.lines[0].recommended_order_qty).toBe(0.05);
  });
  it('converts a hand-calculated 250 g recipe into 5 kg demand and a 3 kg shortfall', () => {
    const flour = { ...ingredients[0], unit: 'kg', current_stock: 2, cost_per_unit: 2 };
    const bread = { ...menuItems[0], recipes: [{ ...menuItems[0].recipes![0], quantity_required: 250, unit: 'g' }] };
    const result = generateSmartPurchaseOrder([sale('past','2026-09-18T12:00:00Z','Burger',20)], [flour], [bread], 1, 1, new Date('2026-09-24T23:59:59Z'));
    expect(result.lines[0]).toMatchObject({ predicted_usage: 5, recommended_order_qty: 3, total_estimated_cost: 6 });
  });
  it('excludes future and refund records and includes explicitly confirmed zero days', () => {
    const result = generateSmartPurchaseOrder([
      sale('past','2026-09-11T12:00:00Z','Burger',10),
      sale('zero','2026-09-18T12:00:00Z','Burger',0),
      sale('future','2026-09-25T12:00:00Z','Burger',1000),
      { ...sale('refund','2026-09-18T12:00:00Z','Burger',1000), transaction_type: 'Refund' },
    ], ingredients, menuItems, 1, 1, new Date('2026-09-24T23:59:59Z'));
    expect(result.totalProjectedMenuUnits).toBe(5);
  });
  it('does not invent demand when a menu item has no sales history', () => {
    const result = generateSmartPurchaseOrder([], ingredients, menuItems, 7, 1);

    expect(result.menuDemandPredictions[0].projectedUnits).toBe(0);
    expect(result.menuDemandPredictions[0].confidence).toBe('none');
    expect(result.lines[0].predicted_usage).toBe(0);
    expect(result.lines[0].recommended_order_qty).toBe(0);
    expect(result.generatedOrders.length).toBe(0);
    expect(result.warnings[0]).toContain('projected 0 instead of guessing');
  });

  it('uses real sales history instead of the old default 15 units', () => {
    const result = generateSmartPurchaseOrder(
      [sale('sale_1', '2026-07-29T12:00:00Z', 'Burger', 4)],
      ingredients,
      menuItems,
      1,
      1,
    );

    expect(result.menuDemandPredictions[0].projectedUnits).toBe(4);
    expect(result.menuDemandPredictions[0].projectedUnits).not.toBe(15);
    expect(result.menuDemandPredictions[0].confidence).toBe('low');
  });
});


describe('Closure calendar purchasing', () => {
  const origin = new Date('2026-09-24T23:59:59Z');
  it('excludes closed target days without treating missing dates as zero', () => {
    const rows = [sale('fri','2026-09-18T12:00:00Z','Burger',20),sale('sat','2026-09-19T12:00:00Z','Burger',40)];
    const result = generateSmartPurchaseOrder(rows,ingredients,menuItems,2,1,origin,undefined,['2026-09-25']);
    expect(result.totalProjectedMenuUnits).toBe(40);
    expect(result.lines[0].recommended_order_qty).toBe(40);
    expect(result.warnings.join(' ')).toMatch(/1 closed day/);
  });
  it('never buys for a fully closed horizon, even if AI suggests demand', () => {
    const result = generateSmartPurchaseOrder([sale('a','2026-09-18','Burger',20)],ingredients,menuItems,1,1,origin,[{menuItemId:'menu_burger',menuItemName:'Burger',projectedUnits:100,confidence:'low',recordsUsed:1,explanation:'test'}],['2026-09-25']);
    expect(result.totalProjectedMenuUnits).toBe(0);
    expect(result.lines[0].recommended_order_qty).toBe(0);
    expect(result.generatedOrders).toEqual([]);
  });
  it('excludes historical closed days from the demand sample', () => {
    const rows=[sale('closed','2026-09-18','Burger',100),sale('open','2026-09-11','Burger',20)];
    expect(generateSmartPurchaseOrder(rows,ingredients,menuItems,1,1,origin,undefined,['2026-09-18']).totalProjectedMenuUnits).toBe(20);
  });
});

describe('Detroit business dates', () => {
  it('keeps late UTC sales on their Detroit day and targets local tomorrow', () => {
    const origin = new Date('2026-10-03T02:00:00Z'); // October 2, 10 PM in Detroit
    const rows = [sale('fri', '2026-09-26T01:30:00Z', 'Burger', 7)]; // Friday in Detroit
    const result = generateSmartPurchaseOrder(rows, ingredients, menuItems, 1, 1, origin);
    expect(result.lines[0].forecast_id).toContain('2026-10-03');
    expect(result.totalProjectedMenuUnits).toBe(7);
  });
});
