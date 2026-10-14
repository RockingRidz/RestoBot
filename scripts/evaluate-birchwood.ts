// Reproduce the owner's synthetic fixture against the existing operational engine.
// No credentials, paid model calls, database writes, or current-stock deductions.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import Papa from 'papaparse';

process.env.NODE_ENV = 'test';
process.env.RESTOBOT_LOAD_ENV = 'false';
process.env.RESTOBOT_REQUIRE_AUTH = 'false';
process.env.RESTOBOT_RESTAURANT_ID = 'rest_demo_001';
process.env.RESTOBOT_RESTAURANT_NAME = 'Birchwood Kitchen & Bar';
process.env.RESTOBOT_LOCATION = 'Troy, Michigan';
for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'GEMINI_API_KEY']) delete process.env[key];

const [posPath, menuPath, outputPath] = process.argv.slice(2);
if (!posPath || !menuPath || !outputPath) throw new Error('Usage: tsx scripts/evaluate-birchwood.ts POS.txt MENU.json NEW_OUTPUT_DIRECTORY');
const lines = readFileSync(posPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
const footer = lines.findIndex(s => /^Showing the first \d+ rows$/i.test(s));
const cells = footer < 0 ? lines : lines.slice(0, footer);
const headers = ['id','restaurant_id','order_id','item_name','menu_item_id','quantity_sold','unit_price','total_amount','sold_at'];
assert.deepEqual(cells.slice(0, 9), headers, 'Unexpected vertical POS headers');
assert.equal((cells.length - 9) % 9, 0, 'Incomplete POS row');
const menus = JSON.parse(readFileSync(menuPath, 'utf8').replace(/^\uFEFF/, ''));
assert(Array.isArray(menus) && menus.length > 0);
const ids = new Set<string>();
const rows: any[] = [];
for (let i = 9; i < cells.length; i += 9) {
  const row: any = Object.fromEntries(headers.map((h, j) => [h, cells[i+j]]));
  assert(!ids.has(row.id), `Duplicate ID ${row.id}`); ids.add(row.id);
  assert.equal(row.restaurant_id, 'rest_demo_001');
  const menu = menus.find((m: any) => m.id === row.menu_item_id);
  assert(menu && menu.name === row.item_name, 'Menu reference mismatch');
  for (const field of ['quantity_sold','unit_price','total_amount']) { row[field] = Number(row[field]); assert(Number.isFinite(row[field]) && row[field] >= 0); }
  assert(Math.abs(row.quantity_sold * row.unit_price - row.total_amount) < 0.02);
  assert(/^2026-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(row.sold_at));
  // Supplied local dates are in May–July: Troy's daylight-saving offset is -04:00.
  row.sold_at += '-04:00';
  rows.push(row);
}
const dates = [...new Set(rows.map(r => r.sold_at.slice(0,10)))].sort();
const daily = rows.map(r => ({date:r.sold_at.slice(0,10), item_name:r.item_name, quantity:r.quantity_sold}));
const menuItems = menus.map((m: any) => ({...m, category:'Unspecified', is_active:true}));
const ingredientCsv = Papa.parse<Record<string,string>>(readFileSync(fileURLToPath(new URL('./birchwood-ingredients.csv', import.meta.url)),'utf8'),{header:true,skipEmptyLines:true});
assert.equal(ingredientCsv.errors.length,0);
const ingredients = ingredientCsv.data.map(i=>({id:i.id,restaurant_id:'rest_demo_001',name:i.name,unit:i.unit,cost_per_unit:Number(i.cost_per_unit),previous_cost_per_unit:Number(i.previous_cost_per_unit),current_stock:Number(i.current_stock_level),last_restocked:i.last_restocked,category:'Unspecified',min_threshold:0,supplier_name:'Unknown — not supplied'}));
assert.equal(ingredients.length,43);
for (const m of menuItems) for (const r of m.recipes) {
  const ing = ingredients.find(i=>i.id===r.ingredient_id); assert(ing);
  r.unit = ing.unit; r.id = `${m.id}_${r.ingredient_id}`; r.menu_item_id = m.id;
}
const truffleMenu = menuItems.find((m: any) => m.id === 'menu_007');
assert.equal(truffleMenu.recipes.find((r: any) => r.ingredient_id === 'ing_027').quantity_required, 0.4);
const truffle = { id:'ing_027', restaurant_id:'rest_demo_001', name:'Black Truffle (Fresh)', unit:'oz', cost_per_unit:19.5, previous_cost_per_unit:12 };
const expectedSubstitutes = [
  {substitute_id:'ing_042', substitute_name:'Truffle Oil', note:'Owner-provided: ~90% cheaper per portion; not independently costed'},
  {substitute_id:'ing_043', substitute_name:'Dried Porcini Mushroom', note:'Owner-provided: ~85% cheaper per portion; not independently costed'},
];
const { app } = await import('../server');
const { getMemorySnapshot } = await import('../src/lib/dataStore');
const { generateSmartPurchaseOrder } = await import('../src/lib/forecastEngine');
const { backtestDemand } = await import('../src/lib/backtest');
const { calculateMenuCostsAndMargins } = await import('../src/lib/marginEngine');
const snap = getMemorySnapshot();
snap.menuItems = menuItems;
snap.ingredients = []; // Missing on-hand stock and other costs stay unknown.
snap.salesRecords = [];
snap.marginAlerts = [];
const server = await new Promise<any>(resolve => { const s = app.listen(0,'127.0.0.1',()=>resolve(s)); });
let importResult: any, blockedImport: any, alertResult: any, repeatedImport: any;
try {
  const base = `http://127.0.0.1:${server.address().port}`;
  const csvData = Papa.unparse(rows);
  const postImport = async (importMode = 'operational') => { const r = await fetch(`${base}/api/ingest`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({csvData,importMode})}); return {status:r.status, body:await r.json()}; };
  blockedImport = await postImport();
  assert.equal(blockedImport.status, 422, 'Full recipe import must reject absent ingredients');
  assert.equal(snap.salesRecords.length, 0);
  // Sales-only test intentionally omits recipes to avoid deducting historical usage
  // from today's inventory. The complete supplied menu is restored afterward.
  snap.ingredients = ingredients;
  const countedStock = ingredients.map(i=>i.current_stock);
  importResult = await postImport('historical'); assert.equal(importResult.status,200);
  assert.equal(importResult.body.parsedCount,rows.length);
  repeatedImport = await postImport('historical'); assert.equal(repeatedImport.body.parsedCount,0);
  assert.equal(repeatedImport.body.duplicateCount,rows.length);
  snap.menuItems = menuItems;
  // Price detection reads only these known fields; no stock or supplier is invented.
  snap.ingredients = ingredients;
  assert.deepEqual(snap.ingredients.map(i=>i.current_stock),countedStock);
  alertResult = await (await fetch(`${base}/api/alerts`)).json();
} finally { await new Promise<void>((resolve,reject)=>server.close((e: any)=>e?reject(e):resolve())); }
const completeDates = dates.filter(date => daily.filter(r=>r.date===date).length === menuItems.length);
const lastComplete = completeDates.at(-1)!;
const asOf = new Date(`${lastComplete}T23:59:59.999Z`);
const history = snap.salesRecords.filter(r=>r.sold_at.slice(0,10)<=lastComplete);
const forecast = generateSmartPurchaseOrder(history, [], menuItems, 1, 1, asOf);
const testStart = new Date(Date.parse(lastComplete)-13*86400000).toISOString().slice(0,10);
const backtest = backtestDemand(daily.filter(r=>r.date<=lastComplete),testStart,1);
const alert = alertResult.data.find((a: any)=>a.affected_menu_item_id==='menu_007' && a.ingredient_id==='ing_027');
assert(alert); assert.equal(alert.increase_percent,62.5);
assert.deepEqual(alert.suggested_substitutes.map((s:any)=>s.ingredient_id).sort(),['ing_042','ing_043']);
assert(alert.suggested_substitutes.every((s:any)=>s.savings_per_portion===null));
const menuCosts = calculateMenuCostsAndMargins(menuItems,ingredients);
const risotto = menuCosts.find(m=>m.menuItem.id==='menu_007')!;
const beforeTruffle = calculateMenuCostsAndMargins([truffleMenu],ingredients.map(i=>i.id==='ing_027'?{...i,cost_per_unit:12}:i))[0];
assert.equal(Math.round((risotto.calculatedCost-beforeTruffle.calculatedCost)*100)/100,3);
const report = {
  fixture:'Synthetic Birchwood Kitchen & Bar — Troy, Michigan', realWorldAccuracyEvidence:false,
  coverage:{rows:rows.length, menuItems:menuItems.length,ingredients:ingredients.length, distinctDates:dates.length, firstDate:dates[0], lastDate:dates.at(-1), completeDates:completeDates.length, truncated:footer>=0, missingMenuDates:dates.flatMap(date=>menuItems.filter((m:any)=>!daily.some(r=>r.date===date && r.item_name===m.name)).map((m:any)=>({date,item:m.name})))},
  totals:{units:rows.reduce((s,r)=>s+r.quantity_sold,0), revenue:rows.reduce((s,r)=>s+r.total_amount,0)},
  import:{mode:'isolated memory API test; not uploaded to Supabase', fullRecipeImportStatus:blockedImport.status, fullRecipeImportFirstError:blockedImport.body.errors?.[0], salesOnlyImported:importResult.body.parsedCount, repeatImported:repeatedImport.body.parsedCount, repeatDuplicates:repeatedImport.body.duplicateCount},
  margin:{actualAlert:alert, costIncreasePerDish:(19.5-12)*0.4, marginDropPercentagePoints:3/truffleMenu.selling_price*100, completeDishMargin:{beforeTruffleSpikeCost:beforeTruffle.calculatedCost,beforeTruffleSpikeMargin:beforeTruffle.marginPercent,currentCost:risotto.calculatedCost,currentMargin:risotto.marginPercent,targetMargin:risotto.targetMarginPercent,healthy:risotto.isMarginHealthy}, substituteSuggestionsReturned:alert.suggested_substitutes ?? [], expectedSubstitutes, matches:{priceSpike:true, affectedMenu:true, substitutes:true}, monthlyLossCaveat:'No current recorded sales: financial impact is unavailable, not an invented monthly estimate.'},
  menuCosts,
  demandOnlyForecast:{asOf:asOf.toISOString(), targetDate:new Date(Date.parse(lastComplete)+86400000).toISOString().slice(0,10), predictions:forecast.menuDemandPredictions, totalUnits:forecast.totalProjectedMenuUnits, revenue:forecast.totalProjectedMenuRevenue},
  backtestSummary:{testStart,lastDate:lastComplete,candidate:backtest.candidate,weekdayBaseline:backtest.weekdayBaseline},
  limitations:['Owner confirms all data is fabricated.','Full 120-day export not received.','Recipe quantities assumed in their ingredient units. Supplier packs, reorder thresholds and substitute portion sizes are not supplied. min_threshold=0 is a technical default, not an owner-defined reorder threshold.','Fractional pcs values are preserved as supplied; whole-piece purchasing needs reconciliation.','Forecast uses the last complete supplied date, not September current operations. September stock is not mixed into July purchasing estimates.','No live AI answer or production import is claimed.'],
};
mkdirSync(outputPath, {recursive:false});
for (const [name,value] of Object.entries({'report.json':report,'menu.json':menuItems,'ingredients.json':ingredients,'sales-imported.json':snap.salesRecords,'pos-normalized.json':rows,'backtest.json':backtest,'truffle-scenario.json':{ingredient:truffle,expectedSubstitutes}})) writeFileSync(path.join(outputPath,name),JSON.stringify(value,null,2));
writeFileSync(path.join(outputPath,'pos-normalized.csv'),Papa.unparse(rows));
writeFileSync(path.join(outputPath,'daily.csv'),Papa.unparse(daily));
console.log(JSON.stringify(report,null,2));

