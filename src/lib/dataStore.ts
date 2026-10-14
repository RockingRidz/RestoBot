import { randomUUID } from 'crypto';
import {
  INITIAL_INGREDIENTS,
  INITIAL_MENU_ITEMS,
  INITIAL_SALES_RECORDS,
  INITIAL_MARGIN_ALERTS,
  INITIAL_RESTAURANT,
} from './demoData';
import { getAdminClient, persistenceMode } from './supabaseAdmin';
import { loadSalesHistory } from './salesHistory';
import { validateClosedDates } from './closureCalendar';
import type { Ingredient, MenuItem, SalesRecord, MarginAlert } from '../types';

export type OrderHistoryRow = {
  id: string;
  restaurant_id: string;
  supplier_name: string;
  note_text: string;
  channel: string;
  status: string;
  total_amount: number;
  lines: any[];
  sent_at: string | null;
  created_at: string;
};

export type SupplierContact = {
  id: string;
  restaurant_id: string;
  name: string;
  contact_method: string;
  contact_value: string;
};

type AccountProfile = {
  closedDates?: string[];
  restaurantId: string;
  restaurantName: string;
  wholesaler: string;
  location: string;
  cuisineType: string;
  pinHash: string | null;
  isUnlocked: boolean;
  lastTrainedAt: string;
};

const mem = {
  ingredients: [...INITIAL_INGREDIENTS] as Ingredient[],
  menuItems: [...INITIAL_MENU_ITEMS] as MenuItem[],
  salesRecords: [...INITIAL_SALES_RECORDS] as SalesRecord[],
  wasteEntries: [] as any[],
  marginAlerts: [...INITIAL_MARGIN_ALERTS] as MarginAlert[],
  orderNotes: [] as OrderHistoryRow[],
  suppliers: [] as SupplierContact[],
  profile: {
    restaurantId: process.env.RESTOBOT_RESTAURANT_ID || '00000000-0000-4000-8000-000000000001',
    restaurantName: process.env.RESTOBOT_RESTAURANT_NAME || INITIAL_RESTAURANT.name,
    wholesaler: process.env.RESTOBOT_WHOLESALERS || 'Sysco Wholesale, Gordon Food Service (GFS), US Foods',
    location: process.env.RESTOBOT_LOCATION || 'Troy, Michigan',
    cuisineType: process.env.RESTOBOT_CUISINE || INITIAL_RESTAURANT.cuisine_type || 'American Diner',
    pinHash: null,
    isUnlocked: false,
    lastTrainedAt: new Date().toISOString(),
  } as AccountProfile,
};

function mapIngredientFromDb(row: any): Ingredient {
  return {
    id: row.id,
    restaurant_id: row.restaurant_id,
    name: row.name,
    category: row.category || 'General',
    unit: row.base_unit || row.unit || 'unit',
    current_stock: Number(row.current_stock ?? 0),
    min_threshold: Number(row.min_threshold ?? 0),
    cost_per_unit: Number(row.current_cost_per_unit ?? row.cost_per_unit ?? 0),
    previous_cost_per_unit: Number(row.normal_cost_per_unit ?? row.previous_cost_per_unit ?? row.current_cost_per_unit ?? 0),
    supplier_name: row.supplier_name || 'Unknown',
    supplier_contact: row.supplier_contact || undefined,
    last_restocked: row.last_restocked || undefined,
    created_at: row.created_at,
    procurement: row.procurement || undefined,
  };
}

function mapIngredientToDb(ing: Ingredient, restaurantId: string) {
  return {
    id: ing.id?.startsWith('ing_') ? undefined : ing.id,
    restaurant_id: restaurantId,
    name: ing.name,
    category: ing.category,
    base_unit: ing.unit,
    unit: ing.unit,
    current_stock: ing.current_stock,
    min_threshold: ing.min_threshold,
    current_cost_per_unit: ing.cost_per_unit,
    cost_per_unit: ing.cost_per_unit,
    normal_cost_per_unit: ing.previous_cost_per_unit ?? ing.cost_per_unit,
    previous_cost_per_unit: ing.previous_cost_per_unit ?? ing.cost_per_unit,
    supplier_name: ing.supplier_name,
    supplier_contact: ing.supplier_contact || null,
    last_restocked: ing.last_restocked || null,
    ...(ing.procurement === undefined ? {} : { procurement: ing.procurement }),
  };
}

