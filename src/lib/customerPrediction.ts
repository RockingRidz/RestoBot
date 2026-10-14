import { GoogleGenAI } from '@google/genai';
import { getGeminiModel } from './aiConfig';
import { SalesRecord } from '../types';
import { addCalendarDays, businessDateKey, tomorrowBusinessDate } from './businessDate';

export interface PredictionModifier {
  name: string;
  percent: number;
  source: 'weather' | 'holiday' | 'weekday' | 'event_rag' | 'manual';
}

export interface LocalEventHit {
  name: string;
  date?: string;
  impactPercent: number;
  summary: string;
  sourceUrl?: string;
}

export interface CustomerPredictionResult {
  targetDate: string;
  dayOfWeek: string;
  location: string;
  coordinates: { lat: number; lon: number } | null;
  baselineMenuUnits: number | null;
  projectedMenuUnits: number | null;
  netModifierPct: number;
  modifiers: PredictionModifier[];
  weather: {
    temperatureF: number | null;
    condition: string;
    live: boolean;
    source: string;
  };
  holiday: {
    isHoliday: boolean;
    name: string | null;
  };
  events: LocalEventHit[];
  webSearchQueries: string[];
  sources: Array<{ title: string; uri: string }>;
  explanations: string[];
  logic_chain: string; 
  ragMode: 'gemini_google_search' | 'heuristic_fallback';
  confidence: 'none' | 'low' | 'medium' | 'high';
}

const WMO: Record<number, string> = {
  0: 'Sunny / Clear', 1: 'Partly Cloudy', 2: 'Partly Cloudy', 3: 'Overcast', 45: 'Foggy', 48: 'Foggy',
  51: 'Rainy / Drizzle', 53: 'Rainy / Drizzle', 55: 'Rainy / Drizzle', 61: 'Rainy / Drizzle', 63: 'Rainy / Drizzle', 65: 'Rainy / Drizzle',
  71: 'Snowing / Cold', 73: 'Snowing / Cold', 75: 'Snowing / Cold', 80: 'Rain Showers', 81: 'Rain Showers', 82: 'Rain Showers',
  95: 'Thunderstorm / Heavy Storm', 96: 'Thunderstorm / Heavy Storm', 99: 'Thunderstorm / Heavy Storm',
};

function round(n: number): number { return Math.round(n); }
function dateKey(d: Date): string { return businessDateKey(d); }
function addDays(d: Date, days: number): Date { return new Date(d.getTime() + days * 86400000); }

export function computeBaselineMenuUnits(salesRecords: SalesRecord[], targetDate: Date): {
  baseline: number | null;
  confidence: 'none' | 'low' | 'medium' | 'high';
  explanation: string;
} {
  const targetDow = targetDate.getUTCDay();
  const byDay = new Map<string, number>();
  for (const record of salesRecords) {
    const sold = new Date(record.sold_at);
    if (Number.isNaN(sold.getTime()) || businessDateKey(sold) >= businessDateKey(targetDate) || !Number.isFinite(record.quantity_sold) || record.quantity_sold < 0 || /refund|void|cancel|return/i.test(record.transaction_type||'')) continue;
    const key = businessDateKey(record.sold_at);
    byDay.set(key, (byDay.get(key) || 0) + Number(record.quantity_sold || 0));
  }

  const sameWeekday = Array.from(byDay.entries())
    .map(([day, qty]) => ({ day: new Date(day), qty }))
    .filter((e) => !Number.isNaN(e.day.getTime()) && e.day.getUTCDay() === targetDow)
    .sort((a, b) => b.day.getTime() - a.day.getTime())
    .slice(0, 8);

  if (sameWeekday.length > 0) {
    const avg = sameWeekday.reduce((s, e) => s + e.qty, 0) / sameWeekday.length;
    return {
      baseline: Math.max(0, round(avg)),
      confidence: sameWeekday.length >= 4 ? 'high' : sameWeekday.length >= 2 ? 'medium' : 'low',
      explanation: `Menu-item unit baseline from ${sameWeekday.length} matching ${targetDate.toLocaleDateString('en-US', { weekday: 'long' })} sales days; this is not a customer count.`,
    };
  }

  return {
    baseline: null,
    confidence: 'none',
    explanation: 'Insufficient matching-weekday sales history. No demand number is shown until real sales are imported.',
  };
}

