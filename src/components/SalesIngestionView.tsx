import { ZeroSalesForm } from './ZeroSalesForm';
import { ownerText } from '../lib/displayText';
import { unitLabel } from '../lib/displayText';
import React, { useState } from 'react';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  MinusCircle, 
  Layers, 
  Search,
  Zap,
  ArrowRight
} from 'lucide-react';
import { SalesRecord, Ingredient, MenuItem } from '../types';
import { SAMPLE_POS_CSV_TEXT } from '../lib/demoData';
import { api } from '../lib/api';
import type { SalesIngestionResult } from '../lib/ingestion';

interface SalesIngestionViewProps {
  restaurantId: string;
  salesRecords: SalesRecord[];
  ingredients: Ingredient[];
  menuItems: MenuItem[];
  onIngestSuccess: (newSales: SalesRecord[], deductedSummary: Array<{ ingredient_name: string; deducted_qty: number; unit: string; new_stock: number }>) => void;
  currencySymbol: string;
}

export const SalesIngestionView: React.FC<SalesIngestionViewProps> = ({
  restaurantId,
  salesRecords,
  ingredients,
  menuItems,
  onIngestSuccess,
  currencySymbol,
}) => {
  const [rawText, setRawText] = useState('');
  const [importMode,setImportMode]=useState('historical');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastBatchSummary, setLastBatchSummary] = useState<Array<{ ingredient_name: string; deducted_qty: number; unit: string; new_stock: number }> | null>(null);
  const [ingestMessage, setIngestMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Handle Drag & Drop / File Select
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setRawText(text);
      };
      reader.readAsText(file);
    }
  };

  // Run the Sales Ingestion & Ingredient Auto-Deduction Engine
  const handleProcessIngestion = async (csvToUse?: string) => {
    const textToProcess = csvToUse || rawText;
    if (!textToProcess.trim()) {
      setIngestMessage({ type: 'error', text: 'Please upload a CSV file or paste POS sales text first.' });
      return;
    }

    setIsProcessing(true);
    setIngestMessage(null);

    try {
      const result = await api<SalesIngestionResult>('/api/ingest', { method: 'POST', body: JSON.stringify({ csvData: textToProcess, restaurantId, importMode }) });

      if (result.parsedCount > 0 || result.duplicateCount > 0) {
        await onIngestSuccess(result.salesRecords, result.deductedIngredientsSummary);
        setLastBatchSummary(result.deductedIngredientsSummary);
        setIngestMessage({
          type: 'success',
          text: `Successfully ingested ${result.parsedCount} POS sales records! Skipped ${result.duplicateCount} duplicate records. ${result.warnings.join(' ')}`,
        });
        setRawText('');
      } else {
        setIngestMessage({
          type: 'error',
          text: `The sales file could not be read. Check the order number, date, item, quantity and price columns. ${ownerText(result.errors.join('. '), 'Please review the file and try again.')}`,
        });
      }
    } catch (err: any) {
      setIngestMessage({ type: 'error', text: err?.message || 'Error processing sales file.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Quick Load Sample POS CSV
  const handleLoadSampleCSV = () => {
    setRawText(SAMPLE_POS_CSV_TEXT);

  };

  // Filter sales list
  const filteredSales = salesRecords.filter(s => 
    s.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.order_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.category && s.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-3 text-emerald-400 font-bold text-xs uppercase tracking-wider mb-1">
          <Zap className="w-4 h-4" />
          <span>Sales Ingestion & Ingredient Deductor</span>
        </div>
        <h1 className="text-2xl font-extrabold text-white">Manual POS Sales File Ingestion</h1>
        <p className="text-sm text-slate-400 mt-1 max-w-2xl">
          Upload daily sales CSVs or paste POS sales reports. RestoBot matches dish names to your recipes and automatically deducts raw ingredient stock levels in real time.
        </p>
      </div>

      <ZeroSalesForm menus={menuItems} onSaved={async()=>{await onIngestSuccess([],[]);}}/>
      {/* INGESTION DRAG/DROP & PASTE PORTAL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Upload Box */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <Upload className="w-5 h-5 text-amber-400" />
              <span>1. Upload or Paste POS CSV Sales Data</span>
            </h2>
            <button
              onClick={handleLoadSampleCSV}
              disabled={isProcessing}
              className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold px-3 py-1.5 rounded-xl transition flex items-center space-x-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isProcessing ? 'animate-spin' : ''}`} />
              <span>Load Sample POS Data</span>
            </button>
          </div>

          {/* Drag and Drop Zone */}
          <div className="border-2 border-dashed border-slate-700 hover:border-amber-500/50 bg-slate-950/60 rounded-2xl p-6 text-center transition space-y-3">
            <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto text-amber-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">
                Choose a POS sales CSV file or paste its contents below
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Include the order number, sale date, item name, quantity, unit price and total amount.
              </p>
            </div>
            <div>
              <label className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2 rounded-xl cursor-pointer border border-slate-700 inline-block transition">
                <span>Browse Local CSV File</span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Or Paste Raw Text */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              Or paste CSV raw text directly below:
            </label>
            <textarea
              rows={4}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="order_id,date,item_name,category,unit_price,quantity,total_amount,transaction_type,received_by,time..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Run Ingestion Button */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-400">
              Auto-maps Vadapav, Frankie, Burger, Pizza to ingredient recipes.
            </span>
            <button
              onClick={() => handleProcessIngestion()}
              disabled={isProcessing || !rawText.trim()}
              className="bg-gradient-to-r from-amber-500 to-emerald-500 hover:brightness-110 text-slate-950 font-bold text-xs px-6 py-2.5 rounded-xl shadow transition disabled:opacity-50 flex items-center space-x-2"
            >
              <span>{isProcessing ? 'Ingesting Sales...' : 'Ingest & Deduct Inventory'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Status Message */}
          <label>Import purpose<select aria-label="Import purpose" value={importMode} onChange={e=>setImportMode(e.target.value)}><option value="historical">Historical backfill — keep current stock unchanged</option><option value="operational">New sales — deduct recipe usage from stock</option></select></label>
          <p>Use historical mode for older POS exports when current stock has already been counted. Reimporting existing sales never deducts stock again.</p>
          {ingestMessage && (
            <div className={`p-4 rounded-xl text-xs font-medium border flex items-start space-x-2.5 ${
              ingestMessage.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-800/80 text-emerald-300'
                : 'bg-rose-950/80 border-rose-800/80 text-rose-300'
            }`}>
              {ingestMessage.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <span>{ingestMessage.text}</span>
            </div>
          )}
        </div>

        {/* Deducted Inventory Summary Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <MinusCircle className="w-5 h-5 text-emerald-400" />
              <span>Ingredient Stock Deductions</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Real-time stock calculated from latest sales batch
            </p>

            <div className="mt-4 space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {!lastBatchSummary || lastBatchSummary.length === 0 ? (
                <div className="text-xs text-slate-500 py-12 text-center bg-slate-950/50 rounded-xl border border-slate-800">
                  Upload or run sample POS data to see real-time recipe stock deductions.
                </div>
              ) : (
                lastBatchSummary.map((item, idx) => (
                  <div key={idx} className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-slate-200">{item.ingredient_name}</div>
                      <div className="text-[11px] text-emerald-400 font-medium">
                        Deducted -{item.deducted_qty} {unitLabel(item.unit)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-slate-400 text-[11px]">Remaining Stock</div>
                      <div className="font-bold text-white text-xs">{item.new_stock} {unitLabel(item.unit)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="text-[11px] text-slate-400 bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
            💡 <strong>Rinet Resto Bot Engine:</strong> Imported sales deduct stock for mapped recipes. Review warnings for missing mappings.
          </div>
        </div>

      </div>

      {/* INGESTED SALES TRANSACTIONS FEED TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <Layers className="w-5 h-5 text-amber-400" />
              <span>Ingested POS Sales Log ({salesRecords.length} records)</span>
            </h2>
            <p className="text-xs text-slate-400">Recent sales records from the active data store</p>
          </div>

          {/* Search filter */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filter by Order ID or Dish..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 w-full sm:w-64"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-4">Sold At</th>
                <th className="py-3 px-4">Dish Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-center">Qty</th>
                <th className="py-3 px-4 text-right">Unit Price</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No sales records found matching filter.
                  </td>
                </tr>
              ) : (
                filteredSales.slice(0, 30).map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-4 font-mono font-semibold text-amber-300">{sale.order_id}</td>
                    <td className="py-2.5 px-4 text-slate-400">
                      {new Date(sale.sold_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-white">{sale.item_name}</td>
                    <td className="py-2.5 px-4 text-slate-400">{sale.category || 'General'}</td>
                    <td className="py-2.5 px-4 text-center font-extrabold text-emerald-400">{sale.quantity_sold}</td>
                    <td className="py-2.5 px-4 text-right">{currencySymbol}{sale.unit_price.toFixed(2)}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-white">
                      {currencySymbol}{sale.total_amount.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px]">
                        {sale.transaction_type || 'Dine In'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

