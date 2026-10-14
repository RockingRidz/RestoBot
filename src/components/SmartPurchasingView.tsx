import { unitLabel } from '../lib/displayText';
import React, { useState } from 'react';
import { 
  ShoppingBag, 
  TrendingUp, 
  FileText, 
  Download, 
  Printer, 
  CheckCircle, 
  Sparkles, 
  Calendar,
  Sliders,
  Send,
  Boxes,
  Info
} from 'lucide-react';
import { Ingredient, MenuItem, SalesRecord, OrderNote } from '../types';
import { generateSmartPurchaseOrder } from '../lib/forecastEngine';

interface SmartPurchasingViewProps {
  salesRecords: SalesRecord[];
  ingredients: Ingredient[];
  menuItems: MenuItem[];
  onOpenExportModal: (orderNote: OrderNote) => void;
  currencySymbol: string;
}

export const SmartPurchasingView: React.FC<SmartPurchasingViewProps> = ({
  salesRecords,
  ingredients,
  menuItems,
  onOpenExportModal,
  currencySymbol,
}) => {
  const [horizonDays, setHorizonDays] = useState<number>(7);
  const [safetyBuffer, setSafetyBuffer] = useState<number>(1.2);
  const [hoveredLogic, setHoveredLogic] = useState<string | null>(null);

  const forecastResult = generateSmartPurchaseOrder(
    salesRecords,
    ingredients,
    menuItems,
    horizonDays,
    safetyBuffer
  );

  // Logic Explanation Generator - FIXED SYNTAX
  const getLogicExplanation = (line: any) => {
    const baseQty = line.predicted_usage;
    const orderQty = line.recommended_order_qty;
    const currentStock = line.current_stock;
    const gap = baseQty - currentStock;
    
    return `LOGIC BREAKDOWN:
📦 Predicted Usage: ${baseQty} (based on sales history)
📉 Current Stock: ${currentStock}
⚠️ Gap: ${gap > 0 ? gap : 0}
🚀 Order Recommendation: ${orderQty} (rounded up for safety)`;
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="relative group">
          <div className="flex items-center space-x-2 text-teal-400 font-bold text-xs uppercase tracking-wider mb-1">
            <ShoppingBag className="w-4 h-4" />
            <span>AI Automated Purchasing Bot</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Smart Supplier Order Planner & Forecast</h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            RestoBot combines current stock levels with expected sales trends to calculate exact supplier order quantities.
          </p>
        </div>
        <div className="bg-teal-500/10 border border-teal-500/30 rounded-2xl p-4 shrink-0 text-right">
          <div className="text-xs text-teal-300 font-semibold uppercase tracking-wider">Estimated PO Total</div>
          <div className="text-2xl font-extrabold text-teal-400 mt-0.5">
            {currencySymbol}{forecastResult.totalProjectedSalesValue.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
            <span className="flex items-center space-x-1.5">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>Planning Horizon</span>
            </span>
            <span className="text-amber-400 font-bold">{horizonDays} Days</span>
          </label>
          <input
            type="range" min={3} max={30} step={1} value={horizonDays}
            onChange={(e) => setHorizonDays(Number(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer mt-2"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
            <span className="flex items-center space-x-1.5">
              <Sliders className="w-4 h-4 text-teal-400" />
              <span>Safety Buffer Factor</span>
            </span>
            <span className="text-teal-400 font-bold">{Math.round((safetyBuffer - 1) * 100)}% Buffer</span>
          </label>
          <input
            type="range" min={1.0} max={1.5} step={0.05} value={safetyBuffer}
            onChange={(e) => setSafetyBuffer(Number(e.target.value))}
            className="w-full accent-teal-500 cursor-pointer mt-2"
          />
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col justify-between text-xs">
          <div className="text-slate-400">
            Based on {salesRecords.length} historical sales records & menu recipes
          </div>
          <div className="font-bold text-white mt-1">
            Generated {forecastResult.generatedOrders.length} Supplier Purchase Orders
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-base font-bold text-white flex items-center space-x-2">
          <FileText className="w-5 h-5 text-amber-400" />
          <span>Automated Supplier Purchase Orders (PO)</span>
        </h2>

        {forecastResult.generatedOrders.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
            Current stock levels are sufficient for the next {horizonDays} days!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {forecastResult.generatedOrders.map(order => (
              <div key={order.id} className="bg-slate-900 border border-slate-800 hover:border-teal-500/50 rounded-2xl p-5 shadow-xl space-y-4 transition flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-400 bg-teal-500/10 px-2.5 py-0.5 rounded-full border border-teal-500/30">
                        {order.po_number}
                      </span>
                      <h3 className="text-base font-bold text-white mt-1">{order.supplier_name}</h3>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-extrabold text-amber-300">{currencySymbol}{order.total_amount.toFixed(2)}</div>
                      <div className="text-[10px] text-slate-400">{order.lines.length} items</div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 border-t border-slate-800 pt-3">
                    {order.lines.map((line, idx) => (
                      <div 
                        key={idx} 
                        className="group flex items-center justify-between text-xs py-1 border-b border-slate-800/40 relative"
                        onMouseEnter={() => setHoveredLogic(getLogicExplanation(line))}
                        onMouseLeave={() => setHoveredLogic(null)}
                      >
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-slate-200">{line.ingredient_name}</span>
                          <div className="p-0.5 bg-slate-800 rounded-full cursor-help opacity-0 group-hover:opacity-100 transition">
                            <Info className="w-3 h-3 text-teal-400" />
                          </div>
                        </div>
                        <div className="font-bold text-teal-400">
                          {line.order_qty} {unitLabel(line.unit)} = {currencySymbol}{line.subtotal.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Status: {order.status}</span>
                  <button
                    onClick={() => onOpenExportModal(order)}
                    className="bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold text-xs px-4 py-2 rounded-xl shadow transition flex items-center space-x-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Preview & Export PO</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {hoveredLogic && (
        <div className="fixed bottom-6 right-6 w-80 bg-slate-900 border-2 border-teal-500 rounded-2xl p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center space-x-2 mb-2 text-teal-400 font-bold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>AI Calculation Logic</span>
          </div>
          <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
            {hoveredLogic}
          </pre>
          <div className="mt-3 pt-2 border-t border-slate-800 text-[10px] text-slate-500 italic">
            Calculated using weighted sales baseline and current inventory levels.
          </div>
        </div>
      )}
    </div>
  );
};