function mapMenuFromDb(row: any): MenuItem {
  return {
    id: row.id,
    restaurant_id: row.restaurant_id,
    name: row.name,
    category: row.category || 'General',
    selling_price: Number(row.selling_price ?? 0),
    target_margin_percent: Number(row.target_margin_percent ?? 65),
    is_active: row.active_status !== false,
    recipes: (row.recipe_ingredients || []).map((r: any) => ({
      id: r.id, menu_item_id: row.id, ingredient_id: r.ingredient_id,
      ingredient_name: r.ingredient_name, quantity_required: Number(r.quantity_per_menu_item), unit: r.unit,
      quantity_basis: r.quantity_basis || 'as_purchased',
      yield_percent: r.yield_percent == null ? undefined : Number(r.yield_percent),
      culinary_role: r.culinary_role || undefined,
      substitutes: r.substitutes || [],
    })),
  };
}

function mapSalesFromDb(row: any): SalesRecord {
  return {
    id: row.metadata?.source_id || row.id,
    restaurant_id: row.restaurant_id,
    order_id: row.order_id || row.id,
    item_name: row.menu_item_name,
    category: row.category,
    unit_price: Number(row.unit_price ?? 0),
    quantity_sold: Number(row.quantity_sold ?? 0),
    total_amount: Number(row.gross_sales ?? 0),
    sold_at: row.sold_at || (row.transaction_date ? `${row.transaction_date}T12:00:00.000Z` : new Date().toISOString()),
    transaction_type: row.transaction_type,
  };
}

export function getMemorySnapshot() {
  return mem;
}

export function getAccountProfile(): AccountProfile {
  return mem.profile;
}

export function saveAccountProfile(patch: Partial<AccountProfile>) {
  mem.profile = { ...mem.profile, ...patch, lastTrainedAt: new Date().toISOString() };
  return mem.profile;
}

export async function ensureRestaurant(): Promise<string> {
  const client = getAdminClient();
  const rid = mem.profile.restaurantId;
  if (!client || persistenceMode() !== 'supabase') return rid;

  const { data: existing, error: lookupError } = await client.from('restaurants').select('id,name').eq('id', rid).maybeSingle();
  if (lookupError) throw new Error('Restaurant lookup failed');
  if (existing?.id) {
    mem.profile.restaurantId = existing.id;
    return existing.id;
  }

  // An explicit tenant identity must never silently resolve to a namesake or create a new tenant.
  if (process.env.RESTOBOT_RESTAURANT_ID || process.env.NODE_ENV === 'production') {
    throw new Error('Configured restaurant does not exist; verify RESTOBOT_RESTAURANT_ID');
  }

  const { data: byName, error: nameError } = await client
    .from('restaurants')
    .select('id,name')
    .eq('name', mem.profile.restaurantName)
    .limit(1)
    .maybeSingle();
  if (nameError) throw new Error('Restaurant lookup failed');
  if (byName?.id) {
    mem.profile.restaurantId = byName.id;
    return byName.id;
  }

  const { data: created, error } = await client
    .from('restaurants')
    .insert({
      id: rid,
      name: mem.profile.restaurantName,
      location: mem.profile.location,
      cuisine_type: mem.profile.cuisineType,
      wholesalers: mem.profile.wholesaler,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error('Restaurant could not be initialized');
  }
  mem.profile.restaurantId = created.id;
  return created.id;
}

export async function loadAll(allowSeed = true): Promise<void> {
  const client = getAdminClient();
  if (!client || persistenceMode() !== 'supabase') {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[dataStore] Production running in memory mode — set SUPABASE_SERVICE_ROLE_KEY');
    }
    return;
  }

  try {
    const restaurantId = await ensureRestaurant();
    const [ings, menus, sales, waste, orders, suppliers] = await Promise.all([
      client.from('ingredients').select('*').eq('restaurant_id', restaurantId),
      client.from('menu_items').select('*,recipe_ingredients(*)').eq('restaurant_id', restaurantId),
      loadSalesHistory(client, restaurantId).then(data => ({ data, error: null })),
      client.from('waste_entries').select('*').eq('restaurant_id', restaurantId).limit(200),
      client.from('order_notes').select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: false }).limit(100),
      client.from('suppliers').select('*').eq('restaurant_id', restaurantId),
    ]);

    for (const result of [ings, menus, sales, waste, orders, suppliers]) {
      if (result.error) throw new Error('Required restaurant data could not be loaded');
    }
    const { data: rest, error: profileError } = await client.from('restaurants').select('*').eq('id', restaurantId).maybeSingle();
    if (profileError || !rest) throw new Error('Restaurant profile could not be loaded');
    const empty = !(ings.data && ings.data.length);
    if (empty && allowSeed && process.env.RESTOBOT_SEED_DEMO === 'true' && process.env.NODE_ENV !== 'production') {
      await seedDemoToSupabase(restaurantId);
      return loadAll(false);
    }

    if (ings.data) mem.ingredients = ings.data.map(mapIngredientFromDb);
    if (menus.data) mem.menuItems = menus.data.map(mapMenuFromDb);
    if (sales.data) mem.salesRecords = sales.data.map(mapSalesFromDb).sort((a, b) => b.sold_at.localeCompare(a.sold_at));
    mem.marginAlerts = [];
    if (waste.data) {
      mem.wasteEntries = waste.data.map((w: any) => ({
        id: w.id,
        restaurant_id: w.restaurant_id,
        ingredient_id: w.ingredient_id,
        ingredient_name: w.ingredient_name,
        quantity: Number(w.quantity_wasted),
        unit: w.unit,
        reason: w.reason,
        logged_at: w.created_at,
      }));
    }
    if (orders.data) {
      mem.orderNotes = orders.data.map((o: any) => ({
        id: o.id,
        restaurant_id: o.restaurant_id,
        supplier_name: o.supplier_name || 'Unknown',
        note_text: o.note_text,
        channel: o.channel || 'clipboard',
        status: o.status || 'draft',
        total_amount: Number(o.total_amount || 0),
        lines: o.lines || [],
        sent_at: o.sent_at,
        created_at: o.created_at,
      }));
    }
    if (suppliers.data) {
      mem.suppliers = suppliers.data.map((s: any) => ({
        id: s.id,
        restaurant_id: s.restaurant_id,
        name: s.name,
        contact_method: s.contact_method || 'email',
        contact_value: s.contact_value || '',
      }));
    }

    if (rest) {
      mem.profile.restaurantName = rest.name || mem.profile.restaurantName;
      mem.profile.location = rest.location || mem.profile.location;
      mem.profile.cuisineType = rest.cuisine_type || mem.profile.cuisineType;
      mem.profile.wholesaler = rest.wholesalers || mem.profile.wholesaler;
      mem.profile.pinHash = rest.pin_hash || null;
      mem.profile.closedDates = validateClosedDates(rest.closed_dates ?? []);
    }
  } catch (err: any) {
    throw new Error('Restaurant data could not be loaded; refusing to serve demo or partial data');
  }
}

