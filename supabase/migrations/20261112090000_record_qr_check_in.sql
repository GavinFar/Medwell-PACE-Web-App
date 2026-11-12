-- record_qr_check_in: saves a volunteer's QR check-in and awards its points in one transaction.
--
-- What this adds
--   record_qr_check_in(user, event, distance, accuracy, flag_reason)
--     Called only by the server (service-role key), from the checkIn Server Action, after the
--     server has checked the QR pass and worked out the distance. It:
--       1. checks again that the event is published and running (the event could have ended
--          while the volunteer was logging in);
--       2. inserts the check-in (verification_method 'qr'; the company is copied from the
--          profile by the existing check_ins_set_organization trigger);
--       3. awards the event's points with the existing award_pace_event_points, which writes
--          the ledger row, check_ins.points_awarded and an audit row;
--       4. returns the check-in, the points and the volunteer's new total.
--     If the volunteer already checked in to this event (a double tap, two tabs, a rescan),
--     it changes nothing and returns the existing check-in with already_checked_in = true.
--     The UNIQUE (user_id, event_id) constraint on check_ins guarantees one per event.
--
--   Only the distance and the GPS accuracy are stored, never coordinates. A check-in is
--   always 'accepted'; flag_reason only marks it for review (an admin can reverse points).
--
-- Errors
--   PC001 event_not_open   the event is missing, not published, or not running right now
--   PC002 bad_flag_reason  flag_reason isn't no_location, outside_radius, low_accuracy or null
--
-- Run test: supabase/tests/qr_check_in_checks.sql

create function public.record_qr_check_in(
  p_user_id     uuid,
  p_event_id    uuid,
  p_distance_m  numeric,
  p_accuracy_m  numeric,
  p_flag_reason text
)
returns table (
  check_in_id        uuid,
  already_checked_in boolean,
  checked_in_at      timestamptz,
  points_awarded     integer,
  total_points       bigint
)
language plpgsql
security definer  -- runs as the table owner; access is limited by the grants below
set search_path = ''
as $$
declare
  v_event  record;
  v_id     uuid;
  v_at     timestamptz;
  v_points integer;
begin
  if p_flag_reason is not null
     and p_flag_reason not in ('no_location', 'outside_radius', 'low_accuracy') then
    raise exception 'bad_flag_reason' using errcode = 'PC002';
  end if;

  -- Lock the event so it can't be ended, cancelled or re-pointed while we check in.
  -- FOR SHARE lets many volunteers check in to the same event at once.
  select e.status, e.starts_at, e.ends_at, e.points
    into v_event
    from public.events e
   where e.id = p_event_id
     for share;

  if not found
     or v_event.status <> 'published'
     or now() < v_event.starts_at
     or now() >= v_event.ends_at then
    raise exception 'event_not_open' using errcode = 'PC001';
  end if;

  insert into public.check_ins as ci
    (event_id, user_id, distance_m, accuracy_m, flag_reason, verification_method)
  values
    (p_event_id, p_user_id, p_distance_m, p_accuracy_m, p_flag_reason, 'qr')
  on conflict (user_id, event_id) do nothing
  returning ci.id, ci.checked_in_at into v_id, v_at;

  if v_id is null then
    -- Already checked in: return the existing check-in unchanged.
    select ci.id, ci.checked_in_at, ci.points_awarded
      into v_id, v_at, v_points
      from public.check_ins ci
     where ci.user_id = p_user_id and ci.event_id = p_event_id;

    return query select v_id, true, v_at, v_points, public.get_pace_points_balance(p_user_id);
    return;
  end if;

  v_points := 0;
  if v_event.points > 0 then
    v_points := public.award_pace_event_points(v_id);
  end if;

  return query select v_id, false, v_at, v_points, public.get_pace_points_balance(p_user_id);
end;
$$;

-- Browsers can never call it; only the server, with the service-role key.
revoke all on function public.record_qr_check_in(uuid, uuid, numeric, numeric, text)
  from public, anon, authenticated;

grant execute on function public.record_qr_check_in(uuid, uuid, numeric, numeric, text)
  to service_role;
