-- MedWell PACE Points System
-- Reverse previously awarded points.
--
-- Requirements:
-- 1. Only trusted server-side callers can request reversals.
-- 2. The original transaction must be a positive award.
-- 3. A transaction cannot be reversed twice.
-- 4. The reversal must belong to the same student.
-- 5. Reversals must use negative points.
-- 6. Original ledger entries must remain unchanged.
-- 7. The reversal must be recorded atomically.
--
-- Implementation will be added after reviewing
-- the existing database structure.


-- Calculate a student's current PACE points balance.
-- Positive entries add points.
-- Negative entries subtract points.

create or replace function public.get_pace_points_balance(
  p_user_id uuid
)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(points), 0)::bigint
  from public.pace_points_ledger
  where user_id = p_user_id;
$$;

-- Not available to logged-out visitors.
revoke all on function public.get_pace_points_balance(uuid)
from public, anon;

-- Signed-in users get only their own balance (the ledger's access rules apply).
grant execute on function public.get_pace_points_balance(uuid)
to authenticated, service_role;

-- Reverse an existing positive PACE points award.
-- Only trusted server-side callers can execute this function.

create or replace function public.reverse_pace_points(
  p_original_entry_id uuid,
  p_reason text,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_original record;
  v_reversal_id uuid;
begin
  -- A reversal must have an explanation.
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reversal reason is required';
  end if;

  if p_actor_id is null then
    raise exception 'The person reversing the points must be recorded';
  end if;

  -- Lock the original transaction during this operation.
  select
    id,
    user_id,
    check_in_id,
    scoring_rule_id,
    activity_type,
    category,
    points,
    reverses_entry_id
  into v_original
  from public.pace_points_ledger
  where id = p_original_entry_id
  for update;

  if not found then
    raise exception 'Original points transaction not found';
  end if;

  -- Only positive awards may be reversed.
  if v_original.points <= 0
     or v_original.reverses_entry_id is not null then
    raise exception 'Only positive awards can be reversed';
  end if;

  -- Prevent a second reversal of the same award.
  if exists (
    select 1
    from public.pace_points_ledger
    where reverses_entry_id = p_original_entry_id
  ) then
    raise exception 'This award has already been reversed';
  end if;

  -- Record a new negative transaction.
  insert into public.pace_points_ledger (
    user_id,
    scoring_rule_id,
    activity_type,
    idempotency_key,
    category,
    points,
    reverses_entry_id,
    description
  )
  values (
    v_original.user_id,
    v_original.scoring_rule_id,
    v_original.activity_type,
    'reversal:' || p_original_entry_id::text,
    v_original.category,
    -v_original.points,
    p_original_entry_id,
    trim(p_reason)
  )
    returning id into v_reversal_id;

  -- Keep the check-in in step with the ledger.
  if v_original.check_in_id is not null then
    update public.check_ins
    set points_awarded = 0,
        status = 'rejected_on_review',
        reviewed_by = p_actor_id,
        reviewed_at = now()
    where id = v_original.check_in_id;
  end if;

  -- Record who reversed the points and why.
  insert into public.audit_log (
    actor_id, action, target_type, target_id, outcome, reason_code, metadata
  )
  values (
    p_actor_id,
    'points.reverse',
    'pace_points_ledger',
    p_original_entry_id::text,
    'success',
    'MANUAL_REVERSAL',
    jsonb_build_object('points', -v_original.points, 'user_id', v_original.user_id, 'reason', trim(p_reason))
  );

  return v_reversal_id;
end;
$$;

-- Prevent direct calls from public API users.
revoke all on function public.reverse_pace_points(uuid, text, uuid)
from public, anon, authenticated;

-- Only the trusted server-side role can execute reversals.
grant execute on function public.reverse_pace_points(uuid, text, uuid)
to service_role;
