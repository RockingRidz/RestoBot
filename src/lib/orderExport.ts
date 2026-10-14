import { createHash } from 'node:crypto';
import type { OrderHistoryRow } from './dataStore';

export function exportRequestId(restaurantId: string, approvalId: string, actor: string | null, channel: string, requestId: unknown) {
  if (typeof requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) {
    throw Object.assign(new Error('A valid export request is required. Please retry from the order page.'), { status: 400 });
  }
  const hash = createHash('sha256').update(JSON.stringify([restaurantId, approvalId, actor, channel, requestId])).digest('hex');
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`;
}

export function buildExport(approval: OrderHistoryRow, channel: string, actor: string | null, requestId: unknown, now = new Date().toISOString()) {
  if (!['clipboard', 'print'].includes(channel)) throw Object.assign(new Error('Choose copy or print from the approved order.'), { status: 400 });
  return {
    id: exportRequestId(approval.restaurant_id, approval.id, actor, channel, requestId),
    noteText: approval.note_text, supplierName: approval.supplier_name, totalAmount: approval.total_amount,
    channel, status: channel === 'print' ? 'Print requested' : 'Copy requested',
    lines: approval.lines.map(line => ({ ...line, approval_id: approval.id, export_requested_by: actor, export_requested_at: now })),
  };
}
