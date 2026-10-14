import { describe, expect, it } from 'vitest';
import { buildApproval } from '../lib/orderApproval';
import type { ForecastResult } from '../lib/forecastEngine';

const forecast = { lines: [{id:'a',ingredient_name:'Bun',recommended_order_qty:20,unit_cost:0.5,unit:'pcs',supplier_name:'Bakery'}] } as ForecastResult;
describe('Order approval snapshot', () => {
  it('rejects partial supplier packs but allows whole packs or exclusion',()=>{
    const packed={...forecast,lines:forecast.lines.map(line=>({...line,pack_size:6,recommended_order_qty:24}))};
    expect(()=>buildApproval(packed,'f',{a:25},'Event',null)).toThrow(/whole number/);
    expect(buildApproval(packed,'f',{a:30},'Event',null).totalAmount).toBe(15);
  });
  it('rejects non-finite costs rather than approving an unpriced order',()=>{
    const bad={...forecast,lines:forecast.lines.map(line=>({...line,unit_cost:NaN}))};
    expect(()=>buildApproval(bad,'f',{a:20},'',null)).toThrow(/costs/);
  });
  it('records original quantities, owner edits, identity and server-calculated costs', () => {
    const result = buildApproval(forecast,'forecast-1',{a:30},'Weekend event','owner-1','2026-09-25T12:00:00Z');
    expect(result.totalAmount).toBe(15);
    expect(result.lines[0]).toMatchObject({suggested_qty:20,approved_qty:30,approved_by:'owner-1',forecast_id:'forecast-1',edit_reason:'Weekend event'});
    expect(forecast.lines[0].recommended_order_qty).toBe(20);
    expect(result.noteText).toContain('Bun: 30 pieces');
  });
  it.each([{a:30},{a:0},{a:-1},{a:'20'},{a:Infinity},{a:20,b:4},{}])('rejects missing reasons, invalid quantities and unknown ingredients %j', quantities => {
    expect(()=>buildApproval(forecast,'f',quantities,'',null)).toThrow();
  });
  it('allows unchanged approval without an edit reason',()=>{
    expect(buildApproval(forecast,'f',{a:20},'',null).totalAmount).toBe(10);
  });
});
