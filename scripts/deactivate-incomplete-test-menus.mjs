import dotenv from 'dotenv';
import {createClient} from '@supabase/supabase-js';
import {readFileSync,writeFileSync} from 'node:fs';
dotenv.config({path:'.env.local',quiet:true});
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const tenant=JSON.parse(readFileSync('synthetic-data/rinet-synthetic-v1/fixture.json','utf8')).restaurantId;
if(!tenant) throw new Error('Configured restaurant required');
const {data:menus,error}=await db.from('menu_items').select('id,name,active_status').eq('restaurant_id',tenant).in('name',['Cheese','pepper']);
if(error||menus.length!==2) throw new Error('Expected the two user-approved menu items');
for(const menu of menus){
 const {count,error}=await db.from('sales_records').select('id',{count:'exact',head:true}).eq('restaurant_id',tenant).eq('menu_item_name',menu.name);
 if(error||count) throw new Error('Menu has sales or could not be checked; stopping');
}
writeFileSync('synthetic-data/rinet-synthetic-v1/deactivated-menus.json',JSON.stringify({restaurantId:tenant,previous:menus,reason:'Owner authorized temporary inactivation for synthetic workflow testing'},null,2),{flag:'wx'});
const result=await db.from('menu_items').update({active_status:false}).eq('restaurant_id',tenant).in('id',menus.map(m=>m.id)).select('name,active_status');
if(result.error||result.data.length!==2) throw new Error('Could not verify both menu updates');
console.log(JSON.stringify(result.data));
