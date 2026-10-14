import { describe, it, expect } from 'vitest';
import { backtestDemand } from '../lib/backtest';

const rows = Array.from({ length: 28 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2,'0')}`, item_name: 'Bread', quantity: 10 }));
describe('Chronological forecast evaluation', () => {
  it('scores known steady demand against the matching-weekday baseline', () => {
    const report = backtestDemand(rows, '2026-09-15');
    expect(report.candidate).toEqual({ windows: 14, mae: 0, wape: 0, bias: 0 });
    expect(report.weekdayBaseline).toEqual(report.candidate);
  });
  it('does not leak the target or later demand into an earlier prediction', () => {
    const original = backtestDemand(rows, '2026-09-15');
    const changed = backtestDemand(rows.map(row => row.date >= '2026-09-15' ? { ...row, quantity: 1000 } : row), '2026-09-15');
    expect(changed.results[0].predicted).toBe(original.results[0].predicted);
    expect(changed.results[0].actual).toBe(1000);
    expect(changed.results[0].baseline).toBe(10);
  });
  it('retains confirmed zeroes and does not pretend zero actuals have a WAPE', () => {
    const report = backtestDemand(rows.map(row => ({ ...row, quantity: 0 })), '2026-09-15');
    expect(report.candidate).toMatchObject({ mae: 0, wape: null, bias: 0 });
    expect(report.results.every(row => row.predicted === 0)).toBe(true);
  });
  it('skips unknown days and rejects duplicate or malformed daily inputs', () => {
    const report = backtestDemand(rows.filter(row => row.date !== '2026-09-15'), '2026-09-15');
    expect(report.skippedWindows).toBe(2);
    expect(() => backtestDemand([...rows, rows[0]], '2026-09-15')).toThrow('Duplicate');
    expect(() => backtestDemand([{ ...rows[0], date: '2026-02-30' }], '2026-09-15')).toThrow();
    expect(() => backtestDemand([{ ...rows[0], quantity: -1 }], '2026-09-15')).toThrow();
  });
  it('evaluates multi-day horizons without using future baseline values', () => {
    const report = backtestDemand(rows, '2026-09-15', 8);
    expect(report.results[0]).toMatchObject({ actual: 80, predicted: 80, baseline: 80 });
  });
});
