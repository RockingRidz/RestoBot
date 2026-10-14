import { readFileSync, writeFileSync } from 'node:fs';
import Papa from 'papaparse';
import { backtestDemand } from '../src/lib/backtest';

const [input, testStart, output, horizon = '1'] = process.argv.slice(2);
if (!input || !testStart || !output) throw new Error('Usage: npm run backtest -- daily.csv YYYY-MM-DD report.json [horizonDays]');
const csv = Papa.parse<Record<string,string>>(readFileSync(input, 'utf8'), { header: true, skipEmptyLines: 'greedy', transformHeader: h => h.trim() });
if (csv.errors.length) throw new Error(csv.errors.map(error => error.message).join('; '));
for (const column of ['date', 'item_name', 'quantity']) if (!csv.meta.fields?.includes(column)) throw new Error(`Missing column: ${column}`);
const rows = csv.data.map(row => ({ date: row.date.trim(), item_name: row.item_name.trim(), quantity: row.quantity?.trim() ? Number(row.quantity) : NaN }));
const report = backtestDemand(rows, testStart, Number(horizon));
if (!report.results.length) throw new Error('No evaluable windows. Supply matching-weekday history and confirmed test observations.');
writeFileSync(output, JSON.stringify(report, null, 2), { flag: 'wx' });
console.log(`Evaluated ${report.results.length} item/horizon windows; skipped ${report.skippedWindows}. Report: ${output}`);
