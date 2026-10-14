import { ownerText } from '../lib/displayText';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { ForecastResult } from '../lib/forecastEngine';

type LiveForecast = ForecastResult & { savedForecastId: string; source: 'ai' | 'rule_engine'; generatedAt: string; targetDate: string; safetyBuffer: number };
// NaN renders as unavailable, never as a fabricated zero-dollar prediction.
const unavailable: ForecastResult = { horizonDays: 1, totalProjectedSalesValue: NaN, totalProjectedMenuRevenue: NaN, totalProjectedMenuUnits: NaN, lines: [], generatedOrders: [], menuDemandPredictions: [], warnings: [] };
const Context = createContext<{ forecast: ForecastResult; live: LiveForecast | null; refresh: () => Promise<void>; loading: boolean }>({ forecast: unavailable, live: null, refresh: async () => {}, loading: false });
export const useForecast = () => useContext(Context);
export function ForecastProvider({ revision, children }: { revision: unknown; children: React.ReactNode }) {
  const [live, setLive] = useState<LiveForecast | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const sequence = useRef(0);
  const refresh = async () => {
    const request = ++sequence.current;
    setLive(null); setLoading(true); setError('');
    try {
      const health = await api<{aiUsage?: {enabled:boolean}}>('/api/health');
      const path = health.aiUsage?.enabled ? '/api/ai/forecast' : '/api/forecast';
      const response = await api<LiveForecast>(path, { method: 'POST', body: path === '/api/forecast' ? JSON.stringify({horizonDays:1,safetyBuffer:1.1}) : '{}' });
      if (request === sequence.current) setLive(response);
    }
    catch (e) { if (request === sequence.current) setError((e as Error).message); }
    finally { if (request === sequence.current) setLoading(false); }
  };
  useEffect(() => {
    const request = ++sequence.current;
    setLive(null); setLoading(false); setError('');
    void api<{data:LiveForecast|null}>('/api/forecasts/current').then(response=>{
      if(request===sequence.current) setLive(response.data);
    }).catch(()=>{ if(request===sequence.current) setError('Saved forecast could not be loaded. Retry or generate a new forecast.'); });
  }, [revision]);
  useEffect(() => () => { ++sequence.current; }, []);
  return <Context.Provider value={{ forecast: live || unavailable, live, refresh, loading }}>
    <div className="order-notice no-print"><div><b>{loading ? 'Generating forecast…' : live ? 'Forecast ready' : error ? 'Forecast unavailable' : 'Forecast ready to generate'}</b><p>{error || (live ? `For ${live.targetDate} (Detroit time) · Generated ${new Date(live.generatedAt).toLocaleString('en-US',{timeZone:'America/Detroit'})} · Estimates, not measured accuracy.` : 'Generate a forecast from your current sales. Actual charts use recorded sales; no sample predictions are substituted.')}</p><button className="outline-button" disabled={loading} onClick={() => void refresh()}>{loading ? 'Working…' : 'Generate forecast'}</button></div></div>
    {!!live?.blockingIssues?.length && <div role="alert" className="error-banner"><b>Forecast available for review; purchasing approval is blocked.</b><ul>{live.blockingIssues.map(issue=><li key={issue}>{ownerText(issue)}</li>)}</ul></div>}
    {children}
  </Context.Provider>;
}
