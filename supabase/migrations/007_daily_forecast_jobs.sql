-- Durable daily draft generation only. No approval, supplier send or external notification.
CREATE TABLE IF NOT EXISTS public.daily_forecast_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  local_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('running','retry','succeeded','skipped','failed')),
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts BETWEEN 1 AND 3),
  lease_token uuid NOT NULL DEFAULT gen_random_uuid(),
  lease_until timestamptz,
  next_attempt_at timestamptz,
  forecast_id uuid REFERENCES public.forecasts(id),
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, local_date)
);
ALTER TABLE public.daily_forecast_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.daily_forecast_runs FROM anon, authenticated;
GRANT ALL ON public.daily_forecast_runs TO service_role;

CREATE OR REPLACE FUNCTION public.restobot_claim_daily_forecast(p_restaurant_id uuid, p_local_date date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r daily_forecast_runs;
BEGIN
  IF p_local_date IS NULL THEN RAISE EXCEPTION 'Missing schedule date'; END IF;
  INSERT INTO daily_forecast_runs(restaurant_id,local_date,status,lease_until)
    VALUES(p_restaurant_id,p_local_date,'running',now()+interval '5 minutes')
    ON CONFLICT (restaurant_id,local_date) DO NOTHING RETURNING * INTO r;
  IF r.id IS NOT NULL THEN RETURN to_jsonb(r); END IF;
  SELECT * INTO r FROM daily_forecast_runs WHERE restaurant_id=p_restaurant_id AND local_date=p_local_date FOR UPDATE;
  IF r.status IN ('succeeded','skipped','failed') THEN RETURN NULL; END IF;
  IF r.status='running' AND r.lease_until>now() THEN RETURN NULL; END IF;
  IF r.status='retry' AND r.next_attempt_at>now() THEN RETURN NULL; END IF;
  IF r.attempts>=3 THEN
    UPDATE daily_forecast_runs SET status='failed',failure_code='lease_exhausted',lease_until=NULL,updated_at=now() WHERE id=r.id;
    RETURN NULL;
  END IF;
  UPDATE daily_forecast_runs SET status='running', attempts=attempts+1, lease_token=gen_random_uuid(),
    lease_until=now()+interval '5 minutes',next_attempt_at=NULL,updated_at=now()
    WHERE id=r.id RETURNING * INTO r;
  RETURN to_jsonb(r);
END $$;

CREATE OR REPLACE FUNCTION public.restobot_complete_daily_forecast(p_restaurant_id uuid,p_run_id uuid,p_token uuid,p_forecast jsonb,p_skip text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r daily_forecast_runs; fid uuid;
BEGIN
  SELECT * INTO r FROM daily_forecast_runs WHERE id=p_run_id AND restaurant_id=p_restaurant_id FOR UPDATE;
  IF r.id IS NULL OR r.lease_token IS DISTINCT FROM p_token THEN RAISE EXCEPTION 'Invalid job lease'; END IF;
  IF r.status IN ('succeeded','skipped') THEN RETURN r.forecast_id; END IF;
  IF r.status<>'running' OR r.lease_until<=now() THEN RAISE EXCEPTION 'Expired job lease'; END IF;
  IF p_skip IS NOT NULL THEN
    IF p_skip<>'closed_target_date' OR p_forecast IS NOT NULL THEN RAISE EXCEPTION 'Invalid skip'; END IF;
    UPDATE daily_forecast_runs SET status='skipped',failure_code=p_skip,lease_until=NULL,updated_at=now() WHERE id=r.id;
    RETURN NULL;
  END IF;
  IF p_forecast IS NULL OR (p_forecast->>'restaurant_id')::uuid IS DISTINCT FROM p_restaurant_id
    OR p_forecast->'forecast_explanation'->>'inputFingerprint' IS NULL THEN RAISE EXCEPTION 'Invalid forecast snapshot'; END IF;
  INSERT INTO forecasts(restaurant_id,target_date,generated_at,status,forecast_summary,forecast_explanation)
    VALUES(p_restaurant_id,(p_forecast->>'target_date')::date,(p_forecast->>'generated_at')::timestamptz,
      'generated',p_forecast->>'forecast_summary',p_forecast->'forecast_explanation') RETURNING id INTO fid;
  UPDATE daily_forecast_runs SET status='succeeded',forecast_id=fid,failure_code=NULL,lease_until=NULL,updated_at=now() WHERE id=r.id;
  RETURN fid;
END $$;

CREATE OR REPLACE FUNCTION public.restobot_fail_daily_forecast(p_restaurant_id uuid,p_run_id uuid,p_token uuid,p_code text,p_retryable boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_code NOT IN ('provider_quota','provider_configuration','provider_unavailable','inputs_changed','forecast_failed') OR p_code IS NULL THEN
    RAISE EXCEPTION 'Invalid failure code';
  END IF;
  UPDATE daily_forecast_runs SET status=CASE WHEN p_retryable AND attempts<3 THEN 'retry' ELSE 'failed' END,
    failure_code=p_code,lease_until=NULL,next_attempt_at=now()+interval '5 minutes',updated_at=now()
    WHERE id=p_run_id AND restaurant_id=p_restaurant_id AND lease_token=p_token AND status='running' AND lease_until>now();
END $$;

REVOKE ALL ON FUNCTION public.restobot_claim_daily_forecast(uuid,date) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.restobot_complete_daily_forecast(uuid,uuid,uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.restobot_fail_daily_forecast(uuid,uuid,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.restobot_claim_daily_forecast(uuid,date) TO service_role;
GRANT EXECUTE ON FUNCTION public.restobot_complete_daily_forecast(uuid,uuid,uuid,jsonb,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.restobot_fail_daily_forecast(uuid,uuid,uuid,text,boolean) TO service_role;
