-- Consent checks for profiles.consent_version / consent_accepted_at.
--
-- How to run: paste the whole file into the Supabase SQL Editor and click Run.
-- It creates temporary test accounts, checks how consent is saved and who can
-- change it, then undoes every change. If anything is wrong it stops with
-- "FAIL: ...". If everything passes, the result row says so.

do $$
declare
  a_id     uuid := gen_random_uuid();  -- signs up with consent
  b_id     uuid := gen_random_uuid();  -- signs up without consent
  c_id     uuid := gen_random_uuid();  -- sends a bad version and a fake time
  a_claims text;
  b_claims text;
  r        record;
  n        int;
  passed   int := 0;
begin
  begin  -- everything in this block is undone at the end
    insert into auth.users (id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
    values
      (a_id, 'authenticated', 'authenticated', 'consent-a-' || a_id || '@test.com',
       '{"display_name":"A","consent_version":"1.0"}', '{"role":"participant"}', now(), now()),
      (b_id, 'authenticated', 'authenticated', 'consent-b-' || b_id || '@test.com',
       '{"display_name":"B"}', '{"role":"participant"}', now(), now()),
      (c_id, 'authenticated', 'authenticated', 'consent-c-' || c_id || '@test.com',
       '{"consent_version":"<script>","consent_accepted_at":"2000-01-01"}', '{"role":"participant"}', now(), now());

    a_claims := json_build_object('sub', a_id, 'role', 'authenticated', 'app_metadata', json_build_object('role', 'participant'))::text;
    b_claims := json_build_object('sub', b_id, 'role', 'authenticated', 'app_metadata', json_build_object('role', 'participant'))::text;

    -- 1. Consent sent at sign-up is saved, with the database's time.
    select consent_version, consent_accepted_at into r from public.profiles where id = a_id;
    if r.consent_version is distinct from '1.0' or r.consent_accepted_at is null
       or r.consent_accepted_at < now() - interval '1 minute' then
      raise exception 'FAIL: consent from sign-up was not saved correctly';
    end if;
    passed := passed + 1;

    -- 2. No consent at sign-up: both columns stay empty.
    select consent_version, consent_accepted_at into r from public.profiles where id = b_id;
    if r.consent_version is not null or r.consent_accepted_at is not null then
      raise exception 'FAIL: consent recorded for a user who did not send it';
    end if;
    passed := passed + 1;

    -- 3. A bad version string is ignored, and a time sent by the browser is never used.
    select consent_version, consent_accepted_at into r from public.profiles where id = c_id;
    if r.consent_version is not null or r.consent_accepted_at is not null then
      raise exception 'FAIL: bad consent version or browser-supplied time was saved';
    end if;
    passed := passed + 1;

    -- 4. Version without a time (or the reverse) is rejected.
    begin
      update public.profiles set consent_accepted_at = null where id = a_id;
      raise exception 'FAIL: consent version saved without a time';
    exception when check_violation then null;
    end;
    passed := passed + 1;

    -- ===== Participant A =====
    perform set_config('request.jwt.claims', a_claims, true);
    set local role authenticated;

    -- 5. Can read their own consent.
    select count(*) into n from public.profiles where id = a_id and consent_version = '1.0';
    if n <> 1 then raise exception 'FAIL: user cannot see their own consent'; end if;
    passed := passed + 1;

    -- 6. Cannot change their consent version.
    begin
      update public.profiles set consent_version = '9.9' where id = a_id;
      raise exception 'FAIL: user changed their consent version';
    exception when insufficient_privilege then null;
    end;
    passed := passed + 1;

    -- 7. Cannot change their consent time.
    begin
      update public.profiles set consent_accepted_at = now() - interval '1 year' where id = a_id;
      raise exception 'FAIL: user changed their consent time';
    exception when insufficient_privilege then null;
    end;
    passed := passed + 1;

    -- 8. Can still change their display name.
    update public.profiles set display_name = 'A renamed' where id = a_id;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'FAIL: user can no longer update their display name'; end if;
    passed := passed + 1;

    reset role;

    -- ===== Participant B =====
    perform set_config('request.jwt.claims', b_claims, true);
    set local role authenticated;

    -- 9. Cannot see another user's consent.
    select count(*) into n from public.profiles where id = a_id;
    if n <> 0 then raise exception 'FAIL: user can see another user''s profile and consent'; end if;
    passed := passed + 1;

    reset role;

    raise exception using errcode = 'P0099', message = 'undo test changes';
  exception when sqlstate 'P0099' then
    null;  -- all test changes are rolled back here
  end;

  raise notice 'All % consent checks passed', passed;
  perform set_config('test.passed', passed::text, false);
end;
$$;

select 'All ' || current_setting('test.passed') || ' consent checks passed' as result;