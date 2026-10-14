import { createHash } from 'node:crypto';
import { getMemorySnapshot } from './dataStore';
import { BUSINESS_TIME_ZONE, tomorrowBusinessDate } from './businessDate';

function canonical(value: any): any {
  if (Array.isArray(value)) return value.map(canonical).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,canonical(value[k])]));
  return value;
}
export function forecastInputFingerprint() {
  const {ingredients,menuItems,salesRecords,profile}=getMemorySnapshot();
  return createHash('sha256').update(JSON.stringify(canonical({restaurantId:profile.restaurantId,closedDates:profile.closedDates || [],ingredients,menuItems,salesRecords}))).digest('hex');
}
export function forecastIsCurrent(row: any, fingerprint = forecastInputFingerprint(), now = new Date()) {
  return row?.target_date === tomorrowBusinessDate(now)
    && row?.forecast_explanation?.dateBasis === BUSINESS_TIME_ZONE
    && row?.forecast_explanation?.inputFingerprint === fingerprint;
}
