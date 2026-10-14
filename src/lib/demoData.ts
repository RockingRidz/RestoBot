import { Restaurant, Ingredient, MenuItem, RecipeItem, SalesRecord, MarginAlert, WasteEntry, OrderNote } from '../types';

export const INITIAL_RESTAURANT: Restaurant = {
  id: 'rest_001',
  name: 'RestoBot Demo Kitchen',
  cuisine_type: 'Multi-Cuisine Street Food & Diner',
  location: 'Downtown Center, Shop #14',
  currency_symbol: '$',
  created_at: new Date().toISOString(),
};

export const INITIAL_INGREDIENTS: Ingredient[] = [
  {
    id: 'ing_01',
    restaurant_id: 'rest_001',
    name: 'Burger Bun / Vadapav Pav',
    category: 'Bakery',
    unit: 'pcs',
    current_stock: 350,
    min_threshold: 100,
    cost_per_unit: 0.15,
    previous_cost_per_unit: 0.15,
    supplier_name: 'Metro Daily Bakery',
    supplier_contact: 'orders@metrobakery.com | 555-0192',
    last_restocked: '2026-07-28',
  },
  {
    id: 'ing_02',
    restaurant_id: 'rest_001',
    name: 'Potatoes (Special Grade)',
    category: 'Produce',
    unit: 'kg',
    current_stock: 42.5,
    min_threshold: 15.0,
    cost_per_unit: 0.80,
    previous_cost_per_unit: 0.80,
    supplier_name: 'GreenValley Produce Co.',
    supplier_contact: 'supply@greenvalley.org',
    last_restocked: '2026-07-27',
  },
  {
    id: 'ing_03',
    restaurant_id: 'rest_001',
    name: 'Refined Frying Oil',
    category: 'Pantry / Oils',
    unit: 'liters',
    current_stock: 18.0,
    min_threshold: 25.0, // LOW STOCK!
    cost_per_unit: 2.40,
    previous_cost_per_unit: 2.10, // Price creeped up!
    supplier_name: 'Metro Wholesale Foods',
    supplier_contact: 'wholesaleline@metro.com',
    last_restocked: '2026-07-20',
  },
  {
    id: 'ing_04',
    restaurant_id: 'rest_001',
    name: 'Tortilla Wraps (10 inch)',
    category: 'Bakery',
    unit: 'pcs',
    current_stock: 180,
    min_threshold: 50,
    cost_per_unit: 0.25,
    previous_cost_per_unit: 0.25,
    supplier_name: 'Metro Daily Bakery',
    supplier_contact: 'orders@metrobakery.com',
    last_restocked: '2026-07-28',
  },
  {
    id: 'ing_05',
    restaurant_id: 'rest_001',
    name: 'Mozzarella & Cheddar Cheese Blend',
    category: 'Dairy',
    unit: 'kg',
    current_stock: 8.5, // LOW STOCK
    min_threshold: 12.0,
    cost_per_unit: 8.50,
    previous_cost_per_unit: 7.20, // 18% PriceCreep Warning!
    supplier_name: 'DairyCraft Creamery',
    supplier_contact: 'sales@dairycraft.com',
    last_restocked: '2026-07-22',
  },
  {
    id: 'ing_06',
    restaurant_id: 'rest_001',
    name: 'Veg Mix (Cabbage, Peas, Carrots)',
    category: 'Produce',
    unit: 'kg',
    current_stock: 14.0,
    min_threshold: 8.0,
    cost_per_unit: 1.20,
    previous_cost_per_unit: 1.20,
    supplier_name: 'GreenValley Produce Co.',
    supplier_contact: 'supply@greenvalley.org',
    last_restocked: '2026-07-28',
  },
  {
    id: 'ing_07',
    restaurant_id: 'rest_001',
    name: 'Chicken Breast Fillet',
    category: 'Poultry & Meat',
    unit: 'kg',
    current_stock: 6.2, // VERY LOW STOCK
    min_threshold: 10.0,
    cost_per_unit: 6.80,
    previous_cost_per_unit: 5.90, // 15% Price creep alert!
    supplier_name: 'Prime Meat Suppliers',
    supplier_contact: 'orders@primemeat.com',
    last_restocked: '2026-07-25',
  },
  {
    id: 'ing_08',
    restaurant_id: 'rest_001',
    name: 'Special Butter Spread',
    category: 'Dairy',
    unit: 'kg',
    current_stock: 11.0,
    min_threshold: 5.0,
    cost_per_unit: 5.40,
    previous_cost_per_unit: 5.40,
    supplier_name: 'DairyCraft Creamery',
    supplier_contact: 'sales@dairycraft.com',
    last_restocked: '2026-07-26',
  },
  {
    id: 'ing_09',
    restaurant_id: 'rest_001',
    name: 'Paneer (Cottage Cheese Block)',
    category: 'Dairy',
    unit: 'kg',
    current_stock: 9.0,
    min_threshold: 6.0,
    cost_per_unit: 6.00,
    previous_cost_per_unit: 6.00,
    supplier_name: 'DairyCraft Creamery',
    supplier_contact: 'sales@dairycraft.com',
    last_restocked: '2026-07-27',
  },
  {
    id: 'ing_10',
    restaurant_id: 'rest_001',
    name: 'Pizza Sauce & Spices',
    category: 'Pantry / Oils',
    unit: 'liters',
    current_stock: 12.0,
    min_threshold: 4.0,
    cost_per_unit: 3.50,
    previous_cost_per_unit: 3.50,
    supplier_name: 'Metro Wholesale Foods',
    supplier_contact: 'wholesaleline@metro.com',
    last_restocked: '2026-07-25',
  }
];

