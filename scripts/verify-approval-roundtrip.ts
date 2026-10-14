// Opt-in live database test. Only uniquely identified verification records are removed.
import '../loadEnv';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as store from '../src/lib/dataStore';
import {getAdminClient} from '../src/lib/supabaseAdmin';
import {saveForecast, listForecastHistory} from '../src/lib/forecastStore';
import {buildApproval} from '../src/lib/orderApproval';
import {buildExport} from '../src/lib/orderExport';
import type {ForecastResult} from '../src/lib/forecastEngine';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_URL) throw new Error('Live database configuration required');
await store.loadAll(false);
const db = getAdminClient()!;
const rid = store.getAccountProfile().restaurantId;
if (process.argv[2] === 'read') {
  const ids = JSON.parse(process.argv[3]);
  const forecast = (await listForecastHistory()).find(row => row.id === ids.forecast);
  assert.ok(forecast, 'Forecast must survive restart');
  const approval = store.listOrderNotes().find(row => row.id === ids.approval)!;
  const copied = store.listOrderNotes().find(row => row.id === ids.copy)!;
  const printed = store.listOrderNotes().find(row => row.id === ids.print)!;
  assert.equal(approval.status, 'Approved');
  assert.equal(approval.lines[0].suggested_qty, 4);
  assert.equal(approval.lines[0].approved_qty, 6);
  assert.equal(approval.lines[0].edit_reason, 'Verification only');
  assert.equal(copied.status, 'Copied');
  assert.equal(copied.lines[0].approval_id, approval.id);
  assert.equal(copied.lines[0].status_history[0].status, 'Copied');
  assert.equal(printed.status, 'Print requested');
  const replay = await store.createOrderNote(buildExport(approval,'clipboard',null,ids.request));
  assert.equal(replay.id, copied.id);
  assert.equal(replay.status, 'Copied', 'Retry must not reset completed exports');
  console.log('PASS: forecast, edited approval, export audit and idempotent retry survive a fresh process.');
} else {
  const ids: Record<string,string> = {request: randomUUID(), approval: randomUUID()};
  const label = `Verification only ${ids.request}`;
  try {
    const result = {horizonDays:1,totalProjectedMenuUnits:4,lines:[{id:'verification-line',ingredient_name:label,unit:'kg',supplier_name:'Verification only',recommended_order_qty:4,unit_cost:2,pack_size:2}]} as ForecastResult;
    ids.forecast = (await saveForecast(result,1,new Date())).id;
    const approval = await store.createOrderNote({...buildApproval(result,ids.forecast,{'verification-line':6},'Verification only',null),id:ids.approval});
    const copy = buildExport(approval,'clipboard',null,ids.request);
    const print = buildExport(approval,'print',null,ids.request);
    ids.copy=copy.id;ids.print=print.id;
    const concurrent = await Promise.all([store.createOrderNote(copy),store.createOrderNote(copy)]);
    assert.equal(concurrent[0].id, concurrent[1].id);
    await store.updateOrderNoteStatus(ids.copy,'Copied');
    await store.createOrderNote(print);
    const file=fileURLToPath(import.meta.url);
    const child=spawnSync(process.execPath,[...(file.endsWith('.ts')?['--import','tsx']:[]),file,'read',JSON.stringify(ids)],{encoding:'utf8',timeout:60000});
    if(child.status!==0) throw new Error('Fresh-process approval verification failed: '+child.stderr.slice(-1000));
    process.stdout.write(child.stdout);
  } finally {
    for (const id of [ids.copy,ids.print,ids.approval].filter(Boolean)) {
      const {error}=await db.from('order_notes').delete().eq('restaurant_id',rid).eq('id',id);
      if(error) throw new Error('Verification order cleanup failed');
    }
    if(ids.forecast) {
      const {error}=await db.from('forecasts').delete().eq('restaurant_id',rid).eq('id',ids.forecast);
      if(error) throw new Error('Verification forecast cleanup failed');
    }
    console.log('Verification records removed. This service-role check does not prove browser authentication.');
  }
}
