import type { MenuItem, SalesRecord } from '../types';
import { businessDateKey, validCalendarDate } from './businessDate';

export function zeroSalesRecords(date: unknown, itemIds: unknown, restaurantId: string, menus: MenuItem[], sales: SalesRecord[], now = new Date()): SalesRecord[] {
  const fail = (message: string): never => { throw Object.assign(new Error(message), {status:400}); };
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('Choose the date of the completed sales day.');
  const day = new Date(date+'T12:00:00Z');
  if (!validCalendarDate(date) || date >= businessDateKey(now)) return fail('Choose a valid completed day before today in Detroit time.');
  if (!Array.isArray(itemIds) || !itemIds.length || itemIds.length > menus.length || new Set(itemIds).size !== itemIds.length) return fail('Select the menu items with confirmed zero sales.');
  return itemIds.map(id => {
    const menu = menus.find(item => item.id === id && item.is_active !== false);
    if (!menu) return fail('Select an active menu item from this restaurant.');
    if (sales.some(row => row.item_name.trim().toLowerCase() === menu.name.trim().toLowerCase() && businessDateKey(row.sold_at) === date && row.quantity_sold > 0)) return fail(`${menu.name} already has sales on this date. Reconcile those records first.`);
    return {id:`zero:${restaurantId}:${date}:${menu.id}`,restaurant_id:restaurantId,order_id:`No sales on ${date}`,item_name:menu.name,quantity_sold:0,unit_price:menu.selling_price,total_amount:0,sold_at:day.toISOString(),transaction_type:'zero_sales'};
  }).filter(row => !sales.some(existing => existing.id === row.id));
}
