import React, { lazy, Suspense, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { ActiveTab, Ingredient, MenuItem, SalesRecord, WasteEntry, MarginAlert, OrderNote } from '../types';

const InventoryView = lazy(() => import('./InventoryView').then(module => ({ default: module.InventoryView })));
const RecipesView = lazy(() => import('./RecipesView').then(module => ({ default: module.RecipesView })));
const SalesIngestionView = lazy(() => import('./SalesIngestionView').then(module => ({ default: module.SalesIngestionView })));
const MarginProtectorView = lazy(() => import('./MarginProtectorView').then(module => ({ default: module.MarginProtectorView })));
const AiAssistantView = lazy(() => import('./AiAssistantView').then(module => ({ default: module.AiAssistantView })));
const WasteLogModal = lazy(() => import('./WasteLogModal').then(module => ({ default: module.WasteLogModal })));
const ExportOrderModal = lazy(() => import('./ExportOrderModal').then(module => ({ default: module.ExportOrderModal })));
const OrderHistoryView = lazy(() => import('./OrderHistoryView').then(module => ({ default: module.OrderHistoryView })));
const RinetOverview = lazy(() => import('./RinetOverview').then(module => ({ default: module.RinetOverview })));
const RinetReports = lazy(() => import('./RinetReports').then(module => ({ default: module.RinetReports })));
const RinetSuppliers = lazy(() => import('./RinetWorkspace').then(module => ({ default: module.RinetSuppliers })));
const RinetSettings = lazy(() => import('./RinetWorkspace').then(module => ({ default: module.RinetSettings })));
import { ForecastProvider } from './ForecastContext';
const RinetOrder = lazy(() => import('./RinetOrder').then(module => ({ default: module.RinetOrder })));

export function WorkspaceViews({ activeTab, setActiveTab, currencySymbol = '$' }: { activeTab: ActiveTab; setActiveTab: (tab: ActiveTab) => void; currencySymbol?: string }) {
  const [data, setData] = useState<{ ingredients: Ingredient[]; menuItems: MenuItem[]; salesRecords: SalesRecord[]; wasteEntries: WasteEntry[]; marginAlerts: MarginAlert[]; restaurantId: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [waste, setWaste] = useState<string | null>(null);
  const [exportNote, setExportNote] = useState<OrderNote | null>(null);
  const refresh = async () => {
    const [ingredients, menus, sales, entries, alerts, profile] = await Promise.all(['/api/ingredients','/api/recipes','/api/sales','/api/waste','/api/alerts','/api/account/profile'].map(path => api(path)));
    setData({ ingredients: ingredients.data, menuItems: menus.data, salesRecords: sales.data, wasteEntries: entries.data, marginAlerts: alerts.data, restaurantId: profile.accountProfile.restaurantId });
  };
  useEffect(() => { refresh().catch(e => setError(e.message)); }, []);
  const mutate = async (path: string, method: string, body?: unknown) => {
    setBusy(true); setError('');
    try { await api(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }); await refresh(); return true; }
    catch (e) { setError((e as Error).message); return false; }
    finally { setBusy(false); }
  };
  if (!data) return <div role="status">{error || 'Loading restaurant data…'}{error && <button onClick={() => { setError(''); refresh().catch(e => setError(e.message)); }}>Retry</button>}</div>;
  const { ingredients, menuItems, salesRecords, wasteEntries, marginAlerts, restaurantId } = data;
  return <ForecastProvider revision={data}>
    {(menuItems.some(item=>item.name.startsWith('[SYNTHETIC] ')) || salesRecords.some(row=>row.order_id?.startsWith('SYNTHETIC-'))) && <div role="status" className="demo-banner">Synthetic test data is loaded. Sales, recipes, prices and stock are fabricated for workflow testing. Forecasts and totals are not real business results. Sample supplier contacts cannot receive orders.</div>}
    {error && <div role="alert" className="p-3 mb-4 text-rose-300">{error}</div>}
    {busy && <div role="status">Saving…</div>}
    <Suspense fallback={<p role="status">Loading workspace…</p>}>
    <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      {activeTab === 'dashboard' && <RinetOverview {...data} currencySymbol={currencySymbol} setActiveTab={setActiveTab} />}
      {(activeTab === 'sales' || activeTab === 'analytics') && <RinetReports {...data} currencySymbol={currencySymbol} setActiveTab={setActiveTab} view={activeTab} />}
      {activeTab === 'suppliers' && <RinetSuppliers ingredients={ingredients} />}
      {activeTab === 'settings' && <RinetSettings onSaved={refresh} />}
      {activeTab === 'inventory' && <InventoryView ingredients={ingredients} wasteEntries={wasteEntries} currencySymbol={currencySymbol} onSaveIngredient={i => mutate('/api/ingredients','POST',i)} onDeleteIngredient={id => mutate(`/api/ingredients/${encodeURIComponent(id)}`,'DELETE')} onOpenWasteModal={id => setWaste(id || '')} />}
      {activeTab === 'recipes' && <RecipesView ingredients={ingredients} menuItems={menuItems} currencySymbol={currencySymbol} onSaveMenuItem={m => mutate('/api/recipes','POST',m)} onDeleteMenuItem={id => mutate(`/api/recipes/${encodeURIComponent(id)}`,'DELETE')} />}
      {activeTab === 'ingestion' && <SalesIngestionView restaurantId={restaurantId} ingredients={ingredients} menuItems={menuItems} salesRecords={salesRecords} currencySymbol={currencySymbol} onIngestSuccess={async () => { await refresh(); }} />}
      {activeTab === 'margin' && <MarginProtectorView onSaveMenuItem={menu=>mutate('/api/recipes','POST',menu)} ingredients={ingredients} menuItems={menuItems} marginAlerts={marginAlerts} currencySymbol={currencySymbol} onResolveAlert={id => mutate(`/api/alerts/${encodeURIComponent(id)}/resolve`,'POST')} onUpdateMenuPrice={(id, price) => { const menu = menuItems.find(m => m.id === id); if (menu) void mutate('/api/recipes','POST',{ ...menu, selling_price: price }); }} />}
      {activeTab === 'assistant' && <AiAssistantView ingredients={ingredients} menuItems={menuItems} salesRecords={salesRecords} marginAlerts={marginAlerts} currencySymbol={currencySymbol} />}
      {activeTab === 'purchasing' && <RinetOrder ingredients={ingredients} menuItems={menuItems} salesRecords={salesRecords} currencySymbol={currencySymbol} />}
      {activeTab === 'history' && <OrderHistoryView />}

    </fieldset>
    {waste !== null && <WasteLogModal ingredients={ingredients} initialIngredientId={waste || undefined} currencySymbol={currencySymbol} onClose={() => setWaste(null)} onSaveWaste={entry => mutate('/api/waste','POST',entry)} />}
    {exportNote && <ExportOrderModal orderNote={exportNote} currencySymbol={currencySymbol} onClose={() => setExportNote(null)} />}
    </Suspense>
  </ForecastProvider>;
}

