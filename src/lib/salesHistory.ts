/** Keyset pagination avoids the former 500-row history truncation. */
export async function loadSalesHistory(client: any, restaurantId: string): Promise<any[]> {
  const rows: any[] = [];
  let cursor: string | undefined;
  for (;;) {
    let query = client.from('sales_records').select('*')
      .eq('restaurant_id', restaurantId).order('id', { ascending: true }).limit(500);
    if (cursor) query = query.gt('id', cursor);
    const { data, error } = await query;
    if (error || !Array.isArray(data)) throw new Error('Sales history could not be loaded');
    if (!data.length) return rows;
    const next = data[data.length - 1].id;
    if (typeof next !== 'string' || next === cursor) throw new Error('Sales history pagination did not advance');
    rows.push(...data);
    cursor = next;
    // Continue even on a short page: the server may impose a smaller row cap.
  }
}