async function seedDemoToSupabase(restaurantId: string) {
  const client = getAdminClient();
  if (!client) return;
  console.log('[dataStore] Seeding demo data into Supabase (dev only)');
  await client.from('ingredients').upsert(
    INITIAL_INGREDIENTS.map((ing) => ({
      ...mapIngredientToDb({ ...ing, restaurant_id: restaurantId }, restaurantId),
      id: randomUUID(),
    })),
    { onConflict: 'restaurant_id,name', ignoreDuplicates: true },
  );
  await client.from('menu_items').upsert(
    INITIAL_MENU_ITEMS.map((m) => ({
      restaurant_id: restaurantId,
      name: m.name,
      category: m.category,
      selling_price: m.selling_price,
      target_margin_percent: m.target_margin_percent,
      active_status: m.is_active,
    })),
    { onConflict: 'restaurant_id,name', ignoreDuplicates: true },
  );
}

export function listIngredients() {
  return mem.ingredients;
}
export function setIngredients(items: Ingredient[]) {
  mem.ingredients = items;
}
export async function upsertIngredient(ing: Ingredient) {
  const restaurantId = mem.profile.restaurantId;
  const idx = mem.ingredients.findIndex((i) => i.id === ing.id || i.name.toLowerCase() === ing.name.toLowerCase());
  let next = { ...(idx >= 0 ? mem.ingredients[idx] : {}), ...ing, id: ing.id || (idx >= 0 ? mem.ingredients[idx].id : randomUUID()), restaurant_id: restaurantId } as Ingredient;

  const client = getAdminClient();
  if (client && persistenceMode() === 'supabase') {
    const payload = mapIngredientToDb(next, restaurantId);
    const { data, error } = await client.from('ingredients').upsert(payload, { onConflict: 'restaurant_id,name' }).select('*').maybeSingle();
    if (!error && data) {
      next = mapIngredientFromDb(data);
    } else throw new Error('Ingredient was not saved');
  }
  if (idx >= 0) mem.ingredients[idx] = next;
  else mem.ingredients.unshift(next);
  return next;
}

