import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeBaselineMenuUnits, predictTomorrowCustomers } from '../lib/customerPrediction';

afterEach(() => vi.unstubAllGlobals());

describe('customer prediction evidence', () => {
  it('does not invent covers or menu demand when sales history is empty', () => {
    const result = computeBaselineMenuUnits([], new Date('2026-09-24T12:00:00Z'));
    expect(result.baseline).toBeNull();
    expect(result.confidence).toBe('none');
  });

  it('uses observed menu quantities without a minimum floor', () => {
    const result = computeBaselineMenuUnits([
      { sold_at: '2026-09-17T12:00:00Z', quantity_sold: 3 },
      { sold_at: '2026-09-10T12:00:00Z', quantity_sold: 5 },
    ] as any, new Date('2026-09-24T12:00:00Z'));
    expect(result.baseline).toBe(4);
  });

  it('resolves Troy Michigan by city and state and leaves cold-start demand unknown', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      urls.push(input);
      if (input.includes('geocoding-api')) return { ok: true, json: async () => ({ results: [
        { name: 'Troy', admin1: 'New York', country_code: 'US', latitude: 42.72, longitude: -73.69 },
        { name: 'Troy', admin1: 'Michigan', country_code: 'US', latitude: 42.60559, longitude: -83.14993 },
      ] }) };
      if (input.includes('open-meteo.com/v1/forecast')) return { ok: true, json: async () => ({ daily: { temperature_2m_max: [22], weather_code: [0] } }) };
      return { ok: true, json: async () => [] };
    }));
    const result = await predictTomorrowCustomers({ salesRecords: [], location: 'Troy Michigan', targetDate: new Date('2026-09-24T12:00:00Z') });
    expect(urls[0]).toContain('name=Troy&count=20');
    expect(result.coordinates).toEqual({ lat: 42.60559, lon: -83.14993 });
    expect(result.projectedMenuUnits).toBeNull();
    expect(result.logic_chain).toContain('unavailable');
  });
});
