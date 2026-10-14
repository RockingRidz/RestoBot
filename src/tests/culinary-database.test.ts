import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {readFileSync} from 'node:fs';
import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import {buildApproval} from '../lib/orderApproval';
import type {ForecastResult} from '../lib/forecastEngine';
let db:PGlite;
const tenant='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002';
const owner='20000000-0000-4000-8000-000000000001',outsider='20000000-0000-4000-8000-000000000002';
const ing='30000000-0000-4000-8000-000000000001';
let menu:any;
beforeAll(async()=>{
 db=await PGlite.create({extensions:{pgcrypto}});
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO authenticated,service_role;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 INSERT INTO auth.users(id,email) VALUES ('${owner}','owner@example.invalid'),('${outsider}','other@example.invalid');`);
 for(const name of ['001_restobot_production.sql','002_atomic_workflows.sql','003_culinary_rules.sql','004_recipe_tenant_links.sql']) await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));
 await db.exec(readFileSync('supabase/migrations/003_culinary_rules.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/005_confirmed_zero_sales.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/005_confirmed_zero_sales.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/006_closure_calendar.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/006_closure_calendar.sql','utf8'));
 await db.exec(`INSERT INTO restaurants(id,name) VALUES ('${tenant}','SQL fixture'),('${other}','Other tenant');
 INSERT INTO profiles(id,restaurant_id,is_owner,email) VALUES ('${owner}','${tenant}',true,'owner@example.invalid'),('${outsider}','${other}',true,'other@example.invalid');
 INSERT INTO ingredients(id,restaurant_id,name,base_unit,unit,current_stock,current_cost_per_unit,cost_per_unit,procurement)
 VALUES ('${ing}','${tenant}','SQL chicken','kg','kg',10,10,10,'{"pack_size":2.5,"lead_time_days":1}');`);
 const result=await db.query<any>('SELECT restobot_save_recipe($1,$2::jsonb) AS menu',[tenant,JSON.stringify({name:'SQL edible dish',selling_price:20,recipes:[{ingredient_id:ing,quantity_required:200,unit:'g',quantity_basis:'edible',yield_percent:80,culinary_role:'bulk',substitutes:[]}]})]);
 menu=result.rows[0].menu;
},30000);
afterAll(async()=>{await db?.close();});
describe('Actual PostgreSQL culinary migrations and transactions',()=>{
 it('stores closure dates and prevents another tenant from changing them',async()=>{
  await db.query('UPDATE restaurants SET closed_dates=$1::jsonb WHERE id=$2',[JSON.stringify(['2026-12-25']),tenant]);
  expect((await db.query<any>('SELECT closed_dates FROM restaurants WHERE id=$1',[tenant])).rows[0].closed_dates).toEqual(['2026-12-25']);
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${outsider}',false);`);
  try { expect((await db.query('UPDATE restaurants SET closed_dates=$1::jsonb WHERE id=$2 RETURNING id',['[]',tenant])).rows).toHaveLength(0); }
  finally { await db.exec('RESET ROLE'); }
 });
 it('rejects a cross-tenant ingredient link even when its UUID is known',async()=>{
  const foreignMenu='40000000-0000-4000-8000-000000000002';
  await db.query('INSERT INTO menu_items(id,restaurant_id,name,selling_price) VALUES ($1,$2,$3,10)',[foreignMenu,other,'Other menu']);
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${outsider}',false);`);
  try {
   await expect(db.query('INSERT INTO recipe_ingredients(menu_item_id,ingredient_id,quantity_per_menu_item,unit) VALUES ($1,$2,1,$3)',[foreignMenu,ing,'kg'])).rejects.toThrow(/row-level security/);
  }finally{await db.exec('RESET ROLE');}
 });
 it('persists recipe yield/role and packaging metadata and converts US fluid ounces',async()=>{
  expect(menu.recipe_ingredients[0].quantity_basis).toBe('edible');expect(Number(menu.recipe_ingredients[0].yield_percent)).toBe(80);
  expect(menu.recipe_ingredients[0].culinary_role).toBe('bulk');
  const r=await db.query<any>('SELECT procurement FROM ingredients WHERE id=$1',[ing]);expect(r.rows[0].procurement.pack_size).toBe(2.5);
  const factor=await db.query<any>("SELECT restobot_unit_factor('fl_oz','gal') AS factor");expect(Number(factor.rows[0].factor)*128).toBeCloseTo(1);
  await expect(db.query("SELECT restobot_unit_factor('oz','fl_oz')")).rejects.toThrow();
 });
 it('rolls back invalid edible recipes rather than saving a partial menu',async()=>{
  await expect(db.query('SELECT restobot_save_recipe($1,$2::jsonb)',[tenant,JSON.stringify({name:'Invalid missing yield',selling_price:20,recipes:[{ingredient_id:ing,quantity_required:1,quantity_basis:'edible'}]})])).rejects.toThrow(/yield/);
  expect((await db.query("SELECT id FROM menu_items WHERE name='Invalid missing yield'")).rows).toHaveLength(0);
 });
 it('deducts cooked-yield usage once, but keeps counted stock for historical backfills',async()=>{
  const row={id:'sql-sale-1',order_id:'sql-order',sold_at:'2026-09-26T12:00:00Z',item_name:'SQL edible dish',quantity_sold:4,unit_price:20,total_amount:80};
  const first=await db.query<any>('SELECT restobot_ingest_sales($1,$2::jsonb) AS result',[tenant,JSON.stringify([row])]);expect(first.rows[0].result.inserted).toBe(1);
  expect(Number((await db.query<any>('SELECT current_stock FROM ingredients WHERE id=$1',[ing])).rows[0].current_stock)).toBe(9);
  const repeat=await db.query<any>('SELECT restobot_ingest_sales($1,$2::jsonb) AS result',[tenant,JSON.stringify([row])]);expect(repeat.rows[0].result.duplicates).toBe(1);
  await db.query('SELECT restobot_ingest_sales($1,$2::jsonb,false)',[tenant,JSON.stringify([{...row,id:'historical-sql',quantity_sold:40,total_amount:800}])]);
  expect(Number((await db.query<any>('SELECT current_stock FROM ingredients WHERE id=$1',[ing])).rows[0].current_stock)).toBe(9);
 });
 it('persists explicit zero observations without consuming stock and rejects unconfirmed zeros',async()=>{
  const before=(await db.query<any>('SELECT current_stock FROM ingredients WHERE id=$1',[ing])).rows[0].current_stock;
  const row={id:'sql-zero',sold_at:'2026-09-25T12:00:00Z',item_name:'SQL edible dish',quantity_sold:0,unit_price:20,total_amount:0,transaction_type:'zero_sales'};
  const first=await db.query<any>('SELECT restobot_ingest_sales($1,$2::jsonb,false) AS result',[tenant,JSON.stringify([row])]);
  expect(first.rows[0].result.inserted).toBe(1);
  expect((await db.query<any>('SELECT current_stock FROM ingredients WHERE id=$1',[ing])).rows[0].current_stock).toBe(before);
  await expect(db.query('SELECT restobot_ingest_sales($1,$2::jsonb)',[tenant,JSON.stringify([{...row,id:'invalid-zero',transaction_type:'sale'}])])).rejects.toThrow(/Invalid sale/);
 });
 it('enforces SQL tenant isolation and denies anonymous workflow execution',async()=>{
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${outsider}',false);`);
  try {
   expect((await db.query('SELECT id FROM ingredients WHERE id=$1',[ing])).rows).toHaveLength(0);
   expect((await db.query('UPDATE ingredients SET current_stock=999 WHERE id=$1 RETURNING id',[ing])).rows).toHaveLength(0);
   await expect(db.query('SELECT restobot_save_recipe($1,$2::jsonb)',[tenant,'{}'])).rejects.toThrow(/permission denied/);
  }finally{await db.exec('RESET ROLE');}
  await db.exec('SET ROLE anon');
  try{await expect(db.query('SELECT restobot_ingest_sales($1,$2::jsonb,false)',[tenant,'[]'])).rejects.toThrow(/permission denied/);}finally{await db.exec('RESET ROLE');}
 });
 it('restores persisted recipe metadata, stock and tenant policies from a database backup',async()=>{
  const forecastId='50000000-0000-4000-8000-000000000001';
  const approval=buildApproval({lines:[{id:'line',ingredient_name:'SQL chicken',recommended_order_qty:2,unit_cost:10,unit:'kg',supplier_name:'SQL supplier'}]} as ForecastResult,forecastId,{line:3},'Verified event',owner,'2026-09-27T12:00:00Z');
  await db.query('INSERT INTO forecasts(id,restaurant_id,target_date,forecast_explanation) VALUES ($1,$2,$3,$4::jsonb)',[forecastId,tenant,'2026-09-28',JSON.stringify({schemaVersion:2,inputFingerprint:'restore-fixture',result:{lines:approval.lines}})]);
  await db.query('INSERT INTO order_notes(restaurant_id,forecast_id,channel,note_text,total_amount,lines,status) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)',[tenant,forecastId,approval.channel,approval.noteText,approval.totalAmount,JSON.stringify(approval.lines),approval.status]);
  const backup=await db.dumpDataDir();
  const restored=await PGlite.create({extensions:{pgcrypto},loadDataDir:backup});
  try {
   expect((await restored.query<any>('SELECT quantity_basis,yield_percent FROM recipe_ingredients WHERE menu_item_id=$1',[menu.id])).rows[0]).toMatchObject({quantity_basis:'edible',yield_percent:'80'});
   expect(Number((await restored.query<any>('SELECT current_stock FROM ingredients WHERE id=$1',[ing])).rows[0].current_stock)).toBe(9);
   const recovered=(await restored.query<any>('SELECT note_text,lines,total_amount FROM order_notes WHERE forecast_id=$1',[forecastId])).rows[0];
   expect(recovered.note_text).toBe(approval.noteText);
   expect(recovered.lines[0]).toMatchObject({suggested_qty:2,approved_qty:3,approved_by:owner,edit_reason:'Verified event',approved_at:'2026-09-27T12:00:00Z'});
   expect(Number(recovered.total_amount)).toBe(30);
   await restored.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${outsider}',false);`);
   expect((await restored.query('SELECT id FROM ingredients WHERE id=$1',[ing])).rows).toHaveLength(0);
   expect((await restored.query('SELECT id FROM order_notes WHERE forecast_id=$1',[forecastId])).rows).toHaveLength(0);
  }finally{await restored.close();}
 },30000);
});