export async function deleteIngredient(id: string) {
  const client = getAdminClient();
  if (client && persistenceMode() === 'supabase') {
    const { error } = await client.from('ingredients').delete().eq('id', id).eq('restaurant_id', mem.profile.restaurantId);
    if (error) throw new Error('Ingredient was not deleted');
  }
  mem.ingredients = mem.ingredients.filter((i) => i.id !== id);
}

export function listMenuItems() {
  return mem.menuItems;
}
export function setMenuItems(items: MenuItem[]) {
  mem.menuItems = items;
}

export async function saveRecipe(menu: MenuItem): Promise<MenuItem> {
  const client = getAdminClient();
  const restaurantId = mem.profile.restaurantId;
  let saved: MenuItem;
  if (client && persistenceMode() === 'supabase') {
    const id = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(menu.id || '') ? menu.id : undefined;
    if (menu.recipes?.some(r => r.quantity_basis === 'edible' || r.yield_percent != null || r.culinary_role || r.substitutes?.length)) {
      const { error: schemaError } = await client.from('recipe_ingredients').select('quantity_basis,yield_percent,culinary_role,substitutes').limit(0);
      if (schemaError) throw new Error('Culinary database migration 003 is required before saving yield or substitution settings');
    }
    const { data, error } = await client.rpc('restobot_save_recipe', {
      p_restaurant_id: restaurantId, p_menu: { ...menu, id },
    });
    if (error || !data) throw new Error('Recipe was not saved');
    saved = mapMenuFromDb(data);
  } else {
    saved = { ...menu, id: menu.id || `menu_${Date.now()}`, restaurant_id: restaurantId };
  }
  const index = mem.menuItems.findIndex(item => item.id === menu.id || item.name.toLowerCase() === menu.name.toLowerCase());
  if (index >= 0) mem.menuItems[index] = saved;
  else mem.menuItems.unshift(saved);
  return saved;
}

export async function deleteRecipe(id: string): Promise<void> {
  const client = getAdminClient();
  if (client && persistenceMode() === 'supabase') {
    const { error } = await client.from('menu_items').delete().eq('id', id).eq('restaurant_id', mem.profile.restaurantId);
    if (error) throw new Error('Recipe was not deleted');
  }
  mem.menuItems = mem.menuItems.filter(item => item.id !== id);
}

export function listSales() {
  return mem.salesRecords;
}
export function setSales(records: SalesRecord[]) {
  mem.salesRecords = records;
}

export async function commitSalesImport(rows: SalesRecord[], applyInventory = true): Promise<{ inserted: number; duplicates: number; insertedIds: string[] }> {
  const client = getAdminClient();
  if (client && persistenceMode() === 'supabase') {
    const { data, error } = await client.rpc('restobot_ingest_sales', {
      p_restaurant_id: mem.profile.restaurantId, p_rows: rows, ...(!applyInventory ? { p_apply_inventory: false } : {}),
    });
    if (error || !data) throw new Error('Sales import was not saved');
    await loadAll(false);
    return { inserted: data.inserted, duplicates: data.duplicates, insertedIds: data.inserted_ids };
  }
  mem.salesRecords = [...rows, ...mem.salesRecords];
  return { inserted: rows.length, duplicates: 0, insertedIds: rows.map(row => row.id) };
}

export function listWaste() {
  return mem.wasteEntries;
}
export function addWaste(entry: any) {
  mem.wasteEntries.unshift(entry);
  return entry;
}

export async function recordWaste(entry: any): Promise<any> {
  const client = getAdminClient();
  if (client && persistenceMode() === 'supabase') {
    const { data, error } = await client.rpc('restobot_log_waste', {
      p_restaurant_id: mem.profile.restaurantId, p_entry: entry,
    });
    if (error || !data) throw new Error('Waste was not saved');
    await loadAll(false);
    return data;
  }
  const stored = { id: `w_${Date.now()}`, logged_at: new Date().toISOString(), ...entry };
  mem.wasteEntries.unshift(stored);
  const ingredient = mem.ingredients.find(i => i.id === entry.ingredient_id);
  if (ingredient) ingredient.current_stock = Math.max(0, Math.round((ingredient.current_stock - entry.quantity) * 100) / 100);
  return stored;
}

