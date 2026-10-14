BEGIN;
-- A tenant's menu must not link another tenant's ingredient through a known UUID.
DROP POLICY IF EXISTS recipe_ingredients_tenant ON public.recipe_ingredients;
CREATE POLICY recipe_ingredients_tenant ON public.recipe_ingredients
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.menu_items m WHERE m.id = menu_item_id AND m.restaurant_id = public.current_restaurant_id()))
WITH CHECK (
  EXISTS (SELECT 1 FROM public.menu_items m WHERE m.id = menu_item_id AND m.restaurant_id = public.current_restaurant_id())
  AND EXISTS (SELECT 1 FROM public.ingredients i WHERE i.id = ingredient_id AND i.restaurant_id = public.current_restaurant_id())
);
COMMIT;
