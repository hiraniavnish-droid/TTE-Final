-- New enquiries and edits must not wait behind the historical import.
BEGIN;
ALTER TABLE public.crm_google_queue ADD COLUMN priority smallint NOT NULL DEFAULT 0 CHECK(priority BETWEEN 0 AND 10);
CREATE OR REPLACE FUNCTION public.crm_google_lead_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF (new.name,new.status,new.contact,new.phone,new.trip_details,new.destination,new.travel_date,new.pax,new.lead_code)
    IS NOT DISTINCT FROM (old.name,old.status,old.contact,old.phone,old.trip_details,old.destination,old.travel_date,old.pax,old.lead_code) THEN RETURN new; END IF;
 END IF;
 INSERT INTO public.crm_google_queue(lead_id,priority) VALUES(new.id,0)
 ON CONFLICT(lead_id) DO UPDATE SET priority=0,revision=crm_google_queue.revision+1,state='pending',attempts=0,next_attempt_at=now(),requested_at=now(),last_error=null;
 RETURN new;
END $$;
CREATE OR REPLACE FUNCTION public.crm_google_backfill() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n integer;
BEGIN
 PERFORM 1 FROM public.crm_google_settings WHERE id AND refresh_token_encrypted IS NOT NULL FOR UPDATE;
 IF NOT found THEN RAISE EXCEPTION 'Connect Google first'; END IF;
 IF (SELECT backfill_at IS NOT NULL FROM public.crm_google_settings WHERE id) THEN RETURN jsonb_build_object('already_queued',true); END IF;
 INSERT INTO public.crm_google_queue(lead_id,priority) SELECT id,10 FROM public.leads
 ON CONFLICT(lead_id) DO UPDATE SET priority=least(crm_google_queue.priority,10),revision=crm_google_queue.revision+1,state='pending',attempts=0,next_attempt_at=now(),requested_at=now(),last_error=null;
 GET DIAGNOSTICS n=ROW_COUNT;
 UPDATE public.crm_google_settings SET backfill_at=now() WHERE id;
 RETURN jsonb_build_object('queued',n);
END $$;
COMMIT;
