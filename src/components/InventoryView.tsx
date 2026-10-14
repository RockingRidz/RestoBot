import { unitLabel } from '../lib/displayText';
import { ProcurementEditor } from './CulinarySettings';
import React, { useState } from 'react';
import { 
  Boxes, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  Phone, 
  Edit2, 
  X,
  Sparkles
} from 'lucide-react';
import { Ingredient, WasteEntry } from '../types';

interface InventoryViewProps {
  ingredients: Ingredient[];
  onSaveIngredient: (ingredient: Ingredient) => Promise<boolean>;
  onDeleteIngredient: (id: string) => void;
  onOpenWasteModal: (ingredientId?: string) => void;
  wasteEntries: WasteEntry[];
  currencySymbol: string;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  ingredients,
  onSaveIngredient,
  onDeleteIngredient,
  onOpenWasteModal,
  wasteEntries,
  currencySymbol,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // New Ingredient state
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Produce');
  const [newUnit, setNewUnit] = useState('kg');
  const [newStock, setNewStock] = useState(10);
  const [newMinThreshold, setNewMinThreshold] = useState(5);
  const [newCost, setNewCost] = useState(2.50);
  const [newSupplier, setNewSupplier] = useState('GreenValley Produce');

  // Categories list
  const categories = ['All', ...Array.from(new Set(ingredients.map(i => i.category)))];

  // Filtered List
  const filteredIngredients = ingredients.filter(ing => {
    const matchesSearch = ing.name.toLowerCase().includes(searchTerm.toLowerCase()) || ing.supplier_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === 'All' || ing.category === selectedCategory;
    return matchesSearch && matchesCat && (!lowOnly || ing.current_stock <= ing.min_threshold);
  });

  // Handle Quick Stock Adjust
  const handleStockAdjust = (ing: Ingredient, delta: number) => {
    const updated = {
      ...ing,
      current_stock: Math.max(0, Math.round((ing.current_stock + delta) * 100) / 100),
      last_restocked: new Date().toISOString().split('T')[0],
    };
    onSaveIngredient(updated);
  };

