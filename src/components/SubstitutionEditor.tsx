import { unitLabel } from '../lib/displayText';
import React,{useState} from 'react';
import type {Ingredient,MenuItem} from '../types';
export function SubstitutionEditor({menu,originalId,replacement,onSave}:{menu:MenuItem;originalId:string;replacement:Ingredient;onSave:(menu:MenuItem)=>Promise<boolean>}) {
 const recipe=menu.recipes?.find(r=>r.ingredient_id===originalId);
 const saved=recipe?.substitutes?.find(s=>s.ingredient_id===replacement.id);
 const [qty,setQty]=useState(saved?.replacement_quantity?.toString()||'');
 const [unit,setUnit]=useState(saved?.replacement_unit||replacement.unit);
 const [chef,setChef]=useState(saved?.verified_by||'');
 const [verified,setVerified]=useState(saved?.chef_verified||false);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 if(!recipe || menu.recipes?.filter(r=>r.ingredient_id===originalId).length!==1)return <p>Consolidate duplicate recipe rows before configuring a replacement portion.</p>;
 const save=async()=>{
   setMessage('');const quantity=Number(qty);
   if(!qty||!Number.isFinite(quantity)||quantity<=0){setMessage('Enter a positive measured replacement quantity.');return;}
   if(verified&&!chef.trim()){setMessage('Enter the verifying chef or owner name.');return;}
   const substitutes=[...(recipe.substitutes||[]).filter(s=>s.ingredient_id!==replacement.id),{ingredient_id:replacement.id,replacement_quantity:quantity,replacement_unit:unit,chef_verified:verified,verified_by:chef}];
   setBusy(true);try{const ok=await onSave({...menu,recipes:menu.recipes?.map(r=>r.id===recipe.id?{...r,substitutes}:r)});setMessage(ok?'Replacement portion saved. Recipe and order quantities remain unchanged.':'Save failed.');}finally{setBusy(false);}
 };
 return <details className="mt-2"><summary>Configure chef-verified replacement portion</summary><p>Amount of {replacement.name} for one dish. This does not replace the recipe automatically.</p><label>Replacement quantity <input aria-label={`Replacement quantity: ${replacement.name}`} type="number" min="0.000001" step="any" value={qty} onChange={e=>{setQty(e.target.value);setVerified(false);}}/></label><label>Unit <input aria-label={`Replacement unit: ${replacement.name}`} value={unitLabel(unit)} onChange={e=>{setUnit(e.target.value);setVerified(false);}}/></label><label>Chef / owner <input aria-label={`Verifying chef: ${replacement.name}`} value={chef} onChange={e=>setChef(e.target.value)}/></label><label><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/>Kitchen-tested portion; product allergens and dietary suitability reviewed</label><button disabled={busy} onClick={save}>{busy?'Saving…':'Save replacement portion'}</button>{message&&<p role="status">{message}</p>}</details>;
}
