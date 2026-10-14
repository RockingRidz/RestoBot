// Manual diagnostic; automated assertions live in src/tests/ingestion.test.ts.
import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import { sanitizeIngredientData } from './ingestion';
const file = path.resolve(process.cwd(), 'chaos_inventory.csv');
const parsed = Papa.parse<Record<string, string>>(fs.readFileSync(file, 'utf8'), { header: true, skipEmptyLines: true });
if (parsed.errors.length) throw new Error(JSON.stringify(parsed.errors));
const ingredients = sanitizeIngredientData(parsed.data);
console.log({ inputRows: parsed.data.length, acceptedRows: ingredients.length });
console.table(ingredients.map(i => ({ name: i.name, stock: i.current_stock, unit: i.unit, cost: i.cost_per_unit })));