export const INITIAL_MENU_ITEMS: MenuItem[] = [
  {
    id: 'menu_01',
    restaurant_id: 'rest_001',
    name: 'Vadapav Classic',
    category: 'Street Food Snacks',
    selling_price: 2.50,
    target_margin_percent: 65,
    is_active: true,
    recipes: [
      { id: 'rec_01', menu_item_id: 'menu_01', ingredient_id: 'ing_01', ingredient_name: 'Burger Bun / Vadapav Pav', quantity_required: 1, unit: 'pcs' },
      { id: 'rec_02', menu_item_id: 'menu_01', ingredient_id: 'ing_02', ingredient_name: 'Potatoes (Special Grade)', quantity_required: 0.15, unit: 'kg' },
      { id: 'rec_03', menu_item_id: 'menu_01', ingredient_id: 'ing_03', ingredient_name: 'Refined Frying Oil', quantity_required: 0.02, unit: 'liters' },
      { id: 'rec_04', menu_item_id: 'menu_01', ingredient_id: 'ing_08', ingredient_name: 'Special Butter Spread', quantity_required: 0.01, unit: 'kg' },
    ]
  },
  {
    id: 'menu_02',
    restaurant_id: 'rest_001',
    name: 'Veg Frankie Roll',
    category: 'Rolls & Wraps',
    selling_price: 4.00,
    target_margin_percent: 65,
    is_active: true,
    recipes: [
      { id: 'rec_05', menu_item_id: 'menu_02', ingredient_id: 'ing_04', ingredient_name: 'Tortilla Wraps (10 inch)', quantity_required: 1, unit: 'pcs' },
      { id: 'rec_06', menu_item_id: 'menu_02', ingredient_id: 'ing_06', ingredient_name: 'Veg Mix (Cabbage, Peas, Carrots)', quantity_required: 0.12, unit: 'kg' },
      { id: 'rec_07', menu_item_id: 'menu_02', ingredient_id: 'ing_05', ingredient_name: 'Mozzarella & Cheddar Cheese Blend', quantity_required: 0.03, unit: 'kg' },
      { id: 'rec_08', menu_item_id: 'menu_02', ingredient_id: 'ing_03', ingredient_name: 'Refined Frying Oil', quantity_required: 0.015, unit: 'liters' },
    ]
  },
  {
    id: 'menu_03',
    restaurant_id: 'rest_001',
    name: 'Paneer Cheese Frankie',
    category: 'Rolls & Wraps',
    selling_price: 5.50,
    target_margin_percent: 60,
    is_active: true,
    recipes: [
      { id: 'rec_09', menu_item_id: 'menu_03', ingredient_id: 'ing_04', ingredient_name: 'Tortilla Wraps (10 inch)', quantity_required: 1, unit: 'pcs' },
      { id: 'rec_10', menu_item_id: 'menu_03', ingredient_id: 'ing_09', ingredient_name: 'Paneer (Cottage Cheese Block)', quantity_required: 0.10, unit: 'kg' },
      { id: 'rec_11', menu_item_id: 'menu_03', ingredient_id: 'ing_05', ingredient_name: 'Mozzarella & Cheddar Cheese Blend', quantity_required: 0.04, unit: 'kg' },
      { id: 'rec_12', menu_item_id: 'menu_03', ingredient_id: 'ing_08', ingredient_name: 'Special Butter Spread', quantity_required: 0.015, unit: 'kg' },
    ]
  },
  {
    id: 'menu_04',
    restaurant_id: 'rest_001',
    name: 'Crispy Chicken Burger',
    category: 'Burgers & Fries',
    selling_price: 6.99,
    target_margin_percent: 60,
    is_active: true,
    recipes: [
      { id: 'rec_13', menu_item_id: 'menu_04', ingredient_id: 'ing_01', ingredient_name: 'Burger Bun / Vadapav Pav', quantity_required: 1, unit: 'pcs' },
      { id: 'rec_14', menu_item_id: 'menu_04', ingredient_id: 'ing_07', ingredient_name: 'Chicken Breast Fillet', quantity_required: 0.15, unit: 'kg' },
      { id: 'rec_15', menu_item_id: 'menu_04', ingredient_id: 'ing_05', ingredient_name: 'Mozzarella & Cheddar Cheese Blend', quantity_required: 0.025, unit: 'kg' },
      { id: 'rec_16', menu_item_id: 'menu_04', ingredient_id: 'ing_03', ingredient_name: 'Refined Frying Oil', quantity_required: 0.03, unit: 'liters' },
    ]
  },
  {
    id: 'menu_05',
    restaurant_id: 'rest_001',
    name: 'Loaded Cheese Pizza (9")',
    category: 'Pizzas',
    selling_price: 9.50,
    target_margin_percent: 70,
    is_active: true,
    recipes: [
      { id: 'rec_17', menu_item_id: 'menu_05', ingredient_id: 'ing_05', ingredient_name: 'Mozzarella & Cheddar Cheese Blend', quantity_required: 0.15, unit: 'kg' },
      { id: 'rec_18', menu_item_id: 'menu_05', ingredient_id: 'ing_10', ingredient_name: 'Pizza Sauce & Spices', quantity_required: 0.08, unit: 'liters' },
      { id: 'rec_19', menu_item_id: 'menu_05', ingredient_id: 'ing_06', ingredient_name: 'Veg Mix (Cabbage, Peas, Carrots)', quantity_required: 0.08, unit: 'kg' },
    ]
  }
];

