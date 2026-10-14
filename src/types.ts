export interface Restaurant {
  id: string;
  name: string;
  cuisine_type?: string;
  location?: string;
  currency_symbol: string;
  created_at?: string;
}

export interface Ingredient {
  procurement?: { pack_size?: number; lead_time_days?: number; shelf_life_days?: number };
  id: string;
  restaurant_id: string;
  name: string;
  category: string;
  unit: string; // e.g. 'kg', 'g', 'lbs', 'units', 'liters', 'ml'
  current_stock: number;
  min_threshold: number;
  cost_per_unit: number; // Current supplier price per unit
  previous_cost_per_unit?: number; // Historical price for creep detection
  supplier_name: string;
  supplier_contact?: string;
  last_restocked?: string;
  created_at?: string;
}

export interface RecipeItem {
  substitutes?: Array<{ ingredient_id: string; replacement_quantity: number; replacement_unit: string; chef_verified: boolean; verified_by?: string; verified_at?: string }>;
  quantity_basis?: 'as_purchased' | 'edible';
  yield_percent?: number;
  culinary_role?: 'accent' | 'bulk' | 'structural';
  id: string;
  menu_item_id: string;
  ingredient_id: string;
  ingredient_name?: string;
  quantity_required: number; // e.g. 2 potatoes for Vadapav, 1 bun
  unit?: string;
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  name: string;
  category: string;
  selling_price: number;
  target_margin_percent: number; // Target profit margin e.g., 65%
  is_active: boolean;
  recipes?: RecipeItem[];
  calculated_cost?: number; // Sum of recipe ingredient costs
  current_margin_percent?: number;
}

export interface SalesRecord {
  id: string;
  restaurant_id: string;
  order_id: string;
  item_name: string;
  category?: string;
  unit_price: number;
  quantity_sold: number;
  total_amount: number;
  sold_at: string;
  transaction_type?: string; // 'Dine In', 'Takeaway', 'Online'
  received_by?: string;
  metadata?: Record<string, any>;
}

export interface MarginAlert {
  cost_increase_per_dish?: number;
  loss_basis?: string;
  loss_available?: boolean;
  suggested_substitutes?: Array<{ ingredient_id: string; name: string; risk: string; note: string; savings_per_portion: number | null }>;
  id: string;
  restaurant_id: string;
  ingredient_id: string;
  ingredient_name: string;
  affected_menu_item_id?: string;
  affected_menu_item_name?: string;
  old_cost: number;
  new_cost: number;
  increase_percent: number;
  estimated_monthly_loss: number;
  suggested_action: string;
  is_resolved: boolean;
  created_at: string;
}

export interface SupplierItem {
  id: string;
  supplier_name: string;
  ingredient_name: string;
  unit: string;
  unit_price: number;
  lead_time_days: number;
  min_order_qty: number;
  contact_email?: string;
  contact_phone?: string;
}

export interface ForecastPlan {
  id: string;
  restaurant_id: string;
  period_start: string;
  period_end: string;
  total_projected_orders: number;
  total_projected_revenue: number;
  generated_at: string;
}

export interface ForecastLine {
  pack_size?: number;
  id: string;
  forecast_id: string;
  ingredient_id: string;
  ingredient_name: string;
  unit: string;
  current_stock: number;
  predicted_usage: number;
  recommended_order_qty: number;
  unit_cost: number;
  total_estimated_cost: number;
  supplier_name: string;
}

export interface OrderNote {
  id: string;
  restaurant_id: string;
  supplier_name: string;
  po_number: string;
  total_amount: number;
  status: 'Draft' | 'Sent' | 'Delivered' | 'Cancelled';
  created_at: string;
  lines: Array<{
    ingredient_name: string;
    order_qty: number;
    unit: string;
    unit_cost: number;
    subtotal: number;
  }>;
}

export interface WasteEntry {
  id: string;
  restaurant_id: string;
  ingredient_id: string;
  ingredient_name: string;
  quantity: number;
  unit: string;
  reason: 'Spoiled / Expired' | 'Kitchen Spillage / Burnt' | 'Customer Return' | 'Over-prepped';
  estimated_loss_amount: number;
  logged_by: string;
  logged_at: string;
}

export interface InventorySnapshot {
  id: string;
  restaurant_id: string;
  snapshot_date: string;
  total_valuation: number;
  item_count: number;
}

export type ActiveTab =
  | 'sales'
  | 'suppliers'
  | 'analytics'
  | 'settings'
  | 'dashboard'
  | 'purchasing'
  | 'ingestion'
  | 'recipes'
  | 'inventory'
  | 'margin'
  | 'assistant'
  | 'history'
  | 'console';
