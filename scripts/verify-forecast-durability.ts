// Creates one uniquely identified forecast, reads it from a fresh process, then removes it.
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
dotenv.config({ path: '.env.local', quiet: true });
if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_URL) throw new Error('Live database configuration required');
const { getAdminClient } = await import('../src/lib/supabaseAdmin');
const store = await import('../src/lib/dataStore');
const { saveForecast } = await import('../src/lib/forecastStore');
const { generateSmartPurchaseOrder } = await import('../src/lib/forecastEngine');
const [stage, marker] = process.argv.slice(2);
if (stage) {
  await store.loadAll(false);
  const client = getAdminClient()!;
  if (stage === 'write') {
    const origin = new Date('2026-09-25T12:00:00Z');
    const forecast = generateSmartPurchaseOrder([],[],[],2,1.1,origin);
    forecast.warnings.push(marker);
    const saved = await saveForecast(forecast,1.1,origin);
    const { error } = await client.from('forecasts').update({ forecast_summary: marker }).eq('id', saved.id).eq('restaurant_id',store.getAccountProfile().restaurantId);
    if (error) throw new Error('Could not label test forecast');
  } else if (stage === 'read') {
    const { data, error } = await client.from('forecasts').select('*').eq('restaurant_id',store.getAccountProfile().restaurantId).eq('forecast_summary', marker).single();
    assert.ifError(error);
    assert.equal(data.target_date,'2026-09-26');
    assert.equal(data.forecast_explanation.result.horizonDays,2);
    assert.equal(data.forecast_explanation.safetyBuffer,1.1);
    assert.ok(data.forecast_explanation.result.warnings.includes(marker));
  } else throw new Error('Unknown stage');
} else {
  await store.loadAll(false);
  const label = `forecast-durability-${randomUUID()}`;
  try {
    for (const step of ['write','read']) {
      const child = spawnSync(process.execPath,['--import','tsx',fileURLToPath(import.meta.url),step,label],{ encoding:'utf8',timeout:45000 });
      if (child.status !== 0) throw new Error(`Forecast ${step} verification failed; check database schema/connectivity`);
    }
    console.log('PASS: exact forecast snapshot survived a fresh Node process.');
  } finally {
    const { error } = await getAdminClient()!.from('forecasts').delete().eq('restaurant_id',store.getAccountProfile().restaurantId)
      .contains('forecast_explanation', { result: { warnings: [label] } });
    if (error) throw new Error(`Test forecast cleanup failed: ${label}`);
    console.log('Test forecast removed.');
  }
}
