import { describe, expect, it } from 'vitest';
import { businessDateKey, localSaleTimestamp, tomorrowBusinessDate } from '../lib/businessDate';

describe('Detroit midnight business-day contract', () => {
  it('uses the local date on both sides of UTC midnight', () => {
    expect(businessDateKey('2026-10-03T02:00:00Z')).toBe('2026-10-02');
    expect(tomorrowBusinessDate(new Date('2026-10-03T02:00:00Z'))).toBe('2026-10-03');
    expect(businessDateKey('2026-10-02')).toBe('2026-10-02');
  });
  it('converts local POS time across daylight-saving offsets', () => {
    expect(localSaleTimestamp('2026-07-01', '00:30')).toBe('2026-07-01T04:30:00.000Z');
    expect(localSaleTimestamp('2026-12-01', '00:30')).toBe('2026-12-01T05:30:00.000Z');
    expect(() => localSaleTimestamp('2026-03-08', '02:30')).toThrow(/nonexistent/);
    expect(() => localSaleTimestamp('2026-11-01', '01:30')).toThrow(/Ambiguous/);
  });
});