async function geocodeLocation(location: string): Promise<{ lat: number; lon: number; label: string } | null> {
  const clean = location.replace(/\([^)]*\)/g, '').trim();
  const stateMatch = clean.match(/(?:,?\s+)(Michigan|MI)$/i);
  const city = stateMatch ? clean.slice(0, stateMatch.index).replace(/,$/, '').trim() : clean.split(',')[0].trim();
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=20&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const results = data.results || [];
  if (!results.length) return null;
  const lower = location.toLowerCase();
  const preferred = results.find((r: any) => {
    const admin = String(r.admin1 || '').toLowerCase();
    const country = String(r.country_code || '').toUpperCase();
    if (lower.includes('michigan') || /(?:,?\s+)mi$/i.test(clean)) return admin.includes('michigan') && country === 'US';
    if (lower.includes('united states') || /, [A-Z]{2}\b/.test(location)) return country === 'US';
    return false;
  }) || results[0];
  return { lat: preferred.latitude, lon: preferred.longitude, label: `${preferred.name}, ${preferred.admin1 || ''}` };
}

async function fetchLiveWeather(lat: number, lon: number, date: string) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,weather_code&timezone=auto&start_date=${date}&end_date=${date}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather API returned ${res.status}`);
  const data = await res.json();
  const daily = data.daily;
  if (!daily) throw new Error('Weather data missing from response');
  return {
    temperatureF: Math.round(daily.temperature_2m_max[0] * 9/5 + 32),
    condition: WMO[daily.weather_code[0]] || 'Unknown',
    live: true,
  };
}

function weatherModifiers(temp: number | null, cond: string): PredictionModifier[] {
  const mods: PredictionModifier[] = [];
  if (temp !== null) {
    if (temp > 85) mods.push({ name: 'Extreme Heat', percent: -10, source: 'weather' });
    if (temp < 32) mods.push({ name: 'Freezing Cold', percent: -15, source: 'weather' });
  }
  if (cond.includes('Rain') || cond.includes('Storm') || cond.includes('Snow')) {
    mods.push({ name: 'Bad Weather', percent: -20, source: 'weather' });
  }
  return mods;
}

async function fetchUsHoliday(date: string) {
  const url = `https://date.nager.at/api/v3/PublicHolidays/${date.split('-')[0]}/US`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Holiday API returned ${res.status}`);
  const data = await res.json();
  const holiday = data.find((h: any) => h.date === date);
  return holiday ? { isHoliday: true, name: holiday.name } : { isHoliday: false, name: null };
}

function weekdayModifier(date: Date): PredictionModifier | null {
  const dow = date.getDay();
  if (dow === 5) return { name: 'Friday Rush', percent: 15, source: 'weekday' };
  if (dow === 6) return { name: 'Saturday Peak', percent: 25, source: 'weekday' };
  if (dow === 0) return { name: 'Sunday Brunch', percent: 10, source: 'weekday' };
  return null;
}

async function searchLocalEventsWithGeminiRag({ ai, location, targetDate, dayOfWeek, cuisineType }: any) {
  const prompt = `Search for major local events in ${location} on ${targetDate} (${dayOfWeek}) that impact dining for ${cuisineType || 'local'} restaurants.
Return ONLY valid JSON:
{ "events": [{ "name": string, "date": "${targetDate}", "summary": string }] }
Include only events on the exact date supported by a search result. If unsure, return an empty events array.`;

  const result = await ai.models.generateContent({
    model: getGeminiModel(),
    contents: prompt,
    config: { tools: [{ googleSearch: {} }] },
  });
  const text = (result.text || '').trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI returned non-JSON response');
  const parsed = JSON.parse(jsonMatch[0]);
  const metadata = result.candidates?.[0]?.groundingMetadata;
  const sources = (metadata?.groundingChunks || [])
    .map((chunk: any) => chunk.web)
    .filter((web: any) => typeof web?.uri === 'string' && web.uri.startsWith('https://'))
    .map((web: any) => ({ title: String(web.title || web.uri), uri: web.uri }));
  return {
    events: sources.length && Array.isArray(parsed.events) ? parsed.events.filter((event: any) => event?.date === targetDate).map((event: any) => ({
      name: String(event.name || ''), date: targetDate, impactPercent: 0,
      summary: String(event.summary || ''), sourceUrl: sources[0].uri,
    })).filter((event: LocalEventHit) => event.name) : [],
    webSearchQueries: metadata?.webSearchQueries || [],
    sources,
  };
}

