-- Run in a rollback transaction. No test lead or webhook is retained.
BEGIN;

DO $$ DECLARE test_id uuid:=gen_random_uuid(); revision_before bigint; webhook_count bigint; BEGIN
 IF has_table_privilege('anon','public.crm_google_settings','SELECT') OR has_table_privilege('authenticated','public.crm_google_queue','SELECT') THEN RAISE EXCEPTION 'private contact data accessible'; END IF;
 IF has_function_privilege('anon','public.crm_google_backfill()','EXECUTE') THEN RAISE EXCEPTION 'private command accessible'; END IF;
 IF public.crm_google_phone('123') IS NOT NULL OR public.crm_google_phone('9876543210')<>'+919876543210' THEN RAISE EXCEPTION 'phone mismatch'; END IF;
 INSERT INTO public.leads(id,name,phone,contact,status,source,created_at,trip_details) VALUES(test_id,'Contacts Sync Rollback Test','9876543210','{"phone":"9876543210"}','New','Test',now(),'{"destination":"Rann Utsav"}');
 IF NOT EXISTS(SELECT 1 FROM public.crm_google_queue WHERE lead_id=test_id AND state='pending') THEN RAISE EXCEPTION 'insert not queued'; END IF;
 UPDATE public.leads SET name='Updated rollback test' WHERE id=test_id;
 SELECT revision INTO revision_before FROM public.crm_google_queue WHERE lead_id=test_id;
 IF (SELECT priority FROM public.crm_google_queue WHERE lead_id=test_id)<>0 THEN RAISE EXCEPTION 'new changes not prioritized'; END IF;
 IF revision_before<>2 THEN RAISE EXCEPTION 'update not queued'; END IF;
 SELECT count(*) INTO webhook_count FROM public.crm_max_outbox;
 UPDATE public.leads SET google_contact_id='people/test' WHERE id=test_id;
 IF (SELECT revision FROM public.crm_google_queue WHERE lead_id=test_id)<>revision_before THEN RAISE EXCEPTION 'recursive sync'; END IF;
 IF (SELECT count(*) FROM public.crm_max_outbox)<>webhook_count THEN RAISE EXCEPTION 'contact ID update woke MAX'; END IF;
 UPDATE public.crm_google_settings SET enabled=true,refresh_token_encrypted='test';
 IF NOT public.crm_google_claim('11111111-1111-1111-1111-111111111111') OR public.crm_google_claim('22222222-2222-2222-2222-222222222222') THEN RAISE EXCEPTION 'concurrency lease failed'; END IF;
 PERFORM public.crm_google_release('11111111-1111-1111-1111-111111111111');
 UPDATE public.crm_google_settings SET enabled=false;
 IF public.crm_google_claim('22222222-2222-2222-2222-222222222222') THEN RAISE EXCEPTION 'pause ignored'; END IF;
END $$;
ROLLBACK;
