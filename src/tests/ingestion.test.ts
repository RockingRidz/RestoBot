import { describe, it, expect } from 'vitest';
import { processSalesIngestion } from '../lib/ingestion';
import { businessDateKey } from '../lib/businessDate';
import type { Ingredient, MenuItem } from '../types';
const ingredients: Ingredient[] = [{ id:'flour', restaurant_id:'r', name:'Flour', category:'Dry', unit:'kg', current_stock:10, min_threshold:1, cost_per_unit:2, supplier_name:'Mill' }];
const menus: MenuItem[] = [{ id:'bread', restaurant_id:'r', name:'Bread, large', category:'Bakery', selling_price:5, target_margin_percent:60, is_active:true, recipes:[{id:'recipe',menu_item_id:'bread',ingredient_id:'flour',quantity_required:250,unit:'g'}] }];
const csv = 'order_id,transaction_date,menu_item_name,quantity_sold,gross_sales\na,2026-09-22,"Bread, large",2,10';
describe('Sales import contract', () => {
  it.each(['Refund', 'Voided', 'Cancelled', 'Returned'])('blocks %s rows before they can deduct inventory', disposition => {
    const input = `date,item_name,quantity,unit_price,status\n2026-09-22,"Bread, large",2,5,${disposition}`;
    const result = processSalesIngestion(input, 'r', ingredients, menus);
    expect(result.errors.join()).toContain('owner reconciliation');
    expect(result.salesRecords).toEqual([]);
    expect(result.updatedIngredients).toEqual(ingredients);
  });
  it('maps named columns, quoted names and grams to stock kilograms without mutating inputs', () => {
    const result = processSalesIngestion(csv,'r',ingredients,menus);
    expect(result.errors).toEqual([]);
    expect(result.salesRecords[0]).toMatchObject({ item_name:'Bread, large', quantity_sold:2, unit_price:5, total_amount:10 });
    expect(result.updatedIngredients[0].current_stock).toBe(9.5);
    expect(ingredients[0].current_stock).toBe(10);
  });
  it('interprets date-only POS rows as Detroit local midnight', () => {
    const result = processSalesIngestion(csv, 'r', ingredients, menus);
    expect(result.salesRecords[0].sold_at).toBe('2026-09-22T04:00:00.000Z');
  });
  it('rejects current-day date-only totals that may be incomplete', () => {
    const today = businessDateKey(new Date());
    const result = processSalesIngestion(`date,item_name,quantity,unit_price\n${today},Bread,2,5`,'r',ingredients,menus);
    expect(result.errors.join(' ')).toContain('completed Detroit business day');
  });
  it('reimporting the same rows does not deduct stock twice', () => {
    const first = processSalesIngestion(csv,'r',ingredients,menus);
    const again = processSalesIngestion(csv,'r',first.updatedIngredients,menus,first.salesRecords);
    expect(again.parsedCount).toBe(0); expect(again.duplicateCount).toBe(1);
    expect(again.updatedIngredients[0].current_stock).toBe(9.5);
  });
  it.each(['', '2026-02-30', 'yesterday'])('rejects missing or invalid date %s atomically', date => {
    const result = processSalesIngestion(csv + `\nb,${date},Bread,2,10`,'r',ingredients,menus);
    expect(result.errors.length).toBeGreaterThan(0); expect(result.salesRecords).toEqual([]);
    expect(result.updatedIngredients).toEqual(ingredients);
  });
  it('rejects mismatched money and unsupported recipe units', () => {
    expect(processSalesIngestion('date,item_name,quantity,unit_price,total_amount\n2026-09-22,Bread,2,5,8').errors.length).toBeGreaterThan(0);
    const badMenus = [{...menus[0],recipes:[{...menus[0].recipes![0],unit:'case'}]}];
    expect(processSalesIngestion(csv,'r',ingredients,badMenus).errors.join()).toContain('Cannot convert');
  });
});