export async function predictTomorrowCustomers(params: {
  salesRecords: SalesRecord[];
  location: string;
  cuisineType?: string;
  ai?: GoogleGenAI | null;
  targetDate?: Date;
}): Promise<CustomerPredictionResult> {
  const target = params.targetDate || new Date(`${tomorrowBusinessDate()}T12:00:00Z`);
  const targetDateStr = dateKey(target);
  const dayOfWeek = target.toLocaleDateString('en-US', { weekday: 'long' });
  const explanations: string[] = [];
  const modifiers: PredictionModifier[] = [];

  const baselineInfo = computeBaselineMenuUnits(params.salesRecords, target);
  explanations.push(baselineInfo.explanation);

  let coordinates: { lat: number; lon: number } | null = null;
  let locationLabel = params.location;
  let weather = { temperatureF: null as number | null, condition: 'Unknown', live: false, source: 'unavailable' };

  try {
    const geo = await geocodeLocation(params.location);
    if (geo) {
      coordinates = { lat: geo.lat, lon: geo.lon };
      locationLabel = geo.label;
      const w = await fetchLiveWeather(geo.lat, geo.lon, targetDateStr);
      weather = { temperatureF: w.temperatureF, condition: w.condition, live: w.live, source: 'Open-Meteo' };
      explanations.push(`Weather: ${w.temperatureF}°F, ${w.condition}`);
      explanations.push('Weather is context only; its effect on demand has not been calibrated.');
    } else {
      explanations.push(`Could not geocode location: ${params.location}`);
    }
  } catch (e: any) {
    explanations.push(`Weather error: ${e.message}`);
  }

  let holiday = { isHoliday: false, name: null as string | null };
  try {
    holiday = await fetchUsHoliday(targetDateStr);
    if (holiday.isHoliday) {
      explanations.push(`Holiday: ${holiday.name}; effect on demand has not been calibrated.`);
    }
  } catch (e: any) {
    explanations.push(`Holiday lookup failed: ${e.message}`);
  }

  let events: LocalEventHit[] = [];
  let webSearchQueries: string[] = [];
  let sources: Array<{ title: string; uri: string }> = [];
  let ragMode: CustomerPredictionResult['ragMode'] = 'heuristic_fallback';

  if (params.ai && baselineInfo.baseline !== null) {
    try {
      const rag = await searchLocalEventsWithGeminiRag({ ai: params.ai, location: locationLabel, targetDate: targetDateStr, dayOfWeek, cuisineType: params.cuisineType });
      events = rag.events;
      webSearchQueries = rag.webSearchQueries;
      sources = rag.sources;
      ragMode = sources.length ? 'gemini_google_search' : 'heuristic_fallback';
      for (const ev of events) {
        explanations.push(`Event found for review: ${ev.name}. No demand uplift assumed.`);
      }
    } catch (e: any) {
      explanations.push('Verified event lookup is unavailable; no event adjustment applied.');
    }
  } else {
    explanations.push(baselineInfo.baseline === null
      ? 'Event lookup deferred until sales history supports a demand baseline.'
      : 'Event lookup unavailable; no event adjustment applied.');
  }

  const netModifierPct = modifiers.reduce((s, m) => s + m.percent, 0);
  const projectedMenuUnits = baselineInfo.baseline;

  const logicChain = baselineInfo.baseline === null
    ? 'Menu demand unavailable: import real sales history.'
    : `Observed matching-weekday menu units (${baselineInfo.baseline}); uncalibrated weather and event adjustments excluded.`;

  return {
    targetDate: targetDateStr, dayOfWeek, location: locationLabel, coordinates, baselineMenuUnits: baselineInfo.baseline,
    projectedMenuUnits, netModifierPct: Math.round(netModifierPct * 10) / 10, modifiers, weather, holiday, events,
    webSearchQueries, sources, explanations, logic_chain: logicChain, ragMode,
    confidence: baselineInfo.confidence,
  };
}
