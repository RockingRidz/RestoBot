// Launch only the synthetic Troy fixture, without reading or writing Supabase.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
// Load only server-side AI settings. Fixture storage remains isolated from Supabase.
const appDirectory = fileURLToPath(new URL('../', import.meta.url));
for (const filename of ['.env.local', '.env']) {
  const envPath = path.join(appDirectory, filename);
  if (!existsSync(envPath)) continue;
  const values = dotenv.parse(readFileSync(envPath));
  for (const key of ['GEMINI_API_KEY', 'GEMINI_MODEL']) {
    if (!process.env[key]?.trim() && values[key]?.trim()) process.env[key] = values[key];
  }
}
process.env.NODE_ENV = 'test';
process.env.RESTOBOT_LOAD_ENV = 'false';
process.env.RESTOBOT_REQUIRE_AUTH = 'false';
process.env.HOST = '127.0.0.1';
process.env.PORT ||= '3001';
process.env.DISABLE_HMR = 'true';
process.env.RESTOBOT_RESTAURANT_ID = 'rest_demo_001';
process.env.RESTOBOT_RESTAURANT_NAME = 'Birchwood Kitchen & Bar — SYNTHETIC TEST';
process.env.RESTOBOT_LOCATION = 'Troy, Michigan';
for (const key of ['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY']) delete process.env[key];
const fixture = process.argv[2] ? path.resolve(process.argv[2]) : path.join(appDirectory, 'birchwood-fixture-2026-09-27');
const read = (name: string) => JSON.parse(readFileSync(path.join(fixture,name),'utf8'));
const { getMemorySnapshot } = await import('../src/lib/dataStore');
const { startServer } = await import('../server');
const snapshot = getMemorySnapshot();
snapshot.ingredients = read('ingredients.json');
snapshot.menuItems = read('menu.json');
snapshot.salesRecords = read('sales-imported.json');
snapshot.marginAlerts = [];
console.log('Synthetic Troy fixture: 499 sales, 10 menus, 43 ingredients. Stock is preserved; history is incomplete. Changes are memory-only.');
console.log(`Gemini configured: ${!!process.env.GEMINI_API_KEY?.trim()}. Forecast and assistant requests use the configured AI service.`);
await startServer();
