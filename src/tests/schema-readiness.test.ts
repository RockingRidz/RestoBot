import {describe,it,expect} from 'vitest';
import {checkOperationalSchema} from '../lib/supabaseAdmin';
function client(failed:string[]):any {
 return {from:(table:string)=>{
  const query={select:()=>query,limit:()=>query,abortSignal:async()=>({error:failed.includes(table)?{code:'42703'}:null})};
  return query;
 }};
}
describe('Production schema readiness',()=>{
 it('requires configuration',async()=>expect(await checkOperationalSchema(null)).toEqual({ready:false,missing:['Supabase configuration']}));
 it('identifies missing culinary columns before accepting production traffic',async()=>expect(await checkOperationalSchema(client(['recipe_ingredients','ingredients']))).toEqual({ready:false,missing:['ingredients','recipe_ingredients']}));
 it('allows the required schema',async()=>expect(await checkOperationalSchema(client([]))).toEqual({ready:true,missing:[]}));
});
