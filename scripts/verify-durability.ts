// Explicit opt-in live check. Creates only uniquely named test records and removes them.
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
dotenv.config({ path: '.env.local', quiet: true });
if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_URL) throw new Error('Live database configuration is required');
const store = await import('../src/lib/dataStore');
const { getAdminClient } = await import('../src/lib/supabaseAdmin');
const [stage, id, label] = process.argv.slice(2);
if (stage) {
  await store.loadAll(false);
  if (stage === 'write') {
    await store.upsertIngredient({ id, name: label, restaurant_id: store.getAccountProfile().restaurantId,
      category: 'Verification', unit: 'kg', current_stock: 9.5, min_threshold: 0, cost_per_unit: 2, supplier_name: 'Test only' });
    await store.createOrderNote({ noteText: label, status: 'Draft' });
  } else if (stage === 'read') {
    const ingredient = store.listIngredients().find(i => i.id === id);
    assert.equal(ingredient?.current_stock, 9.5);
    assert.equal(ingredient?.unit, 'kg');
    assert.ok(store.listOrderNotes().some(o => o.note_text === label && o.status === 'Draft'));
  } else throw new Error('Unknown verification stage');
} else {
  const testId = randomUUID();
  const testLabel = `durability-check-${testId}`;
  try {
    for (const step of ['write', 'read']) {
      const child = spawnSync(process.execPath, ['--import', 'tsx', fileURLToPath(import.meta.url), step, testId, testLabel], { encoding: 'utf8', timeout: 45000 });
      if (child.status !== 0) throw new Error(`Durability ${step} failed (${child.error?.message || 'see database configuration/schema'})`);
    }
    console.log('PASS: ingredient stock/unit and order draft survived a fresh Node process.');
  } finally {
    const client = getAdminClient()!;
    const restaurantId = store.getAccountProfile().restaurantId;
    for (const [table, field, value] of [['ingredients', 'id', testId], ['order_notes', 'note_text', testLabel]]) {
      const { error } = await client.from(table).delete().eq(field, value).eq('restaurant_id', restaurantId);
      if (error) throw new Error(`Test record cleanup failed for ${table}: ${testLabel}`);
    }
    console.log('Test records removed.');
  }
}
