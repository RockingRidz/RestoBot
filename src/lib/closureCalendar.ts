/** Closure dates are restaurant calendar dates in Detroit time. */
export function validateClosedDates(value: unknown): string[] {
  const fail = (): never => { throw Object.assign(new Error('Enter up to 366 valid closure dates, with no duplicates.'), {status: 400}); };
  if (!Array.isArray(value) || value.length > 366) return fail();
  for (const date of value) {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail();
    const parsed = new Date(date + 'T00:00:00Z');
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== date) return fail();
  }
  if (new Set(value).size !== value.length) return fail();
  return [...value].sort();
}
