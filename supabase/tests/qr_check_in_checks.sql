-- Checks for record_qr_check_in: one check-in and its points, in one transaction.
--
-- How to run: paste the whole file into the Supabase SQL Editor and click Run.
-- Needs the test accounts (organizer@test.com, participant@test.com).
-- Every change it makes is undone at the end.
-- If anything is wrong it stops with "FAIL: ...".

do $$
declare
  p_id        uuid;
  o_id        uuid;
  p_claims    text;
  ev_open     uuid;
  ev_draft    uuid;
  ev_future   uuid;
  ev_past     uuid;
  ev_free     uuid;
  r           record;
  r2          record;
  before_bal  bigint;
  n           int;
  passed      int := 0;
begin
  select id, json_build_object('sub', id, 'role', 'authenticated', 'app_metadata', raw_app_meta_data)::text
    into p_id, p_claims from auth.users where email = 'participant@test.com';
  select id into o_id from auth.users where email = 'organizer@test.com';

  if p_id is null or o_id is null then
    raise exception 'FAIL: test accounts are missing';
  end if;

  begin  -- everything in this block is undone at the end

    insert into public.events (organizer_id, title, latitude, longitude, starts_at, ends_at, points, status)
      values (o_id, 'QR Test Open', 32.73, -97.11, now() - interval '1 hour', now() + interval '1 hour', 10, 'published')
      returning id into ev_open;
    insert into public.events (organizer_id, title, latitude, longitude, starts_at, ends_at, points, status)
      values (o_id, 'QR Test Draft', 32.73, -97.11, now() - interval '1 hour', now() + interval '1 hour', 10, 'draft')
      returning id into ev_draft;
    insert into public.events (organizer_id, title, latitude, longitude, starts_at, ends_at, points, status)
      values (o_id, 'QR Test Future', 32.73, -97.11, now() + interval '1 hour', now() + interval '2 hours', 10, 'published')
      returning id into ev_future;
    insert into public.events (organizer_id, title, latitude, longitude, starts_at, ends_at, points, status)
      values (o_id, 'QR Test Past', 32.73, -97.11, now() - interval '3 hours', now() - interval '1 hour', 10, 'published')
      returning id into ev_past;
    insert into public.events (organizer_id, title, latitude, longitude, starts_at, ends_at, points, status)
      values (o_id, 'QR Test No Points', 32.73, -97.11, now() - interval '1 hour', now() + interval '1 hour', 0, 'published')
      returning id into ev_free;

    before_bal := public.get_pace_points_balance(p_id);

    -- ===== 1. The first check-in is saved and earns the event's points once =====
    set local role service_role;
    select * into r from public.record_qr_check_in(p_id, ev_open, 42.5, 12.3, 'low_accuracy');
    reset role;
    if r.check_in_id is null then raise exception 'FAIL: no check-in id returned'; end if;
    if r.already_checked_in then raise exception 'FAIL: a first check-in was reported as already checked in'; end if;
    if r.points_awarded <> 10 then raise exception 'FAIL: first check-in awarded % points, expected 10', r.points_awarded; end if;
    if r.total_points <> before_bal + 10 then
      raise exception 'FAIL: total is %, expected %', r.total_points, before_bal + 10;
    end if;
    if r.checked_in_at is null then raise exception 'FAIL: no check-in time returned'; end if;
    select count(*) into n from public.pace_points_ledger where check_in_id = r.check_in_id;
    if n <> 1 then raise exception 'FAIL: % ledger rows for one check-in, expected 1', n; end if;
    passed := passed + 1;

    -- ===== 2. Checking in again changes nothing and returns the first check-in =====
    set local role service_role;
    select * into r2 from public.record_qr_check_in(p_id, ev_open, null, null, 'no_location');
    reset role;
    if not r2.already_checked_in then raise exception 'FAIL: a second check-in was not reported as already checked in'; end if;
    if r2.check_in_id <> r.check_in_id then raise exception 'FAIL: a second check-in returned a different id'; end if;
    if r2.points_awarded <> 10 then raise exception 'FAIL: a repeat check-in reported % points, expected the original 10', r2.points_awarded; end if;
    select count(*) into n from public.pace_points_ledger where check_in_id = r.check_in_id;
    if n <> 1 then raise exception 'FAIL: % ledger rows after checking in twice, expected 1', n; end if;
    select count(*) into n from public.check_ins where user_id = p_id and event_id = ev_open;
    if n <> 1 then raise exception 'FAIL: % check-ins after checking in twice, expected 1', n; end if;
    passed := passed + 1;

    -- ===== 3. Distance, accuracy, flag and method are stored; status stays accepted =====
    select * into r2 from public.check_ins where id = r.check_in_id;
    if r2.distance_m <> 42.5 or r2.accuracy_m <> 12.3 then
      raise exception 'FAIL: stored distance/accuracy are %/%, expected 42.5/12.3', r2.distance_m, r2.accuracy_m;
    end if;
    if r2.flag_reason is distinct from 'low_accuracy' then
      raise exception 'FAIL: stored flag_reason is %, expected low_accuracy (and not overwritten by the repeat)', r2.flag_reason;
    end if;
    if r2.verification_method <> 'qr' then raise exception 'FAIL: verification method is %', r2.verification_method; end if;
    if r2.status <> 'accepted' then raise exception 'FAIL: status is %, expected accepted', r2.status; end if;
    passed := passed + 1;

    -- ===== 4. Only published events that are running accept check-ins =====
    set local role service_role;
    begin
      perform public.record_qr_check_in(p_id, ev_draft, null, null, 'no_location');
      raise exception 'FAIL: a draft event accepted a check-in';
    exception when sqlstate 'PC001' then null;
    end;
    begin
      perform public.record_qr_check_in(p_id, ev_future, null, null, 'no_location');
      raise exception 'FAIL: an event that has not started accepted a check-in';
    exception when sqlstate 'PC001' then null;
    end;
    begin
      perform public.record_qr_check_in(p_id, ev_past, null, null, 'no_location');
      raise exception 'FAIL: an event that has ended accepted a check-in';
    exception when sqlstate 'PC001' then null;
    end;
    begin
      perform public.record_qr_check_in(p_id, gen_random_uuid(), null, null, 'no_location');
      raise exception 'FAIL: a missing event accepted a check-in';
    exception when sqlstate 'PC001' then null;
    end;
    reset role;
    select count(*) into n from public.check_ins where user_id = p_id and event_id in (ev_draft, ev_future, ev_past);
    if n <> 0 then raise exception 'FAIL: a refused check-in left a row behind'; end if;
    passed := passed + 1;

    -- ===== 5. Unknown flag reasons are refused =====
    set local role service_role;
    begin
      perform public.record_qr_check_in(p_id, ev_free, null, null, 'whatever');
      raise exception 'FAIL: an unknown flag reason was accepted';
    exception when sqlstate 'PC002' then null;
    end;
    reset role;
    passed := passed + 1;

    -- ===== 6. An event worth 0 points records the check-in with no ledger row =====
    set local role service_role;
    select * into r from public.record_qr_check_in(p_id, ev_free, 10, 5, null);
    reset role;
    if r.already_checked_in or r.points_awarded <> 0 then
      raise exception 'FAIL: 0-point event returned already=% points=%', r.already_checked_in, r.points_awarded;
    end if;
    select count(*) into n from public.pace_points_ledger where check_in_id = r.check_in_id;
    if n <> 0 then raise exception 'FAIL: a 0-point event wrote a ledger row'; end if;
    if (select flag_reason from public.check_ins where id = r.check_in_id) is not null then
      raise exception 'FAIL: a null flag reason was not stored as null';
    end if;
    passed := passed + 1;

    -- ===== 7. Browsers can't call it, signed in or not =====
    perform set_config('request.jwt.claims', p_claims, true);
    set local role authenticated;
    begin
      perform public.record_qr_check_in(p_id, ev_open, 0, 0, null);
      raise exception 'FAIL: a signed-in user called record_qr_check_in';
    exception when insufficient_privilege then null;
    end;
    reset role;
    set local role anon;
    begin
      perform public.record_qr_check_in(p_id, ev_open, 0, 0, null);
      raise exception 'FAIL: an anonymous visitor called record_qr_check_in';
    exception when insufficient_privilege then null;
    end;
    reset role;
    passed := passed + 1;

    raise exception using errcode = 'P0099', message = 'undo test changes';
  exception when sqlstate 'P0099' then
    null;
  end;

  perform set_config('test.passed', passed::text, false);
end;
$$;

select 'All ' || current_setting('test.passed') || ' QR check-in checks passed' as result;
