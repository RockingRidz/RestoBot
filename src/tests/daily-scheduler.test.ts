import { describe, it, expect, vi } from 'vitest';
import { createDailyScheduler, dueLocalDate, validateSchedule, scheduledFailure, type DailyJobStore } from '../lib/dailyScheduler';

describe('Restaurant wall-time scheduling', () => {
  it('uses the restaurant date across UTC midnight and fractional offsets', () => {
    expect(dueLocalDate(new Date('2026-10-01T23:00:00Z'),{timeZone:'Asia/Kolkata',at:'04:30'})).toBe('2026-10-02');
    expect(dueLocalDate(new Date('2026-10-01T22:59:00Z'),{timeZone:'Asia/Kolkata',at:'04:30'})).toBeNull();
    expect(dueLocalDate(new Date('2026-10-02T02:00:00Z'),{timeZone:'America/Detroit',at:'04:30'})).toBe('2026-10-01');
  });
  it('catches a skipped spring-forward time and maps both repeated fall times to one day', () => {
    expect(dueLocalDate(new Date('2026-03-08T07:00:00Z'),{timeZone:'America/Detroit',at:'02:30'})).toBe('2026-03-08');
    for(const time of ['2026-11-01T05:30:00Z','2026-11-01T06:30:00Z']) {
      expect(dueLocalDate(new Date(time),{timeZone:'America/Detroit',at:'01:30'})).toBe('2026-11-01');
    }
  });
  it('rejects incomplete or malformed operator configuration', () => {
    for(const schedule of [{timeZone:'',at:'04:30'},{timeZone:'invalid',at:'04:30'},{timeZone:'UTC',at:'24:00'},{timeZone:'UTC',at:'4:30'}]) {
      expect(()=>validateSchedule(schedule)).toThrow();
    }
  });
});

const claim = {id:'run',lease_token:'token',attempts:1};
function setup(generate = vi.fn(async () => ({skip:'closed_target_date'}))) {
  const store: DailyJobStore = {claim:vi.fn(async()=>claim),complete:vi.fn(async()=>{}),fail:vi.fn(async()=>{})};
  const report=vi.fn();
  return {store,report,generate,tick:createDailyScheduler({schedule:{timeZone:'UTC',at:'04:30'},store,generate,report})};
}
describe('Daily worker orchestration', () => {
  it('does not generate before due time or when the durable claim is held/completed',async()=>{
    const job=setup();
    await job.tick(new Date('2026-10-01T04:29:00Z'));
    expect(job.store.claim).not.toHaveBeenCalled();
    vi.mocked(job.store.claim).mockResolvedValue(null);
    await job.tick(new Date('2026-10-01T04:30:00Z'));
    expect(job.generate).not.toHaveBeenCalled();
  });
  it('guards overlapping ticks and completes a closure without calling any export workflow',async()=>{
    const job=setup();
    await Promise.all([job.tick(new Date('2026-10-01T05:00:00Z')),job.tick(new Date('2026-10-01T05:00:00Z'))]);
    expect(job.store.claim).toHaveBeenCalledTimes(1);
    expect(job.store.complete).toHaveBeenCalledWith(claim,{skip:'closed_target_date'});
  });
  it.each([[429,'provider_quota',false],[403,'provider_configuration',false],[503,'provider_unavailable',true],[409,'inputs_changed',true]])('classifies status %s without retaining provider secrets',async(status,code,retryable)=>{
    const job=setup(vi.fn(async()=>{throw {status,message:'SECRET_CUSTOMER_DATA'};}));
    await job.tick(new Date('2026-10-01T05:00:00Z'));
    expect(job.store.fail).toHaveBeenCalledWith(claim,code,retryable);
    expect(job.store.complete).not.toHaveBeenCalled();
    expect(JSON.stringify(job.report.mock.calls)).not.toContain('SECRET');
  });
  it('reports a store outage and releases its process guard for the next tick',async()=>{
    const job=setup();vi.mocked(job.store.claim).mockRejectedValueOnce(new Error('secret URL'));
    await job.tick(new Date('2026-10-01T05:00:00Z'));
    await job.tick(new Date('2026-10-01T05:01:00Z'));
    expect(job.report).toHaveBeenCalledWith(expect.objectContaining({event:'daily_forecast_store_unavailable'}));
    expect(job.store.complete).toHaveBeenCalledTimes(1);
  });
  it('does not retry malformed output and does retry recognized transport failures',()=>{
    expect(scheduledFailure(new SyntaxError('bad JSON')).retryable).toBe(false);
    expect(scheduledFailure({cause:{code:'ECONNRESET'}}).retryable).toBe(true);
  });
});
