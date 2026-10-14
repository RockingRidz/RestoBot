// Read-only deployment checks. Never print keys, connection strings or restaurant data.
import dotenv from 'dotenv';
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';
dotenv.config({path:fileURLToPath(new URL('../.env.local',import.meta.url)),quiet:true});
const checks=[];
const record=(name,passed,detail)=>checks.push({name,passed,detail});
record('Gemini server credential',!!process.env.GEMINI_API_KEY?.trim(),'Presence only; no paid generation');
const configured=!!(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY&&process.env.SUPABASE_ANON_KEY);
record('Supabase server configuration',configured,'Required URL, service key and auth key');
record('Explicit restaurant identity',!!process.env.RESTOBOT_RESTAURANT_ID,'Required in production; no restaurant-name fallback');
if(configured){
 const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 if(process.env.RESTOBOT_RESTAURANT_ID){
  try{
   const {data,error}=await client.from('restaurants').select('id').eq('id',process.env.RESTOBOT_RESTAURANT_ID).maybeSingle().abortSignal(AbortSignal.timeout(10000));
   record('Configured restaurant exists',!error&&!!data,'Exact configured ID only');
  }catch{record('Configured restaurant exists',false,'Lookup unavailable');}
 }
 for(const [table,columns] of [
  ['restaurants','id,closed_dates'],
  ['ingredients','id,restaurant_id,procurement'],
  ['recipe_ingredients','id,quantity_basis,yield_percent,culinary_role,substitutes'],
  ['forecasts','id,restaurant_id,forecast_explanation'],
  ['order_notes','id,restaurant_id,lines,channel,status'],
  ['sales_records','id,restaurant_id,metadata'],
  ...(process.env.RESTOBOT_SCHEDULER_ENABLED==='true' ? [['daily_forecast_runs','id,restaurant_id,local_date,status,lease_token,lease_until,next_attempt_at,attempts']] : []),
 ]){
  try{
   const {error}=await client.from(table).select(columns).limit(0).abortSignal(AbortSignal.timeout(10000));
   record(`${table} schema`,!error,error?`Check failed (${error.code||'network'}); verify migration and database access`:'Required columns available');
  }catch{record(`${table} schema`,false,'Database request timed out or failed');}
 }
}
console.log(JSON.stringify({checkedAt:new Date().toISOString(),passed:checks.every(c=>c.passed),checks,limits:['Does not verify deployed auth redirects, RLS policy definitions, scheduled jobs, backups or real restaurant accuracy.']},null,2));
if(checks.some(c=>!c.passed))process.exitCode=1;