  // Add New Ingredient
  const handleCreateIngredient = async () => {
    if (!newName.trim()) return;

    const newIng: Ingredient = {
      id: `ing_${Date.now()}`,
      restaurant_id: 'rest_001',
      name: newName.trim(),
      category: newCategory,
      unit: newUnit,
      current_stock: Number(newStock),
      min_threshold: Number(newMinThreshold),
      cost_per_unit: Number(newCost),
      previous_cost_per_unit: Number(newCost),
      supplier_name: newSupplier,
      last_restocked: new Date().toISOString().split('T')[0],
    };

    if (!await onSaveIngredient(newIng)) return;
    setIsAddingNew(false);
    setNewName('');
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-rose-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Boxes className="w-4 h-4" />
            <span>Raw Stock & Inventory Management</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Inventory</h1>
          <p className="text-sm text-slate-400 mt-1">
            Track your current stock and get low-stock alerts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="low-stock-toggle"><input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)} /> Low stock only</label>
          <button
            onClick={() => onOpenWasteModal()}
            className="bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 text-xs font-semibold px-4 py-2.5 rounded-xl shadow transition flex items-center space-x-2"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>Log Kitchen Waste</span>
          </button>
          <button
            onClick={() => setIsAddingNew(!isAddingNew)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Ingredient</span>
          </button>
        </div>
      </div>

      {/* NEW INGREDIENT FORM PANEL */}
      {isAddingNew && (
        <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 shadow-2xl space-y-4">
          <h2 className="text-base font-bold text-white">Add New Ingredient to Inventory</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Ingredient Name</label>
              <input
                type="text"
                placeholder="e.g. Flour / Wheat"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Category</label>
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Unit</label>
              <select
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white focus:outline-none focus:border-amber-500"
              >
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="pcs">pcs</option>
                <option value="liters">liters</option>
                <option value="ml">ml</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Current Stock</label>
              <input
                type="number"
                value={newStock}
                onChange={(e) => setNewStock(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Min Safety Reorder</label>
              <input
                type="number"
                value={newMinThreshold}
                onChange={(e) => setNewMinThreshold(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Cost / Unit ({currencySymbol})</label>
              <input
                type="number"
                step="0.01"
                value={newCost}
                onChange={(e) => setNewCost(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              onClick={() => setIsAddingNew(false)}
              className="bg-slate-800 text-slate-300 text-xs px-4 py-2 rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateIngredient}
              disabled={!newName.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2 rounded-xl transition"
            >
              Save Ingredient
            </button>
          </div>
        </div>
      )}

      {/* FILTER AND SEARCH BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-xs px-3 py-1.5 rounded-xl font-medium shrink-0 transition ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search ingredient or supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 w-full sm:w-64"
          />
        </div>
      </div>

      {/* INGREDIENTS TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/90 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Ingredient Name</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4 text-center">Current Stock</th>
                <th className="py-3.5 px-4 text-center">Min Threshold</th>
                <th className="py-3.5 px-4 text-right">Cost Rate</th>
                <th className="py-3.5 px-4">Supplier</th>
                <th className="py-3.5 px-4 text-center">Quick Adjust</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredIngredients.map(ing => {
                const isLow = ing.current_stock <= ing.min_threshold;

                return (
                  <tr key={ing.id} className={`hover:bg-slate-800/40 transition ${isLow ? 'bg-rose-950/20' : ''}`}>
                    
                    {/* Name */}
                    <td className="py-3 px-4 font-bold text-white flex items-center space-x-2">
                      <span>{ing.name}</span>
                      {isLow && (
                        <span className="bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase">
                          Low Stock
                        </span>
                      )}
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4 text-slate-400">{ing.category}</td>

                    {/* Current Stock */}
                    <td className="py-3 px-4 text-center">
                      <span className={`font-extrabold text-sm ${isLow ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {ing.current_stock} {unitLabel(ing.unit)}
                      </span>
                    </td>

                    {/* Min Threshold */}
                    <td className="py-3 px-4 text-center text-slate-400 font-medium">
                      {ing.min_threshold} {unitLabel(ing.unit)}
                    </td>

                    {/* Unit Cost */}
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-300">
                      {currencySymbol}{ing.cost_per_unit.toFixed(2)} / {unitLabel(ing.unit)}
                    </td>

                    {/* Supplier */}
                    <td className="py-3 px-4 text-slate-300">
                      <div className="font-semibold">{ing.supplier_name}</div><ProcurementEditor ingredient={ing} onSave={onSaveIngredient}/>
                      {ing.supplier_contact && (
                        <div className="text-[10px] text-slate-400">{ing.supplier_contact}</div>
                      )}
                    </td>

                    {/* Quick Stock Adjust Buttons */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => handleStockAdjust(ing, -1)}
                          className="w-6 h-6 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-bold transition flex items-center justify-center"
                          title="Reduce stock -1"
                        >
                          -
                        </button>
                        <button
                          onClick={() => handleStockAdjust(ing, 1)}
                          className="w-6 h-6 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-bold transition flex items-center justify-center"
                          title="Increase stock +1"
                        >
                          +
                        </button>
                        <button
                          onClick={() => handleStockAdjust(ing, 10)}
                          className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded border border-emerald-500/30 hover:bg-emerald-500/30"
                          title="Restock +10"
                        >
                          +10
                        </button>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-center space-x-1.5">
                      <button
                        onClick={() => onOpenWasteModal(ing.id)}
                        className="text-slate-400 hover:text-rose-400 p-1 transition"
                        title="Log Spoilage / Waste"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteIngredient(ing.id)}
                        className="text-slate-500 hover:text-rose-500 p-1 transition"
                        title="Delete ingredient"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

