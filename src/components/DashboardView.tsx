import { unitLabel } from '../lib/displayText';
import React from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  AlertTriangle, 
  Boxes, 
  Trash2, 
  ArrowUpRight, 
  Sparkles, 
  ShoppingBag, 
  CheckCircle2, 
  ChevronRight,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { MenuItem, Ingredient, MarginAlert, SalesRecord, WasteEntry, ActiveTab } from '../types';

interface DashboardViewProps {
  salesRecords: SalesRecord[];
  menuItems: MenuItem[];
  ingredients: Ingredient[];
  marginAlerts: MarginAlert[];
  wasteEntries: WasteEntry[];
  setActiveTab: (tab: ActiveTab) => void;
  onResolveAlert: (id: string) => void;
  currencySymbol: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  salesRecords,
  menuItems,
  ingredients,
  marginAlerts,
  wasteEntries,
  setActiveTab,
  onResolveAlert,
  currencySymbol,
}) => {
  // Metrics calculations
  const totalRevenue = salesRecords.reduce((sum, s) => sum + s.total_amount, 0);
  const totalOrdersCount = salesRecords.length;

  const lowStockList = ingredients.filter(i => i.current_stock <= i.min_threshold);
  const totalWasteCost = wasteEntries.reduce((sum, w) => sum + w.estimated_loss_amount, 0);

  // Overall store avg margin
  const avgMargin = menuItems.length > 0
    ? Math.round(menuItems.reduce((acc, m) => acc + (m.current_margin_percent || 60), 0) / menuItems.length)
    : 62;

  // Chart data aggregation by Date
  const salesByDateMap: Record<string, number> = {};
  salesRecords.forEach(s => {
    const d = s.sold_at.split('T')[0] || 'Today';
    salesByDateMap[d] = (salesByDateMap[d] || 0) + s.total_amount;
  });

  const chartData = Object.keys(salesByDateMap).map(dateKey => ({
    date: dateKey.slice(5), // '07-29'
    Revenue: Math.round(salesByDateMap[dateKey] * 100) / 100,
    EstimatedCost: Math.round(salesByDateMap[dateKey] * (1 - avgMargin / 100) * 100) / 100,
  }));

  // Fallback: empty chart until real sales exist (no fake revenue)
  const finalChartData = chartData.length > 0 ? chartData : [];

  const activeUnresolvedAlerts = marginAlerts.filter(a => !a.is_resolved);

  return (
    <div className="space-[#0f172a] text-slate-100 space-y-6 pb-12">
      
      {/* Top Welcome & Quick Action Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
              Live Resto Operations
            </span>
            <span className="text-xs text-slate-400">Updated Real-Time</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1.5 tracking-tight">
            Restaurant Owner Command Center
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Tracking recipe cost creep, ingredient stock levels, and automated purchase orders.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setActiveTab('ingestion')}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-lg transition flex items-center space-x-2"
          >
            <span>Upload POS Sales</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTab('purchasing')}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs px-4 py-2.5 rounded-xl transition flex items-center space-x-2"
          >
            <ShoppingBag className="w-4 h-4 text-amber-400" />
            <span>Generate PO</span>
          </button>
        </div>
      </div>

      {/* KPI METRICS GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        
        {/* Total Revenue */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Total POS Sales</span>
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-extrabold text-white">
              {currencySymbol}{totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-emerald-400 font-semibold mt-1 flex items-center space-x-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>{totalOrdersCount} orders ingested</span>
            </div>
          </div>
        </div>

        {/* Avg Profit Margin */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Avg Profit Margin</span>
            <div className="p-2 bg-teal-500/10 rounded-xl text-teal-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-extrabold text-white">
              {avgMargin}%
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Target: 65% benchmark
            </div>
          </div>
        </div>

        {/* Active Margin Alerts */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Price Creep Alerts</span>
            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-xl sm:text-2xl font-extrabold ${activeUnresolvedAlerts.length > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
              {activeUnresolvedAlerts.length}
            </div>
            <div className="text-[11px] text-amber-400/90 font-medium mt-1">
              {activeUnresolvedAlerts.length > 0 ? 'Actionable loss warning' : 'Margins protected'}
            </div>
          </div>
        </div>

        {/* Low Stock Items */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Low Stock Items</span>
            <div className="p-2 bg-rose-500/10 rounded-xl text-rose-400">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-xl sm:text-2xl font-extrabold ${lowStockList.length > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
              {lowStockList.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {lowStockList.length > 0 ? 'Need reorder today' : 'Inventory healthy'}
            </div>
          </div>
        </div>

        {/* Kitchen Waste Loss */}
        <div className="col-span-2 lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Logged Spoilage/Waste</span>
            <div className="p-2 bg-slate-800 rounded-xl text-slate-400">
              <Trash2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-extrabold text-slate-200">
              {currencySymbol}{totalWasteCost.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {wasteEntries.length} logged incidents
            </div>
          </div>
        </div>

      </div>

      {/* FEATURED "THE MARGIN PROTECTOR" BANNER (Matching user's request) */}
      {activeUnresolvedAlerts.length > 0 ? (
        <div className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-slate-900 border border-amber-500/40 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-start space-x-3.5">
            <div className="p-3 bg-amber-500/20 border border-amber-500/40 rounded-2xl text-amber-400 shrink-0 mt-0.5">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>

            <div className="space-y-2 flex-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-extrabold uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/30">
                  Margin Protector Alert
                </span>
                <button
                  onClick={() => setActiveTab('margin')}
                  className="text-xs font-semibold text-amber-300 hover:text-white flex items-center space-x-1"
                >
                  <span>View All {activeUnresolvedAlerts.length} Price Creep Insights</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <h3 className="text-lg font-bold text-white">
                {activeUnresolvedAlerts[0].ingredient_name}: Supplier Raised Price by +{activeUnresolvedAlerts[0].increase_percent}%
              </h3>

              <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
                {activeUnresolvedAlerts[0].suggested_action}
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setActiveTab('margin')}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-4 py-2 rounded-xl transition shadow"
                >
                  See Substitute Suppliers & Optimize Menu Price
                </button>
                <button
                  onClick={() => onResolveAlert(activeUnresolvedAlerts[0].id)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium px-3.5 py-2 rounded-xl transition border border-slate-700"
                >
                  Dismiss / Mark Resolved
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-2xl p-4 flex items-center justify-between text-sm text-emerald-300">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span><strong>Margin Protector Status:</strong> All ingredient prices match your contract baseline. No profit loss detected.</span>
          </div>
          <button
            onClick={() => setActiveTab('margin')}
            className="text-xs font-semibold underline text-emerald-400 hover:text-emerald-200"
          >
            Review Supplier Rates
          </button>
        </div>
      )}

      {/* CHARTS AND LOW STOCK GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sales & Cost Trend Chart */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-base font-bold text-white">Sales Revenue vs Food Cost</h2>
              <p className="text-xs text-slate-400">Daily POS sales ingested vs estimated ingredient costs</p>
            </div>
            <div className="flex items-center space-x-4 text-xs font-medium">
              <span className="flex items-center space-x-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span>Revenue</span>
              </span>
              <span className="flex items-center space-x-1.5 text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span>Food Cost</span>
              </span>
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={finalChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                  itemStyle={{ color: '#f8fafc' }}
                  formatter={(val: any) => [`$${val}`, '']}
                />
                <Area type="monotone" dataKey="Revenue" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" dataKey="EstimatedCost" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorCost)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Low Stock Reorder Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <Boxes className="w-4 h-4 text-rose-400" />
                <span>Low Stock Reorder List</span>
              </h2>
              <button
                onClick={() => setActiveTab('inventory')}
                className="text-xs text-amber-400 hover:underline font-medium"
              >
                View All ({ingredients.length})
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Ingredients near or below minimum safety thresholds
            </p>

            <div className="mt-4 space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              {lowStockList.length === 0 ? (
                <div className="text-xs text-slate-400 py-8 text-center bg-slate-950/40 rounded-xl border border-slate-800">
                  All ingredient stock levels are currently sufficient!
                </div>
              ) : (
                lowStockList.map(item => (
                  <div key={item.id} className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-slate-200">{item.name}</div>
                      <div className="text-[11px] text-slate-400 flex items-center space-x-2 mt-0.5">
                        <span>Stock: <strong className="text-rose-400">{item.current_stock} {unitLabel(item.unit)}</strong></span>
                        <span>•</span>
                        <span>Min: {item.min_threshold} {unitLabel(item.unit)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('purchasing')}
                      className="bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold text-[11px] px-2.5 py-1.5 rounded-lg border border-slate-700 transition shrink-0"
                    >
                      + Order
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={() => setActiveTab('purchasing')}
            className="w-full bg-gradient-to-r from-amber-500 to-emerald-500 text-slate-950 hover:brightness-110 font-bold text-xs py-2.5 rounded-xl shadow transition text-center flex items-center justify-center space-x-2"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Generate Supplier Purchase Orders</span>
          </button>
        </div>

      </div>

    </div>
  );
};
