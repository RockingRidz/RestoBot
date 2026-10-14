-- RestoBot production schema + RLS
-- Safe to re-run. Seed nothing.
-- Apply in Supabase SQL Editor, or: node scripts/apply-schema.mjs

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Core tables (aligned to app types.ts + original production draft)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  location text,
  cuisine_type text,
  wholesalers text,
  timezone text NOT NULL DEFAULT 'UTC',
  operating_days text[] NOT NULL DEFAULT ARRAY['mon','tue','wed','thu','fri','sat','sun'],
  ordering_time time NOT NULL DEFAULT '05:00',
  pin_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  full_name text,
  is_owner boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_method text,
  contact_value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, name)
);

CREATE TABLE IF NOT EXISTS public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  selling_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
  target_margin_percent numeric(8,2) NOT NULL DEFAULT 65,
  active_status boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, name)
);

CREATE TABLE IF NOT EXISTS public.ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  name text NOT NULL,
  category text,
  -- App Ingredient.unit (also mirrored as base_unit for draft compatibility)
  unit text NOT NULL DEFAULT 'unit',
  base_unit text NOT NULL DEFAULT 'unit',
  current_stock numeric(12,4) NOT NULL DEFAULT 0,
  min_threshold numeric(12,4) NOT NULL DEFAULT 0,
  -- App cost fields
  cost_per_unit numeric(12,4) CHECK (cost_per_unit IS NULL OR cost_per_unit >= 0),
  previous_cost_per_unit numeric(12,4) CHECK (previous_cost_per_unit IS NULL OR previous_cost_per_unit >= 0),
  -- Draft compatibility aliases
  normal_cost_per_unit numeric(12,4) CHECK (normal_cost_per_unit IS NULL OR normal_cost_per_unit >= 0),
  current_cost_per_unit numeric(12,4) CHECK (current_cost_per_unit IS NULL OR current_cost_per_unit >= 0),
  supplier_name text,
  supplier_contact text,
  last_restocked date,
  allergen_tags text[] DEFAULT ARRAY[]::text[],
  dietary_tags text[] DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, name)
);

CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  ingredient_name text,
  quantity_per_menu_item numeric(12,4) NOT NULL CHECK (quantity_per_menu_item >= 0),
  unit text NOT NULL DEFAULT 'unit',
  yield_factor numeric(8,4) NOT NULL DEFAULT 1 CHECK (yield_factor > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (menu_item_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS public.sales_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  order_id text,
  transaction_date date,
  sold_at timestamptz,
  menu_item_name text NOT NULL,
  quantity_sold numeric(12,2) NOT NULL CHECK (quantity_sold >= 0),
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  gross_sales numeric(12,2) NOT NULL DEFAULT 0 CHECK (gross_sales >= 0),
  category text,
  location text,
  transaction_type text,
  received_by text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  target_date date NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'generated',
  forecast_summary text,
  forecast_explanation jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.forecast_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id uuid NOT NULL REFERENCES public.forecasts(id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  menu_item_name text NOT NULL,
  baseline_quantity numeric(12,2) NOT NULL DEFAULT 0 CHECK (baseline_quantity >= 0),
  adjusted_quantity numeric(12,2) NOT NULL DEFAULT 0 CHECK (adjusted_quantity >= 0),
  final_quantity numeric(12,2) NOT NULL DEFAULT 0 CHECK (final_quantity >= 0),
  confidence text NOT NULL DEFAULT 'none',
  explanation text,
  modifiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  ingredient_id uuid REFERENCES public.ingredients(id) ON DELETE SET NULL,
  ingredient_name text NOT NULL,
  quantity_on_hand numeric(12,4) NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  unit text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supplier_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  ingredient_id uuid REFERENCES public.ingredients(id) ON DELETE SET NULL,
  ingredient_name text NOT NULL,
  package_size numeric(12,4) NOT NULL CHECK (package_size > 0),
  package_unit text NOT NULL,
  package_label text,
  price numeric(12,2) CHECK (price IS NULL OR price >= 0),
  availability_status text NOT NULL DEFAULT 'unknown',
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.substitute_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  original_ingredient_id uuid REFERENCES public.ingredients(id) ON DELETE CASCADE,
  substitute_ingredient_id uuid REFERENCES public.ingredients(id) ON DELETE CASCADE,
  original_ingredient_name text NOT NULL,
  substitute_ingredient_name text NOT NULL,
  quality_score numeric(5,4) NOT NULL DEFAULT 0 CHECK (quality_score >= 0),
  estimated_margin_saved_percent numeric(8,2) NOT NULL DEFAULT 0,
  availability text NOT NULL DEFAULT 'unknown',
  customer_risk text NOT NULL DEFAULT 'medium',
  allergen_warning text,
  owner_approved_default boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.margin_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  forecast_id uuid REFERENCES public.forecasts(id) ON DELETE CASCADE,
  ingredient_id uuid REFERENCES public.ingredients(id) ON DELETE SET NULL,
  ingredient_name text NOT NULL,
  alert_type text NOT NULL DEFAULT 'price_creep',
  -- App MarginAlert fields
  affected_menu_item_id uuid,
  affected_menu_item_name text,
  old_cost numeric(12,4),
  new_cost numeric(12,4),
  increase_percent numeric(8,2),
  estimated_monthly_loss numeric(12,2) DEFAULT 0,
  suggested_action text,
  is_resolved boolean NOT NULL DEFAULT false,
  -- Draft compatibility
  normal_price numeric(12,4),
  current_price numeric(12,4),
  price_change_percentage numeric(8,2),
  recommended_action text,
  owner_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  forecast_id uuid REFERENCES public.forecasts(id) ON DELETE CASCADE,
  supplier_name text,
  channel text,
  po_number text,
  note_text text NOT NULL DEFAULT '',
  edited_note_text text,
  total_amount numeric(12,2) DEFAULT 0,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  copied_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.forecast_actuals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id uuid NOT NULL REFERENCES public.forecasts(id) ON DELETE CASCADE,
  menu_item_name text NOT NULL,
  predicted_quantity numeric(12,2) NOT NULL DEFAULT 0,
  actual_quantity numeric(12,2) NOT NULL DEFAULT 0,
  variance numeric(12,2) NOT NULL DEFAULT 0,
  variance_percent numeric(8,2) NOT NULL DEFAULT 0,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.waste_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  ingredient_id uuid REFERENCES public.ingredients(id) ON DELETE SET NULL,
  ingredient_name text NOT NULL,
  quantity_wasted numeric(12,4) NOT NULL DEFAULT 0 CHECK (quantity_wasted >= 0),
  unit text NOT NULL,
  reason text,
  estimated_loss_amount numeric(12,2) NOT NULL DEFAULT 0,
  logged_by text,
  logged_at timestamptz,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.account_settings (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  pin_hash text,
  wholesaler text,
  location text,
  cuisine_type text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Upgrade path: ADD COLUMN IF NOT EXISTS for pre-existing tables
-- ---------------------------------------------------------------------------

ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS cuisine_type text;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS wholesalers text;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS pin_hash text;

ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS target_margin_percent numeric(8,2) NOT NULL DEFAULT 65;

ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS unit text DEFAULT 'unit';
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS current_stock numeric(12,4) NOT NULL DEFAULT 0;
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS min_threshold numeric(12,4) NOT NULL DEFAULT 0;
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS cost_per_unit numeric(12,4);
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS previous_cost_per_unit numeric(12,4);
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS supplier_name text;
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS supplier_contact text;
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS last_restocked date;

ALTER TABLE public.recipe_ingredients ADD COLUMN IF NOT EXISTS ingredient_name text;

ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS order_id text;
ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS sold_at timestamptz;
ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS unit_price numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS transaction_type text;
ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS received_by text;
ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.margin_alerts ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.margin_alerts ADD COLUMN IF NOT EXISTS affected_menu_item_id uuid;
ALTER TABLE public.margin_alerts ADD COLUMN IF NOT EXISTS affected_menu_item_name text;
ALTER TABLE public.margin_alerts ADD COLUMN IF NOT EXISTS old_cost numeric(12,4);
ALTER TABLE public.margin_alerts ADD COLUMN IF NOT EXISTS new_cost numeric(12,4);
ALTER TABLE public.margin_alerts ADD COLUMN IF NOT EXISTS increase_percent numeric(8,2);
ALTER TABLE public.margin_alerts ADD COLUMN IF NOT EXISTS estimated_monthly_loss numeric(12,2) DEFAULT 0;
ALTER TABLE public.margin_alerts ADD COLUMN IF NOT EXISTS suggested_action text;
ALTER TABLE public.margin_alerts ADD COLUMN IF NOT EXISTS is_resolved boolean NOT NULL DEFAULT false;

ALTER TABLE public.order_notes ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.order_notes ADD COLUMN IF NOT EXISTS supplier_name text;
ALTER TABLE public.order_notes ADD COLUMN IF NOT EXISTS channel text;
ALTER TABLE public.order_notes ADD COLUMN IF NOT EXISTS po_number text;
ALTER TABLE public.order_notes ADD COLUMN IF NOT EXISTS total_amount numeric(12,2) DEFAULT 0;
ALTER TABLE public.order_notes ADD COLUMN IF NOT EXISTS lines jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.waste_entries ADD COLUMN IF NOT EXISTS estimated_loss_amount numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.waste_entries ADD COLUMN IF NOT EXISTS logged_by text;
ALTER TABLE public.waste_entries ADD COLUMN IF NOT EXISTS logged_at timestamptz;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_profiles_restaurant_id ON public.profiles(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON public.menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_restaurant_id ON public.ingredients(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_sales_records_restaurant_date ON public.sales_records(restaurant_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_forecasts_restaurant_target ON public.forecasts(restaurant_id, target_date);
CREATE INDEX IF NOT EXISTS idx_forecast_lines_forecast_id ON public.forecast_lines(forecast_id);
CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_restaurant_id ON public.inventory_snapshots(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_supplier_items_supplier_id ON public.supplier_items(supplier_id);
CREATE INDEX IF NOT EXISTS idx_margin_alerts_forecast_id ON public.margin_alerts(forecast_id);
CREATE INDEX IF NOT EXISTS idx_margin_alerts_restaurant ON public.margin_alerts(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_order_notes_forecast_id ON public.order_notes(forecast_id);
CREATE INDEX IF NOT EXISTS idx_order_notes_restaurant ON public.order_notes(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suppliers_restaurant ON public.suppliers(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_waste_entries_restaurant_date ON public.waste_entries(restaurant_id, entry_date);

-- ---------------------------------------------------------------------------
-- Tenant helper (service role bypasses RLS automatically)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_restaurant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT restaurant_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- RLS: enable on ALL public tenant tables
-- ---------------------------------------------------------------------------

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.substitute_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.margin_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_actuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waste_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS restaurants_tenant ON public.restaurants;
CREATE POLICY restaurants_tenant ON public.restaurants
  FOR ALL TO authenticated
  USING (id = public.current_restaurant_id())
  WITH CHECK (id = public.current_restaurant_id());

DROP POLICY IF EXISTS profiles_self ON public.profiles;
DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
CREATE POLICY profiles_self_select ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS suppliers_tenant ON public.suppliers;
CREATE POLICY suppliers_tenant ON public.suppliers
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

DROP POLICY IF EXISTS menu_items_tenant ON public.menu_items;
CREATE POLICY menu_items_tenant ON public.menu_items
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

DROP POLICY IF EXISTS ingredients_tenant ON public.ingredients;
CREATE POLICY ingredients_tenant ON public.ingredients
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

DROP POLICY IF EXISTS recipe_ingredients_tenant ON public.recipe_ingredients;
CREATE POLICY recipe_ingredients_tenant ON public.recipe_ingredients
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.menu_items m
      WHERE m.id = menu_item_id AND m.restaurant_id = public.current_restaurant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.menu_items m
      WHERE m.id = menu_item_id AND m.restaurant_id = public.current_restaurant_id()
    )
  );

DROP POLICY IF EXISTS sales_records_tenant ON public.sales_records;
CREATE POLICY sales_records_tenant ON public.sales_records
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

DROP POLICY IF EXISTS forecasts_tenant ON public.forecasts;
CREATE POLICY forecasts_tenant ON public.forecasts
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

DROP POLICY IF EXISTS forecast_lines_tenant ON public.forecast_lines;
CREATE POLICY forecast_lines_tenant ON public.forecast_lines
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.forecasts f
      WHERE f.id = forecast_id AND f.restaurant_id = public.current_restaurant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.forecasts f
      WHERE f.id = forecast_id AND f.restaurant_id = public.current_restaurant_id()
    )
  );

DROP POLICY IF EXISTS inventory_snapshots_tenant ON public.inventory_snapshots;
CREATE POLICY inventory_snapshots_tenant ON public.inventory_snapshots
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

DROP POLICY IF EXISTS supplier_items_tenant ON public.supplier_items;
CREATE POLICY supplier_items_tenant ON public.supplier_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.suppliers s
      WHERE s.id = supplier_id AND s.restaurant_id = public.current_restaurant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.suppliers s
      WHERE s.id = supplier_id AND s.restaurant_id = public.current_restaurant_id()
    )
  );

DROP POLICY IF EXISTS substitute_rules_tenant ON public.substitute_rules;
CREATE POLICY substitute_rules_tenant ON public.substitute_rules
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

DROP POLICY IF EXISTS margin_alerts_tenant ON public.margin_alerts;
CREATE POLICY margin_alerts_tenant ON public.margin_alerts
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

DROP POLICY IF EXISTS order_notes_tenant ON public.order_notes;
CREATE POLICY order_notes_tenant ON public.order_notes
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

DROP POLICY IF EXISTS forecast_actuals_tenant ON public.forecast_actuals;
CREATE POLICY forecast_actuals_tenant ON public.forecast_actuals
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.forecasts f
      WHERE f.id = forecast_id AND f.restaurant_id = public.current_restaurant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.forecasts f
      WHERE f.id = forecast_id AND f.restaurant_id = public.current_restaurant_id()
    )
  );

DROP POLICY IF EXISTS waste_entries_tenant ON public.waste_entries;
CREATE POLICY waste_entries_tenant ON public.waste_entries
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

DROP POLICY IF EXISTS account_settings_tenant ON public.account_settings;
CREATE POLICY account_settings_tenant ON public.account_settings
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

-- Bootstrap a single restaurant owner on the first Supabase Auth signup.
-- Additional signups require an explicit invitation flow before multi-user rollout.
CREATE OR REPLACE FUNCTION public.bootstrap_restobot_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  restaurant_count integer;
  assigned_restaurant_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('restobot:first-owner-signup'));

  IF EXISTS (SELECT 1 FROM public.profiles LIMIT 1) THEN
    RAISE EXCEPTION 'Restaurant signup is closed. Ask the owner for an invitation.'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO restaurant_count FROM public.restaurants;

  IF restaurant_count = 0 THEN
    INSERT INTO public.restaurants (name, location, cuisine_type, wholesalers)
    VALUES (
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'restaurant_name', ''), 'RestoBot Restaurant'),
      NULLIF(NEW.raw_user_meta_data->>'location', ''),
      NULLIF(NEW.raw_user_meta_data->>'cuisine_type', ''),
      NULLIF(NEW.raw_user_meta_data->>'wholesalers', '')
    )
    RETURNING id INTO assigned_restaurant_id;
  ELSIF restaurant_count = 1 THEN
    SELECT id INTO assigned_restaurant_id FROM public.restaurants LIMIT 1;
  ELSE
    RAISE EXCEPTION 'Multiple restaurants exist; owner signup needs administrator setup.'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.profiles (id, restaurant_id, email, full_name, is_owner)
  VALUES (
    NEW.id,
    assigned_restaurant_id,
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    true
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS restobot_bootstrap_owner ON auth.users;
CREATE TRIGGER restobot_bootstrap_owner
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.bootstrap_restobot_owner();

-- Supabase projects with hardened default privileges require explicit API grants.
-- Authenticated table access remains restricted by the RLS policies above.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT EXECUTE ON FUNCTION public.current_restaurant_id() TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO service_role;
