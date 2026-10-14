-- Reviewed culinary quantities and supplier settings. Apply after 002.
BEGIN;
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS procurement jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.recipe_ingredients ADD COLUMN IF NOT EXISTS quantity_basis text NOT NULL DEFAULT 'as_purchased' CHECK (quantity_basis IN ('as_purchased','edible'));
ALTER TABLE public.recipe_ingredients ADD COLUMN IF NOT EXISTS yield_percent numeric CHECK (yield_percent > 0 AND yield_percent <= 100);
ALTER TABLE public.recipe_ingredients ADD COLUMN IF NOT EXISTS culinary_role text CHECK (culinary_role IN ('accent','bulk','structural'));
ALTER TABLE public.recipe_ingredients ADD COLUMN IF NOT EXISTS substitutes jsonb NOT NULL DEFAULT '[]'::jsonb;
-- Atomic owner workflows. Only the server service role may invoke these functions.
-- Each RPC call is one Postgres transaction; errors roll back the whole call.
CREATE OR REPLACE FUNCTION public.restobot_save_recipe(p_restaurant_id uuid, p_menu jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_menu public.menu_items%ROWTYPE; v_recipe jsonb; v_ingredient uuid;
BEGIN
  IF nullif(trim(p_menu->>'name'), '') IS NULL THEN RAISE EXCEPTION 'Recipe name is required'; END IF;
  IF jsonb_typeof(p_menu->'recipes') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Recipe ingredients must be an array'; END IF;
  IF p_menu ? 'id' AND nullif(p_menu->>'id', '') IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.menu_items WHERE id = (p_menu->>'id')::uuid AND restaurant_id <> p_restaurant_id
  ) THEN RAISE EXCEPTION 'Recipe belongs to another restaurant'; END IF;
  IF nullif(p_menu->>'id', '') IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.menu_items WHERE id = (p_menu->>'id')::uuid AND restaurant_id = p_restaurant_id
  ) THEN
    UPDATE public.menu_items SET name = trim(p_menu->>'name'), category = p_menu->>'category',
      selling_price = (p_menu->>'selling_price')::numeric,
      target_margin_percent = coalesce((p_menu->>'target_margin_percent')::numeric, 65),
      active_status = coalesce((p_menu->>'is_active')::boolean, true), updated_at = now()
    WHERE id = (p_menu->>'id')::uuid AND restaurant_id = p_restaurant_id RETURNING * INTO v_menu;
  ELSE
  INSERT INTO public.menu_items (id, restaurant_id, name, category, selling_price, target_margin_percent, active_status)
  VALUES (coalesce(nullif(p_menu->>'id', '')::uuid, gen_random_uuid()), p_restaurant_id,
    trim(p_menu->>'name'), p_menu->>'category', (p_menu->>'selling_price')::numeric,
    coalesce((p_menu->>'target_margin_percent')::numeric, 65), coalesce((p_menu->>'is_active')::boolean, true))
  ON CONFLICT (restaurant_id, name) DO UPDATE SET category = EXCLUDED.category,
    selling_price = EXCLUDED.selling_price, target_margin_percent = EXCLUDED.target_margin_percent,
    active_status = EXCLUDED.active_status, updated_at = now()
  RETURNING * INTO v_menu;
  END IF;
  DELETE FROM public.recipe_ingredients WHERE menu_item_id = v_menu.id;
  FOR v_recipe IN SELECT value FROM jsonb_array_elements(p_menu->'recipes') LOOP
    IF v_recipe->>'quantity_basis' = 'edible' AND nullif(v_recipe->>'yield_percent','') IS NULL THEN RAISE EXCEPTION 'Edible recipe requires measured yield'; END IF;
    v_ingredient := (v_recipe->>'ingredient_id')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.ingredients WHERE id = v_ingredient AND restaurant_id = p_restaurant_id) THEN
      RAISE EXCEPTION 'Recipe ingredient is outside this restaurant';
    END IF;
    INSERT INTO public.recipe_ingredients (menu_item_id, ingredient_id, ingredient_name, quantity_per_menu_item, unit, quantity_basis, yield_percent, culinary_role, substitutes)
    SELECT v_menu.id, i.id, i.name, (v_recipe->>'quantity_required')::numeric,
      coalesce(nullif(v_recipe->>'unit', ''), i.base_unit),
      coalesce(v_recipe->>'quantity_basis','as_purchased'), (v_recipe->>'yield_percent')::numeric, nullif(v_recipe->>'culinary_role',''), coalesce(v_recipe->'substitutes','[]'::jsonb)
    FROM public.ingredients i WHERE i.id = v_ingredient;
  END LOOP;
  RETURN (SELECT to_jsonb(m) || jsonb_build_object('recipe_ingredients',
    coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM public.recipe_ingredients r WHERE r.menu_item_id = v_menu.id), '[]'::jsonb))
    FROM public.menu_items m WHERE m.id = v_menu.id);
