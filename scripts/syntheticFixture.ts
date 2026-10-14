import { createHash } from 'node:crypto';
import type { Ingredient, MenuItem, SalesRecord } from '../src/types';

export const fixtureName = 'rinet-synthetic-v1';
export const syntheticLabel = '[SYNTHETIC] ';
export function fixtureId(restaurant: string, key: string) {
  const h = createHash('sha256').update(`${fixtureName}:${restaurant}:${key}`).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}

/** Fabricated shift totals, recipes and stock; never measured restaurant evidence. */
export function buildSyntheticFixture(restaurantId: string, endExclusive: string, days = 180) {
  const end = new Date(endExclusive + 'T00:00:00Z');
  if (!Number.isFinite(end.getTime()) || end.toISOString().slice(0,10) !== endExclusive || !Number.isInteger(days) || days < 1 || days > 365) throw new Error('Invalid fixture date or history length');
  const suppliers = ['Produce','Proteins','Seafood','Pantry','Dairy','Bakery'].map((name, i) => ({
    id: fixtureId(restaurantId, 'supplier:'+name), name: syntheticLabel+name+' Supply',
    contact_method: 'email', contact_value: `supplier-${i+1}@example.invalid`,
  }));
  // name, stock unit, invented cost/unit, supplier index, invented pack size
  const catalog: Array<[string,string,number,number,number]> = [
    ['Chicken','kg',7,1,2],['Tofu','kg',4,1,1],['Shrimp','kg',14,2,1],['Beef','kg',12,1,2],
    ['Rice noodles','kg',3,3,5],['Jasmine rice','kg',2.4,3,5],['Coconut milk','l',3.5,3,1],
    ['Green curry paste','kg',8,3,.5],['Red curry paste','kg',8.5,3,.5],['Garlic','kg',5,0,.5],
    ['Thai basil','kg',14,0,.25],['Bell pepper','kg',4,0,1],['Broccoli','kg',3.5,0,1],
    ['Carrot','kg',2,0,1],['Onion','kg',1.8,0,2],['Mushroom','kg',6,0,1],
    ['Lime','kg',4,0,1],['Lemongrass','kg',10,0,.25],['Chili','kg',8,0,.25],
    ['Soy sauce','l',3,3,1],['Fish sauce','l',4,3,1],['Cooking oil','l',2.5,3,5],
    ['Sugar','kg',1.5,3,2],['Peanuts','kg',5,3,1],['Egg','pcs',.25,1,30],
    ['Tamarind paste','kg',7,3,.5],['Tea','kg',12,3,.5],['Condensed milk','l',5,4,1],
    ['Mango','kg',5,0,1],['Sticky rice','kg',3,3,2],['Spring roll wrapper','pcs',.18,5,50],
    ['Cabbage','kg',1.5,0,2],['Sweet chili sauce','l',4,3,1],['Milk','l',2,4,1],
  ];
  const ingredients: Ingredient[] = catalog.map(([name,unit,cost,supplier,pack], i) => ({
    id:fixtureId(restaurantId,'ingredient:'+name), restaurant_id:restaurantId, name:syntheticLabel+name,
    category:['Produce','Proteins','Seafood','Pantry','Dairy','Bakery'][supplier],unit,
    current_stock:i%7===0 ? 0 : Number((pack * (i%3+.5)).toFixed(4)), min_threshold:pack*2,
    cost_per_unit:cost, previous_cost_per_unit:name==='Shrimp'?11:cost,
    supplier_name:suppliers[supplier].name,supplier_contact:suppliers[supplier].contact_value,
    procurement:{pack_size:pack,lead_time_days:1,shelf_life_days:supplier===0||supplier===1||supplier===2?4:30},
  }));
  const menuItems: MenuItem[] = [];
  function menu(name:string, price:number, category:string, recipe:Array<[string,number]>) {
    const id=fixtureId(restaurantId,'menu:'+name);
    menuItems.push({id,restaurant_id:restaurantId,name:syntheticLabel+name,category,selling_price:price,target_margin_percent:65,is_active:true,
      recipes:recipe.map(([ingredient,quantity])=>{
        const row=ingredients.find(i=>i.name===syntheticLabel+ingredient);
        if(!row) throw new Error('Unknown fixture ingredient');
        return {id:fixtureId(restaurantId,`recipe:${name}:${ingredient}`),menu_item_id:id,ingredient_id:row.id,ingredient_name:row.name,quantity_required:quantity,unit:row.unit,quantity_basis:'as_purchased',culinary_role:'bulk'};
      }),
    });
  }
  const dishes: Array<[string,number,Array<[string,number]>]> = [
    ['Pad Thai',15,[['Rice noodles',.12],['Tamarind paste',.02],['Peanuts',.015],['Egg',1],['Lime',.025],['Sugar',.008]]],
    ['Basil Rice',14,[['Jasmine rice',.1],['Thai basil',.015],['Bell pepper',.05],['Onion',.04],['Chili',.005]]],
    ['Green Curry',16,[['Jasmine rice',.1],['Coconut milk',.16],['Green curry paste',.025],['Broccoli',.06],['Fish sauce',.006]]],
    ['Red Curry',16,[['Jasmine rice',.1],['Coconut milk',.16],['Red curry paste',.025],['Bell pepper',.06],['Carrot',.04]]],
    ['Garlic Rice',14,[['Jasmine rice',.1],['Mushroom',.05],['Carrot',.04],['Egg',1]]],
    ['Tom Yum',15,[['Mushroom',.07],['Lemongrass',.015],['Lime',.03],['Chili',.004],['Fish sauce',.01]]],
  ];
  for(const [dish,price,recipe] of dishes) for(const [protein,extra] of [['Chicken',0],['Tofu',-1],['Shrimp',3],['Beef',2]] as const)
    menu(`${protein} ${dish}`,price+extra,'Mains',[[protein,.15],...recipe,['Garlic',.008],['Cooking oil',.012],['Soy sauce',.008]]);
  menu('Thai Iced Tea',5,'Drinks',[['Tea',.006],['Condensed milk',.04],['Milk',.1],['Sugar',.02]]);
  menu('Mango Sticky Rice',8,'Desserts',[['Mango',.15],['Sticky rice',.08],['Coconut milk',.06],['Sugar',.015]]);
  menu('Vegetable Spring Rolls',7,'Starters',[['Spring roll wrapper',3],['Cabbage',.08],['Carrot',.03],['Cooking oil',.015],['Sweet chili sauce',.035]]);
  menu('Lime Iced Tea',4,'Drinks',[['Tea',.006],['Lime',.04],['Sugar',.02]]);
  const sales:SalesRecord[]=[];
  for(let d=days;d>=1;d--) {
    const date=new Date(end.getTime()-d*86400000), key=date.toISOString().slice(0,10), weekend=[0,5,6].includes(date.getUTCDay());
    for(const [i,item] of menuItems.entries()) for(let shift=0;shift<3;shift++) {
      const seed=createHash('sha256').update(`${key}:${i}:${shift}`).digest().readUInt32BE(0);
      const units=(seed%97===0)?0:Math.max(1,Math.round((4+i%8)*(weekend?1.4:1)*(shift===1?1.25:.8)*(.75+(seed%51)/100)));
      const id=fixtureId(restaurantId,`sale:${key}:${item.id}:${shift}`);
      sales.push({id,restaurant_id:restaurantId,order_id:`SYNTHETIC-${key}-${i}-${shift}`,item_name:item.name,category:item.category,
        quantity_sold:units,unit_price:item.selling_price,total_amount:units*item.selling_price,
        sold_at:`${key}T${[12,17,21][shift]}:00:00.000Z`,transaction_type:units===0?'zero_sales':['Dine In','Takeaway','Online'][shift],
        metadata:{synthetic:true,fixture:fixtureName,aggregation:'fabricated shift totals'},
      });
    }
  }
  return {fixture:fixtureName,synthetic:true as const,restaurantId,endExclusive,days,suppliers,ingredients,menuItems,sales};
}
