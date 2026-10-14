import {describe,it,expect} from 'vitest';
import {dailyOperationsHealth} from '../lib/operationsHealth';
const schedule={timeZone:'America/Detroit',at:'04:30'};
describe('Daily operations monitor',()=>{
  it('detects a missing run even when the web server liveness is up',()=>{
    expect(dailyOperationsHealth(new Date('2026-10-01T08:29:00Z'),schedule,[]).healthy).toBe(true);
    expect(dailyOperationsHealth(new Date('2026-10-01T08:31:00Z'),schedule,[]).healthy).toBe(true);
    expect(dailyOperationsHealth(new Date('2026-10-01T08:36:00Z'),schedule,[])).toEqual({healthy:false,state:'missing_run'});
  });
  it('detects terminal failures, expired leases and overdue retries',()=>{
    const now=new Date('2026-10-01T09:00:00Z');
    for(const row of [{status:'failed'},{status:'running',lease_until:'2026-10-01T08:59:00Z'},{status:'retry',next_attempt_at:'2026-10-01T08:57:00Z'},{status:'running',lease_until:'invalid'}]) {
      expect(dailyOperationsHealth(now,schedule,[{local_date:'2026-10-01',...row}]).healthy).toBe(false);
    }
    expect(dailyOperationsHealth(now,schedule,[{local_date:'2026-10-01',status:'succeeded'}]).healthy).toBe(true);
    expect(dailyOperationsHealth(now,schedule,[{local_date:'2026-09-30',status:'succeeded'}]).healthy).toBe(false);
  });
});
