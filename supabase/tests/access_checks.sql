-- Access checks for the RLS policies, the audit log, organizations, consent and QR secrets.
--
-- How to run: paste the whole file into the Supabase SQL Editor and click Run.
-- Needs the test accounts organizer@test.com and participant@test.com.
-- It creates its own events and organizations, so it does not depend on sample data
-- and does not break when sample event dates pass.
--
-- It signs in as each test user inside the database (plus a simulated admin and an
-- anonymous visitor), tries allowed and forbidden actions, then undoes every change
-- it made. If anything is wrong it stops with "FAIL: ...". If everything passes,
-- the result row says so.

do $$
declare
  p_id      uuid;
  o_id      uuid;
  p_claims  text;
  o_claims  text;
  a_claims  text;
  past_ev   uuid;  -- an event that already happened, used for the check-in
  open_ev   uuid;  -- a published event in the future, open for registration
  org_mine  uuid;  -- the participant's company
  org_other uuid;  -- some other company
  ci        uuid;
  r         uuid;
  n         int;
  passed    int := 0;
begin
  select id, json_build_object('sub', id, 'role', 'authenticated', 'app_metadata', raw_app_meta_data)::text
    into p_id, p_claims from auth.users where email = 'participant@test.com';
  select id, json_build_object('sub', id, 'role', 'authenticated', 'app_metadata', raw_app_meta_data)::text
    into o_id, o_claims from auth.users where email = 'organizer@test.com';
  -- A simulated admin: only the role in the claims matters for these checks.
  a_claims := json_build_object('sub', gen_random_uuid(), 'role', 'authenticated',
                                'app_metadata', json_build_object('role', 'admin'))::text;

  if p_id is null or o_id is null then
    raise exception 'FAIL: test accounts are missing (organizer@test.com, participant@test.com)';
  end if;

  begin  -- everything in this block is undone at the end
    -- ===== Setup, as the database owner =====
    insert into public.events (organizer_id, title, latitude, longitude, starts_at, ends_at, status)
      values (o_id, 'Access test: past event', 32.7, -97.1,
              now() - interval '2 hours', now() - interval '1 hour', 'published')
      returning id into past_ev;
    insert into public.events (organizer_id, title, latitude, longitude, starts_at, ends_at, status)
      values (o_id, 'Access test: open event', 32.7, -97.1,
              now() + interval '7 days', now() + interval '7 days 3 hours', 'published')
      returning id into open_ev;

    insert into public.organizations (name) values ('Access test company A') returning id into org_mine;
    insert into public.organizations (name) values ('Access test company B') returning id into org_other;
    update public.profiles set organization_id = org_mine where id = p_id;

    insert into public.check_ins (event_id, user_id, status, points_awarded)
      values (past_ev, p_id, 'accepted', 10)
      returning id into ci;
    insert into public.audit_log (action, outcome, actor_id) values ('test.setup', 'success', o_id);

    -- Audit log is append-only, even for the owner.
    begin
      update public.audit_log set outcome = 'failure' where action = 'test.setup';
      raise exception 'FAIL: audit_log row was updated';
    exception when raise_exception then
      if sqlerrm not like '%append-only%' then raise; end if;
    end;
    passed := passed + 1;

    -- Every event gets a QR secret automatically.
    select count(*) into n from public.event_qr_secrets where event_id in (past_ev, open_ev);
    if n <> 2 then raise exception 'FAIL: new events did not get a QR secret'; end if;
    passed := passed + 1;

    -- A check-in keeps the company it was made for, even if the volunteer changes company.
    select organization_id into r from public.check_ins where id = ci;
    if r is distinct from org_mine then raise exception 'FAIL: check-in did not copy the volunteer''s company'; end if;
    update public.profiles set organization_id = org_other where id = p_id;
    update public.check_ins set points_awarded = 10 where id = ci;
    update public.check_ins set organization_id = org_other where id = ci;
    select organization_id into r from public.check_ins where id = ci;
    if r is distinct from org_mine then raise exception 'FAIL: check-in company changed after it was created'; end if;
    update public.profiles set organization_id = org_mine where id = p_id;
    passed := passed + 1;

    -- ===== Participant =====
    perform set_config('request.jwt.claims', p_claims, true);
    set local role authenticated;

    select count(*) into n from public.events where id in (past_ev, open_ev);
    if n <> 2 then raise exception 'FAIL: participant cannot see published events (saw %)', n; end if;
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
      update public.profiles set organization_id = org_other where id = p_id;
      raise exception 'FAIL: participant changed their company';
    exception when insufficient_privilege then null;
    end;
    passed := passed + 1;

    begin
      update public.profiles set consent_version = '9.9', consent_accepted_at = now() where id = p_id;
      raise exception 'FAIL: participant changed their consent';
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
      insert into public.check_ins (event_id, user_id) values (open_ev, p_id);
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

    insert into public.event_registrations (event_id, user_id) values (open_ev, p_id);
    passed := passed + 1;

    begin
      insert into public.event_registrations (event_id, user_id) values (past_ev, p_id);
      raise exception 'FAIL: participant registered for an event that already ended';
    exception when insufficient_privilege then null;
    end;
    passed := passed + 1;

    begin
      insert into public.event_registrations (event_id, user_id) values (open_ev, o_id);
      raise exception 'FAIL: participant registered another user';
    exception when insufficient_privilege then null;
    end;
    passed := passed + 1;

    select count(*) into n from public.audit_log;
    if n <> 0 then raise exception 'FAIL: participant can read the audit log'; end if;
    passed := passed + 1;

    select count(*) into n from public.organizations;
    if n <> 1 then raise exception 'FAIL: participant sees % companies, expected only their own', n; end if;
    passed := passed + 1;

    begin
      insert into public.organizations (name) values ('Participant-made company');
      raise exception 'FAIL: participant created a company';
    exception when insufficient_privilege then null;
    end;
    passed := passed + 1;

    begin
      select count(*) into n from public.event_qr_secrets;
      raise exception 'FAIL: participant can read QR secrets';
    exception when insufficient_privilege then null;
    end;
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

    select count(*) into n from public.check_ins where event_id = past_ev;
    if n <> 1 then raise exception 'FAIL: organizer cannot see check-ins for their own event'; end if;
    passed := passed + 1;

    select count(*) into n from public.profiles where id = p_id;
    if n <> 1 then raise exception 'FAIL: organizer cannot see their attendee''s profile'; end if;
    passed := passed + 1;

    begin
      update public.check_ins set points_awarded = 999 where event_id = past_ev;
      raise exception 'FAIL: organizer changed points directly';
    exception when insufficient_privilege then null;
    end;
    passed := passed + 1;

    select count(*) into n from public.audit_log;
    if n <> 0 then raise exception 'FAIL: organizer can read the audit log'; end if;
    passed := passed + 1;

    begin
      insert into public.organizations (name) values ('Organizer-made company');
      raise exception 'FAIL: organizer created a company';
    exception when insufficient_privilege then null;
    end;
    passed := passed + 1;

    begin
      select count(*) into n from public.event_qr_secrets;
      raise exception 'FAIL: organizer can read QR secrets from the browser';
    exception when insufficient_privilege then null;
    end;
    passed := passed + 1;

    reset role;

    -- ===== Admin (simulated) =====
    perform set_config('request.jwt.claims', a_claims, true);
    set local role authenticated;

    select count(*) into n from public.organizations where id in (org_mine, org_other);
    if n <> 2 then raise exception 'FAIL: admin cannot see all companies'; end if;
    passed := passed + 1;

    insert into public.organizations (name) values ('Admin-made company');
    passed := passed + 1;

    begin
      select count(*) into n from public.event_qr_secrets;
      raise exception 'FAIL: admin can read QR secrets from the browser';
    exception when insufficient_privilege then null;
    end;
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

    begin
      select count(*) into n from public.organizations;
      raise exception 'FAIL: anonymous visitor can read companies';
    exception when insufficient_privilege then null;
    end;
    passed := passed + 1;

    begin
      select count(*) into n from public.event_qr_secrets;
      raise exception 'FAIL: anonymous visitor can read QR secrets';
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