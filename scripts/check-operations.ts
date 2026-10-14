// Read-only monitor. Connect its exit status/stdout to the deployment's chosen alerting system.
import '../loadEnv';
import { getAdminClient } from '../src/lib/supabaseAdmin';
import { validateSchedule } from '../src/lib/dailyScheduler';
import { dailyOperationsHealth } from '../src/lib/operationsHealth';

async function main() {
  if(process.env.RESTOBOT_SCHEDULER_ENABLED!=='true') {
    console.log(JSON.stringify({healthy:false,state:'disabled'}));process.exitCode=2;return;
  }
  const client=getAdminClient(),restaurant=process.env.RESTOBOT_RESTAURANT_ID;
  if(!client||!restaurant)throw new Error('Missing configuration');
  const schedule=validateSchedule({timeZone:process.env.RESTOBOT_SCHEDULE_TIMEZONE||'',at:process.env.RESTOBOT_SCHEDULE_AT||'04:30'});
  const {data,error}=await client.from('daily_forecast_runs').select('local_date,status,lease_until,next_attempt_at,failure_code')
    .eq('restaurant_id',restaurant).order('local_date',{ascending:false}).limit(14).abortSignal(AbortSignal.timeout(10000));
  if(error||!data)throw new Error('Status unavailable');
  const result=dailyOperationsHealth(new Date(),schedule,data);
  console.log(JSON.stringify({...result,checkedAt:new Date().toISOString()}));
  if(!result.healthy)process.exitCode=1;
}
main().catch(()=>{console.error(JSON.stringify({healthy:false,state:'monitor_unavailable'}));process.exitCode=1;});
