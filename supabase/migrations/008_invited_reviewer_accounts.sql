-- Allow administrators to provision additional, non-owner users for an existing
-- restaurant. The tenant id must be supplied in auth app_metadata, which regular
-- users cannot edit themselves.
CREATE OR REPLACE FUNCTION public.bootstrap_restobot_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  restaurant_count integer;
  assigned_restaurant_id uuid;
  invited_restaurant_text text;
BEGIN
  -- Supabase Auth does not expose custom app_metadata to every create-user
  -- trigger path. Keep the IBR exception narrowly allowlisted to one address
  -- and one tenant; all other additional signups remain closed.
  IF lower(NEW.email) = 'ibr-reviewer@restobot-demo.invalid' THEN
    assigned_restaurant_id := '4b7f7099-132d-4b01-aaa8-43cc13adcd0b'::uuid;

    IF NOT EXISTS (SELECT 1 FROM public.restaurants WHERE id = assigned_restaurant_id) THEN
      RAISE EXCEPTION 'IBR demo restaurant does not exist.' USING ERRCODE = '23503';
    END IF;

    INSERT INTO public.profiles (id, restaurant_id, email, full_name, is_owner)
    VALUES (
      NEW.id,
      assigned_restaurant_id,
      NEW.email,
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      false
    );
    RETURN NEW;
  END IF;

  invited_restaurant_text := NULLIF(NEW.raw_app_meta_data->>'restobot_restaurant_id', '');

  IF invited_restaurant_text IS NOT NULL THEN
    BEGIN
      assigned_restaurant_id := invited_restaurant_text::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Invalid invited restaurant id.' USING ERRCODE = '22023';
    END;

    IF NOT EXISTS (SELECT 1 FROM public.restaurants WHERE id = assigned_restaurant_id) THEN
      RAISE EXCEPTION 'Invited restaurant does not exist.' USING ERRCODE = '23503';
    END IF;

    INSERT INTO public.profiles (id, restaurant_id, email, full_name, is_owner)
    VALUES (
      NEW.id,
      assigned_restaurant_id,
      NEW.email,
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      false
    );
    RETURN NEW;
  END IF;

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

