import { unitLabel } from './displayText';
import type { ForecastResult } from './forecastEngine';

export function buildApproval(forecast: ForecastResult, forecastId: string, quantities: unknown, reason: unknown, actorId: string | null, approvedAt = new Date().toISOString()) {
  if(forecast.blockingIssues?.length) throw new Error('Resolve forecast issues before approval: '+forecast.blockingIssues.join('; '));
  if (!quantities || typeof quantities !== 'object' || Array.isArray(quantities)) throw new Error('Supply order quantities');
  const requested = quantities as Record<string, unknown>;
  const candidates = forecast.lines.filter(l => l.recommended_order_qty > 0);
  if (Object.keys(requested).some(id => !candidates.some(l => l.id === id)) || candidates.some(l => !(l.id in requested))) throw new Error('Quantities must match every suggested ingredient');
  const explanation = typeof reason === 'string' ? reason.trim() : '';
  if (explanation.length > 2000) throw new Error('Edit reason must be at most 2000 characters');
  const lines = candidates.map(line => {
    if (!Number.isFinite(line.unit_cost) || line.unit_cost < 0 || !Number.isFinite(line.recommended_order_qty)) throw new Error('Order costs or quantities are invalid. Generate a corrected forecast.');
    const quantity = requested[line.id];
    if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity < 0 || quantity > 1000000) throw new Error('Invalid order quantity');
    if (quantity !== line.recommended_order_qty && !explanation) throw new Error('Explain quantity changes or excluded ingredients');
    if (line.pack_size && quantity > 0 && Math.abs(quantity / line.pack_size - Math.round(quantity / line.pack_size)) > 1e-8) throw new Error(`${line.ingredient_name}: order a whole number of supplier packs or exclude this ingredient.`);
    return { ...line, suggested_qty: line.recommended_order_qty, approved_qty: quantity, forecast_id: forecastId, approved_by: actorId, approved_at: approvedAt, edit_reason: explanation, subtotal: Math.round(quantity * line.unit_cost * 100) / 100 };
  });
  if (!lines.some(l => l.approved_qty > 0)) throw new Error('Select at least one ingredient');
  const noteText = ['APPROVED ORDER', `Approved: ${approvedAt}`, ...lines.filter(l => l.approved_qty > 0).map(l => `${l.supplier_name} — ${l.ingredient_name}: ${l.approved_qty} ${unitLabel(l.unit)}`)].join('\n');
  return { lines, noteText, totalAmount: Math.round(lines.reduce((sum, l) => sum + l.subtotal, 0) * 100) / 100, supplierName: [...new Set(lines.filter(l => l.approved_qty > 0).map(l => l.supplier_name))].join(', '), channel: 'approval', status: 'Approved' };
}
