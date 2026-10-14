import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ client: null as any }));
vi.mock('../lib/supabaseAdmin', () => ({
  getAdminClient: () => mock.client,
  persistenceMode: () => 'supabase',
}));
import { ensureRestaurant, getMemorySnapshot, upsertIngredient, deleteIngredient, createOrderNote, updateOrderNoteStatus, loadAll, saveRecipe, commitSalesImport, recordWaste, upsertSupplier } from '../lib/dataStore';

function database(result: any) {
  const query: any = {};
  for (const method of ['upsert', 'insert', 'update', 'delete', 'select', 'eq', 'order', 'limit', 'single', 'maybeSingle']) {
    query[method] = vi.fn(() => query);
  }
  query.then = (resolve: any) => Promise.resolve(result).then(resolve);
  mock.client = { from: vi.fn(() => query) };
  return query;
}

describe('Durable writes fail without mutating the visible cache', () => {
  beforeEach(() => { database({ data: null, error: { message: 'database unavailable' } }); });
  it('does not cache a supplier whose database write failed', async () => {
    const before = structuredClone(getMemorySnapshot().suppliers);
    await expect(upsertSupplier({ name: 'Unsaved supplier' })).rejects.toThrow('Supplier was not saved');
    expect(getMemorySnapshot().suppliers).toEqual(before);
  });
  it('preserves inventory on failed save and delete', async () => {
    const before = structuredClone(getMemorySnapshot().ingredients);
    await expect(upsertIngredient({ ...before[0], current_stock: 123 })).rejects.toThrow();
    await expect(deleteIngredient(before[0].id)).rejects.toThrow();
    expect(getMemorySnapshot().ingredients).toEqual(before);
  });
  it('returns the persisted ingredient ID and converted numeric fields', async () => {
    const existing = getMemorySnapshot().ingredients[0];
    database({ data: { ...existing, id: 'saved-id', base_unit: 'kg', current_stock: '9.5', current_cost_per_unit: '2' }, error: null });
    const saved = await upsertIngredient(existing);
    expect(saved.id).toBe('saved-id');
    expect(saved.current_stock).toBe(9.5);
    expect(getMemorySnapshot().ingredients[0]).toEqual(saved);
  });
  it('does not record a successful export when persistence failed', async () => {
    const before = structuredClone(getMemorySnapshot().orderNotes);
    await expect(createOrderNote({ noteText: 'Test', status: 'Copied' })).rejects.toThrow();
    expect(getMemorySnapshot().orderNotes).toEqual(before);
  });
  it('does not change order status after a failed update and scopes it to the tenant', async () => {
    database({ data: { id: 'order-test', created_at: '2026-09-24' }, error: null });
    await createOrderNote({ noteText: 'Test' });
    const query = database({ data: null, error: { message: 'offline' } });
    await expect(updateOrderNoteStatus('order-test', 'Sent')).rejects.toThrow();
    expect(getMemorySnapshot().orderNotes[0].status).toBe('Draft');
    expect(query.eq).toHaveBeenCalledWith('restaurant_id', getMemorySnapshot().profile.restaurantId);
  });
  it('refuses to start with failed database reads', async () => {
    await expect(loadAll(false)).rejects.toThrow('refusing to serve demo or partial data');
  });
  it('never substitutes another restaurant or creates a tenant when an explicit ID is missing', async () => {
    const previous=process.env.RESTOBOT_RESTAURANT_ID;
    process.env.RESTOBOT_RESTAURANT_ID='10000000-0000-4000-8000-000000000099';
    const query=database({data:null,error:null});
    try {
      await expect(ensureRestaurant()).rejects.toThrow('Configured restaurant does not exist');
      expect(query.eq).toHaveBeenCalledTimes(1);
      expect(query.insert).not.toHaveBeenCalled();
    } finally {
      if(previous===undefined) delete process.env.RESTOBOT_RESTAURANT_ID;
      else process.env.RESTOBOT_RESTAURANT_ID=previous;
    }
  });
  it('does not claim recipe, sales, or waste writes when their transactions fail', async () => {
    const before = {
      ingredients: structuredClone(getMemorySnapshot().ingredients),
      menus: structuredClone(getMemorySnapshot().menuItems),
      sales: structuredClone(getMemorySnapshot().salesRecords),
      waste: structuredClone(getMemorySnapshot().wasteEntries),
    };
    mock.client = { rpc: vi.fn(async () => ({ data: null, error: { message: 'offline' } })) };
    await expect(saveRecipe({ ...before.menus[0], name: 'Uncommitted recipe' })).rejects.toThrow();
    await expect(commitSalesImport([before.sales[0]])).rejects.toThrow();
    await expect(recordWaste({ ingredient_id: before.ingredients[0].id, quantity: 0.5, unit: before.ingredients[0].unit })).rejects.toThrow();
    expect(getMemorySnapshot().ingredients).toEqual(before.ingredients);
    expect(getMemorySnapshot().menuItems).toEqual(before.menus);
    expect(getMemorySnapshot().salesRecords).toEqual(before.sales);
    expect(getMemorySnapshot().wasteEntries).toEqual(before.waste);
  });
});
