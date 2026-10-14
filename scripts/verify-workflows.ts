// Opt-in live round trip: creates uniquely named records, tests a fresh process,
// and removes only those records in a finally block.
import dotenv from 'dotenv';
import {zeroSalesRecords} from '../src/lib/zeroSales';
import { randomUUID, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
dotenv.config({ path: '.env.local', quiet: true });
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Live Supabase configuration required');
const store = await import('../src/lib/dataStore');
const { getAdminClient } = await import('../src/lib/supabaseAdmin');
const { processSalesIngestion } = await import('../src/lib/ingestion');
const [stage, ingredientId, label, sourceId] = process.argv.slice(2);
const runDate = '2026-09-24';
if (stage === 'write') {
  await store.loadAll(false);
  const rid = store.getAccountProfile().restaurantId;
  const ingredient = await store.upsertIngredient({ id: ingredientId, restaurant_id: rid, name: label,
    category: 'Verification', unit: 'kg', current_stock: 10, min_threshold: 0, cost_per_unit: 2, supplier_name: 'Test only', procurement: {pack_size: 2, lead_time_days: 1, shelf_life_days: 5} });
  const menu = await store.saveRecipe({ id: '', restaurant_id: rid, name: `${label} bread`, category: 'Verification',
    selling_price: 5, target_margin_percent: 60, is_active: true,
    recipes: [{ id: '', menu_item_id: '', ingredient_id: ingredient.id, quantity_required: 250, unit: 'g', quantity_basis: 'edible', yield_percent: 50, culinary_role: 'bulk', substitutes: [] }] });
  const renamed = await store.saveRecipe({ ...menu, name: `${label} renamed` });
  assert.equal(renamed.id, menu.id);
  await store.saveRecipe({ ...renamed, name: menu.name });
  const invalidName = `${label} invalid`;
  await assert.rejects(store.saveRecipe({ ...menu, id: '', name: invalidName,
    recipes: [{ id: '', menu_item_id: '', ingredient_id: randomUUID(), quantity_required: 1, unit: 'kg' }] }));
  const { data: partialRecipe } = await getAdminClient()!.from('menu_items').select('id').eq('restaurant_id', rid).eq('name', invalidName).maybeSingle();
  assert.equal(partialRecipe, null, 'Failed recipe transaction must roll back its menu row');
  const csv = `order_id,date,item_name,quantity,unit_price\n${label},${runDate},${menu.name},2,5`;
  const preview = processSalesIngestion(csv, rid, store.listIngredients(), store.listMenuItems(), store.listSales());
  assert.equal(preview.errors.length, 0);
  assert.equal(preview.salesRecords.length, 1);
  assert.equal(preview.salesRecords[0].id, sourceId);
  const first = await store.commitSalesImport(preview.salesRecords);
  assert.equal(first.inserted, 1);
  const repeat = await store.commitSalesImport(preview.salesRecords);
  assert.equal(repeat.inserted, 0);
  assert.equal(repeat.duplicates, 1);
  const zeroRows=zeroSalesRecords('2026-09-23',[menu.id],rid,store.listMenuItems(),store.listSales());
  assert.equal((await store.commitSalesImport(zeroRows,false)).inserted,1);
  assert.equal((await store.commitSalesImport(zeroRows,false)).inserted,0);
  await store.recordWaste({ ingredient_id: ingredient.id, unit: 'kg', quantity: 0.5, reason: 'Verification only' });
  assert.equal(store.listIngredients().find(i => i.id === ingredient.id)?.current_stock, 8.5);
  console.log(JSON.stringify({ menuId: menu.id }));
} else if (stage === 'read') {
  await store.loadAll(false);
  const rid = store.getAccountProfile().restaurantId;
  assert.deepEqual(store.listIngredients().find(i => i.id === ingredientId)?.procurement, {pack_size:2,lead_time_days:1,shelf_life_days:5});
  assert.equal(store.listMenuItems().find(m => m.name === `${label} bread`)?.recipes?.[0]?.yield_percent, 50);
  assert.equal(store.listIngredients().find(i => i.id === ingredientId)?.current_stock, 8.5);
  assert.equal(store.listMenuItems().find(m => m.name === `${label} bread`)?.recipes?.[0]?.quantity_required, 250);
  assert.ok(store.listSales().some(s => s.id === sourceId));
  assert.ok(store.listSales().some(s => s.item_name === `${label} bread` && s.quantity_sold === 0 && s.transaction_type === 'zero_sales'));
  assert.ok(store.listWaste().some(w => w.ingredient_name === label && w.quantity === 0.5));
  const csv = `order_id,date,item_name,quantity,unit_price\n${label},${runDate},${label} bread,2,5`;
  const again = processSalesIngestion(csv, rid, store.listIngredients(), store.listMenuItems(), []);
  const replay = await store.commitSalesImport(again.salesRecords);
  assert.equal(replay.inserted, 0);
  assert.equal(replay.duplicates, 1);
  assert.equal(store.listIngredients().find(i => i.id === ingredientId)?.current_stock, 8.5);
  console.log('PASS: culinary metadata, packaging, recipe, sales, yield-adjusted idempotent deduction, waste, explicit zero sales, and stock survived a fresh process.');
} else {
  await store.loadAll(false);
  const rid = store.getAccountProfile().restaurantId;
  const id = randomUUID();
  const name = `workflow-check-${id}`;
  const csv = `order_id,date,item_name,quantity,unit_price\n${name},${runDate},${name} bread,2,5`;
  const source = processSalesIngestion(csv, rid, [], [], []).salesRecords[0].id;
  const saleHash = createHash('md5').update(source).digest('hex');
  const saleId = `${saleHash.slice(0,8)}-${saleHash.slice(8,12)}-${saleHash.slice(12,16)}-${saleHash.slice(16,20)}-${saleHash.slice(20)}`;
  let completed = false;
  try {
    for (const step of ['write', 'read']) {
      const child = spawnSync(process.execPath, [...(fileURLToPath(import.meta.url).endsWith('.ts') ? ['--import','tsx'] : []), fileURLToPath(import.meta.url), step, id, name, source],
        { encoding: 'utf8', timeout: 60000 });
      if (child.status !== 0) throw new Error(`${step} failed: ${(child.stderr || child.stdout).slice(-500)}`);
      if (step === 'read') process.stdout.write(child.stdout);
    }
    completed = true;
  } finally {
    const db = getAdminClient()!;
    for (const [table, field, value] of [
      ['sales_records','id',saleId], ['sales_records','menu_item_name',`${name} bread`], ['waste_entries','ingredient_name',name],
      ['menu_items','name',`${name} bread`], ['menu_items','name',`${name} invalid`], ['ingredients','id',id],
    ]) {
      const { error } = await db.from(table).delete().eq(field, value).eq('restaurant_id', rid);
      if (error) throw new Error(`Cleanup failed for ${table}: ${error.message}`);
    }
    console.log('Verification records removed.');
  }
  if (!completed) throw new Error('Workflow verification did not complete');
}
