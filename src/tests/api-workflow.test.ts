import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { saveForecast } from '../lib/forecastStore';
import type { ForecastResult } from '../lib/forecastEngine';
import { openTestServer } from './testServer';
import { tomorrowBusinessDate } from '../lib/businessDate';
let server: Awaited<ReturnType<typeof openTestServer>>;
async function request(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(server.url + path, { method, headers:{'Content-Type':'application/json'}, body:body === undefined ? undefined : JSON.stringify(body) });
  return { status:response.status, body:await response.json() };
}
beforeAll(async () => { server = await openTestServer(); });
afterAll(async () => { await server?.close(); });
describe('Operational API contract', () => {
  it('restores a current AI snapshot but invalidates it after stock changes',async()=>{
    const ingredient={id:'freshness-test',name:'Freshness stock',unit:'kg',current_stock:1,min_threshold:0,cost_per_unit:2,supplier_name:'Mill'};
    await request('/api/ingredients','POST',ingredient);
    const saved=await saveForecast({source:'ai',modelUsed:'test-model',horizonDays:1,lines:[{id:'line',recommended_order_qty:2,unit_cost:2}],totalProjectedMenuUnits:2} as unknown as ForecastResult,1,new Date());
    expect((await request('/api/forecasts/current')).body.data.savedForecastId).toBe(saved.id);
    await request('/api/ingredients','POST',{...ingredient,current_stock:3});
    expect((await request('/api/forecasts/current')).body.data).toBeNull();
    expect((await request('/api/orders/approve','POST',{forecastId:saved.id,quantities:{line:2}})).status).toBe(409);
    await request('/api/ingredients/freshness-test','DELETE');
  });
  it('imports 1200 historical rows without changing counted stock', async()=>{
    const before=(await request('/api/ingredients')).body.data;
    const csvData='order_id,item_name,quantity,unit_price,date\n'+Array.from({length:1200},(_,i)=>`history-${i},History fixture,1,1,2026-09-01`).join('\n');
    const result=await request('/api/ingest','POST',{csvData,importMode:'historical'});
    expect(result.status).toBe(200);expect(result.body.parsedCount).toBe(1200);
    expect((await request('/api/ingredients')).body.data).toEqual(before);
    const repeat=await request('/api/ingest','POST',{csvData,importMode:'historical'});
    expect(repeat.body.parsedCount).toBe(0);expect(repeat.body.duplicateCount).toBe(1200);
    expect((await request('/api/ingest','POST',{csvData,importMode:'unknown'})).status).toBe(400);
  });
  it('rejects missing culinary context instead of inventing a substitute or savings',async()=>{
    expect((await request('/api/ai/substitute-evaluation','POST',{priceAlert:{ingredient_at_risk:'Unknown'}})).status).toBe(422);
    const result=await request('/api/ai/format-daily-note','POST',{});
    expect(result.status).toBe(503);expect(JSON.stringify(result.body)).not.toContain('135 customers');
    expect((await request('/api/knowledge')).body.version).toBe('2026-09-27.1');
  });
  it('saves approval history from a server forecast and prevents rewriting it', async () => {
    const candidates = [{id:'approval-test-line',ingredient_name:'Bun',recommended_order_qty:20,unit_cost:0.5,unit:'pcs',supplier_name:'Bakery'}];
    const saved = await saveForecast({horizonDays:1,totalProjectedMenuUnits:20,lines:candidates} as ForecastResult,1.1,new Date());
    const forecast = {body:{savedForecastId:saved.id}};
    expect(candidates.length).toBeGreaterThan(0);
    const quantities = Object.fromEntries(candidates.map((l:any)=>[l.id,l.recommended_order_qty+1]));
    const input = {forecastId:forecast.body.savedForecastId,quantities,reason:'Extra stock for event'};
    expect((await request('/api/orders/approve','POST',{...input,reason:''})).status).toBe(400);
    const approved = await request('/api/orders/approve','POST',input);
    expect(approved.status).toBe(201);
    expect(approved.body.data.status).toBe('Approved');
    expect(approved.body.data.lines[0].approved_qty).toBe(candidates[0].recommended_order_qty+1);
    const exportInput={approvalId:approved.body.data.id,noteText:'tampered',channel:'clipboard',requestId:randomUUID()};
    const exported = await request('/api/orders/send','POST',exportInput);
    expect(exported.status).toBe(201);
    expect(exported.body.data.status).toBe('Copy requested');
    expect((await request('/api/orders/send','POST',exportInput)).body.data.id).toBe(exported.body.data.id);
    expect((await request('/api/orders/send','POST',{...exportInput,channel:'email'})).status).toBe(400);
    const printed=await request('/api/orders/send','POST',{...exportInput,channel:'print'});
    expect(printed.body.data.status).toBe('Print requested');
    const copied=await request('/api/orders/'+exported.body.data.id+'/status','PATCH',{status:'Copied'});
    expect(copied.body.data.lines[0].status_history[0].status).toBe('Copied');
    expect((await request('/api/orders/'+exported.body.data.id+'/status','PATCH',{status:'Delivered'})).body.data.status).toBe('Delivered');
    expect((await request('/api/orders/'+exported.body.data.id+'/status','PATCH',{status:'Copied'})).status).toBe(409);
    expect(exported.body.data.note_text).toBe(approved.body.data.note_text);
    expect(exported.body.data.lines[0].approval_id).toBe(approved.body.data.id);
    expect((await request(`/api/orders/${approved.body.data.id}/status`,'PATCH',{status:'Delivered'})).status).toBe(409);
    const history = await request('/api/orders/history');
    expect(history.body.data.find((r:any)=>r.id===approved.body.data.id).lines[0].edit_reason).toBe(input.reason);
    expect((await request('/api/orders/approve','POST',{...input,forecastId:'missing'})).status).toBe(404);
  });
  it('does not substitute demo predictions when AI is not configured', async () => {
    const result = await request('/api/ai/forecast', 'POST', {});
    expect(result.status).toBe(503);
    expect(result.body.error).toMatch(/AI forecast unavailable/);
    expect(result.body.totalProjectedMenuRevenue).toBeUndefined();
  });
  it('keeps deterministic forecasts available with AI usage disabled', async () => {
    const health = await request('/api/health');
    expect(health.body.aiUsage.enabled).toBe(false);
    const forecast = await request('/api/forecast', 'POST', {horizonDays:1,safetyBuffer:1.1});
    expect(forecast.status).toBe(200);
    expect(forecast.body.source).toBe('rule_engine');
    expect(forecast.body.targetDate).toBeTruthy();
    expect((await request('/api/forecasts/current')).body.data.savedForecastId).toBe(forecast.body.savedForecastId);
  });
  it('saves supplier contacts and rejects unsupported contact methods', async () => {
    const contact = { name: 'Workflow Supplier', contact_method: 'email', contact_value: 'workflow@example.invalid' };
    expect((await request('/api/supplier-contacts','POST',contact)).status).toBe(201);
    const updated = await request('/api/supplier-contacts','POST',{ ...contact, contact_value: 'updated@example.invalid' });
    expect(updated.body.data.contact_value).toBe('updated@example.invalid');
    const list = (await request('/api/supplier-contacts')).body.data.filter((row:any) => row.name === contact.name);
    expect(list).toHaveLength(1);
    expect(list[0].contact_value).toBe('updated@example.invalid');
    expect((await request('/api/supplier-contacts','POST',{...contact,contact_method:'unknown'})).status).toBe(400);
  });
  it('requires a verified Supabase session for production API routes', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect((await request('/api/ingredients')).status).toBe(401);
      expect((await request('/api/health')).status).toBe(401);
      expect((await request('/healthz')).status).toBe(200);
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous;
    }
  });
  it('exposes actual collection metrics and JSON 404 errors', async () => {
    const health = await request('/api/health');
    const ingredients = await request('/api/ingredients');
    expect(health.status).toBe(200);
    expect(health.body.metrics.totalIngredients).toBe(ingredients.body.data.length);
    expect((await request('/api/unknown')).status).toBe(404);
  });
  it('saves inventory/recipe, imports sales once, forecasts and logs waste', async () => {
    const ingredient = { id:'workflow-flour', name:'Workflow Flour', unit:'kg', category:'Dry', current_stock:10, min_threshold:1, cost_per_unit:2, supplier_name:'Mill' };
    expect((await request('/api/ingredients','POST',ingredient)).status).toBe(200);
    const menu = { id:'workflow-bread', name:'Workflow Bread', category:'Bakery', selling_price:5, target_margin_percent:60, is_active:true, recipes:[{id:'r',menu_item_id:'workflow-bread',ingredient_id:ingredient.id,quantity_required:250,unit:'g'}] };
    expect((await request('/api/recipes','POST',menu)).status).toBe(200);
    const csvData = 'order_id,date,item_name,quantity,unit_price\na,2026-09-22,Workflow Bread,2,5';
    const first = await request('/api/ingest','POST',{csvData});
    expect(first.body.parsedCount).toBe(1);
    expect(first.body.deductedIngredientsSummary[0].new_stock).toBe(9.5);
    const second = await request('/api/ingest','POST',{csvData});
    expect(second.body.duplicateCount).toBe(1);
    const forecast = await request('/api/forecast','POST',{horizonDays:1,safetyBuffer:1});
    expect(forecast.status).toBe(200); expect(forecast.body.menuDemandPredictions.some((p:any) => p.menuItemName === menu.name)).toBe(true);
    const history = await request('/api/forecasts/history');
    expect(history.body.data.find((row:any) => row.id === forecast.body.savedForecastId).forecast_explanation.result.lines).toEqual(forecast.body.lines);
    expect((await request('/api/waste','POST',{ingredient_id:ingredient.id,unit:'kg',quantity:0.5,reason:'Spoiled / Expired'})).status).toBe(200);
    const stock = (await request('/api/ingredients')).body.data.find((i:any) => i.id === ingredient.id);
    expect(stock.current_stock).toBe(9);
    expect((await request(`/api/ingredients/${ingredient.id}`,'DELETE')).status).toBe(409);
    expect((await request(`/api/recipes/${menu.id}`,'DELETE')).status).toBe(200);
    expect((await request(`/api/ingredients/${ingredient.id}`,'DELETE')).status).toBe(200);
  });
  it('rejects invalid writes without importing demo sales', async () => {
    expect((await request('/api/ingest','POST',{})).status).toBe(400);
    expect((await request('/api/ingest','POST',{csvData:'date,item_name,quantity,unit_price\n,Bread,2,5'})).status).toBe(422);
    expect((await request('/api/ingredients','POST',{name:'Bad',unit:'kg',current_stock:-1,min_threshold:1,cost_per_unit:2})).status).toBe(400);
    expect((await request('/api/forecast','POST',{horizonDays:0})).status).toBe(400);
  });
  it('rejects exports without an approval',async()=>{
    expect((await request('/api/orders/send','POST',{noteText:'Flour: 2 kg',channel:'clipboard',requestId:randomUUID()})).status).toBe(400);
    expect((await request('/api/orders/missing/status','PATCH',{status:'Delivered'})).status).toBe(404);
  });
  it('sets an owner PIN once and rejects the old default', async () => {
    expect((await request('/api/account/initial-setup','POST',{restaurantName:'Test Kitchen',pin:'12ab'})).status).toBe(400);
    expect((await request('/api/account/initial-setup','POST',{restaurantName:'Test Kitchen',pin:'8392'})).status).toBe(200);
    expect((await request('/api/account/verify-pin','POST',{pin:'1234'})).status).toBe(401);
    expect((await request('/api/account/verify-pin','POST',{pin:'8392'})).status).toBe(200);
    expect((await request('/api/account/initial-setup','POST',{restaurantName:'Other Kitchen',pin:'1111'})).status).toBe(409);
    expect((await request('/api/account/profile')).body.setupComplete).toBe(true);
    const date=tomorrowBusinessDate();
    const saved=await saveForecast({source:'ai',horizonDays:1,lines:[],totalProjectedMenuUnits:1} as unknown as ForecastResult,1,new Date());
    expect((await request('/api/forecasts/current')).body.data.savedForecastId).toBe(saved.id);
    expect((await request('/api/account/setup','POST',{pin:'wrong',closedDates:[date]})).status).toBe(401);
    expect((await request('/api/account/setup','POST',{pin:'8392',closedDates:['2026-02-30'],retrainAi:false})).status).toBe(400);
    expect((await request('/api/account/setup','POST',{pin:'8392',closedDates:[date,'2026-09-01'],retrainAi:false})).status).toBe(200);
    expect((await request('/api/account/profile')).body.accountProfile.closedDates).toContain(date);
    expect((await request('/api/forecasts/current')).body.data).toBeNull();
    expect((await request('/api/forecast','POST',{horizonDays:1,safetyBuffer:1})).body.totalProjectedMenuUnits).toBe(0);
    expect((await request('/api/sales/zero-day','POST',{date:'2026-09-01',menuItemIds:['any']})).status).toBe(400);
    await request('/api/account/setup','POST',{pin:'8392',closedDates:[],retrainAi:false});

  });
});
