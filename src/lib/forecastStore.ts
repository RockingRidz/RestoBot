import { randomUUID } from 'node:crypto';
import { getAdminClient, persistenceMode } from './supabaseAdmin';
import { getAccountProfile } from './dataStore';
import type { ForecastResult } from './forecastEngine';
import { forecastInputFingerprint } from './forecastFreshness';
import { BUSINESS_TIME_ZONE, tomorrowBusinessDate } from './businessDate';

const memory: any[] = [];

export function forecastRow(result: ForecastResult, safetyBuffer: number, generatedAt: Date, actorId?: string, inputFingerprint = forecastInputFingerprint()) {
  return { id: randomUUID(), restaurant_id: getAccountProfile().restaurantId,
    target_date: tomorrowBusinessDate(generatedAt), generated_at: generatedAt.toISOString(), status: 'generated',
    forecast_summary: `${result.horizonDays}-day forecast: ${result.totalProjectedMenuUnits} menu units`,
    forecast_explanation: { schemaVersion: 2, dateBasis: BUSINESS_TIME_ZONE, safetyBuffer, inputFingerprint, generatedBy: actorId || null, result } };
}

export async function saveForecast(result: ForecastResult, safetyBuffer: number, generatedAt: Date, actorId?: string, inputFingerprint = forecastInputFingerprint()) {
  const row = forecastRow(result, safetyBuffer, generatedAt, actorId, inputFingerprint);
  const client = getAdminClient();
  if (client && persistenceMode() === 'supabase') {
    // A single JSON snapshot preserves the exact result atomically, including warnings and purchase lines.
    const { data, error } = await client.from('forecasts').insert(row).select('*').single();
    if (error || !data) throw new Error('Forecast was not saved');
    return data;
  }
  memory.unshift(structuredClone(row));
  return row;
}

export async function listForecastHistory() {
  const restaurantId = getAccountProfile().restaurantId;
  const client = getAdminClient();
  if (client && persistenceMode() === 'supabase') {
    const { data, error } = await client.from('forecasts').select('*').eq('restaurant_id', restaurantId)
      .order('generated_at', { ascending: false }).order('id', { ascending: false }).limit(100);
    if (error || !data) throw new Error('Forecast history could not be loaded');
    return data;
  }
  return memory.filter(row => row.restaurant_id === restaurantId).slice(0,100).map(row => structuredClone(row));
}
