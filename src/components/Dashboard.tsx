import { unitLabel } from '../lib/displayText';
import { api, authenticatedFetch } from '../lib/api';
import React, { useState, useEffect } from 'react';
import { 
  Copy, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  AlertTriangle,
  ShieldAlert,
  Smartphone,
  Mail,
  MessageSquare,
  Users,
  Sun,
  Truck,
  RefreshCw
} from 'lucide-react';

interface DashboardContext {
  restaurantName?: string;
  location?: string;
  weather?: { temperature?: string; condition?: string; live?: boolean };
  demand?: { baseline?: number | null; projected?: number | null; modifierPct?: number };
  cutoffs?: Array<{ vendor: string; cutoffLabel: string; remainingLabel: string; passed: boolean }>;
  explanations?: string[];
  logic_chain?: string;
  ragMode?: string;
  sources?: Array<{ title?: string; uri?: string }>;
  confidence?: string;
}

export function Dashboard() {
  const [exportError, setExportError] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [task1Data, setTask1Data] = useState<any[]>([]);
  const [task2Text, setTask2Text] = useState<string>('');
  const [restaurantName, setRestaurantName] = useState('RestoBot Restaurant');
  const [substituteStatus, setSubstituteStatus] = useState<'pending' | 'accepted' | 'rejected'>('pending');
  const [profile, setProfile] = useState<any>({});
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [orderLines, setOrderLines] = useState<any[]>([]);
  const [ctx, setCtx] = useState<DashboardContext>({});
  const [engineMode, setEngineMode] = useState<string>('');

  const handleFetchOrder = async () => {
    setLoading(true);
    setTask1Data([]);
    setTask2Text('');
    setSubstituteStatus('pending');
    try {
      const profRes = await authenticatedFetch('/api/account/profile');
      const profData = await profRes.json();
      const p = profData.accountProfile || {};
      setProfile(p);
      setRestaurantName(p.restaurantName || 'RestoBot Restaurant');

      const session = {
        restaurant_id: p.restaurantId,
        restaurant_name: p.restaurantName || 'RestoBot Restaurant',
        zip_code: p.location || '',
        cuisine_type: p.cuisineType || 'Restaurant',
        user_name: p.userName || 'Owner',
        is_authenticated: true,
      };

      const [ingRes, ctxRes, forecastRes] = await Promise.all([
        authenticatedFetch('/api/ingredients').then((r) => r.json()),
        authenticatedFetch('/api/dashboard/context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: p.location,
            wholesaler: p.wholesaler,
          }),
        }).then((r) => r.json()),
        api('/api/forecast', { method: 'POST', body: JSON.stringify({ horizonDays: 1, safetyBuffer: 1.1 }) }),
      ]);

      const fetchedIngredients = Array.isArray(ingRes) ? ingRes : (ingRes.data || []);
      setIngredients(fetchedIngredients);
      setCtx(ctxRes || {});

      const projected = ctxRes?.demand?.projected ?? null;
      const orders = forecastRes.lines.filter((line: any) => line.recommended_order_qty > 0).map((line: any) => ({
        ingredient: line.ingredient_name,
        quantity: String(line.recommended_order_qty) + ' ' + line.unit,
        vendor: line.supplier_name,
        currentPrice: line.unit_cost,
      }));

      const res = await authenticatedFetch('/api/generate-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-resto-session': JSON.stringify(session),
        },
        body: JSON.stringify({
          forecast: {
            targetMenuUnits: projected,
            safetyBufferPct: 0.10,
            horizonDays: 1,
          },
          orders,
          acceptedSubstitutes: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Order request failed');

      let alerts = data.priceSpikeAlerts || [];
      if (!alerts.length && data.priceSpikeAlert) alerts = [data.priceSpikeAlert];
      if (!alerts.length && data.task1_json) {
        const t = data.task1_json;
        alerts = [{
          detected: true,
          originalIngredient: t.ingredient_at_risk,
          priceIncreasePct: t.price_increase_percentage,
          recommendedSubstitute: t.recommended_substitute,
          estimatedMarginSavingsUSD: t.dollar_savings_estimate,
          confidenceScorePct: Math.round((t.confidence_score || 0) * 100),
          culinaryReasoning: t.reasoning,
          kitchenPrepTip: t.kitchen_action_tip,
        }];
      }

      setTask1Data(Array.isArray(alerts) ? alerts : []);
      setTask2Text(
        data.formattedSmsText ||
          data.task2_text ||
          'No order note generated.',
      );
      setOrderLines(data.vendorDispatchNotes || []);
      setEngineMode(data._mode || (data.errorMsg ? 'rule_engine' : 'gemini'));
    } catch (err) {
      console.error('Failed to generate order', err);
      setTask2Text('Failed to generate order. Check that the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleFetchOrder();
  }, []);

  const resolveNoteText = () => {
    let textToCopy = task2Text;
    if (substituteStatus === 'accepted' && task1Data.length > 0) {
      task1Data.filter((t) => t.detected).forEach((alert) => {
        if (alert.originalIngredient && alert.recommendedSubstitute) {
          textToCopy = textToCopy.replace(
            new RegExp(alert.originalIngredient, 'gi'),
            alert.recommendedSubstitute.replace(/ via .+$/, ''),
          );
        }
      });
    }
    return textToCopy;
  };

  const auditSend = async (channel: 'clipboard' | 'email' | 'sms' | 'whatsapp', noteText: string) => {
    if (!noteText) return;
    try {
      await api('/api/orders/send', { method: 'POST', body: JSON.stringify({ noteText, supplierName: orderLines[0]?.vendorName, channel }) });
    } catch (error) { setExportError('Export could not be recorded: ' + (error as Error).message); }
  };

  const handleCopy = async () => {
    if (!task2Text) return;
    setExportError('');
    try {
      const textToCopy = resolveNoteText();
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      await auditSend('clipboard', textToCopy);
      setTimeout(() => setCopied(false), 2000);
    } catch { setExportError('Clipboard access failed. Select and copy the note manually.'); }
  };

  const detectedAlerts = task1Data.filter((t) => t.detected && t.recommendedSubstitute);
  const weatherLabel = ctx.weather?.temperature
    ? `${ctx.weather.temperature} ${ctx.weather.condition || ''}`.trim()
    : loading ? 'Loading weather…' : 'Weather unavailable';
  const demandLabel = ctx.demand?.projected != null
    ? `${ctx.demand.projected}`
    : 'Insufficient sales history';
  const modifierLabel =
    ctx.demand?.modifierPct != null && ctx.demand.modifierPct !== 0
      ? ` (${ctx.demand.modifierPct > 0 ? '+' : ''}${ctx.demand.modifierPct}% vs baseline)`
      : '';

  return (
    <div className="text-slate-100 font-sans flex flex-col relative pb-12">
      {exportError && <div role="alert" className="text-rose-300 mb-4">{exportError}</div>}
      <div className="bg-slate-900/80 text-slate-300 py-2.5 px-4 md:px-6 border border-slate-800 rounded-2xl text-xs font-mono flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center space-x-2 text-emerald-400">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>RestoBot Online{engineMode ? ` · ${engineMode}` : ''}</span>
          </div>
          <div className="flex items-center space-x-2 text-slate-400">
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {ctx.location || profile.location || 'Set location in Account Setup'} · {weatherLabel}
              {ctx.weather?.live ? ' · live' : ''}
            </span>
          </div>
          <div className="flex items-center space-x-2 text-slate-400">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span>
              Tomorrow&apos;s projected menu units:{' '}
              <strong className="text-white">{demandLabel}</strong>
              {modifierLabel}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(ctx.cutoffs || []).map((c) => (
            <div key={c.vendor} className="flex items-center space-x-1.5 bg-slate-800 px-2 py-1 rounded">
              <Truck className={`w-3.5 h-3.5 ${c.passed ? 'text-slate-500' : 'text-rose-400'}`} />
              <span className="font-semibold text-white truncate max-w-[120px]">{c.vendor.split('(')[0].trim()}:</span>
              <span className={`font-bold ${c.passed ? 'text-slate-500' : 'text-rose-400'}`}>
                {c.cutoffLabel} ({c.remainingLabel})
              </span>
            </div>
          ))}
        </div>
      </div>

      {(ctx.explanations?.length || ctx.logic_chain || ctx.ragMode) && (
        <div className="glass-box rounded-2xl p-5 mb-6 border border-slate-700/50">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-extrabold text-white tracking-tight">Demand evidence</h2>
            <div className="flex items-center gap-2">
              {ctx.ragMode && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-indigo-500/15 text-indigo-300 border-indigo-500/30">
                  {ctx.ragMode === 'gemini_google_search' ? 'Verified web context' : 'Recorded-data estimate'}
                </span>
              )}
              {ctx.confidence && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-slate-800 text-slate-300 border-slate-600">
                  {ctx.confidence} confidence
                </span>
              )}
            </div>
          </div>
          {ctx.logic_chain && (
            <p className="text-xs font-mono text-emerald-300/90 mb-3 leading-relaxed">{ctx.logic_chain}</p>
          )}
          {!!ctx.explanations?.length && (
            <ul className="space-y-1.5 mb-3">
              {ctx.explanations.map((ex, i) => (
                <li key={i} className="text-xs text-slate-300 flex gap-2">
                  <span className="text-emerald-400 shrink-0">•</span>
                  <span>{ex}</span>
                </li>
              ))}
            </ul>
          )}
          {!!ctx.sources?.length && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-700/40">
              {ctx.sources.slice(0, 6).map((s, i) =>
                s.uri ? (
                  <a
                    key={i}
                    href={s.uri}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-blue-300 hover:text-blue-200 underline underline-offset-2 truncate max-w-[220px]"
                  >
                    {s.title || s.uri}
                  </a>
                ) : null,
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between items-center mb-8 glass-box p-6 rounded-2xl shadow-sm border border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Daily Smart Order</h1>
          <p className="text-sm text-slate-400 mt-1 font-medium">
            {restaurantName} · Margin Guard · {profile.userName || 'Owner'}
          </p>
        </div>
        <button
          onClick={handleFetchOrder}
          disabled={loading}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold tracking-wide shadow-lg disabled:opacity-50 transition-all flex items-center space-x-2"
        >
          {loading ? <Clock className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
          <span>{loading ? 'Analyzing…' : 'Refresh & Generate'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start relative">
        <div className="xl:col-span-7 space-y-6">
          <div className="glass-box border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-amber-400" />
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <ShieldAlert className="w-6 h-6 text-amber-500" />
                <h2 className="text-xl font-extrabold text-white tracking-tight">Cost Optimization</h2>
              </div>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-1 rounded font-bold uppercase tracking-wider">
                {ingredients.length} ingredients
              </span>
            </div>

            <div className="bg-slate-950/40 rounded-xl border border-slate-800/80 p-5 min-h-[200px]">
              {loading ? (
                <div className="flex flex-col items-center justify-center text-slate-500 font-medium py-12">
                  <Clock className="w-8 h-8 animate-spin mb-4 text-slate-600" />
                  <p>Scanning ingredients against wholesaler alternatives…</p>
                </div>
              ) : detectedAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-emerald-400 space-y-3 py-12">
                  <CheckCircle2 className="w-12 h-12" />
                  <p className="font-bold text-lg text-white">No verified substitute selected</p>
                  <p className="text-sm text-slate-400 text-center max-w-md">
                    {task1Data[0]?.culinaryReasoning || 'No actionable cheaper same-quality substitutes found.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {detectedAlerts.map((alert, idx) => (
                    <div key={idx} className="border-b border-slate-800 pb-6 last:border-0 last:pb-0">
                      <div className="flex justify-between items-start mb-4 gap-4">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 px-2 py-1 rounded">
                            Cost Spike +{alert.priceIncreasePct}%
                          </span>
                          <div className="text-lg font-extrabold text-white mt-2">{alert.originalIngredient}</div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded">
                            Save ${alert.estimatedMarginSavingsUSD}
                          </span>
                          <div className="text-lg font-extrabold text-emerald-400 mt-2">{alert.recommendedSubstitute}</div>
                        </div>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                        <p className="text-sm font-medium text-slate-300 mb-2">{alert.culinaryReasoning}</p>
                        <p className="text-xs text-slate-500">
                          <strong className="text-slate-300">Kitchen tip:</strong> {alert.kitchenPrepTip}
                        </p>
                      </div>
                    </div>
                  ))}

                  <div className="flex space-x-3 pt-4">
                    {substituteStatus === 'pending' ? (
                      <>
                        <button
                          onClick={() => setSubstituteStatus('rejected')}
                          className="flex-1 py-3 rounded-xl border border-rose-500/30 text-rose-300 font-bold text-sm hover:bg-rose-500/10 transition-colors"
                        >
                          Keep Originals
                        </button>
                        <button
                          onClick={() => setSubstituteStatus('accepted')}
                          className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-500 transition-colors"
                        >
                          Accept Subs
                        </button>
                      </>
                    ) : (
                      <div
                        className={`w-full flex justify-between items-center px-4 py-3 rounded-xl border ${
                          substituteStatus === 'accepted'
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                        }`}
                      >
                        <span className="font-bold text-sm">
                          {substituteStatus === 'accepted'
                            ? 'Substitutes applied to order note'
                            : 'Substitutes rejected — originals kept'}
                        </span>
                        <button
                          onClick={() => setSubstituteStatus('pending')}
                          className="text-xs font-bold underline px-2 py-1 rounded"
                        >
                          Undo
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="glass-box border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/40 flex justify-between items-center">
              <h3 className="font-bold text-white text-sm">Inventory & Order Targets</h3>
              <span className="text-[10px] font-bold bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded uppercase">
                +10% buffer
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-3 font-bold">Item</th>
                    <th className="px-6 py-3 font-bold">Baseline</th>
                    <th className="px-6 py-3 font-bold">Current</th>
                    <th className="px-6 py-3 font-bold">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {ingredients.length === 0 && !loading && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-500 text-sm">
                        No inventory data. Add ingredients or run Account Setup.
                      </td>
                    </tr>
                  )}
                  {ingredients.map((ing, i) => {
                    const alert = detectedAlerts.find((a) => a.originalIngredient === ing.name);
                    const baseline = ing.previous_cost_per_unit || ing.normal_price || ing.cost_per_unit;
                    return (
                      <tr key={ing.id || i} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4 font-semibold text-white">
                          <span className="inline-flex items-center gap-1.5">
                            {alert && substituteStatus === 'accepted'
                              ? (alert.recommendedSubstitute || '').replace(/ via .+$/, '')
                              : ing.name}
                            {alert && substituteStatus !== 'accepted' && (
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500">${Number(baseline).toFixed(2)}</td>
                        <td className={`px-6 py-4 font-medium ${alert ? 'text-rose-400 font-bold' : 'text-slate-300'}`}>
                          ${Number(ing.cost_per_unit).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-slate-400">
                          {ing.current_stock} {unitLabel(ing.unit)}
                          {ing.current_stock <= ing.min_threshold && (
                            <span className="ml-2 text-[10px] font-bold text-rose-300 uppercase">Low</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="xl:col-span-5 sticky top-4">
          <div className="bg-[#1E293B] rounded-[2.5rem] p-4 shadow-2xl border-[6px] border-slate-800 flex flex-col h-[700px] overflow-hidden relative">
            <div className="flex justify-center mb-6 mt-1 absolute top-0 left-0 right-0 z-20">
              <div className="w-1/3 h-6 bg-slate-900 rounded-b-3xl shadow-sm border-b border-slate-800" />
            </div>
            <div className="flex items-center justify-between px-3 pt-6 pb-4 text-white z-10 border-b border-slate-800/50">
              <div className="flex items-center space-x-2">
                <Smartphone className="w-4 h-4 text-slate-400" />
                <h3 className="font-bold text-sm tracking-wide">Wholesaler Order Note</h3>
              </div>
              <span className="text-[10px] font-medium bg-slate-800 px-2 py-0.5 rounded-full text-slate-300">
                Ready to send
              </span>
            </div>

            <div className="bg-gray-50 flex-1 rounded-2xl p-5 overflow-y-auto text-[13px] text-slate-800 whitespace-pre-wrap font-mono leading-relaxed shadow-inner mt-2 border border-gray-200">
              {loading ? (
                <div className="animate-pulse space-y-4 mt-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-full" />
                  <div className="h-4 bg-gray-200 rounded w-5/6" />
                </div>
              ) : (
                (() => {
                  let text = task2Text;
                  if (substituteStatus === 'accepted' && detectedAlerts.length > 0) {
                    detectedAlerts.forEach((alert) => {
                      if (alert.originalIngredient && alert.recommendedSubstitute) {
                        text = text.replace(
                          new RegExp(alert.originalIngredient, 'gi'),
                          alert.recommendedSubstitute.replace(/ via .+$/, ''),
                        );
                      }
                    });
                  }
                  return text;
                })()
              )}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 z-10">
              <button
                onClick={handleCopy}
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-3 flex flex-col items-center justify-center transition active:scale-95"
              >
                {copied ? <CheckCircle2 className="w-5 h-5 mb-1.5" /> : <Copy className="w-5 h-5 mb-1.5" />}
                <span className="text-[10px] font-bold uppercase tracking-wider">{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <a
                href={`mailto:?subject=${encodeURIComponent('Daily Order — ' + restaurantName)}&body=${encodeURIComponent(resolveNoteText())}`}
                onClick={() => auditSend('email', resolveNoteText())}
                className="bg-slate-800 hover:bg-slate-700 text-white rounded-xl py-3 flex flex-col items-center justify-center transition border border-slate-700 active:scale-95"
              >
                <Mail className="w-5 h-5 mb-1.5 text-slate-300" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Email</span>
              </a>
              <a
                href={`sms:?&body=${encodeURIComponent(resolveNoteText())}`}
                onClick={() => auditSend('sms', resolveNoteText())}
                className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl py-3 flex flex-col items-center justify-center transition active:scale-95"
              >
                <MessageSquare className="w-5 h-5 mb-1.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">SMS</span>
              </a>
            </div>
          </div>
          {orderLines.length > 0 && (
            <p className="text-[11px] text-slate-500 mt-3 text-center">
              {orderLines.length} vendor group{orderLines.length === 1 ? '' : 's'} · powered by{' '}
              {engineMode === 'gemini' ? 'AI-assisted forecast' : 'Rule engine + supplier directory'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
