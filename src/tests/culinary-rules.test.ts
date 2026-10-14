import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {purchaseQuantity,suggestCulinarySubstitutes} from '../lib/culinaryKnowledge';
import {calculateMenuCostsAndMargins,detectSupplierPriceCreeps} from '../lib/marginEngine';
import {convertQuantity,processSalesIngestion} from '../lib/ingestion';
import {generateSmartPurchaseOrder} from '../lib/forecastEngine';
import {buildApproval} from '../lib/orderApproval';
import type {Ingredient,MenuItem} from '../types';
const ingredients=JSON.parse(readFileSync('birchwood-fixture-2026-09-27/ingredients.json','utf8')) as Ingredient[];
const menus=JSON.parse(readFileSync('birchwood-fixture-2026-09-27/menu.json','utf8')) as MenuItem[];
const risotto=menus.find(m=>m.id==='menu_007')!;
const truffle=ingredients.find(i=>i.id==='ing_027')!;
describe('Reviewed culinary behavior',()=>{
 it('connects the supplied truffle alternatives without inventing portion savings',()=>{
  const alert=detectSupplierPriceCreeps(ingredients,menus).find(a=>a.ingredient_id===truffle.id)!;
  expect(alert.increase_percent).toBe(62.5);expect(alert.cost_increase_per_dish).toBe(3);
  expect(alert.loss_available).toBe(false);expect(alert.estimated_monthly_loss).toBe(0);
  expect(alert.suggested_substitutes?.map(s=>s.name)).toEqual(['Truffle Oil','Dried Porcini Mushroom']);
  expect(alert.suggested_substitutes?.every(s=>s.savings_per_portion===null)).toBe(true);
  expect(alert.suggested_action).not.toContain('$900');
 });
 it('preserves the actual above-target risotto margin',()=>{
  const cost=calculateMenuCostsAndMargins([risotto],ingredients)[0];
  expect(cost.calculatedCost).toBe(11.38);expect(cost.marginPercent).toBe(59.4);expect(cost.isMarginHealthy).toBe(true);
 });
 it('blocks structural and sensitive-dish substitutes',()=>{
  expect(suggestCulinarySubstitutes(truffle,{...risotto,name:'Truffle souffle'},ingredients)).toEqual([]);
  const structural={...risotto,recipes:risotto.recipes!.map(r=>({...r,culinary_role:'structural' as const}))};
  expect(suggestCulinarySubstitutes(truffle,structural,ingredients)).toEqual([]);
 });
 it('requires a verified replacement portion, using the replacement unit, not a truffle-to-oil conversion',()=>{
  const menu=structuredClone(risotto),r=menu.recipes!.find(r=>r.ingredient_id===truffle.id)!;
  // Arbitrary test-only quantity, NOT a culinary recommendation.
  r.substitutes=[{ingredient_id:'ing_042',replacement_quantity:0.1,replacement_unit:'fl_oz',chef_verified:false}];
  expect(suggestCulinarySubstitutes(truffle,menu,ingredients)[0].savings_per_portion).toBeNull();
  Object.assign(r.substitutes[0],{chef_verified:true,verified_by:'Test Chef',verified_at:'2026-09-27'});
  expect(suggestCulinarySubstitutes(truffle,menu,ingredients)[0].savings_per_portion).toBe(7.62);
  r.substitutes[0].replacement_unit='oz';
  expect(suggestCulinarySubstitutes(truffle,menu,ingredients)[0].savings_per_portion).toBeNull();
 });
 it('converts fluid ounces without equating volume with mass',()=>{
  expect(convertQuantity(128,'fl_oz','gal')).toBeCloseTo(1);
  expect(()=>convertQuantity(1,'oz','fl_oz')).toThrow();
 });
 it('uses the same edible-yield quantity for margin, forecasting and stock deductions',()=>{
  const ing={...ingredients[0],id:'yield-test',unit:'kg',cost_per_unit:10,current_stock:10,procurement:{pack_size:2.5}};
  const recipe={id:'r',menu_item_id:'yield-menu',ingredient_id:ing.id,quantity_required:200,unit:'g',quantity_basis:'edible' as const,yield_percent:80};
  const menu={...risotto,id:'yield-menu',name:'Yield test',recipes:[recipe]};
  expect(purchaseQuantity(recipe,ing)).toBeCloseTo(0.25);
  expect(calculateMenuCostsAndMargins([menu],[ing])[0].calculatedCost).toBe(2.5);
  const imported=processSalesIngestion('item_name,quantity,unit_price,date\nYield test,4,28,2026-09-26','test',[ing],[menu]);
  expect(imported.errors).toEqual([]);expect(imported.updatedIngredients[0].current_stock).toBe(9);
  const forecast=generateSmartPurchaseOrder([], [{...ing,current_stock:0}], [menu],1,1,new Date('2026-09-27'),[{menuItemId:menu.id,menuItemName:menu.name,projectedUnits:12,recordsUsed:1,confidence:'low',explanation:'fixture'}]);
  expect(forecast.lines[0].predicted_usage).toBe(3);expect(forecast.lines[0].recommended_order_qty).toBe(5);
  expect(purchaseQuantity({...recipe,quantity_basis:'as_purchased'},ing)).toBe(0.2);
  expect(()=>purchaseQuantity({...recipe,yield_percent:undefined},ing)).toThrow(/yield/);
 });
 it('does not call missing-ingredient costs a healthy margin',()=>{
  const cost=calculateMenuCostsAndMargins([risotto],[])[0];
  expect(cost.complete).toBe(false);expect(cost.isMarginHealthy).toBe(false);expect(Number.isNaN(cost.calculatedCost)).toBe(true);
 });
 it('blocks approval of a partial purchase calculation with missing yield',()=>{
   const menu={...risotto,recipes:risotto.recipes!.map(r=>({...r,quantity_basis:'edible' as const,yield_percent:undefined}))};
   const result=generateSmartPurchaseOrder([],ingredients,[menu],1,1,new Date('2026-09-27'),[{menuItemId:menu.id,menuItemName:menu.name,projectedUnits:10,recordsUsed:0,confidence:'low',explanation:'test'}]);
   expect(result.blockingIssues?.some(s=>s.includes('yield'))).toBe(true);
   expect(()=>buildApproval(result,'test',{},'',null)).toThrow(/Resolve forecast issues/);
 });
 it('accepts all 1200 rows and suppresses all duplicates; there is no 500-row importer cap',()=>{
  const csv='order_id,item_name,quantity,unit_price,date\n'+Array.from({length:1200},(_,i)=>`o-${i},Fixture,1,2,2026-09-26`).join('\n');
  const first=processSalesIngestion(csv,'test');expect(first.errors).toEqual([]);expect(first.parsedCount).toBe(1200);
  const repeat=processSalesIngestion(csv,'test',[],[],first.salesRecords);expect(repeat.parsedCount).toBe(0);expect(repeat.duplicateCount).toBe(1200);
 });
});
