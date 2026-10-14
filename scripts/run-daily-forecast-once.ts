// Explicit one-shot operational verification. Retains a real draft and job audit record.
import '../loadEnv';
import { GoogleGenAI } from '@google/genai';
import { loadAll, getAccountProfile } from '../src/lib/dataStore';
import { getAdminClient } from '../src/lib/supabaseAdmin';
import { getGeminiModel } from '../src/lib/aiConfig';
import { prepareAiForecast, ForecastInputError } from '../src/lib/aiForecastService';
import { forecastRow } from '../src/lib/forecastStore';
import { createDailyScheduler, dueLocalDate, validateSchedule } from '../src/lib/dailyScheduler';
import { dailyJobStore } from '../src/lib/dailyJobStore';
import { BUSINESS_TIME_ZONE } from '../src/lib/businessDate';
import { aiRequestsAllowed, withAiUsageLimit } from '../src/lib/aiUsage';

async function main() {
  if(!process.argv.includes('--run-once'))throw new Error('Pass --run-once to generate and retain a real scheduled draft.');
  const client=getAdminClient();
  if(!client||!process.env.GEMINI_API_KEY||!process.env.RESTOBOT_RESTAURANT_ID||!aiRequestsAllowed())throw new Error('Explicit database, restaurant and enabled AI usage policy required');
  const schedule=validateSchedule({timeZone:process.env.RESTOBOT_SCHEDULE_TIMEZONE||'',at:process.env.RESTOBOT_SCHEDULE_AT||'04:30'});
  if(schedule.timeZone!==BUSINESS_TIME_ZONE)throw new Error(`Daily scheduling timezone must be ${BUSINESS_TIME_ZONE}`);
  const date=dueLocalDate(new Date(),schedule);
  if(!date)throw new Error('The local schedule is not due yet');
  await loadAll(false);
  const restaurantId=getAccountProfile().restaurantId;
  const provider=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
  const guardedModels=new Proxy(provider.models,{get(target,property,receiver){
    if(property!=='generateContent')return Reflect.get(target,property,receiver);
    return (...args:Parameters<typeof target.generateContent>)=>withAiUsageLimit(()=>target.generateContent(...args));
  }});
  const ai=new Proxy(provider,{get(target,property,receiver){
    return property==='models'?guardedModels:Reflect.get(target,property,receiver);
  }});
  let generations=0;
  const tick=createDailyScheduler({schedule,store:dailyJobStore(client,restaurantId),
    async generate() {
      generations++;
      try {
        const prepared=await prepareAiForecast(ai,getGeminiModel());
        return {forecast:forecastRow(prepared.result,1.1,prepared.generatedAt,undefined,prepared.inputFingerprint)};
      } catch(error) {
        if(error instanceof ForecastInputError&&error.code==='closed_target_date')return {skip:'closed_target_date'};
        throw error;
      }
    },report:event=>console.log(JSON.stringify(event)),
  });
  await tick();
  const {data:run,error}=await client.from('daily_forecast_runs').select('id,status,attempts,forecast_id,failure_code')
    .eq('restaurant_id',restaurantId).eq('local_date',date).abortSignal(AbortSignal.timeout(10000)).single();
  if(error||!run)throw new Error('Run could not be verified');
  if(run.status==='succeeded') {
    const {data:saved,error:savedError}=await client.from('forecasts').select('id').eq('id',run.forecast_id).eq('restaurant_id',restaurantId).single();
    if(savedError||!saved)throw new Error('Saved draft could not be verified');
  }
  console.log(JSON.stringify({localDate:date,timeZone:schedule.timeZone,generations,...run}));
  if(!['succeeded','skipped'].includes(run.status))process.exitCode=1;
}
main().catch(()=>{console.error('Daily one-shot verification failed; inspect run status and configuration.');process.exitCode=1;});
