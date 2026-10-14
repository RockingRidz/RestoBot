/** Calendar dates for the first pilot restaurant. A business day ends at local midnight. */
export const BUSINESS_TIME_ZONE = 'America/Detroit';

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function localParts(instant: Date) {
  const parts = formatter.formatToParts(instant);
  const number = (type: string) => Number(parts.find(part => part.type === type)?.value);
  return { year: number('year'), month: number('month'), day: number('day'),
    hour: number('hour'), minute: number('minute'), second: number('second') };
}

export function validCalendarDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function businessDateKey(value: Date | string): string {
  // Historical daily observations are already calendar dates, not UTC instants.
  if (typeof value === 'string' && validCalendarDate(value)) return value;
  const instant = typeof value === 'string' ? new Date(value) : value;
  if (!Number.isFinite(instant.getTime())) throw new Error('Invalid sale or forecast timestamp');
  const { year, month, day } = localParts(instant);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function addCalendarDays(date: string, days: number): string {
  if (!validCalendarDate(date) || !Number.isInteger(days)) throw new Error('Invalid calendar date');
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export function tomorrowBusinessDate(now = new Date()): string {
  return addCalendarDays(businessDateKey(now), 1);
}

/** Interpret a POS timestamp without an offset as restaurant wall time. Reject DST gaps/overlaps. */
export function localSaleTimestamp(date: string, time = '00:00:00'): string {
  if (!validCalendarDate(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)) throw new Error('Invalid local sale date or time');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute, second = 0] = time.split(':').map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute, second);
  let candidate = desired;
  for (let attempt = 0; attempt < 3; attempt++) {
    const found = localParts(new Date(candidate));
    const displayed = Date.UTC(found.year, found.month - 1, found.day, found.hour, found.minute, found.second);
    candidate += desired - displayed;
  }
  const matches = (millis: number) => {
    const found = localParts(new Date(millis));
    return found.year === year && found.month === month && found.day === day
      && found.hour === hour && found.minute === minute && found.second === second;
  };
  if (!matches(candidate) || matches(candidate - 3_600_000) || matches(candidate + 3_600_000)) {
    throw new Error('Ambiguous or nonexistent local time; include an explicit UTC offset in the POS timestamp');
  }
  return new Date(candidate).toISOString();
}