export const INITIAL_MARGIN_ALERTS: MarginAlert[] = [
  {
    id: 'alert_01',
    restaurant_id: 'rest_001',
    ingredient_id: 'ing_05',
    ingredient_name: 'Mozzarella & Cheddar Cheese Blend',
    affected_menu_item_id: 'menu_05',
    affected_menu_item_name: 'Loaded Cheese Pizza (9")',
    old_cost: 7.20,
    new_cost: 8.50,
    increase_percent: 18.0,
    estimated_monthly_loss: 285.00,
    suggested_action: 'Supplier "DairyCraft" raised cheese price by +18%. Recommend switching to Metro Dairy ($7.60/kg) or increasing Pizza price from $9.50 to $9.99.',
    is_resolved: false,
    created_at: '2026-07-28T09:15:00Z',
  },
  {
    id: 'alert_02',
    restaurant_id: 'rest_001',
    ingredient_id: 'ing_07',
    ingredient_name: 'Chicken Breast Fillet',
    affected_menu_item_id: 'menu_04',
    affected_menu_item_name: 'Crispy Chicken Burger',
    old_cost: 5.90,
    new_cost: 6.80,
    increase_percent: 15.2,
    estimated_monthly_loss: 215.00,
    suggested_action: 'Poultry price creep (+15.2%). Burger profit margin dropped from 61% to 52%. Recommend adding $0.40 to selling price or adjusting portion to 140g.',
    is_resolved: false,
    created_at: '2026-07-29T10:00:00Z',
  },
  {
    id: 'alert_03',
    restaurant_id: 'rest_001',
    ingredient_id: 'ing_03',
    ingredient_name: 'Refined Frying Oil',
    affected_menu_item_id: 'menu_01',
    affected_menu_item_name: 'Vadapav Classic',
    old_cost: 2.10,
    new_cost: 2.40,
    increase_percent: 14.2,
    estimated_monthly_loss: 110.00,
    suggested_action: 'Bulk cooking oil rate increased. Consider bulk 20L tin order to get $2.05/L rate.',
    is_resolved: false,
    created_at: '2026-07-27T14:30:00Z',
  }
];

export const INITIAL_SALES_RECORDS: SalesRecord[] = buildRollingSalesHistory();

