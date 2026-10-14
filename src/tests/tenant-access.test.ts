import {describe,it,expect,vi,beforeAll,afterAll} from 'vitest';
const tenant=vi.hoisted(()=>({id:'00000000-0000-4000-8000-000000000001'}));
vi.mock('../lib/supabaseAdmin',()=>({
 persistenceMode:()=> 'memory',checkAdminConnection:async()=>({connected:false}),
 verifyAccessToken:async(token:string)=>token==='owner'||token==='other'?{id:token}:null,
 getAdminClient:()=>({from:()=>({select:()=>({eq:(_field:string,user:string)=>({maybeSingle:async()=>({data:{restaurant_id:user==='owner'?tenant.id:'different-tenant',is_owner:true},error:null})})})})}),
}));
import {openTestServer} from './testServer';
import {getAccountProfile} from '../lib/dataStore';
let server:Awaited<ReturnType<typeof openTestServer>>;
beforeAll(async()=>{tenant.id=getAccountProfile().restaurantId;server=await openTestServer();process.env.RESTOBOT_REQUIRE_AUTH='true';});
afterAll(async()=>{delete process.env.RESTOBOT_REQUIRE_AUTH;await server.close();});
describe('Authenticated tenant boundary',()=>{
 it('rejects another tenant on read/write even when it spoofs a restaurant ID',async()=>{
  const results=await Promise.all([
   fetch(server.url+'/api/ingredients',{headers:{Authorization:'Bearer owner'}}),
   fetch(server.url+'/api/ingredients?restaurant_id='+tenant.id,{headers:{Authorization:'Bearer other'}}),
   fetch(server.url+'/api/ingredients',{method:'POST',headers:{Authorization:'Bearer other','Content-Type':'application/json'},body:JSON.stringify({restaurant_id:tenant.id,name:'spoof'})}),
   fetch(server.url+'/api/ingredients',{headers:{Authorization:'Bearer invalid'}}),
   fetch(server.url+'/api/ingredients'),
  ]);
 expect(results.map(r=>r.status)).toEqual([200,403,403,401,401]);
 });
 it('protects scheduler status from anonymous and other-tenant callers',async()=>{
  const results=await Promise.all([
   fetch(server.url+'/api/operations/daily-forecast'),
   fetch(server.url+'/api/operations/daily-forecast',{headers:{Authorization:'Bearer other'}}),
   fetch(server.url+'/api/operations/daily-forecast',{headers:{Authorization:'Bearer owner'}}),
  ]);
  expect(results.map(r=>r.status)).toEqual([401,403,200]);
  expect(await results[2].json()).toEqual({enabled:false,runs:[]});
 });
});
