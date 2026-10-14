import { dueLocalDate, type DailySchedule } from './dailyScheduler';
type Run = { local_date:string;status:string;lease_until?:string|null;next_attempt_at?:string|null;failure_code?:string|null };
export function dailyOperationsHealth(now:Date,schedule:DailySchedule,runs:Run[]) {
  const due=dueLocalDate(now,schedule);
  if(!due)return {healthy:true,state:'not_due'};
  const run=runs.find(row=>row.local_date===due);
  // Give a new minute-level scheduler five minutes to claim its first run.
  if(!run)return {healthy:dueLocalDate(new Date(now.getTime()-5*60000),schedule)!==due,state:'missing_run'};
  if(['succeeded','skipped'].includes(run.status))return {healthy:true,state:run.status};
  if(run.status==='failed')return {healthy:false,state:'failed'};
  const deadline=run.status==='running'?run.lease_until:run.next_attempt_at;
  const timestamp=deadline?Date.parse(deadline):NaN;
  return {healthy:Number.isFinite(timestamp)&&now.getTime()<=timestamp+(run.status==='retry'?2*60000:0),state:run.status};
}
