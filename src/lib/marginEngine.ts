import { MenuItem, Ingredient, MarginAlert, SalesRecord } from '../types';
import { purchaseQuantity, suggestCulinarySubstitutes } from './culinaryKnowledge';

export interface CalculatedMenuCost {
  menuItem:MenuItem; calculatedCost:number; marginPercent:number; targetMarginPercent:number; isMarginHealthy:boolean;
  complete:boolean; warnings:string[];
  costBreakdown:Array<{ingredient_name:string;qty:number;unit:string;unit_cost:number;portion_cost:number}>;
}
export function calculateMenuCostsAndMargins(menuItems:MenuItem[],ingredients:Ingredient[]):CalculatedMenuCost[] {
  return menuItems.map(item=>{
    let cost=0; const warnings:string[]=[];
    const costBreakdown:CalculatedMenuCost['costBreakdown']=[];
    if(!item.recipes?.length) warnings.push('No recipe: cost is unavailable');
    for(const recipe of item.recipes||[]) {
      const ing=ingredients.find(i=>i.id===recipe.ingredient_id);
      if(!ing){warnings.push(`Missing ingredient ${recipe.ingredient_id}`);continue;}
      try {
        if(!Number.isFinite(ing.cost_per_unit)||ing.cost_per_unit<0) throw new Error(`Missing or invalid price for ${ing.name}`);
        const qty=purchaseQuantity(recipe,ing);const portion=qty*ing.cost_per_unit; cost+=portion;
        costBreakdown.push({ingredient_name:ing.name,qty,unit:ing.unit,unit_cost:ing.cost_per_unit,portion_cost:Math.round(portion*1000)/1000});
      } catch(e){warnings.push((e as Error).message);}
    }
    const complete=warnings.length===0;
    const calculatedCost=complete?Math.round(cost*100)/100:NaN;
    const marginPercent=complete&&item.selling_price>0?Math.round((item.selling_price-calculatedCost)/item.selling_price*1000)/10:NaN;
    const targetMarginPercent=item.target_margin_percent??60;
    return {menuItem:{...item,calculated_cost:complete?calculatedCost:undefined,current_margin_percent:Number.isFinite(marginPercent)?marginPercent:undefined},calculatedCost,marginPercent,targetMarginPercent,isMarginHealthy:complete&&marginPercent>=targetMarginPercent,complete,warnings,costBreakdown};
  });
}
export function detectSupplierPriceCreeps(ingredients:Ingredient[],menuItems:MenuItem[],salesOrExplicitEstimate:SalesRecord[]|number=[],asOf=new Date()):MarginAlert[] {
  const alerts:MarginAlert[]=[];
  for(const ing of ingredients){
    const old=ing.previous_cost_per_unit,current=ing.cost_per_unit;
    if(old===undefined||!Number.isFinite(old)||old<=0||!Number.isFinite(current)||current<=old)continue;
    for(const menu of menuItems.filter(m=>m.is_active!==false&&m.recipes?.some(r=>r.ingredient_id===ing.id))){
      let costDiff:number;
      try{costDiff=(menu.recipes||[]).filter(r=>r.ingredient_id===ing.id).reduce((s,r)=>s+purchaseQuantity(r,ing)*(current-old),0);}catch{continue;}
      const increase=Math.round((current-old)/old*1000)/10;
      let volume=0,available=false,basis='No recent sales coverage; monthly impact unavailable.';
      if(typeof salesOrExplicitEstimate==='number'&&Number.isFinite(salesOrExplicitEstimate)&&salesOrExplicitEstimate>=0){volume=salesOrExplicitEstimate;available=true;basis=`Explicit scenario estimate: ${volume} dishes/month; not observed demand.`;}
      else if(Array.isArray(salesOrExplicitEstimate)) {
        const recent=salesOrExplicitEstimate.filter(s=>s.item_name.trim().toLowerCase()===menu.name.trim().toLowerCase()&&Number.isFinite(s.quantity_sold)&&s.quantity_sold>=0&&Date.parse(s.sold_at)<=asOf.getTime()&&Date.parse(s.sold_at)>asOf.getTime()-30*86400000&&!/refund|void|cancel|return/i.test(s.transaction_type||''));
        if(recent.length){volume=recent.reduce((s,r)=>s+r.quantity_sold,0);available=true;basis=`Impact at ${volume} recorded item units in the trailing 30 days; incomplete exports may understate demand.`;}
      }
      const calculated=calculateMenuCostsAndMargins([menu],ingredients)[0];
      const target=menu.target_margin_percent;
      const targetPrice=calculated.complete&&target>=0&&target<100?Math.ceil(calculated.calculatedCost/(1-target/100)*100)/100:null;
      const loss=Math.round(costDiff*volume*100)/100;
      const substitutes=suggestCulinarySubstitutes(ing,menu,ingredients);
      alerts.push({id:`alert_creep_${ing.id}_${menu.id}`,restaurant_id:ing.restaurant_id,ingredient_id:ing.id,ingredient_name:ing.name,affected_menu_item_id:menu.id,affected_menu_item_name:menu.name,old_cost:old,new_cost:current,increase_percent:increase,estimated_monthly_loss:loss,loss_available:available,loss_basis:basis,cost_increase_per_dish:Math.round(costDiff*100)/100,suggested_substitutes:substitutes,
        suggested_action:`${ing.name} rose ${increase}%; adds $${costDiff.toFixed(2)} per dish. ${available?`Impact at recorded/explicit volume: $${loss.toFixed(2)}. `:''}${calculated.complete?`Current margin ${calculated.marginPercent}%, target ${target}%. `:'Complete recipe costs before changing price. '}${targetPrice!==null&&!calculated.isMarginHealthy?`Price to meet target at current costs: $${targetPrice.toFixed(2)}. `:''}${substitutes.length?'Chef-review alternatives: '+substitutes.map(s=>s.name).join(', ')+'.':''}`,is_resolved:false,created_at:asOf.toISOString()});
    }
  }
  return alerts;
}
