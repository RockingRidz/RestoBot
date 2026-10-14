import { describe, it, expect, vi } from 'vitest';
const mock = vi.hoisted(() => ({ client: null as any }));
vi.mock('../lib/supabaseAdmin', () => ({ getAdminClient: () => mock.client, persistenceMode: () => 'supabase' }));
import { saveForecast, listForecastHistory } from '../lib/forecastStore';
import { generateSmartPurchaseOrder } from '../lib/forecastEngine';
import { getAccountProfile } from '../lib/dataStore';
import { forecastIsCurrent } from '../lib/forecastFreshness';

describe('Durable forecast snapshots', () => {
  it('persists the exact forecast and actor in one write, scoped to the configured restaurant', async () => {
    let stored: any;
    const query: any = { insert: vi.fn((row: any) => { stored = row; return query; }), select: () => query,
      single: () => query, eq: vi.fn(() => query), order: () => query, limit: () => query,
      then: (resolve: any) => Promise.resolve({ data: stored, error: null }).then(resolve) };
    mock.client = { from: () => query };
    const origin = new Date('2026-09-25T12:00:00Z');
    const result = generateSmartPurchaseOrder([], [], [], 2, 1.1, origin);
    const saved = await saveForecast(result, 1.1, origin, 'owner-id');
    expect(saved.forecast_explanation).toMatchObject({ result, generatedBy: 'owner-id', safetyBuffer: 1.1 });
    expect(saved.target_date).toBe('2026-09-26');
    expect(forecastIsCurrent({...saved,forecast_explanation:{...saved.forecast_explanation,dateBasis:'UTC'}},saved.forecast_explanation.inputFingerprint,origin)).toBe(false);
    await listForecastHistory();
    expect(query.eq).toHaveBeenCalledWith('restaurant_id', getAccountProfile().restaurantId);
  });
  it('surfaces write and read failures', async () => {
    const query: any = {};
    for (const method of ['insert','select','single','eq','order','limit']) query[method] = () => query;
    query.then = (resolve: any) => Promise.resolve({ data: null, error: {} }).then(resolve);
    mock.client = { from: () => query };
    await expect(saveForecast(generateSmartPurchaseOrder([],[],[]), 1, new Date())).rejects.toThrow('Forecast was not saved');
    await expect(listForecastHistory()).rejects.toThrow('could not be loaded');
  });
});
