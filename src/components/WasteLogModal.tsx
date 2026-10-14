import { unitLabel } from '../lib/displayText';
import React, { useState } from 'react';
import { X, Trash2, AlertCircle } from 'lucide-react';
import { Ingredient, WasteEntry } from '../types';

interface WasteLogModalProps {
  ingredients: Ingredient[];
  initialIngredientId?: string;
  onClose: () => void;
  onSaveWaste: (entry: WasteEntry) => Promise<boolean>;
  currencySymbol: string;
}

export const WasteLogModal: React.FC<WasteLogModalProps> = ({
  ingredients,
  initialIngredientId,
  onClose,
  onSaveWaste,
  currencySymbol,
}) => {
  const [ingredientId, setIngredientId] = useState<string>(
    initialIngredientId || ingredients[0]?.id || ''
  );
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<WasteEntry['reason']>('Spoiled / Expired');
  const [loggedBy, setLoggedBy] = useState('Line Cook Dave');

  const selectedIngredient = ingredients.find(i => i.id === ingredientId);
  const estimatedLoss = selectedIngredient ? Math.round(quantity * selectedIngredient.cost_per_unit * 100) / 100 : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIngredient || quantity <= 0) return;

    const newEntry: WasteEntry = {
      id: `w_${Date.now()}`,
      restaurant_id: selectedIngredient.restaurant_id,
      ingredient_id: selectedIngredient.id,
      ingredient_name: selectedIngredient.name,
      quantity,
      unit: selectedIngredient.unit,
      reason,
      estimated_loss_amount: estimatedLoss,
      logged_by: loggedBy,
      logged_at: new Date().toISOString(),
    };

    if (!await onSaveWaste(newEntry)) return;
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-fadeIn">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2 text-rose-400 font-bold text-sm">
            <Trash2 className="w-5 h-5" />
            <span>Log Kitchen Waste & Spoilage</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* Ingredient Select */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Select Wasted Ingredient</label>
            <select
              value={ingredientId}
              onChange={(e) => setIngredientId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
            >
              {ingredients.map(ing => (
                <option key={ing.id} value={ing.id}>
                  {ing.name} ({ing.current_stock} {unitLabel(ing.unit)} in stock)
                </option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Quantity Wasted ({selectedIngredient?.unit || 'units'})
            </label>
            <input
              type="number"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Reason for Waste</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="Spoiled / Expired">Spoiled / Expired</option>
              <option value="Kitchen Spillage / Burnt">Kitchen Spillage / Burnt</option>
              <option value="Customer Return">Customer Return</option>
              <option value="Over-prepped">Over-prepped</option>
            </select>
          </div>

          {/* Staff Name */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Logged By</label>
            <input
              type="text"
              value={loggedBy}
              onChange={(e) => setLoggedBy(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Loss Preview */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
            <span className="text-slate-400">Estimated Food Cost Loss:</span>
            <span className="text-base font-extrabold text-rose-400">
              {currencySymbol}{estimatedLoss.toFixed(2)}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-5 py-2 rounded-xl shadow transition"
            >
              Record Waste Entry
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
