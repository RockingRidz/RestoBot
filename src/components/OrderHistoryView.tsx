import { ownerText } from '../lib/displayText';
import { unitLabel } from '../lib/displayText';
import { api } from '../lib/api';
import React, { useEffect, useState } from 'react';
import { History, RefreshCw, CheckCircle2, Truck } from 'lucide-react';

interface OrderHistoryEntry {
  id: string;
  date: string;
  supplierName?: string;
  channel: string;
  status: string;
  sentAt?: string;
  noteText?: string;
  notePreview?: string;
  lines?: any[];
}

export function OrderHistoryView() {
  const [rows, setRows] = useState<OrderHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api('/api/orders/history');
      const list = Array.isArray(data) ? data : data?.data || data?.orders || [];
      setRows(
        list.map((r: any) => ({
          id: r.id,
          lines: r.lines || [],
          date: r.date || (r.sent_at || r.sentAt || r.created_at || '').slice(0, 10),
          supplierName: r.supplierName || r.supplier_name || '—',
          channel: r.channel || 'clipboard',
          status: r.status || 'Draft',
          sentAt: r.sent_at || r.sentAt,
          noteText: r.noteText || r.note_text,
          notePreview: (r.noteText || r.note_text || r.notePreview || '').slice(0, 80),
        })),
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to load order history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const markDelivered = async (id: string) => {
    setUpdatingId(id);
    setError(null);
    try {
      await api('/api/orders/' + encodeURIComponent(id) + '/status', { method: 'PATCH', body: JSON.stringify({ status: 'Delivered' }) });
      setRows(prev => prev.map(r => r.id === id ? { ...r, status: 'Delivered' } : r));
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="glass-box rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs uppercase tracking-wider mb-1">
            <History className="w-4 h-4" />
            <span>Dispatch Audit Log</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Order History</h1>
          <p className="text-sm text-slate-400 mt-1">
            Approvals, copy requests and print requests. Exports do not confirm supplier delivery.
          </p>
        </div>
        <button
          onClick={loadHistory}
          disabled={loading}
          className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 border border-slate-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="glass-box rounded-2xl border border-slate-800 overflow-hidden">
        {error && (
          <div className="px-6 py-4 text-sm text-rose-300 bg-rose-500/10 border-b border-rose-500/20">
            {error}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] text-slate-500 uppercase tracking-wider bg-slate-950/40">
                <th className="px-6 py-3 font-bold">Date</th>
                <th className="px-6 py-3 font-bold">Supplier</th>
                <th className="px-6 py-3 font-bold">Channel</th>
                <th className="px-6 py-3 font-bold">Status</th>
                <th className="px-6 py-3 font-bold">Sent At</th>
                <th className="px-6 py-3 font-bold">Note Preview</th>
                <th className="px-6 py-3 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                    Loading order history…
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                    No order exports recorded yet. Copy a note from Daily Smart Order.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-6 py-4 text-slate-300">{row.date || '—'}</td>
                  <td className="px-6 py-4 font-semibold text-white">{row.supplierName}</td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] uppercase font-bold tracking-wider bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                      {{approval:'Approval',clipboard:'Clipboard',print:'Print / PDF'}[row.channel] || ownerText(row.channel)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${
                        row.status === 'Delivered'
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-xs">
                    {row.sentAt ? new Date(row.sentAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-xs max-w-xs">
                    <details><summary>{ownerText(row.notePreview, '—')}</summary><div className="whitespace-pre-wrap">{ownerText(row.noteText)}</div>{row.lines?.filter(l=>l.approved_at).map(l=><p key={l.id}>{l.ingredient_name}: suggested {l.suggested_qty} → approved {l.approved_qty} {unitLabel(l.unit)}. Reason: {l.edit_reason || 'Unchanged'}. Approved by {l.approved_by && l.approved_by !== 'demo' ? 'restaurant account' : 'local demo (unverified)'} at {l.approved_at ? new Date(l.approved_at).toLocaleString() : 'time unavailable'}. Linked forecast saved with this approval.{l.export_requested_at && <> Export requested by {l.export_requested_by ? 'restaurant account' : 'local demo (unverified)'} at {new Date(l.export_requested_at).toLocaleString()}.</>}{l.status_history?.map((event:any,index:number)=><span key={index}> {event.status} recorded {new Date(event.recorded_at).toLocaleString()} by {event.actor_id ? 'restaurant account' : 'local demo (unverified)'}.</span>)}</p>)}</details>
                  </td>
                  <td className="px-6 py-4">
                    {['Copied','Print requested','Exported','Sent'].includes(row.status) && row.channel !== 'approval' && (
                      <button
                        onClick={() => markDelivered(row.id)}
                        disabled={updatingId === row.id}
                        className="text-xs font-bold text-emerald-300 hover:text-emerald-200 flex items-center gap-1 disabled:opacity-50"
                      >
                        {updatingId === row.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : row.status === 'Sent' ? (
                          <Truck className="w-3.5 h-3.5" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        Mark delivered
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
