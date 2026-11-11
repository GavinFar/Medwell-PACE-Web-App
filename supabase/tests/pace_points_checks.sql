-- Checks for the PACE points ledger, awards, reversals and access rules.
--
-- How to run: paste the whole file into the Supabase SQL Editor and click Run.
-- Needs the test accounts (organizer@test.com, participant@test.com) and the
-- "Campus Cleanup" sample event. Every change it makes is undone at the end.
-- If anything is wrong it stops with "FAIL: ...".

do $$
declare
  p_id      uuid;
  o_id      uuid;
  p_claims  text;
  o_claims  text;
  event_id  uuid;
  ci_id     uuid;
  award_id  uuid;
  n         int;
  b         bigint;
  passed    int := 0;
begin
  select id, json_build_object('sub', id, 'role', 'authenticated', 'app_metadata', raw_app_meta_data)::text
    into p_id, p_claims from auth.users where email = 'participant@test.com';
  select id, json_build_object('sub', id, 'role', 'authenticated', 'app_metadata', raw_app_meta_data)::text
    into o_id, o_claims from auth.users where email = 'organizer@test.com';
  select id into event_id from public.events where title = 'Campus Cleanup';

  if p_id is null or o_id is null or event_id is null then
    raise exception 'FAIL: test accounts or the Campus Cleanup event are missing';
  end if;

  begin  -- everything in this block is undone at the end
    -- Setup: a fresh accepted check-in and one scoring rule.
    delete from public.check_ins where user_id = p_id;
    insert into public.check_ins (event_id, user_id, status) values (event_id, p_id, 'accepted')
      returning id into ci_id;
    insert into public.pace_scoring_rules (activity_type, points) values ('test_activity', 5);

    -- Award once: points recorded in the ledger, on the check-in and in the audit log.
    n := public.award_pace_event_points(ci_id);
    if n <= 0 then raise exception 'FAIL: award returned % points', n; end if;
    select id into award_id from public.pace_points_ledger where check_in_id = ci_id;
    if award_id is null then raise exception 'FAIL: no ledger row for the award'; end if;
    if (select points_awarded from public.check_ins where id = ci_id) <> n then
      raise exception 'FAIL: check-in does not show the awarded points';
    end if;
    if not exists (select 1 from public.audit_log where action = 'points.award' and target_id = ci_id::text) then
      raise exception 'FAIL: award was not written to the audit log';
    end if;
    passed := passed + 1;

    -- Award twice: blocked.
    begin
      perform public.award_pace_event_points(ci_id);
      raise exception 'FAIL: points were awarded twice';
    exception when raise_exception then
      if sqlerrm like 'FAIL%' then raise; end if;
    end;
    passed := passed + 1;

    -- Ledger rows cannot be edited.
    begin
      update public.pace_points_ledger set points = 999 where id = award_id;
      raise exception 'FAIL: a ledger row was edited';
    exception when raise_exception then
      if sqlerrm like 'FAIL%' then raise; end if;
    end;
    passed := passed + 1;

    -- ===== Participant =====
    perform set_config('request.jwt.claims', p_claims, true);
    set local role authenticated;

    select count(*) into n from public.pace_points_ledger;
    if n <> 1 then raise exception 'FAIL: participant sees % ledger rows, expected their own 1', n; end if;
    passed := passed + 1;

    b := public.get_pace_points_balance(p_id);
    if b <= 0 then raise exception 'FAIL: participant cannot see their balance'; end if;
    passed := passed + 1;

    select count(*) into n from public.pace_scoring_rules where activity_type = 'test_activity';
    if n <> 1 then raise exception 'FAIL: participant cannot read scoring rules'; end if;
    passed := passed + 1;

    begin
      insert into public.pace_points_ledger (user_id, activity_type, idempotency_key, points)
        values (p_id, 'free_points', 'hack', 1000);
      raise exception 'FAIL: participant wrote to the ledger';
    exception when insufficient_privilege then null;
    end;
    passed := passed + 1;

    begin
      perform public.award_pace_event_points(ci_id);
      raise exception 'FAIL: participant called the award function';
    exception when insufficient_privilege then null;
    end;
    passed := passed + 1;

    reset role;

    -- ===== Organizer (not admin): sees no one's ledger rows =====
    perform set_config('request.jwt.claims', o_claims, true);
    set local role authenticated;
    select count(*) into n from public.pace_points_ledger;
    if n <> 0 then raise exception 'FAIL: organizer can read participants'' ledger rows'; end if;
    b := public.get_pace_points_balance(p_id);
    if b <> 0 then raise exception 'FAIL: organizer can read another user''s balance'; end if;
    passed := passed + 1;
    reset role;

    -- ===== Reversal =====
    begin
      perform public.reverse_pace_points(award_id, 'no actor', null);
      raise exception 'FAIL: reversal without a recorded person was allowed';
    exception when raise_exception then
      if sqlerrm like 'FAIL%' then raise; end if;
    end;
    passed := passed + 1;

    perform public.reverse_pace_points(award_id, 'Test reversal', o_id);
    if public.get_pace_points_balance(p_id) <> 0 then raise exception 'FAIL: balance is not 0 after reversal'; end if;
    if (select points_awarded from public.check_ins where id = ci_id) <> 0 then
      raise exception 'FAIL: check-in still shows points after reversal';
    end if;
    if not exists (select 1 from public.audit_log where action = 'points.reverse' and actor_id = o_id) then
      raise exception 'FAIL: reversal was not written to the audit log';
    end if;
    passed := passed + 1;

    begin
      perform public.reverse_pace_points(award_id, 'again', o_id);
      raise exception 'FAIL: an award was reversed twice';
    exception when raise_exception then
      if sqlerrm like 'FAIL%' then raise; end if;
    end;
    passed := passed + 1;

    -- ===== Account deletion keeps the ledger but removes the link to the person =====
    delete from public.profiles where id = p_id;
    select count(*) into n from public.pace_points_ledger where user_id is null and reverses_entry_id = award_id;
    if n <> 1 then raise exception 'FAIL: ledger rows were not kept anonymously after deleting the user'; end if;
    passed := passed + 1;

    raise exception using errcode = 'P0099', message = 'undo test changes';
  exception when sqlstate 'P0099' then
    null;
  end;

  perform set_config('test.passed', passed::text, false);
end;
$$;

select 'All ' || current_setting('test.passed') || ' points checks passed' as result;