END $$;

CREATE OR REPLACE FUNCTION public.restobot_log_waste(p_restaurant_id uuid, p_entry jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_ingredient public.ingredients%ROWTYPE; v_waste public.waste_entries%ROWTYPE; v_quantity numeric;
BEGIN
  v_quantity := (p_entry->>'quantity')::numeric;
  IF v_quantity <= 0 THEN RAISE EXCEPTION 'Waste quantity must be positive'; END IF;
  SELECT * INTO v_ingredient FROM public.ingredients
    WHERE id = (p_entry->>'ingredient_id')::uuid AND restaurant_id = p_restaurant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown restaurant ingredient'; END IF;
  IF p_entry->>'unit' <> v_ingredient.base_unit THEN RAISE EXCEPTION 'Waste unit does not match stock unit'; END IF;
  INSERT INTO public.waste_entries (restaurant_id, ingredient_id, ingredient_name, quantity_wasted, unit, reason,
    estimated_loss_amount, logged_at)
  VALUES (p_restaurant_id, v_ingredient.id, v_ingredient.name, v_quantity, v_ingredient.base_unit,
    p_entry->>'reason', v_quantity * coalesce(v_ingredient.current_cost_per_unit, 0), now()) RETURNING * INTO v_waste;
  UPDATE public.ingredients SET current_stock = greatest(0, current_stock - v_quantity), updated_at = now()
    WHERE id = v_ingredient.id;
  RETURN jsonb_build_object('id', v_waste.id, 'ingredient_id', v_ingredient.id,
    'ingredient_name', v_ingredient.name, 'quantity', v_quantity, 'unit', v_ingredient.base_unit,
    'reason', v_waste.reason, 'logged_at', v_waste.created_at);
END $$;

CREATE OR REPLACE FUNCTION public.restobot_unit_factor(p_from text, p_to text)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE v_from text := lower(trim(p_from)); v_to text := lower(trim(p_to));
  v_from_kind text; v_to_kind text; v_from_scale numeric; v_to_scale numeric;
BEGIN
  IF v_from = v_to THEN RETURN 1; END IF;
  SELECT kind, scale INTO v_from_kind, v_from_scale FROM (VALUES
    ('g','mass',1::numeric), ('kg','mass',1000::numeric), ('lb','mass',453.59237::numeric),
    ('lbs','mass',453.59237::numeric), ('oz','mass',28.349523125::numeric),
    ('ml','volume',1::numeric), ('l','volume',1000::numeric), ('liter','volume',1000::numeric),
    ('liters','volume',1000::numeric), ('gal','volume',3785.411784::numeric),
    ('fl_oz','volume',29.5735295625::numeric), ('fl oz','volume',29.5735295625::numeric),
    ('tsp','volume',4.92892159375::numeric), ('tbsp','volume',14.78676478125::numeric), ('cup','volume',236.5882365::numeric),
    ('unit','count',1::numeric), ('units','count',1::numeric), ('pcs','count',1::numeric),
    ('piece','count',1::numeric), ('pieces','count',1::numeric)
  ) AS u(code,kind,scale) WHERE code = v_from;
  SELECT kind, scale INTO v_to_kind, v_to_scale FROM (VALUES
    ('g','mass',1::numeric), ('kg','mass',1000::numeric), ('lb','mass',453.59237::numeric),
    ('lbs','mass',453.59237::numeric), ('oz','mass',28.349523125::numeric),
    ('ml','volume',1::numeric), ('l','volume',1000::numeric), ('liter','volume',1000::numeric),
    ('liters','volume',1000::numeric), ('gal','volume',3785.411784::numeric),
    ('fl_oz','volume',29.5735295625::numeric), ('fl oz','volume',29.5735295625::numeric),
    ('tsp','volume',4.92892159375::numeric), ('tbsp','volume',14.78676478125::numeric), ('cup','volume',236.5882365::numeric),
    ('unit','count',1::numeric), ('units','count',1::numeric), ('pcs','count',1::numeric),
    ('piece','count',1::numeric), ('pieces','count',1::numeric)
  ) AS u(code,kind,scale) WHERE code = v_to;
  IF v_from_kind IS NULL OR v_to_kind IS NULL OR v_from_kind <> v_to_kind THEN
    RAISE EXCEPTION 'Unsupported recipe unit conversion % to %', p_from, p_to;
  END IF;
  RETURN v_from_scale / v_to_scale;
END $$;

CREATE OR REPLACE FUNCTION public.restobot_ingest_sales(p_restaurant_id uuid, p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_row jsonb; v_recipe record; v_ingredient public.ingredients%ROWTYPE;
  v_count integer := 0; v_duplicate integer := 0; v_ids jsonb := '[]'::jsonb;
  v_used numeric; v_factor numeric; v_from text; v_to text;
BEGIN
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Sales rows must be an array'; END IF;
  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    IF nullif(v_row->>'id', '') IS NULL OR (v_row->>'quantity_sold')::numeric <= 0 THEN
      RAISE EXCEPTION 'Invalid sale';
    END IF;
    INSERT INTO public.sales_records (id, restaurant_id, order_id, transaction_date, sold_at,
      menu_item_name, quantity_sold, unit_price, gross_sales, category, transaction_type, received_by, metadata)
    VALUES (md5(v_row->>'id')::uuid, p_restaurant_id, v_row->>'order_id', (v_row->>'sold_at')::timestamptz::date,
      (v_row->>'sold_at')::timestamptz, v_row->>'item_name', (v_row->>'quantity_sold')::numeric,
      (v_row->>'unit_price')::numeric, (v_row->>'total_amount')::numeric, v_row->>'category',
      v_row->>'transaction_type', v_row->>'received_by', jsonb_build_object('source_id', v_row->>'id'))
    ON CONFLICT (id) DO NOTHING;
    IF NOT FOUND THEN v_duplicate := v_duplicate + 1; CONTINUE; END IF;
    v_count := v_count + 1;
    v_ids := v_ids || jsonb_build_array(v_row->>'id');
    FOR v_recipe IN
      SELECT ri.ingredient_id, ri.quantity_per_menu_item, ri.unit, ri.quantity_basis, ri.yield_percent
      FROM public.menu_items m JOIN public.recipe_ingredients ri ON ri.menu_item_id = m.id
      WHERE m.restaurant_id = p_restaurant_id AND lower(m.name) = lower(v_row->>'item_name')
    LOOP
      SELECT * INTO v_ingredient FROM public.ingredients
        WHERE id = v_recipe.ingredient_id AND restaurant_id = p_restaurant_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Recipe ingredient missing'; END IF;
      v_factor := public.restobot_unit_factor(v_recipe.unit, v_ingredient.base_unit);
      v_used := v_recipe.quantity_per_menu_item * (v_row->>'quantity_sold')::numeric * v_factor;
      IF v_recipe.quantity_basis = 'edible' THEN
        IF v_recipe.yield_percent IS NULL THEN RAISE EXCEPTION 'Edible recipe requires measured yield'; END IF;
        v_used := v_used / (v_recipe.yield_percent / 100);
      END IF;
      UPDATE public.ingredients SET current_stock = greatest(0, current_stock - v_used), updated_at = now()
        WHERE id = v_ingredient.id;
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('inserted', v_count, 'duplicates', v_duplicate, 'inserted_ids', v_ids);
END $$;

REVOKE ALL ON FUNCTION public.restobot_save_recipe(uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restobot_log_waste(uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restobot_ingest_sales(uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restobot_save_recipe(uuid,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.restobot_log_waste(uuid,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.restobot_ingest_sales(uuid,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.restobot_unit_factor(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restobot_unit_factor(text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.restobot_ingest_sales(p_restaurant_id uuid, p_rows jsonb, p_apply_inventory boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_row jsonb; v_recipe record; v_ingredient public.ingredients%ROWTYPE;
  v_count integer := 0; v_duplicate integer := 0; v_ids jsonb := '[]'::jsonb;
  v_used numeric; v_factor numeric; v_from text; v_to text;
BEGIN
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Sales rows must be an array'; END IF;
  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    IF nullif(v_row->>'id', '') IS NULL OR (v_row->>'quantity_sold')::numeric <= 0 THEN
      RAISE EXCEPTION 'Invalid sale';
    END IF;
    INSERT INTO public.sales_records (id, restaurant_id, order_id, transaction_date, sold_at,
      menu_item_name, quantity_sold, unit_price, gross_sales, category, transaction_type, received_by, metadata)
    VALUES (md5(v_row->>'id')::uuid, p_restaurant_id, v_row->>'order_id', (v_row->>'sold_at')::timestamptz::date,
      (v_row->>'sold_at')::timestamptz, v_row->>'item_name', (v_row->>'quantity_sold')::numeric,
      (v_row->>'unit_price')::numeric, (v_row->>'total_amount')::numeric, v_row->>'category',
      v_row->>'transaction_type', v_row->>'received_by', jsonb_build_object('source_id', v_row->>'id'))
    ON CONFLICT (id) DO NOTHING;
    IF NOT FOUND THEN v_duplicate := v_duplicate + 1; CONTINUE; END IF;
    v_count := v_count + 1;
    v_ids := v_ids || jsonb_build_array(v_row->>'id');
    IF p_apply_inventory THEN
    FOR v_recipe IN
      SELECT ri.ingredient_id, ri.quantity_per_menu_item, ri.unit, ri.quantity_basis, ri.yield_percent
      FROM public.menu_items m JOIN public.recipe_ingredients ri ON ri.menu_item_id = m.id
      WHERE m.restaurant_id = p_restaurant_id AND lower(m.name) = lower(v_row->>'item_name')
    LOOP
      SELECT * INTO v_ingredient FROM public.ingredients
        WHERE id = v_recipe.ingredient_id AND restaurant_id = p_restaurant_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Recipe ingredient missing'; END IF;
      v_factor := public.restobot_unit_factor(v_recipe.unit, v_ingredient.base_unit);
      v_used := v_recipe.quantity_per_menu_item * (v_row->>'quantity_sold')::numeric * v_factor;
      IF v_recipe.quantity_basis = 'edible' THEN
        IF v_recipe.yield_percent IS NULL THEN RAISE EXCEPTION 'Edible recipe requires measured yield'; END IF;
        v_used := v_used / (v_recipe.yield_percent / 100);
      END IF;
      UPDATE public.ingredients SET current_stock = greatest(0, current_stock - v_used), updated_at = now()
        WHERE id = v_ingredient.id;
    END LOOP;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('inserted', v_count, 'duplicates', v_duplicate, 'inserted_ids', v_ids);
END $$;
REVOKE ALL ON FUNCTION public.restobot_ingest_sales(uuid,jsonb,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restobot_ingest_sales(uuid,jsonb,boolean) TO service_role;

COMMIT;


