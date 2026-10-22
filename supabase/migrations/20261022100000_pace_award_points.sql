-- MedWell PACE Points System
-- Award points for verified event check-ins.
--
-- This migration will contain the database function
-- responsible for safely recording points awards.
--
-- Requirements:
-- 1. Only accepted check-ins qualify.
-- 2. Event attendance uses events.points.
-- 3. Duplicate awards must be prevented.
-- 4. Ledger insertion and check-in updates must be atomic.
-- 5. Only authorized server-side callers may award points.


-- Award points for an accepted event check-in.
-- The implementation will be added in the next steps.

create or replace function public.award_pace_event_points(
  p_check_in_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_check_in record;
  v_event_points integer;
  v_existing_award_id uuid;
begin
  -- Find the check-in and lock it during this transaction.
  select
    id,
    user_id,
    event_id,
    status,
    points_awarded
  into v_check_in
  from public.check_ins
  where id = p_check_in_id
  for update;

  -- Reject nonexistent check-ins.
  if not found then
    raise exception 'Check-in not found';
  end if;

  -- Only accepted check-ins qualify for points.
  if v_check_in.status <> 'accepted' then
    raise exception 'Check-in is not accepted';
  end if;

  -- Reject check-ins that already have recorded points.
  if v_check_in.points_awarded <> 0 then
    raise exception 'Check-in already has recorded points';
  end if;

  -- Retrieve the points configured for this event.
  select points
  into v_event_points
  from public.events
  where id = v_check_in.event_id;

  if not found then
    raise exception 'Event not found';
  end if;

  if v_event_points <= 0 then
    raise exception 'Event must have positive points';
  end if;

  -- Check whether this check-in already has a ledger entry.
  select id
  into v_existing_award_id
  from public.pace_points_ledger
  where check_in_id = p_check_in_id;

  if found then
    raise exception 'Points have already been awarded for this check-in';
  end if;

  -- Record the points award in the transaction ledger.
  insert into public.pace_points_ledger (
    user_id,
    check_in_id,
    activity_type,
    idempotency_key,
    points,
    description
  )
  values (
    v_check_in.user_id,
    p_check_in_id,
    'event_attendance',
    'event_check_in:' || p_check_in_id::text,
    v_event_points,
    'Points awarded for verified event attendance'
  );

  -- Update the existing check-in record.
  update public.check_ins
  set points_awarded = v_event_points
  where id = p_check_in_id;

  -- Return the number of points awarded.
  return v_event_points;
end;
$$;

-- Prevent ordinary API users from executing the awarding function.
revoke all on function public.award_pace_event_points(uuid)
from public, anon, authenticated;

-- Allow only the trusted server-side role to execute this function.
grant execute on function public.award_pace_event_points(uuid)
to service_role;
