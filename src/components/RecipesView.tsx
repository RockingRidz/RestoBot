import { unitLabel } from '../lib/displayText';
import { RecipeBasisEditor } from './CulinarySettings';
import { purchaseQuantity } from '../lib/culinaryKnowledge';
import React, { useState } from 'react';
import { authenticatedFetch } from '../lib/api';
import { foodIcon } from './RinetUi';
import { calculateMenuCostsAndMargins } from '../lib/marginEngine';
import { 
  BookOpen, 
  Plus, 
  Trash2, 
  Sparkles, 
  TrendingUp, 
  AlertCircle, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  ChefHat 
} from 'lucide-react';
import { MenuItem, Ingredient, RecipeItem } from '../types';

interface RecipesViewProps {
  menuItems: MenuItem[];
  ingredients: Ingredient[];
  onSaveMenuItem: (updatedMenuItem: MenuItem) => Promise<boolean>;
  onDeleteMenuItem: (id: string) => void;
  currencySymbol: string;
}

export const RecipesView: React.FC<RecipesViewProps> = ({
  menuItems,
  ingredients,
  onSaveMenuItem,
  onDeleteMenuItem,
  currencySymbol,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [menuSearch, setMenuSearch] = useState('');
  const [menuCategory, setMenuCategory] = useState('All');
  const [isAddingNew, setIsAddingNew] = useState(false);

  // New Menu Item Form State
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Snacks');
  const [newPrice, setNewPrice] = useState(4.50);
  const [newTargetMargin, setNewTargetMargin] = useState(65);
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // Calculate Portion Cost for a given menu item
  const calculateDishCost = (item: MenuItem) => calculateMenuCostsAndMargins([item], ingredients)[0].calculatedCost;

  // Add Ingredient to existing recipe
  const handleAddIngredientToRecipe = (menuItem: MenuItem, ingredientId: string) => {
    const ing = ingredients.find(i => i.id === ingredientId);
    if (!ing) return;

    const newRecipeItem: RecipeItem = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      menu_item_id: menuItem.id,
      ingredient_id: ing.id,
      ingredient_name: ing.name,
      quantity_required: ing.unit === 'pcs' ? 1 : 0.05,
      unit: ing.unit,
    };

    const updatedRecipes = [...(menuItem.recipes || []), newRecipeItem];
    onSaveMenuItem({
      ...menuItem,
      recipes: updatedRecipes,
    });
  };

  // Remove Ingredient from recipe
  const handleRemoveIngredientFromRecipe = (menuItem: MenuItem, recipeId: string) => {
    const updatedRecipes = (menuItem.recipes || []).filter(r => r.id !== recipeId);
    onSaveMenuItem({
      ...menuItem,
      recipes: updatedRecipes,
    });
  };

  // Update recipe quantity
  const handleUpdateRecipeQty = (menuItem: MenuItem, recipeId: string, newQty: number) => {
    const updatedRecipes = (menuItem.recipes || []).map(r => 
      r.id === recipeId ? { ...r, quantity_required: Math.max(0.001, newQty) } : r
    );
    onSaveMenuItem({
      ...menuItem,
      recipes: updatedRecipes,
    });
  };

  // Create new Menu Item with standard default recipe
  const handleCreateNewMenuItem = async () => {
    if (!newName.trim()) return;

    const newMenuItem: MenuItem = {
      id: `menu_${Date.now()}`,
      restaurant_id: 'rest_001',
      name: newName.trim(),
      category: newCategory,
      selling_price: Number(newPrice),
      target_margin_percent: Number(newTargetMargin),
      is_active: true,
      recipes: [],
    };

    if (!await onSaveMenuItem(newMenuItem)) return;
    setExpandedId(newMenuItem.id);
    setIsAddingNew(false);
    setNewName('');
  };

  // AI Recipe Suggestion helper
  const handleAiSuggestRecipe = async () => {
    if (!newName.trim()) return;
    setIsAiGenerating(true);

    try {
      const res = await authenticatedFetch('/api/ai/suggest-recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dishName: newName,
          category: newCategory,
          targetSellingPrice: newPrice,
        }),
      });
      const data = await res.json();
      if (data.suggestedIngredients) {
        // match with existing ingredients
        const generatedRecipes: RecipeItem[] = [];
        data.suggestedIngredients.forEach((sugg: any, idx: number) => {
          const matchedIng = ingredients.find(i => i.name.toLowerCase().includes(sugg.name.toLowerCase())) || ingredients[idx % ingredients.length];
          if (matchedIng) {
            generatedRecipes.push({
              id: `rec_ai_${Date.now()}_${idx}`,
              menu_item_id: `menu_${Date.now()}`,
              ingredient_id: matchedIng.id,
              ingredient_name: matchedIng.name,
              quantity_required: Number(sugg.qty) || 0.1,
              unit: matchedIng.unit,
            });
          }
        });

        const newMenuItem: MenuItem = {
          id: `menu_${Date.now()}`,
          restaurant_id: 'rest_001',
          name: newName.trim(),
          category: newCategory,
          selling_price: Number(newPrice),
          target_margin_percent: Number(newTargetMargin),
          is_active: true,
          recipes: generatedRecipes,
        };

        if (!await onSaveMenuItem(newMenuItem)) return;
        setExpandedId(newMenuItem.id);
        setIsAddingNew(false);
        setNewName('');
      }
    } catch (e) {
      console.error('AI recipe suggestion notice:', e);
      handleCreateNewMenuItem();
    } finally {
      setIsAiGenerating(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs uppercase tracking-wider mb-1">
            <BookOpen className="w-4 h-4" />
            <span>Bill of Materials (BOM) & Recipe Costing</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Menu & Recipes</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your menu items and ingredient recipes.
          </p>
        </div>

        <button
          onClick={() => setIsAddingNew(!isAddingNew)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition flex items-center space-x-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add menu item</span>
        </button>
      </div>

      {/* NEW DISH FORM MODAL / PANEL */}
      {isAddingNew && (
        <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-6 shadow-2xl space-y-4 animate-fadeIn">
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <ChefHat className="w-5 h-5 text-amber-400" />
            <span>Create New Menu Item Recipe</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Dish Name</label>
              <input
                type="text"
                placeholder="e.g. Cheese Garlic Naan"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
              <input
                type="text"
                placeholder="e.g. Breads / Starters"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Selling Price ({currencySymbol})</label>
              <input
                type="number"
                step="0.01"
                value={newPrice}
                onChange={(e) => setNewPrice(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Target Margin %</label>
              <input
                type="number"
                value={newTargetMargin}
                onChange={(e) => setNewTargetMargin(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              onClick={() => setIsAddingNew(false)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-4 py-2 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              onClick={handleAiSuggestRecipe}
              disabled={isAiGenerating || !newName.trim()}
              className="bg-gradient-to-r from-amber-500 to-indigo-500 hover:brightness-110 text-slate-950 font-bold text-xs px-4 py-2 rounded-xl shadow transition flex items-center space-x-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isAiGenerating ? 'Generating Recipe...' : 'AI Suggest Recipe Breakdown'}</span>
            </button>
            <button
              onClick={handleCreateNewMenuItem}
              disabled={!newName.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2 rounded-xl transition"
            >
              Save Manual Recipe
            </button>
          </div>
        </div>
      )}

      {/* RECIPE ITEMS CARDS ACCORDION */}
      <section className="paper-panel">
        <div className="page-tabs"><span className="active">Menu items</span></div>
        <label className="search-field"><input aria-label="Search menu items" placeholder="Search menu items…" value={menuSearch} onChange={e => setMenuSearch(e.target.value)} /></label>
        <div className="category-chips">{['All', ...new Set(menuItems.map(m => m.category))].map(category => <button key={category} className={menuCategory === category ? 'active' : ''} onClick={() => setMenuCategory(category)}>{category} ({menuItems.filter(m => category === 'All' || m.category === category).length})</button>)}</div>
        <div className="table-scroll"><table className="rinet-table"><thead><tr><th>Item</th><th>Category</th><th>Price</th><th>Ingredients</th><th>Status</th><th>Action</th></tr></thead><tbody>{menuItems.filter(m => m.name.toLowerCase().includes(menuSearch.toLowerCase()) && (menuCategory === 'All' || m.category === menuCategory)).map(menu => <tr key={menu.id}><td><span className="food-icon">{foodIcon(menu.name)}</span>{menu.name}</td><td>{menu.category}</td><td>{currencySymbol}{menu.selling_price.toFixed(2)}</td><td>{menu.recipes?.length || 0} items</td><td><span className="status-pill">{menu.is_active ? 'Active' : 'Inactive'}</span></td><td><button className="outline-button small" onClick={() => setExpandedId(expandedId === menu.id ? null : menu.id)}>{expandedId === menu.id ? 'Close recipe' : 'Edit recipe'}</button></td></tr>)}</tbody></table></div>
        {!menuItems.length && <p className="inline-empty">Add your first menu item to start mapping recipes.</p>}
      </section>
      <div className="space-y-4">
        {menuItems.filter(menu => menu.id === expandedId).map(menu => {
          const dishCost = calculateDishCost(menu);
          const profit = menu.selling_price - dishCost;
          const marginPct = menu.selling_price > 0 ? Math.round((profit / menu.selling_price) * 100) : 0;
          const isExpanded = expandedId === menu.id;
          const targetMargin = menu.target_margin_percent || 60;
          const isHealthy = marginPct >= targetMargin;

          return (
            <div 
              key={menu.id}
              className={`bg-slate-900 border rounded-2xl transition shadow-xl overflow-hidden ${
                isExpanded ? 'border-amber-500/50 ring-1 ring-amber-500/20' : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Header Bar */}
              <div 
                onClick={() => setExpandedId(isExpanded ? null : menu.id)}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none bg-slate-900/90"
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-amber-400 shrink-0">
                    {menu.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-base font-bold text-white">{menu.name}</h3>
                      <span className="bg-slate-800 text-slate-400 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                        {menu.category}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 flex items-center space-x-3">
                      <span>Price: <strong className="text-slate-200">{currencySymbol}{menu.selling_price.toFixed(2)}</strong></span>
                      <span>•</span>
                      <span>Portion Cost: <strong className="text-slate-200">{Number.isFinite(dishCost) ? currencySymbol + dishCost.toFixed(2) : 'Check units'}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Margin & Toggle */}
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className={`text-sm font-extrabold flex items-center justify-end space-x-1 ${
                      isHealthy ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      <TrendingUp className="w-4 h-4" />
                      <span>{Number.isFinite(marginPct) ? marginPct + '% Margin' : 'Review recipe units'}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Profit: {Number.isFinite(profit) ? currencySymbol + profit.toFixed(2) : 'Check units'} / dish
                    </div>
                  </div>

                  <div className="text-slate-400">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>
              </div>

              {/* Recipe Ingredients Details */}
              {isExpanded && (
                <div className="border-t border-slate-800 p-5 bg-slate-950/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Recipe Ingredient Requirements (BOM)
                    </h4>
                    
                    {/* Add Ingredient Dropdown */}
                    <div className="flex items-center space-x-2">
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAddIngredientToRecipe(menu, e.target.value);
                            e.target.value = '';
                          }
                        }}
                        defaultValue=""
                        className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                      >
                        <option value="" disabled>+ Add Ingredient to Dish...</option>
                        {ingredients.map(ing => (
                          <option key={ing.id} value={ing.id}>
                            {ing.name} ({currencySymbol}{ing.cost_per_unit}/{unitLabel(ing.unit)})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Recipe Items Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">Ingredient Name</th>
                          <th className="py-2.5 px-3">Portion Qty</th>
                          <th className="py-2.5 px-3">Unit</th>
                          <th className="py-2.5 px-3 text-right">Supplier Rate</th>
                          <th className="py-2.5 px-3 text-right">Portion Cost</th>
                          <th className="py-2.5 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {(!menu.recipes || menu.recipes.length === 0) ? (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-slate-500">
                              No ingredients mapped yet. Select an ingredient above to build recipe.
                            </td>
                          </tr>
                        ) : (
                          menu.recipes.map(recipe => {
                            const matchedIng = ingredients.find(i => i.id === recipe.ingredient_id);
                            const unitCost = matchedIng ? matchedIng.cost_per_unit : 0;
                            let itemPortionCost = NaN;
                            if (matchedIng) { try { itemPortionCost = purchaseQuantity(recipe, matchedIng) * unitCost; } catch { /* Unit mismatch needs review. */ } }

                            return (
                              <tr key={recipe.id} className="hover:bg-slate-900/40">
                                <td className="py-2.5 px-3 font-semibold text-white">
                                  {matchedIng ? matchedIng.name : recipe.ingredient_name || 'Ingredient'}<RecipeBasisEditor recipe={recipe} menu={menu} onSave={onSaveMenuItem}/>
                                </td>
                                <td className="py-2.5 px-3">
                                  <input
                                    type="number"
                                    step="0.001"
                                    value={recipe.quantity_required}
                                    onChange={(e) => handleUpdateRecipeQty(menu, recipe.id, Number(e.target.value))}
                                    className="w-20 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-amber-500 font-mono"
                                  />
                                </td>
                                <td className="py-2.5 px-3 text-slate-400">{unitLabel(recipe.unit || matchedIng?.unit || 'pcs')}</td>
                                <td className="py-2.5 px-3 text-right text-slate-400 font-mono">
                                  {currencySymbol}{unitCost.toFixed(2)} / {unitLabel(matchedIng?.unit || 'unit')}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-amber-300 font-mono">
                                  {Number.isFinite(itemPortionCost) ? currencySymbol + itemPortionCost.toFixed(3) : 'Check units'}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    onClick={() => handleRemoveIngredientFromRecipe(menu, recipe.id)}
                                    className="p-1 text-slate-500 hover:text-rose-400 transition"
                                    title="Remove from recipe"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Bar */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between text-xs text-slate-300">
                    <div>
                      Total Food Cost: <strong className="text-white">{Number.isFinite(dishCost) ? currencySymbol + dishCost.toFixed(2) : 'Check units'}</strong> | 
                      Menu Price: <strong className="text-white">{currencySymbol}{menu.selling_price.toFixed(2)}</strong>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => onDeleteMenuItem(menu.id)}
                        className="text-rose-400 hover:underline text-xs"
                      >
                        Delete Dish
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
};




