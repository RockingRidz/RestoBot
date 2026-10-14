import { unitLabel } from '../lib/displayText';
import React, { useState } from 'react';
import { CircleDollarSign, Leaf, TrendingUp, TriangleAlert, Upload, FileText, ChartNoAxesCombined } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { Metric, PageHeading, foodIcon } from './RinetUi';
import type { ActiveTab, Ingredient, MenuItem, SalesRecord, WasteEntry, MarginAlert } from '../types';
import { useForecast } from './ForecastContext';
import { businessDateKey } from '../lib/businessDate';

type Props = {
  view: 'sales' | 'analytics'; ingredients: Ingredient[]; menuItems: MenuItem[];
  salesRecords: SalesRecord[]; wasteEntries: WasteEntry[]; marginAlerts: MarginAlert[];
  currencySymbol: string; setActiveTab: (tab: ActiveTab) => void;
};
export function RinetReports(props: Props) {
  const { view, ingredients, salesRecords, wasteEntries, menuItems, marginAlerts, setActiveTab } = props;
  const [range, setRange] = useState(14);
  const money = (value: number) => !Number.isFinite(value) ? '—' : props.currencySymbol + value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const dates = new Map<string, number>();
  const items = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const sale of salesRecords) {
    const date = businessDateKey(sale.sold_at);
    dates.set(date, (dates.get(date) || 0) + sale.total_amount);
    const row = items.get(sale.item_name) || { name: sale.item_name, quantity: 0, revenue: 0 };
    row.quantity += sale.quantity_sold; row.revenue += sale.total_amount; items.set(sale.item_name, row);
  }
  const daily = [...dates].sort(([a], [b]) => a.localeCompare(b)).slice(-range).map(([date, value]) => ({ date: date.slice(5), value }));
  const revenue = salesRecords.reduce((sum, row) => sum + row.total_amount, 0);
  const { forecast, live } = useForecast();
  const forecastChart = [...daily.map(row => ({...row, forecast: undefined as number | undefined})), ...(live ? [{date:live.targetDate.slice(5),value:undefined,forecast:live.totalProjectedMenuRevenue}] : [])];
  const ranked = [...items.values()].sort((a, b) => b.revenue - a.revenue);
  const itemTable = (rows: typeof ranked) => <div className="table-scroll"><table className="rinet-table"><thead><tr><th>Menu item</th><th>Units</th><th>Sales</th><th>Tomorrow</th></tr></thead><tbody>{rows.map(row => <tr key={row.name}><td><span className="food-icon">{foodIcon(row.name)}</span>{row.name}</td><td>{row.quantity}</td><td>{money(row.revenue)}</td><td>{forecast.menuDemandPredictions.find(p => p.menuItemName.toLowerCase() === row.name.toLowerCase())?.projectedUnits ?? '—'}</td></tr>)}</tbody></table>{!rows.length && <p className="inline-empty">Import sales to compare your menu items.</p>}</div>;
  const salesChart = <div className="sales-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={forecastChart}><CartesianGrid stroke="#eee6d8" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 11, fill: '#806d4d' }} tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 11, fill: '#806d4d' }} tickLine={false} axisLine={false} /><Tooltip formatter={(value: any,name:any) => [money(Number(value)), name==='forecast'?'AI forecast':'Actual sales']} /><Bar dataKey="value" fill="#c7a365" radius={[3, 3, 0, 0]} /><Bar dataKey="forecast" fill="#7651a8" radius={[3,3,0,0]} /></BarChart></ResponsiveContainer></div>;

  if (view === 'sales') return <>
    <PageHeading title="Sales & Forecast" subtitle="Analyse past sales and review tomorrow’s predictions."><button className="outline-button" onClick={() => setActiveTab('ingestion')}><Upload size={15} />Import sales</button></PageHeading>
    <div className="page-tabs"><span className="active">Overview</span><button onClick={() => setActiveTab('purchasing')}>Menu item forecast</button><button onClick={() => setActiveTab('ingestion')}>Import sales</button></div>
    <div className="metric-grid"><Metric label="Total Sales" value={money(revenue)} note="All imported history" icon={CircleDollarSign} /><Metric label="Avg. Recorded Day" value={dates.size ? money(revenue / dates.size) : '—'} note={`${dates.size} recorded sales days`} icon={ChartNoAxesCombined} /><Metric label="Forecast (Tomorrow)" value={money(forecast.totalProjectedMenuRevenue)} note="Projected menu revenue" icon={TrendingUp} /><Metric label="Forecast Accuracy" value="—" note="Historical evaluation pending" icon={Leaf} dark /></div>
    <section className="paper-panel"><div className="panel-heading"><h2>Daily Sales & AI Forecast</h2><select aria-label="Sales chart period" value={range} onChange={e => setRange(Number(e.target.value))}><option value={7}>Last 7 recorded days</option><option value={14}>Last 14 recorded days</option><option value={30}>Last 30 recorded days</option></select></div>{daily.length ? salesChart : <p className="inline-empty">Import a POS export to see daily sales.</p>}</section>
    <div className="sales-rankings"><section className="paper-panel"><div className="panel-heading"><h2>Top Items by Recorded Revenue</h2></div>{itemTable(ranked.slice(0, 5))}</section><section className="paper-panel"><div className="panel-heading"><h2>Lower-Revenue Items</h2></div>{itemTable([...ranked].reverse().slice(0, 5))}</section></div>
  </>;

  const waste = new Map<string, { name: string; quantity: number; unit: string }>();
  const costs = new Map<string, number>();
  for (const entry of wasteEntries) {
    const key = entry.ingredient_name + ':' + entry.unit;
    const row = waste.get(key) || { name: entry.ingredient_name, quantity: 0, unit: entry.unit };
    row.quantity += entry.quantity; waste.set(key, row);
    if (Number.isFinite(entry.estimated_loss_amount)) {
      const date = entry.logged_at.slice(0, 10); costs.set(date, (costs.get(date) || 0) + entry.estimated_loss_amount);
    }
  }
  const costRows = [...costs].sort(([a], [b]) => a.localeCompare(b)).map(([date, cost]) => ({ date: date.slice(5), cost }));
  const exportReport = () => {
    const quote = (value: unknown) => '"' + String(value).replace(/"/g, '""') + '"';
    const csv = ['Date,Ingredient,Quantity,Unit,Reason,Recorded loss', ...wasteEntries.map(w => [w.logged_at, w.ingredient_name, w.quantity, w.unit, w.reason, Number.isFinite(w.estimated_loss_amount) ? w.estimated_loss_amount : ''].map(quote).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'restobot-waste-report.csv'; anchor.click(); URL.revokeObjectURL(url);
  };
  return <>
    <PageHeading title="Analytics" subtitle="Track performance, waste and restaurant operations."><button className="outline-button" onClick={exportReport}><FileText size={15} />Export waste report</button></PageHeading>
    <div className="metric-grid"><Metric label="Forecast Accuracy" value="—" note="Requires historical evaluation" icon={ChartNoAxesCombined} /><Metric label="Waste Recorded" value={`${wasteEntries.length} entries`} note="Recorded kitchen incidents" icon={Leaf} /><Metric label="Inventory Value" value={money(ingredients.reduce((sum, i) => sum + i.current_stock * i.cost_per_unit, 0))} note="At current ingredient costs" icon={CircleDollarSign} /><Metric label="Price Alerts" value={String(marginAlerts.filter(a => !a.is_resolved).length)} note="Unresolved cost alerts" icon={TriangleAlert} /></div>
    <div className="analytics-grid"><section className="paper-panel"><div className="panel-heading"><h2>Waste Cost by Day</h2></div>{costRows.length ? <div className="sales-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={costRows}><XAxis dataKey="date" /><YAxis /><Tooltip formatter={(v: any) => [money(Number(v)), 'Recorded loss']} /><Bar dataKey="cost" fill="#c7a365" /></BarChart></ResponsiveContainer></div> : <div className="empty-state"><Leaf /><b>No waste costs recorded yet.</b><p>Cost history appears once waste entries include a recorded loss amount.</p><button className="text-button" onClick={() => setActiveTab('inventory')}>Log kitchen waste</button></div>}</section>
    <section className="paper-panel"><div className="panel-heading"><h2>Waste by Ingredient</h2></div><div className="table-scroll"><table className="rinet-table"><thead><tr><th>Ingredient</th><th>Waste</th></tr></thead><tbody>{[...waste.values()].map(w => <tr key={w.name + ':' + w.unit}><td><span className="food-icon">{foodIcon(w.name)}</span>{w.name}</td><td>{Number(w.quantity.toFixed(3))} {unitLabel(w.unit)}</td></tr>)}</tbody></table></div>{!waste.size && <p className="inline-empty">No waste entries recorded.</p>}</section>
    <section className="paper-panel"><div className="panel-heading"><h2>Sales Revenue Trend</h2></div>{daily.length ? <div className="sales-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={daily}><CartesianGrid stroke="#eee6d8" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(v: any) => [money(Number(v)), 'Sales']} /><Area dataKey="value" stroke="#a37319" fill="#e9d7ac" fillOpacity={.25} isAnimationActive={false} /></AreaChart></ResponsiveContainer></div> : <p className="inline-empty">Import sales to see revenue trends.</p>}</section></div>
    <section className="paper-panel analytics-note"><h2>Measure what matters</h2><p>Forecast accuracy, avoided waste and margin savings need a verified comparison period. Recorded sales and inventory values are available now.</p></section>
  </>;
}
