/**
 * Idempotently provisions the isolated IBR reviewer tenant and synthetic data.
 * Required: IBR_DEMO_EMAIL, IBR_DEMO_PASSWORD and --apply.
 */
import '../loadEnv';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';
import { buildSyntheticFixture, fixtureId, fixtureName } from './syntheticFixture';

if (!process.argv.includes('--apply')) throw new Error('Pass --apply to provision the IBR demo.');
const email = process.env.IBR_DEMO_EMAIL?.trim().toLowerCase();
const password = process.env.IBR_DEMO_PASSWORD;
if (!email || !password) throw new Error('Set IBR_DEMO_EMAIL and IBR_DEMO_PASSWORD.');
if (password.length < 14) throw new Error('IBR demo password must be at least 14 characters.');
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error('Supabase admin configuration is required.');

const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const restaurantId = fixtureId('ibr-reviewer-tenant', 'restaurant');
const restaurant = {
  id: restaurantId,
  name: 'RestoBot IBR Demo Restaurant',
  location: 'Synthetic demonstration workspace',
  cuisine_type: 'Thai & Asian Fusion (Synthetic)',
  wholesalers: 'Synthetic suppliers only',
  timezone: 'Asia/Kolkata',
};

const { error: restaurantError } = await db.from('restaurants').upsert(restaurant, { onConflict: 'id' });
if (restaurantError) throw new Error(`Restaurant provisioning failed: ${restaurantError.message}`);

const listed = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listed.error) throw new Error(`Could not inspect Auth users: ${listed.error.message}`);
const users = listed.data.users as User[];
let user: User | undefined = users.find((candidate) => candidate.email?.toLowerCase() === email);
if (!user) {
  const created = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'IBR Reviewer', account_purpose: 'India Book of Records demonstration' },
    app_metadata: { restobot_restaurant_id: restaurantId, restobot_role: 'reviewer' },
  });
  if (created.error || !created.data.user) {
    throw new Error(`Reviewer Auth user could not be created: ${created.error?.message || 'unknown error'}`);
  }
  user = created.data.user;
} else {
  const updated = await db.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
    user_metadata: { ...user.user_metadata, full_name: 'IBR Reviewer', account_purpose: 'India Book of Records demonstration' },
    app_metadata: { ...user.app_metadata, restobot_restaurant_id: restaurantId, restobot_role: 'reviewer' },
  });
  if (updated.error) throw new Error(`Reviewer Auth user could not be updated: ${updated.error.message}`);
}

const { error: profileError } = await db.from('profiles').upsert({
  id: user.id,
  restaurant_id: restaurantId,
  email,
  full_name: 'IBR Reviewer',
  is_owner: false,
}, { onConflict: 'id' });
if (profileError) throw new Error(`Reviewer profile provisioning failed: ${profileError.message}`);

const today = new Date().toISOString().slice(0, 10);
const fixture = buildSyntheticFixture(restaurantId, today);
for (const supplier of fixture.suppliers) {
  const { error } = await db.from('suppliers').upsert({ ...supplier, restaurant_id: restaurantId }, { onConflict: 'restaurant_id,name' });
  if (error) throw new Error(`Supplier seed failed: ${error.message}`);
}
for (const ingredient of fixture.ingredients) {
  const supplier = fixture.suppliers.find((item) => item.name === ingredient.supplier_name);
  const { procurement, ...base } = ingredient;
  const { error } = await db.from('ingredients').upsert({
    ...base,
    supplier_id: supplier?.id || null,
    unit: ingredient.unit,
    base_unit: ingredient.unit,
    normal_cost_per_unit: ingredient.previous_cost_per_unit,
    current_cost_per_unit: ingredient.cost_per_unit,
    procurement,
  }, { onConflict: 'restaurant_id,name' });
  if (error) throw new Error(`Ingredient seed failed: ${error.message}`);
}
for (const menu of fixture.menuItems) {
  const { data, error } = await db.rpc('restobot_save_recipe', {
    p_restaurant_id: restaurantId,
    p_menu: {
      id: menu.id,
      name: menu.name,
      category: menu.category,
      selling_price: menu.selling_price,
      target_margin_percent: menu.target_margin_percent,
      active_status: true,
      recipes: menu.recipes,
    },
  });
  if (error || !data) throw new Error(`Recipe seed failed for ${menu.name}: ${error?.message || 'no result'}`);
}

