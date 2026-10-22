-- Access checks for the RLS policies and the audit log.
--
-- How to run: paste the whole file into the Supabase SQL Editor and click Run.
-- Needs the test accounts (organizer@test.com, participant@test.com) and the
-- sample events from the test-data script.
--
-- It signs in as each test user inside the database, tries allowed and
-- forbidden actions, then undoes every change it made. If anything is wrong it
-- stops with "FAIL: ...". If everything passes, the result row says so.

do $$
declare
  p_id     uuid;
  o_id     uuid;
  p_claims text;
  o_claims text;
  cleanup  uuid;
  health   uuid;
  n        int;
  passed   int := 0;
begin
  select id, json_build_object('sub', id, 'role', 'authenticated', 'app_metadata', raw_app_meta_data)::text
    into p_id, p_claims from auth.users where email = 'participant@test.com';
  select id, json_build_object('sub', id, 'role', 'authenticated', 'app_metadata', raw_app_meta_data)::text
    into o_id, o_claims from auth.users where email = 'organizer@test.com';
  select id into cleanup from public.events where title = 'Campus Cleanup';
  select id into health  from public.events where title = 'Health Fair Volunteering';

  if p_id is null or o_id is null or cleanup is null or health is null then
    raise exception 'FAIL: test accounts or sample events are missing; run the test-data script first';
  end if;

  begin  -- everything in this block is undone at the end
    -- Setup, as the database owner: one check-in and one audit entry.
    insert into public.check_ins (event_id, user_id, status, points_awarded)
      values (cleanup, p_id, 'accepted', 10);
    insert into public.audit_log (action, outcome, actor_id) values ('test.setup', 'success', o_id);

    -- Audit log is append-only, even for the owner.
    begin
      update public.audit_log set outcome = 'failure' where action = 'test.setup';
      raise exception 'FAIL: audit_log row was updated';
    exception when raise_exception then
      if sqlerrm not like '%append-only%' then raise; end if;
    end;
    passed := passed + 1;

    -- ===== Participant =====
    perform set_config('request.jwt.claims', p_claims, true);
    set local role authenticated;

    select count(*) into n from public.events;
    if n < 2 then raise exception 'FAIL: participant cannot see published events (saw %)', n; end if;
    passed := passed + 1;

    select count(*) into n from public.profiles;
    if n <> 1 then raise exception 'FAIL: participant sees % profiles, expected only their own', n; end if;
    passed := passed + 1;

    update public.profiles set display_name = 'Test Participant' where id = p_id;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'FAIL: participant cannot update own display name'; end if;
    passed := passed + 1;

    begin
      update public.profiles set id = gen_random_uuid() where id = p_id;
      raise exception 'FAIL: participant changed their profile id';
    exception when insufficient_privilege then null;
    end;
    passed := passed + 1;

    begin
      insert into public.events (organizer_id, title, latitude, longitude, starts_at, ends_at)
        values (p_id, 'Fake event', 32.7, -97.1, now(), now() + interval '1 hour');
      raise exception 'FAIL: participant created an event';
    exception when insufficient_privilege then null;
    end;
    passed := passed + 1;

    begin
      insert into public.check_ins (event_id, user_id) values (health, p_id);
      raise exception 'FAIL: participant inserted a check-in directly';
    exception when insufficient_privilege then null;
    end;
    passed := passed + 1;

    begin
      update public.check_ins set points_awarded = 999 where user_id = p_id;
      raise exception 'FAIL: participant changed their points';
    exception when insufficient_privilege then null;
    end;
    passed := passed + 1;

    select count(*) into n from public.check_ins;
    if n <> 1 then raise exception 'FAIL: participant sees % check-ins, expected 1 (their own)', n; end if;
    passed := passed + 1;

    insert into public.event_registrations (event_id, user_id) values (health, p_id);
    passed := passed + 1;

    begin
      insert into public.event_registrations (event_id, user_id) values (health, o_id);
      raise exception 'FAIL: participant registered another user';
    exception when insufficient_privilege then null;
    end;
    passed := passed + 1;

    select count(*) into n from public.audit_log;
    if n <> 0 then raise exception 'FAIL: participant can read the audit log'; end if;
    passed := passed + 1;

    reset role;

    -- ===== Organizer =====
    perform set_config('request.jwt.claims', o_claims, true);
    set local role authenticated;

    insert into public.events (organizer_id, title, latitude, longitude, starts_at, ends_at)
      values (o_id, 'Organizer test event', 32.7, -97.1, now(), now() + interval '1 hour');
    passed := passed + 1;

    begin
      insert into public.events (organizer_id, title, latitude, longitude, starts_at, ends_at)
        values (p_id, 'Event in someone else''s name', 32.7, -97.1, now(), now() + interval '1 hour');
      raise exception 'FAIL: organizer created an event owned by another user';
    exception when insufficient_privilege then null;
    end;
    passed := passed + 1;

    select count(*) into n from public.check_ins where event_id = cleanup;
    if n <> 1 then raise exception 'FAIL: organizer cannot see check-ins for their own event'; end if;
    passed := passed + 1;

    select count(*) into n from public.profiles where id = p_id;
    if n <> 1 then raise exception 'FAIL: organizer cannot see their attendee''s profile'; end if;
    passed := passed + 1;

    begin
      update public.check_ins set points_awarded = 999 where event_id = cleanup;
      raise exception 'FAIL: organizer changed points directly';
    exception when insufficient_privilege then null;
    end;
    passed := passed + 1;

    select count(*) into n from public.audit_log;
    if n <> 0 then raise exception 'FAIL: organizer can read the audit log'; end if;
    passed := passed + 1;

    reset role;

    -- ===== Anonymous visitor =====
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    set local role anon;
    begin
      select count(*) into n from public.events;
      raise exception 'FAIL: anonymous visitor can read events';
    exception when insufficient_privilege then null;
    end;
    passed := passed + 1;
    reset role;

    raise exception using errcode = 'P0099', message = 'undo test changes';
  exception when sqlstate 'P0099' then
    null;  -- all test changes are rolled back here
  end;

  raise notice 'All % access checks passed', passed;
  perform set_config('test.passed', passed::text, false);
end;
$$;

select 'All ' || current_setting('test.passed') || ' access checks passed' as result;