/** Build ~6 weeks of POS history relative to today so weekday forecasting has real baselines. */
function buildRollingSalesHistory(): SalesRecord[] {
  const menu = [
    { name: 'Vadapav Classic', category: 'Street Food Snacks', price: 2.5, base: 18 },
    { name: 'Veg Frankie Roll', category: 'Rolls & Wraps', price: 4.0, base: 12 },
    { name: 'Paneer Cheese Frankie', category: 'Rolls & Wraps', price: 5.5, base: 9 },
    { name: 'Crispy Chicken Burger', category: 'Burgers & Fries', price: 6.99, base: 11 },
    { name: 'Loaded Cheese Pizza (9")', category: 'Pizzas', price: 9.5, base: 7 },
  ];
  const records: SalesRecord[] = [];
  let id = 1;
  const today = new Date();

  for (let daysAgo = 42; daysAgo >= 1; daysAgo -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - daysAgo);
    const dow = day.getDay();
    const weekendBoost = dow === 5 || dow === 6 ? 1.25 : dow === 0 ? 1.1 : dow === 1 ? 0.85 : 1;
    const dayNoise = 0.9 + ((daysAgo * 17) % 20) / 100; // deterministic pseudo-noise

    menu.forEach((item, idx) => {
      const qty = Math.max(1, Math.round(item.base * weekendBoost * dayNoise * (0.85 + (idx % 3) * 0.05)));
      const hour = 11 + (idx % 6);
      const sold = new Date(day);
      sold.setHours(hour, (idx * 7) % 60, 0, 0);
      records.push({
        id: `sale_roll_${id}`,
        restaurant_id: 'rest_001',
        order_id: `ORD-${8000 + id}`,
        item_name: item.name,
        category: item.category,
        unit_price: item.price,
        quantity_sold: qty,
        total_amount: Math.round(qty * item.price * 100) / 100,
        sold_at: sold.toISOString(),
        transaction_type: idx % 2 === 0 ? 'Dine In' : 'Takeaway',
        received_by: 'POS',
      });
      id += 1;
    });
  }

  return records;
}

export const INITIAL_WASTE_ENTRIES: WasteEntry[] = [
  {
    id: 'w_01',
    restaurant_id: 'rest_001',
    ingredient_id: 'ing_05',
    ingredient_name: 'Mozzarella & Cheddar Cheese Blend',
    quantity: 0.8,
    unit: 'kg',
    reason: 'Spoiled / Expired',
    estimated_loss_amount: 6.80,
    logged_by: 'Head Chef Alex',
    logged_at: '2026-07-28T18:00:00Z',
  },
  {
    id: 'w_02',
    restaurant_id: 'rest_001',
    ingredient_id: 'ing_01',
    ingredient_name: 'Burger Bun / Vadapav Pav',
    quantity: 12,
    unit: 'pcs',
    reason: 'Kitchen Spillage / Burnt',
    estimated_loss_amount: 1.80,
    logged_by: 'Line Cook Dave',
    logged_at: '2026-07-29T11:30:00Z',
  }
];

export const SAMPLE_POS_CSV_TEXT = `order_id,date,item_name,category,unit_price,quantity,total_amount,transaction_type,received_by,time
ORD-9001,2026-07-29,Vadapav Classic,Street Food Snacks,2.50,5,12.50,Dine In,Raj,12:00
ORD-9002,2026-07-29,Veg Frankie Roll,Rolls & Wraps,4.00,3,12.00,Takeaway,Maya,12:15
ORD-9003,2026-07-29,Paneer Cheese Frankie,Rolls & Wraps,5.50,4,22.00,Online,Sam,12:30
ORD-9004,2026-07-29,Crispy Chicken Burger,Burgers & Fries,6.99,2,13.98,Dine In,Raj,12:45
ORD-9005,2026-07-29,Loaded Cheese Pizza (9"),Pizzas,9.50,2,19.00,Takeaway,Maya,13:00
ORD-9006,2026-07-29,Vadapav Classic,Street Food Snacks,2.50,10,25.00,Online,Sam,13:15
ORD-9007,2026-07-29,Veg Frankie Roll,Rolls & Wraps,4.00,6,24.00,Dine In,Raj,13:30
ORD-9008,2026-07-29,Crispy Chicken Burger,Burgers & Fries,6.99,4,27.96,Takeaway,Maya,13:45
ORD-9009,2026-07-29,Paneer Cheese Frankie,Rolls & Wraps,5.50,5,27.50,Dine In,Sam,14:00
ORD-9010,2026-07-29,Vadapav Classic,Street Food Snacks,2.50,8,20.00,Takeaway,Raj,14:15`;
