import { generateSmartPurchaseOrder } from './forecastEngine';
import type { MenuItem, SalesRecord } from '../types';

export type DailyObservation = { date: string; item_name: string; quantity: number };
const DAY = 86400000;
const key = (name: string) => name.trim().toLowerCase();

/** Input is an owner-confirmed daily panel; absent days are unknown, never implicit zeroes. */
export function backtestDemand(observations: DailyObservation[], testStart: string, horizonDays = 1) {
  const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
  if (!validDate(testStart)) throw new Error('testStart must be an ISO calendar date');
  if (!Number.isInteger(horizonDays) || horizonDays < 1 || horizonDays > 31) throw new Error('horizonDays must be 1–31');
  const grouped = new Map<string, DailyObservation[]>();
  const seen = new Set<string>();
  for (const row of observations) {
    if (!validDate(row.date) || !row.item_name?.trim() || !Number.isFinite(row.quantity) || row.quantity < 0) {
      throw new Error('Every observation needs a valid date, item_name and non-negative quantity');
    }
    const name = key(row.item_name), identity = `${name}:${row.date}`;
    if (seen.has(identity)) throw new Error(`Duplicate daily observation: ${identity}`);
    seen.add(identity);
    const rows = grouped.get(name) || [];
    rows.push(row); grouped.set(name, rows);
  }
  if (!observations.length) throw new Error('No observations supplied');
  const results: Array<{ item: string; origin: string; horizonDays: number; actual: number; predicted: number; baseline: number }> = [];
  let skippedWindows = 0;
  for (const [name, unsorted] of grouped) {
    const rows = [...unsorted].sort((a,b) => a.date.localeCompare(b.date));
    const byDate = new Map(rows.map(row => [row.date, row.quantity]));
    const menu: MenuItem = { id: name, restaurant_id: 'backtest', name, category: '', selling_price: 0, target_margin_percent: 0, is_active: true };
    const sales: SalesRecord[] = rows.map(row => ({ id: `${name}:${row.date}`, restaurant_id: 'backtest', order_id: row.date,
      item_name: name, quantity_sold: row.quantity, unit_price: 0, total_amount: 0, sold_at: `${row.date}T12:00:00Z` }));
    const last = Date.parse(rows[rows.length - 1].date);
    for (let start = Date.parse(testStart); start + (horizonDays - 1) * DAY <= last; start += DAY) {
      const origin = new Date(start - 1);
      let actual = 0, baseline = 0, complete = true;
      for (let h = 0; h < horizonDays; h++) {
        const target = start + h * DAY;
        // Last matching weekday known at origin (also valid for horizons > 7).
        let prior = target - 7 * DAY;
        while (prior >= start) prior -= 7 * DAY;
        const truth = byDate.get(new Date(target).toISOString().slice(0,10));
        const base = byDate.get(new Date(prior).toISOString().slice(0,10));
        if (truth === undefined || base === undefined) { complete = false; break; }
        actual += truth; baseline += base;
      }
      if (!complete) { skippedWindows++; continue; }
      const predicted = generateSmartPurchaseOrder(sales, [], [menu], horizonDays, 1, origin).totalProjectedMenuUnits;
      results.push({ item: name, origin: origin.toISOString(), horizonDays, actual, predicted, baseline });
    }
  }
  function metrics(rows: typeof results, field: 'predicted' | 'baseline') {
    const actual = rows.reduce((sum, row) => sum + row.actual, 0);
    const absoluteError = rows.reduce((sum, row) => sum + Math.abs(row[field] - row.actual), 0);
    return { windows: rows.length, mae: rows.length ? absoluteError / rows.length : null,
      wape: actual > 0 ? absoluteError / actual : null,
      bias: rows.length ? rows.reduce((sum, row) => sum + row[field] - row.actual, 0) / rows.length : null };
  }
  return { testStart, horizonDays, dateBasis: 'America/Detroit calendar dates', skippedWindows,
    candidate: metrics(results, 'predicted'), weekdayBaseline: metrics(results, 'baseline'),
    byItem: [...grouped.keys()].map(item => ({ item, candidate: metrics(results.filter(row => row.item === item), 'predicted'),
      weekdayBaseline: metrics(results.filter(row => row.item === item), 'baseline') })), results,
    warnings: ['Daily observations must include explicitly confirmed zero-sales days. Missing days are skipped, not imputed.',
      'Rolling-origin evaluation uses only history available at each origin; overlapping horizons are not independent.',
      'WAPE is a ratio and is null when actual demand is zero. This report is not an accuracy or launch certification.'] };
}
