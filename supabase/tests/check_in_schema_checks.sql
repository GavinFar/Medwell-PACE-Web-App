-- Checks for organizations, per-event QR secrets and the new check-in columns.
--
-- How to run: paste the whole file into the Supabase SQL Editor and click Run.
-- Needs the test accounts (organizer@test.com, participant@test.com).
-- Admin access is tested with made-up admin claims, so no admin account is needed.
-- Every change it makes is undone at the end.
-- If anything is wrong it stops with "FAIL: ...".

do $$
declare
  p_id        uuid;
  o_id        uuid;
  p_claims    text;
  o_claims    text;
  a_claims    text;
  org_a       uuid;
  org_b       uuid;
  ev_id       uuid;
  ev2_id      uuid;
  ci_id       uuid;
  s1          text;
  s2          text;
  n           int;
  passed      int := 0;
begin
  select id, json_build_object('sub', id, 'role', 'authenticated', 'app_metadata', raw_app_meta_data)::text
    into p_id, p_claims from auth.users where email = 'participant@test.com';
  select id, json_build_object('sub', id, 'role', 'authenticated', 'app_metadata', raw_app_meta_data)::text
    into o_id, o_claims from auth.users where email = 'organizer@test.com';
  -- The organizer's account, but with admin claims.
  a_claims := json_build_object('sub', o_id, 'role', 'authenticated', 'app_metadata', json_build_object('role', 'admin'))::text;

  if p_id is null or o_id is null then
    raise exception 'FAIL: test accounts are missing';
  end if;

  begin  -- everything in this block is undone at the end

    -- ===== Organizations: only admins create them =====
    perform set_config('request.jwt.claims', p_claims, true);
    set local role authenticated;
    begin
      insert into public.organizations (name) values ('Sneaky Corp');
      raise exception 'FAIL: a participant created an organization';
    exception when insufficient_privilege then null;
    end;
    reset role;
    passed := passed + 1;

    perform set_config('request.jwt.claims', a_claims, true);
    set local role authenticated;
    insert into public.organizations (name) values ('Test Company A') returning id into org_a;
    insert into public.organizations (name) values ('Test Company B') returning id into org_b;
    select count(*) into n from public.organizations where id in (org_a, org_b);
    if n <> 2 then raise exception 'FAIL: admin sees % of the 2 test organizations', n; end if;
    reset role;
    passed := passed + 1;

    begin
      insert into public.organizations (name) values ('Test Company A');
      raise exception 'FAIL: two organizations with the same name were allowed';
    exception when unique_violation then null;
    end;
    passed := passed + 1;

    -- ===== Members see their own organization, not others =====
    update public.profiles set organization_id = org_a where id = p_id;

    perform set_config('request.jwt.claims', p_claims, true);
    set local role authenticated;
    select count(*) into n from public.organizations where id = org_a;
    if n <> 1 then raise exception 'FAIL: participant cannot see their own organization'; end if;
    select count(*) into n from public.organizations where id = org_b;
    if n <> 0 then raise exception 'FAIL: participant can see an organization they do not belong to'; end if;
    passed := passed + 1;

    -- ===== Volunteers cannot change their own organization =====
    begin
      update public.profiles set organization_id = org_b where id = p_id;
      raise exception 'FAIL: participant changed their own organization';
    exception when insufficient_privilege then null;
    end;
    reset role;
    passed := passed + 1;

    -- ===== Every new event gets its own QR secret automatically =====
    perform set_config('request.jwt.claims', o_claims, true);
    set local role authenticated;
    insert into public.events (organizer_id, title, latitude, longitude, starts_at, ends_at)
      values (o_id, 'Secret Test Event 1', 32.7, -97.1, now(), now() + interval '1 hour')
      returning id into ev_id;
    insert into public.events (organizer_id, title, latitude, longitude, starts_at, ends_at)
      values (o_id, 'Secret Test Event 2', 32.7, -97.1, now(), now() + interval '1 hour')
      returning id into ev2_id;
    reset role;

    select secret into s1 from public.event_qr_secrets where event_id = ev_id;
    select secret into s2 from public.event_qr_secrets where event_id = ev2_id;
    if s1 is null or s2 is null then raise exception 'FAIL: a new event did not get a QR secret'; end if;
    if s1 !~ '^[0-9a-f]{64}$' then raise exception 'FAIL: QR secret is not 64 hex characters'; end if;
    if s1 = s2 then raise exception 'FAIL: two events got the same QR secret'; end if;
    passed := passed + 1;

    -- ===== Nobody can read the secrets from the browser, not even the event's organizer =====
    perform set_config('request.jwt.claims', o_claims, true);
    set local role authenticated;
    begin
      perform 1 from public.event_qr_secrets where event_id = ev_id;
      raise exception 'FAIL: the organizer can read the QR secret';
    exception when insufficient_privilege then null;
    end;
    reset role;

    perform set_config('request.jwt.claims', a_claims, true);
    set local role authenticated;
    begin
      perform 1 from public.event_qr_secrets where event_id = ev_id;
      raise exception 'FAIL: an admin can read the QR secret from the browser';
    exception when insufficient_privilege then null;
    end;
    reset role;

    set local role anon;
    begin
      perform 1 from public.event_qr_secrets;
      raise exception 'FAIL: anonymous visitors can read QR secrets';
    exception when insufficient_privilege then null;
    end;
    reset role;
    passed := passed + 1;

    -- ===== Check-ins record how they were verified =====
    insert into public.check_ins (event_id, user_id) values (ev_id, p_id) returning id into ci_id;
    if (select verification_method from public.check_ins where id = ci_id) <> 'qr' then
      raise exception 'FAIL: verification method does not default to qr';
    end if;
    begin
      insert into public.check_ins (event_id, user_id, verification_method) values (ev2_id, p_id, 'honor_system');
      raise exception 'FAIL: an unknown verification method was accepted';
    exception when check_violation then null;
    end;
    passed := passed + 1;

    -- ===== Check-ins keep the company the volunteer had at the time =====
    if (select organization_id from public.check_ins where id = ci_id) is distinct from org_a then
      raise exception 'FAIL: check-in did not record the volunteer''s organization';
    end if;
    update public.profiles set organization_id = org_b where id = p_id;
    if (select organization_id from public.check_ins where id = ci_id) is distinct from org_a then
      raise exception 'FAIL: changing companies rewrote an old check-in';
    end if;
    passed := passed + 1;

    -- The organization always comes from the profile, never from whoever inserts the row.
    insert into public.check_ins (event_id, user_id, organization_id) values (ev2_id, p_id, org_a)
      returning id into ci_id;
    if (select organization_id from public.check_ins where id = ci_id) is distinct from org_b then
      raise exception 'FAIL: a check-in was saved with an organization the volunteer does not belong to';
    end if;
    passed := passed + 1;

    -- ===== A company with check-ins cannot be deleted (it would erase report history) =====
    begin
      delete from public.organizations where id = org_a;
      raise exception 'FAIL: an organization with check-ins was deleted';
    exception when foreign_key_violation then null;
    end;
    passed := passed + 1;

    raise exception using errcode = 'P0099', message = 'undo test changes';
  exception when sqlstate 'P0099' then
    null;
  end;

  perform set_config('test.passed', passed::text, false);
end;
$$;

select 'All ' || current_setting('test.passed') || ' check-in schema checks passed' as result;