let insertedSales = 0;
for (let start = 0; start < fixture.sales.length; start += 500) {
  const { data, error } = await db.rpc('restobot_ingest_sales', {
    p_restaurant_id: restaurantId,
    p_rows: fixture.sales.slice(start, start + 500),
    p_apply_inventory: false,
  });
  if (error || !data) throw new Error(`Sales seed failed at row ${start}: ${error?.message || 'no result'}`);
  insertedSales += Number(data.inserted || 0);
}

const wasteRows = fixture.ingredients.slice(0, 14).map((ingredient, index) => ({
  id: fixtureId(restaurantId, `waste:${index}`),
  restaurant_id: restaurantId,
  ingredient_id: ingredient.id,
  ingredient_name: ingredient.name,
  quantity_wasted: Number((0.08 + index * 0.017).toFixed(3)),
  unit: ingredient.unit,
  reason: ['Spoilage', 'Preparation trim', 'Overproduction', 'Expired'][index % 4],
  estimated_loss_amount: Number(((0.08 + index * 0.017) * ingredient.cost_per_unit).toFixed(2)),
  entry_date: new Date(Date.now() - index * 86400000).toISOString().slice(0, 10),
}));
const wasteResult = await db.from('waste_entries').upsert(wasteRows, { onConflict: 'id' });
if (wasteResult.error) throw new Error(`Waste seed failed: ${wasteResult.error.message}`);

const orderRows = fixture.suppliers.slice(0, 4).map((supplier, index) => ({
  id: fixtureId(restaurantId, `order-note:${index}`),
  restaurant_id: restaurantId,
  supplier_name: supplier.name,
  note_text: `SYNTHETIC DEMO — draft purchase recommendation ${index + 1}. No order was sent.`,
  channel: 'clipboard',
  status: 'draft',
  total_amount: 120 + index * 35,
  lines: fixture.ingredients.filter((item) => item.supplier_name === supplier.name).slice(0, 3).map((item) => ({ ingredient_name: item.name, quantity: 1, unit: item.unit })),
}));
const ordersResult = await db.from('order_notes').upsert(orderRows, { onConflict: 'id' });
if (ordersResult.error) throw new Error(`Order history seed failed: ${ordersResult.error.message}`);

const [{ count: ingredientCount }, { count: menuCount }, { count: recipeCount }, { count: salesCount }, { count: wasteCount }, { count: orderCount }] = await Promise.all([
  db.from('ingredients').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId),
  db.from('menu_items').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId),
  db.from('recipe_ingredients').select('id,menu_items!inner(restaurant_id)', { count: 'exact', head: true }).eq('menu_items.restaurant_id', restaurantId),
  db.from('sales_records').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId),
  db.from('waste_entries').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId),
  db.from('order_notes').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId),
]);
assert((ingredientCount || 0) >= fixture.ingredients.length);
assert((menuCount || 0) >= fixture.menuItems.length);
assert((recipeCount || 0) > 0);
assert((salesCount || 0) >= fixture.sales.length);

console.log(JSON.stringify({
  ok: true,
  fixture: fixtureName,
  restaurantId,
  reviewerEmail: email,
  counts: { ingredients: ingredientCount, menus: menuCount, recipes: recipeCount, sales: salesCount, waste: wasteCount, orderDrafts: orderCount },
  insertedSales,
  supplierDeliveryEnabled: false,
}, null, 2));
