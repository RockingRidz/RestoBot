// Explicit opt-in import into the configured restaurant. No deletes or real-data overwrites.
import '../loadEnv';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {buildSyntheticFixture,fixtureName,syntheticLabel} from './syntheticFixture';
import * as store from '../src/lib/dataStore';
import {getAdminClient,persistenceMode} from '../src/lib/supabaseAdmin';

if(!process.argv.includes('--apply')) throw new Error('Pass --apply to import the synthetic fixture into the configured restaurant.');
const db=getAdminClient();
if(!db||persistenceMode()!=='supabase') throw new Error('Configured Supabase required');
await store.loadAll(false);
const restaurant=store.getAccountProfile();
const f=buildSyntheticFixture(restaurant.restaurantId,new Date().toISOString().slice(0,10));
const directory=path.resolve('synthetic-data',fixtureName);
mkdirSync(directory,{recursive:true});
const prior={ingredients:store.listIngredients().map(i=>({id:i.id,stock:i.current_stock})),sales:store.listSales().length};
writeFileSync(path.join(directory,'fixture.json'),JSON.stringify(f,null,2));
writeFileSync(path.join(directory,'README.md'),`# Synthetic workflow data\n\nFabricated shift totals, recipes, prices, packs and stock. Not real POS data or accuracy evidence.\n\nRestaurant: ${restaurant.restaurantName}\n180 completed UTC days; all menu, ingredient and supplier names begin with ${syntheticLabel}. Supplier addresses use example.invalid and cannot receive real orders.\n\nHistorical import preserves stock. Reruns skip existing catalog rows and deduplicate sales IDs. No real records are overwritten or deleted.\n`);
console.log(`Importing synthetic fixture into ${restaurant.restaurantName}: ${f.ingredients.length} ingredients, ${f.menuItems.length} menus, ${f.sales.length} sales.`);
// Abort on a name collision with a row this fixture did not create.
for(const item of f.ingredients){
 const existing=store.listIngredients().find(i=>i.name===item.name);
 if(existing&&existing.id!==item.id) throw new Error('Synthetic ingredient name collision; nothing overwritten');
}
for(const item of f.menuItems){
 const existing=store.listMenuItems().find(i=>i.name===item.name);
 if(existing&&existing.id!==item.id) throw new Error('Synthetic menu name collision; nothing overwritten');
}
for(const supplier of f.suppliers) if(!store.listSuppliers().some(s=>s.name===supplier.name)) await store.upsertSupplier(supplier);
for(const item of f.ingredients) if(!store.listIngredients().some(i=>i.id===item.id)) await store.upsertIngredient(item);
for(const item of f.menuItems) if(!store.listMenuItems().some(i=>i.id===item.id)) await store.saveRecipe(item);
console.log('Synthetic suppliers, stock and recipes saved. Importing historical sales without stock deduction.');
let inserted=0,duplicates=0;
for(let start=0;start<f.sales.length;start+=500){
 const {data,error}=await db.rpc('restobot_ingest_sales',{p_restaurant_id:restaurant.restaurantId,p_rows:f.sales.slice(start,start+500),p_apply_inventory:false});
 if(error||!data) throw new Error(`Synthetic import failed at row ${start}; rerun safely to resume`);
 inserted+=data.inserted;duplicates+=data.duplicates;
 if(start%2500===0) console.log(`Processed ${Math.min(start+500,f.sales.length)}/${f.sales.length} sales`);
}
await store.loadAll(false);
const actual=new Set(store.listSales().map(s=>s.id));
assert(f.sales.every(s=>actual.has(s.id)),'All expected sales must survive database reload');
for(const item of prior.ingredients) assert.equal(store.listIngredients().find(i=>i.id===item.id)?.current_stock,item.stock,'Existing stock unchanged');
for(const item of f.ingredients) if(!prior.ingredients.some(i=>i.id===item.id)) assert.equal(store.listIngredients().find(i=>i.id===item.id)?.current_stock,item.current_stock,'Synthetic initial stock unchanged');
const replay=await db.rpc('restobot_ingest_sales',{p_restaurant_id:restaurant.restaurantId,p_rows:f.sales.slice(0,500),p_apply_inventory:false});
assert(!replay.error);assert.equal(replay.data.inserted,0);assert.equal(replay.data.duplicates,500);
const report={fixture:fixtureName,synthetic:true,restaurant:restaurant.restaurantName,verifiedAt:new Date().toISOString(),days:f.days,ingredients:f.ingredients.length,menus:f.menuItems.length,suppliers:f.suppliers.length,expectedSales:f.sales.length,inserted,duplicates,totalSales:store.listSales().length,stockPreserved:true,replayInserted:0};
writeFileSync(path.join(directory,'import-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
