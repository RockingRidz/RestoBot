import {describe,it,expect} from 'vitest';
import {buildSyntheticFixture} from '../../scripts/syntheticFixture';
import {generateSmartPurchaseOrder} from '../lib/forecastEngine';
describe('Large synthetic owner-workflow fixture',()=>{
 it('provides complete, reconciled recent history and actionable recipe/pack orders',()=>{
  const f=buildSyntheticFixture('restaurant','2026-09-29');
  expect(f.sales).toHaveLength(15120);
  expect(new Set(f.sales.map(s=>s.id)).size).toBe(f.sales.length);
  expect(new Set(f.sales.map(s=>s.sold_at.slice(0,10))).size).toBe(180);
  expect(f.sales.every(s=>s.total_amount===s.quantity_sold*s.unit_price&&s.metadata?.synthetic)).toBe(true);
  expect(f.sales.at(-1)!.sold_at<'2026-09-29').toBe(true);
  const forecast=generateSmartPurchaseOrder(f.sales,f.ingredients,f.menuItems,1,1.1,new Date('2026-09-29T15:00:00Z'));
  expect(forecast.blockingIssues).toEqual([]);
  expect(forecast.generatedOrders.length).toBeGreaterThan(0);
  expect(forecast.lines.every(l=>Number.isFinite(l.recommended_order_qty))).toBe(true);
 });
 it('keeps overlapping sales identities stable on later runs and separates tenants',()=>{
  const first=buildSyntheticFixture('one','2026-09-29',2),next=buildSyntheticFixture('one','2026-09-30',2),other=buildSyntheticFixture('two','2026-09-29',2);
  const overlap=first.sales.filter(s=>s.sold_at.startsWith('2026-09-28'));
  expect(next.sales.filter(s=>s.sold_at.startsWith('2026-09-28'))).toEqual(overlap);
  expect(other.ingredients[0].id).not.toBe(first.ingredients[0].id);
 });
});
