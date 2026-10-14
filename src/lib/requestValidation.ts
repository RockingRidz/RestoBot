export function requireText(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw Object.assign(new Error(`${name} is required`), { status: 400 });
}
export function requireNumber(value: unknown, name: string, minimum = 0): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) throw Object.assign(new Error(`${name} must be a number >= ${minimum}`), { status: 400 });
}

// Used when an owner supplies an explicit order. Never replace those quantities
// with a fresh forecast, and never invent an unverified substitute price.
export function formatRequestedOrder(orders: unknown, restaurantName: string) {
  if (!Array.isArray(orders)) throw Object.assign(new Error('orders must be an array'), { status: 400 });
  const vendors = new Map<string, Array<{ itemName: string; packQuantity: string }>>();
  for (const order of orders) {
    requireText(order?.ingredient, 'ingredient');
    const quantity = order.quantity;
    if (typeof quantity === 'number') requireNumber(quantity, 'quantity', Number.MIN_VALUE);
    else { requireText(quantity, 'quantity'); if (!/^\d+(?:\.\d+)?(?:\s|$)/.test(quantity) || Number.parseFloat(quantity) <= 0) throw Object.assign(new Error('quantity must begin with a positive number'), { status: 400 }); }
    const vendor = order.vendor || order.supplier_name || order.defaultVendor || 'Primary Wholesaler';
    requireText(vendor, 'vendor');
    if (!vendors.has(vendor)) vendors.set(vendor, []);
    vendors.get(vendor)!.push({ itemName: order.ingredient, packQuantity: String(quantity) });
  }
  const vendorDispatchNotes = [...vendors].map(([vendorName, items]) => ({ vendorName, items }));
  const priceSpikeAlert = { detected: false, originalIngredient: '', priceIncreasePct: 0, recommendedSubstitute: '', estimatedMarginSavingsUSD: 0, confidenceScorePct: 0, culinaryReasoning: 'No verified substitute selected. Original requested items retained.', kitchenPrepTip: 'Review supplier prices before approving.' };
  return { priceSpikeAlert, priceSpikeAlerts: [priceSpikeAlert], vendorDispatchNotes, formattedSmsText: (vendorDispatchNotes.length ? vendorDispatchNotes.map(v => `TO: ${v.vendorName}\n${v.items.map(i => `- ${i.itemName}: ${i.packQuantity}`).join('\n')}`).join('\n\n') : '0 items ordered.') + `\n\nOrder Placed By: ${restaurantName}`, _mode: 'rule_engine' };
}
