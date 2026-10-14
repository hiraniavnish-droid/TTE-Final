-- Isolated Google Contacts integration: no MAX tables, webhook dispatch or lead events.
BEGIN;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS google_contact_id text;
CREATE TABLE public.crm_google_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), enabled boolean NOT NULL DEFAULT false,
 client_id text, client_secret_encrypted text, refresh_token_encrypted text,
 expected_email text NOT NULL DEFAULT 'booking@thetourismexperts.com', account_email text, google_subject text,
 group_resource text, index_ready boolean NOT NULL DEFAULT false, index_page_token text, index_sync_token text,
 backfill_at timestamptz, connected_at timestamptz, last_run_at timestamptz, last_error text,
 lease_token uuid, locked_until timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.crm_google_settings(id) VALUES(true);
CREATE TABLE public.crm_google_oauth_states (
 state_hash text PRIMARY KEY, actor_id text NOT NULL, session_version integer NOT NULL,
 verifier_encrypted text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE public.crm_google_contacts_index (
 phone text NOT NULL, resource_name text NOT NULL,
 PRIMARY KEY(phone,resource_name)
);
CREATE INDEX ON public.crm_google_contacts_index(resource_name);
CREATE TABLE public.crm_google_queue (
 lead_id uuid PRIMARY KEY REFERENCES public.leads(id) ON DELETE CASCADE,
 revision bigint NOT NULL DEFAULT 1, state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','synced','failed','skipped')),
 attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
 requested_at timestamptz NOT NULL DEFAULT now(), synced_at timestamptz, last_error text
);
CREATE INDEX ON public.crm_google_queue(next_attempt_at) WHERE state='pending';
CREATE FUNCTION public.crm_google_phone(p_value text) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path=public,pg_temp AS $$
DECLARE p text := regexp_replace(coalesce(p_value,''),'[^0-9]','','g');
BEGIN
 IF p LIKE '00%' THEN p:=substr(p,3); END IF;
 IF length(p)=10 THEN p:='91'||p; END IF;
 IF length(p)<8 OR length(p)>15 OR p LIKE '0%' THEN RETURN NULL; END IF;
 RETURN '+'||p;
END $$;
CREATE FUNCTION public.crm_google_lead_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF (new.name,new.status,new.contact,new.phone,new.trip_details,new.destination,new.travel_date,new.pax,new.lead_code)
    IS NOT DISTINCT FROM (old.name,old.status,old.contact,old.phone,old.trip_details,old.destination,old.travel_date,old.pax,old.lead_code) THEN RETURN new; END IF;
 END IF;
 INSERT INTO public.crm_google_queue(lead_id) VALUES(new.id)
 ON CONFLICT(lead_id) DO UPDATE SET revision=crm_google_queue.revision+1,state='pending',attempts=0,next_attempt_at=now(),requested_at=now(),last_error=null;
 RETURN new;
END $$;
CREATE TRIGGER crm_google_lead_sync AFTER INSERT OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.crm_google_lead_changed();
CREATE FUNCTION public.crm_google_claim(p_lease uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE public.crm_google_settings SET lease_token=p_lease,locked_until=now()+interval '120 seconds'
 WHERE id AND enabled AND refresh_token_encrypted IS NOT NULL AND (locked_until IS NULL OR locked_until<now());
 RETURN found;
END $$;
CREATE FUNCTION public.crm_google_release(p_lease uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 UPDATE public.crm_google_settings SET lease_token=null,locked_until=null,last_run_at=now() WHERE id AND lease_token=p_lease;
$$;
CREATE FUNCTION public.crm_google_related(p_phone text) RETURNS SETOF public.leads LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT * FROM public.leads WHERE public.crm_google_phone(coalesce(nullif(contact->>'phone',''),phone))=p_phone ORDER BY created_at DESC,id DESC;
$$;
CREATE INDEX crm_google_lead_phone_idx ON public.leads(public.crm_google_phone(coalesce(nullif(contact->>'phone',''),phone)));
CREATE FUNCTION public.crm_google_backfill() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n integer;
BEGIN
 PERFORM 1 FROM public.crm_google_settings WHERE id AND refresh_token_encrypted IS NOT NULL FOR UPDATE;
 IF NOT found THEN RAISE EXCEPTION 'Connect Google first'; END IF;
 IF (SELECT backfill_at IS NOT NULL FROM public.crm_google_settings WHERE id) THEN RETURN jsonb_build_object('already_queued',true); END IF;
 INSERT INTO public.crm_google_queue(lead_id) SELECT id FROM public.leads
 ON CONFLICT(lead_id) DO UPDATE SET revision=crm_google_queue.revision+1,state='pending',attempts=0,next_attempt_at=now(),requested_at=now(),last_error=null;
 GET DIAGNOSTICS n=ROW_COUNT;
 UPDATE public.crm_google_settings SET backfill_at=now() WHERE id;
 RETURN jsonb_build_object('queued',n);
END $$;
CREATE FUNCTION public.crm_google_retry_failed() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n integer;
BEGIN
 UPDATE public.crm_google_queue SET state='pending',attempts=0,next_attempt_at=now(),last_error=null,revision=revision+1 WHERE state='failed';
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;
CREATE FUNCTION public.crm_google_oauth_consume(p_hash text) RETURNS SETOF public.crm_google_oauth_states LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 DELETE FROM public.crm_google_oauth_states WHERE state_hash=p_hash AND expires_at>now() RETURNING *;
$$;
CREATE FUNCTION public.crm_google_status() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('pending',count(*) FILTER(WHERE state='pending'),'synced',count(*) FILTER(WHERE state='synced'),'failed',count(*) FILTER(WHERE state='failed'),'skipped',count(*) FILTER(WHERE state='skipped')) FROM public.crm_google_queue;
$$;
CREATE FUNCTION public.crm_google_index_page(p_people jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE person jsonb; number jsonb; p text;
BEGIN
 FOR person IN SELECT value FROM jsonb_array_elements(p_people) LOOP
  DELETE FROM public.crm_google_contacts_index WHERE resource_name=person->>'resourceName';
  IF coalesce((person->'metadata'->>'deleted')::boolean,false) THEN CONTINUE; END IF;
  FOR number IN SELECT value FROM jsonb_array_elements(coalesce(person->'phoneNumbers','[]'::jsonb)) LOOP
   p:=public.crm_google_phone(coalesce(number->>'canonicalForm',number->>'value'));
   IF p IS NOT NULL THEN INSERT INTO public.crm_google_contacts_index(phone,resource_name) VALUES(p,person->>'resourceName') ON CONFLICT DO NOTHING; END IF;
  END LOOP;
 END LOOP;
END $$;
-- Only the backend service role may read tokens, configure settings or operate jobs.
DO $$ DECLARE t text; f text; BEGIN
 FOREACH t IN ARRAY ARRAY['crm_google_settings','crm_google_oauth_states','crm_google_contacts_index','crm_google_queue'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM public,anon,authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
 FOR f IN SELECT p.oid::regprocedure::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'crm_google_%' LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION '||f||' FROM public,anon,authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION '||f||' TO service_role';
 END LOOP;
END $$;
-- Pure phone normalization is safe for lead indexes and ordinary app writes.
GRANT EXECUTE ON FUNCTION public.crm_google_phone(text) TO anon,authenticated;
COMMIT;
