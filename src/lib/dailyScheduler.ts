// Scheduling, sales grouping, forecasts, and closures use the restaurant's Detroit calendar date.
export type DailySchedule = { timeZone: string; at: string };
export function validateSchedule(schedule: DailySchedule) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.at)) throw new Error('Schedule time must be HH:mm');
  if (!schedule.timeZone?.trim()) throw new Error('A restaurant timezone is required');
  new Intl.DateTimeFormat('en', { timeZone: schedule.timeZone }).format(new Date());
  return schedule;
}

export function dueLocalDate(now: Date, schedule: DailySchedule): string | null {
  validateSchedule(schedule);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: schedule.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const value = (type: string) => parts.find(p => p.type === type)!.value;
  if (`${value('hour')}:${value('minute')}` < schedule.at) return null;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export type DailyClaim = { id: string; lease_token: string; attempts: number };
export type ScheduledResult = { forecast: Record<string, unknown> } | { skip: string };
export interface DailyJobStore {
  claim(date: string): Promise<DailyClaim | null>;
  complete(claim: DailyClaim, result: ScheduledResult): Promise<void>;
  fail(claim: DailyClaim, code: string, retryable: boolean): Promise<void>;
}

export function scheduledFailure(error: unknown): { code: string; retryable: boolean } {
  const e = error as { status?: number; cause?: { code?: string } };
  const status = Number(e?.status);
  if (status === 429) return { code: 'provider_quota', retryable: false };
  if ([401, 403, 404].includes(status)) return { code: 'provider_configuration', retryable: false };
  if (status === 409 || [500, 502, 503, 504].includes(status)
    || ['ECONNRESET', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT'].includes(e?.cause?.code || '')) {
    return { code: status === 409 ? 'inputs_changed' : 'provider_unavailable', retryable: true };
  }
  return { code: 'forecast_failed', retryable: false };
}

// A process guard reduces overlap; PostgreSQL leases arbitrate across processes/restarts.
export function createDailyScheduler(options: {
  schedule: DailySchedule; store: DailyJobStore;
  generate: () => Promise<ScheduledResult>;
  report: (event: { event: string; runId?: string; code?: string }) => void;
}) {
  validateSchedule(options.schedule);
  let running = false;
  return async (now = new Date()) => {
    if (running) return;
    const date = dueLocalDate(now, options.schedule);
    if (!date) return;
    running = true;
    let claim: DailyClaim | null = null;
    try {
      claim = await options.store.claim(date);
      if (!claim) return;
      const result = await options.generate();
      await options.store.complete(claim, result);
      options.report({ event: 'daily_forecast_completed', runId: claim.id });
    } catch (error) {
      const failure = scheduledFailure(error);
      if (claim) {
        try { await options.store.fail(claim, failure.code, failure.retryable); }
        catch { options.report({ event: 'daily_forecast_store_unavailable', runId: claim.id }); }
      }
      // Only controlled codes are logged: provider errors can contain credentials or customer data.
      options.report({ event: claim ? 'daily_forecast_failed' : 'daily_forecast_store_unavailable', runId: claim?.id, code: failure.code });
    } finally { running = false; }
  };
}
