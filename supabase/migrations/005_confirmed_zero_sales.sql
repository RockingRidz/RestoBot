-- Explicit zero-sales observations are not missing dates, refunds or stock returns.
BEGIN;
CREATE OR REPLACE FUNCTION public.restobot_ingest_sales(p_restaurant_id uuid, p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_row jsonb; v_recipe record; v_ingredient public.ingredients%ROWTYPE;
  v_count integer := 0; v_duplicate integer := 0; v_ids jsonb := '[]'::jsonb;
  v_used numeric; v_factor numeric; v_from text; v_to text;
BEGIN
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Sales rows must be an array'; END IF;
  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    IF nullif(v_row->>'id', '') IS NULL OR (v_row->>'quantity_sold')::numeric < 0 OR ((v_row->>'quantity_sold')::numeric = 0 AND coalesce(v_row->>'transaction_type','') <> 'zero_sales') THEN
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
    IF (v_row->>'quantity_sold')::numeric = 0 THEN CONTINUE; END IF;
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

CREATE OR REPLACE FUNCTION public.restobot_ingest_sales(p_restaurant_id uuid, p_rows jsonb, p_apply_inventory boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_row jsonb; v_recipe record; v_ingredient public.ingredients%ROWTYPE;
  v_count integer := 0; v_duplicate integer := 0; v_ids jsonb := '[]'::jsonb;
  v_used numeric; v_factor numeric; v_from text; v_to text;
BEGIN
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Sales rows must be an array'; END IF;
  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    IF nullif(v_row->>'id', '') IS NULL OR (v_row->>'quantity_sold')::numeric < 0 OR ((v_row->>'quantity_sold')::numeric = 0 AND coalesce(v_row->>'transaction_type','') <> 'zero_sales') THEN
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
    IF (v_row->>'quantity_sold')::numeric = 0 THEN CONTINUE; END IF;
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
REVOKE ALL ON FUNCTION public.restobot_ingest_sales(uuid,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.restobot_ingest_sales(uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.restobot_ingest_sales(uuid,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.restobot_ingest_sales(uuid,jsonb,boolean) TO service_role;
COMMIT;