export function listMarginAlerts() {
  return mem.marginAlerts;
}
export function setMarginAlerts(alerts: MarginAlert[]) {
  mem.marginAlerts = alerts;
}

export function listOrderNotes() {
  return mem.orderNotes;
}

export async function createOrderNote(input: {
  id?: string;
  noteText: string;
  supplierName?: string;
  channel?: string;
  status?: string;
  totalAmount?: number;
  lines?: any[];
}) {
  const row: OrderHistoryRow = {
    id: input.id || randomUUID(),
    restaurant_id: mem.profile.restaurantId,
    supplier_name: input.supplierName || 'Primary Vendor',
    note_text: input.noteText,
    channel: input.channel || 'clipboard',
    status: input.status || 'Draft',
    total_amount: input.totalAmount || 0,
    lines: input.lines || [],
    sent_at: input.status === 'Sent' ? new Date().toISOString() : null,
    created_at: new Date().toISOString(),
  };

  const client = getAdminClient();
  if (client && persistenceMode() === 'supabase') {
    const { data, error } = await client
      .from('order_notes')
      .insert({
        id: row.id,
        restaurant_id: row.restaurant_id,
        supplier_name: row.supplier_name,
        note_text: row.note_text,
        channel: row.channel,
        status: row.status,
        total_amount: row.total_amount,
        lines: row.lines,
        sent_at: row.sent_at,
      })
      .select('*')
      .single();
    if (!error && data) {
      row.id = data.id;
      row.created_at = data.created_at;
    } else if (error?.code === '23505' && input.id) {
      const existing = await client.from('order_notes').select('*').eq('id', row.id).eq('restaurant_id', row.restaurant_id).single();
      if (existing.error || !existing.data) throw new Error('Order history could not be confirmed');
      if (!mem.orderNotes.some(note => note.id === existing.data.id)) mem.orderNotes.unshift(existing.data);
      return existing.data as OrderHistoryRow;
    } else throw new Error('Order history was not saved');
  }
  if (input.id && mem.orderNotes.some(note => note.id === input.id)) return mem.orderNotes.find(note => note.id === input.id)!;
  mem.orderNotes.unshift(row);
  return row;
}

export async function updateOrderNoteStatus(id: string, status: string, actorId: string | null = null) {
  const idx = mem.orderNotes.findIndex((o) => o.id === id);
  if (idx < 0) return null;
  const updatedAt = new Date().toISOString();
  const lines = mem.orderNotes[idx].lines.map(line => ({ ...line,
    status_history: [...(line.status_history || []), {status, actor_id: actorId, recorded_at: updatedAt}],
  }));
  const client = getAdminClient();
  if (client && persistenceMode() === 'supabase') {
    const { data, error } = await client.from('order_notes').update({ status, lines, updated_at: updatedAt }).eq('id', id).eq('restaurant_id', mem.profile.restaurantId).eq('status', mem.orderNotes[idx].status).select('id').single();
    if (error || !data) throw new Error('Order status was not saved');
  }
  const currentIndex = mem.orderNotes.findIndex(row => row.id === id);
  mem.orderNotes[currentIndex] = { ...mem.orderNotes[currentIndex], status, lines };
  return mem.orderNotes[currentIndex];
}

export function listSuppliers() {
  return mem.suppliers;
}

export async function upsertSupplier(s: Partial<SupplierContact> & { name: string }) {
  const restaurantId = mem.profile.restaurantId;
  const idx = mem.suppliers.findIndex((x) => x.name.toLowerCase() === s.name.toLowerCase());
  const next: SupplierContact = {
    id: s.id || (idx >= 0 ? mem.suppliers[idx].id : randomUUID()),
    restaurant_id: restaurantId,
    name: s.name,
    contact_method: s.contact_method || 'email',
    contact_value: s.contact_value || '',
  };
  const client = getAdminClient();
  if (client && persistenceMode() === 'supabase') {
    const { data, error } = await client
      .from('suppliers')
      .upsert(
        {
          restaurant_id: restaurantId,
          name: next.name,
          contact_method: next.contact_method,
          contact_value: next.contact_value,
        },
        { onConflict: 'restaurant_id,name' },
      )
      .select('*')
      .maybeSingle();
    if (!error && data) {
      next.id = data.id;
    } else throw new Error('Supplier was not saved');
  }
  if (idx >= 0) mem.suppliers[idx] = next;
  else mem.suppliers.push(next);
  return next;
}

