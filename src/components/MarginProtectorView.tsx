import { SubstitutionEditor } from './SubstitutionEditor';
import { calculateMenuCostsAndMargins } from '../lib/marginEngine';
import React, { useState } from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  TrendingUp, 
  DollarSign, 
  CheckCircle2, 
  ArrowRight, 
  Sparkles, 
  Sliders, 
  RefreshCw 
} from 'lucide-react';
import { MarginAlert, MenuItem, Ingredient } from '../types';

interface MarginProtectorViewProps {
  marginAlerts: MarginAlert[];
  menuItems: MenuItem[];
  ingredients: Ingredient[];
  onResolveAlert: (id: string) => void;
  onUpdateMenuPrice: (menuId: string, newPrice: number) => void;
  currencySymbol: string;
  onSaveMenuItem: (menu:MenuItem)=>Promise<boolean>;
}

export const MarginProtectorView: React.FC<MarginProtectorViewProps> = ({
  marginAlerts,
  menuItems,
  ingredients,
  onResolveAlert,
  onUpdateMenuPrice,
  currencySymbol,
  onSaveMenuItem,
}) => {
  const [selectedMenuForSim, setSelectedMenuForSim] = useState<MenuItem | null>(menuItems[0] || null);
  const [simulatedPrice, setSimulatedPrice] = useState<number>(menuItems[0]?.selling_price || 5.00);

  const activeAlerts = marginAlerts.filter(a => !a.is_resolved).sort((a,b)=>b.increase_percent-a.increase_percent);

  // Compute total monthly loss across active price creep alerts
  const totalMonthlyLoss = activeAlerts.reduce((sum, a) => sum + a.estimated_monthly_loss, 0);

  // Price Simulation Math
  const getDishPortionCost = (item: MenuItem) => calculateMenuCostsAndMargins([item],ingredients)[0].calculatedCost;

  const currentSimCost = selectedMenuForSim ? getDishPortionCost(selectedMenuForSim) : 2.00;
  const simProfit = simulatedPrice - currentSimCost;
  const simMarginPct = simulatedPrice > 0 ? Math.round((simProfit / simulatedPrice) * 100) : 0;

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs uppercase tracking-wider mb-1">
            <ShieldAlert className="w-4 h-4" />
            <span>Found Money Engine</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">The Margin Protector & Price Creep Detector</h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Catches silent supplier price increases on raw ingredients before they drain your profits. Shows recipe-cost impact and alternatives for chef review.
          </p>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 shrink-0 text-right">
          <div className="text-xs text-amber-300 font-semibold uppercase tracking-wider">Cost impact at recorded volume</div>
          <div className="text-2xl font-extrabold text-amber-400 mt-0.5">
            {activeAlerts.some(a=>a.loss_available!==false) ? currencySymbol+totalMonthlyLoss.toFixed(2) : 'Unavailable'}
          </div>
        </div>
      </div>

      {/* ACTIVE PRICE CREEP ALERTS CARDS */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-white flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <span>Supplier Price Change Alerts ({activeAlerts.length})</span>
        </h2>

        {activeAlerts.length === 0 ? (
          <div className="bg-emerald-950/40 border border-emerald-800/80 rounded-2xl p-8 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <h3 className="text-lg font-bold text-white">No Active Supplier Price Creep Alerts</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              All supplier rates match your target baseline. If a supplier raises rates on Cheese, Oil, or Meat, Rinet Resto Bot will alert you here immediately.
            </p>
          </div>
        ) : (
          activeAlerts.map(alert => (
            <div 
              key={alert.id}
              className="bg-slate-900 border border-amber-500/40 rounded-2xl p-6 shadow-2xl relative overflow-hidden space-y-4"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                
                <div className="space-y-1.5 max-w-3xl">
                  <div className="flex items-center space-x-2">
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                      +{alert.increase_percent}% Supplier Price Creep
                    </span>
                    <span className="text-xs text-slate-400">
                      Detected on {alert.ingredient_name}
                    </span>
                  </div>

                  <h3 className="text-lg font-extrabold text-white">
                    Impacted Dish: "{alert.affected_menu_item_name || 'Multiple Dishes'}"
                  </h3>

                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
                    💡 <strong>Bot Recommendation:</strong> {alert.suggested_action}
                  </p>
                </div>

                {/* Financial Loss Pill */}
                <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-4 text-center shrink-0 min-w-[200px]">
                  <div className="text-[11px] text-slate-400 uppercase font-semibold">Recorded-volume impact</div>
                  <div className="text-xl font-extrabold text-amber-400">
                    -{alert.loss_available === false ? 'Unavailable' : currencySymbol+alert.estimated_monthly_loss.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Old: {currencySymbol}{alert.old_cost} → New: <strong className="text-amber-300">{currencySymbol}{alert.new_cost}</strong>
                  </div>
                </div>

              </div>

              {alert.loss_basis && <p className="text-xs text-slate-400">{alert.loss_basis}</p>}
              {!!alert.suggested_substitutes?.length && <section aria-label="Chef-review substitutes" className="text-sm text-slate-200"><h4>Chef-review alternatives</h4>{alert.suggested_substitutes.map(s=><div key={s.ingredient_id} className="mt-2"><strong>{s.name}</strong><p>{s.note}</p><small>Savings: {s.savings_per_portion===null?'replacement portion required':currencySymbol+s.savings_per_portion.toFixed(2)}</small>{menuItems.find(m=>m.id===alert.affected_menu_item_id) && ingredients.find(i=>i.id===s.ingredient_id) && <SubstitutionEditor menu={menuItems.find(m=>m.id===alert.affected_menu_item_id)!} originalId={alert.ingredient_id} replacement={ingredients.find(i=>i.id===s.ingredient_id)!} onSave={onSaveMenuItem}/>}</div>)}</section>}
              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80">
                <div className="text-xs text-slate-400">
                  Created {new Date(alert.created_at).toLocaleDateString()}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      const matchedMenu = menuItems.find(m => m.name === alert.affected_menu_item_name);
                      if (matchedMenu) {
                        setSelectedMenuForSim(matchedMenu);
                        setSimulatedPrice(matchedMenu.selling_price + 0.50);
                      }
                    }}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-4 py-2 rounded-xl transition shadow"
                  >
                    Simulate Price Fix
                  </button>

                  <button
                    onClick={() => onResolveAlert(alert.id)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-4 py-2 rounded-xl border border-slate-700 transition"
                  >
                    Mark Resolved
                  </button>
                </div>
              </div>

            </div>
          ))
        )}
      </div>

      {/* DYNAMIC PROFIT MARGIN SIMULATOR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Interactive Dish Price & Margin Simulator</h2>
            <p className="text-xs text-slate-400">Adjust menu selling prices to see instant margin recovery</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Select Dish */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Select Menu Item</label>
            <select
              value={selectedMenuForSim?.id || ''}
              onChange={(e) => {
                const found = menuItems.find(m => m.id === e.target.value);
                if (found) {
                  setSelectedMenuForSim(found);
                  setSimulatedPrice(found.selling_price);
                }
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
            >
              {menuItems.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} (Current: {currencySymbol}{m.selling_price.toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          {/* Price Slider */}
          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
              <span>Simulated Selling Price</span>
              <span className="text-amber-400 font-extrabold">{currencySymbol}{simulatedPrice.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={Math.max(1, currentSimCost)}
              max={currentSimCost * 4}
              step="0.10"
              value={simulatedPrice}
              onChange={(e) => setSimulatedPrice(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer mt-2"
            />
          </div>

          {/* Result Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Recipe Food Cost:</span>
              <span className="font-bold text-slate-200">{Number.isFinite(currentSimCost)?currencySymbol+currentSimCost.toFixed(2):'Unavailable — complete recipe costs'}</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-slate-400">Simulated Margin:</span>
              <span className={`font-extrabold text-sm ${simMarginPct >= 60 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {Number.isFinite(simMarginPct)?simMarginPct+'% ('+currencySymbol+simProfit.toFixed(2)+' contribution)':'Unavailable'}
              </span>
            </div>

            <button
              onClick={() => {
                if (selectedMenuForSim) {
                  onUpdateMenuPrice(selectedMenuForSim.id, simulatedPrice);
                }
              }}
              className="mt-3 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2 rounded-xl shadow transition"
            >
              Save Menu Price
            </button>
          </div>

        </div>
      </div>

    </div>
  );
};




