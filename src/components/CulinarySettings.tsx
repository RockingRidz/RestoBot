import { unitLabel } from '../lib/displayText';
import React,{useState} from 'react';
import type {Ingredient,MenuItem,RecipeItem} from '../types';
export function RecipeBasisEditor({recipe,menu,onSave}:{recipe:RecipeItem;menu:MenuItem;onSave:(menu:MenuItem)=>Promise<boolean>}) {
 const [basis,setBasis]=useState(recipe.quantity_basis||'as_purchased');
 const [yieldPct,setYield]=useState(recipe.yield_percent?.toString()||'');
 const [role,setRole]=useState(recipe.culinary_role||'');
 const [message,setMessage]=useState('');
 const save=async()=>{
  const y=yieldPct?Number(yieldPct):undefined;
  if(basis==='edible'&&(y===undefined||!Number.isFinite(y)||y<=0||y>100)){setMessage('Enter a kitchen-measured yield above 0 and at most 100%.');return;}
  const patch={...recipe,quantity_basis:basis,yield_percent:basis==='edible'?y:undefined,culinary_role:role||undefined} as RecipeItem;
  const ok=await onSave({...menu,recipes:menu.recipes?.map(r=>r.id===recipe.id?patch:r)});setMessage(ok?'Recipe basis saved.':'Save failed.');
 };
 return <details><summary>Yield and culinary role</summary><label>Quantity basis<select value={basis} onChange={e=>setBasis(e.target.value as typeof basis)}><option value="as_purchased">Raw / as purchased</option><option value="edible">Edible / cooked</option></select></label>{basis==='edible'&&<label>Measured yield %<input aria-label="Measured yield percent" type="number" min="0.01" max="100" step="any" value={yieldPct} onChange={e=>setYield(e.target.value)}/></label>}<label>Role in this dish<select value={role} onChange={e=>setRole(e.target.value as typeof role)}><option value="">Chef review / unspecified</option><option value="accent">Flavor / aroma accent</option><option value="bulk">Bulk / body</option><option value="structural">Structural</option></select></label><button onClick={save}>Save yield and role</button>{message&&<p role="status">{message}</p>}</details>;
}
export function ProcurementEditor({ingredient,onSave}:{ingredient:Ingredient;onSave:(ingredient:Ingredient)=>Promise<boolean>}) {
 const [pack,setPack]=useState(ingredient.procurement?.pack_size?.toString()||'');
 const [lead,setLead]=useState(ingredient.procurement?.lead_time_days?.toString()||'');
 const [life,setLife]=useState(ingredient.procurement?.shelf_life_days?.toString()||'');
 const [message,setMessage]=useState('');
 const save=async()=>{
  const procurement:NonNullable<Ingredient['procurement']>={};
  for(const [k,v] of [['pack_size',pack],['lead_time_days',lead],['shelf_life_days',life]] as const){if(v!==''){const n=Number(v);if(!Number.isFinite(n)||n<0||(k!=='lead_time_days'&&n===0)){setMessage('Enter valid positive values; lead time may be zero.');return;}procurement[k]=n;}}
  const ok=await onSave({...ingredient,procurement});setMessage(ok?'Supplier settings saved.':'Save failed.');
 };
 return <details><summary>Packaging and delivery</summary><label>Pack size ({unitLabel(ingredient.unit)})<input aria-label={`Pack size: ${ingredient.name}`} type="number" step="any" value={pack} onChange={e=>setPack(e.target.value)}/></label><label>Lead time (days)<input aria-label={`Lead time: ${ingredient.name}`} type="number" value={lead} onChange={e=>setLead(e.target.value)}/></label><label>Planning shelf life (days)<input aria-label={`Planning shelf life: ${ingredient.name}`} type="number" value={life} onChange={e=>setLife(e.target.value)}/></label><p>Use supplier specifications. Shelf life is a planning warning, not a safe-to-serve decision.</p><button onClick={save}>Save supplier settings</button>{message&&<p role="status">{message}</p>}</details>;
}

