import { describe, it, expect, vi } from 'vitest';
import { loadSalesHistory } from '../lib/salesHistory';

describe('Full sales history loading', () => {
  it('loads beyond 500 rows even when the database enforces shorter pages', async () => {
    const rows = Array.from({ length: 1201 }, (_, i) => ({ id: String(i).padStart(5,'0') }));
    const scopes: string[] = [];
    const client = { from: vi.fn(() => {
      let cursor = '';
      const query: any = { select: () => query, order: () => query, limit: () => query,
        eq: (field: string, value: string) => { expect(field).toBe('restaurant_id'); scopes.push(value); return query; },
        gt: (field: string, value: string) => { expect(field).toBe('id'); cursor = value; return query; },
        then: (resolve: any) => Promise.resolve({ data: rows.filter(row => row.id > cursor).slice(0, 200), error: null }).then(resolve) };
      return query;
    }) };
    expect(await loadSalesHistory(client, 'tenant-a')).toEqual(rows);
    expect(scopes).toHaveLength(8);
    expect(scopes.every(scope => scope === 'tenant-a')).toBe(true);
  });
  it('fails visibly on a later page instead of returning partial history', async () => {
    let page = 0;
    const query: any = {};
    for (const method of ['select','eq','order','limit','gt']) query[method] = () => query;
    query.then = (resolve: any) => Promise.resolve(page++ === 0 ? { data: [{ id: 'a' }], error: null } : { data: null, error: {} }).then(resolve);
    await expect(loadSalesHistory({ from: () => query }, 'tenant')).rejects.toThrow('could not be loaded');
  });
});
