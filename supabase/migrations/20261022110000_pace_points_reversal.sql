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

-- Do not expose this function directly to students.
revoke all on function public.get_pace_points_balance(uuid)
from public, anon, authenticated;

-- Only trusted server-side code may call it.
grant execute on function public.get_pace_points_balance(uuid)
to service_role;

-- Reverse an existing positive PACE points award.
-- Only trusted server-side callers can execute this function.

create or replace function public.reverse_pace_points(
  p_original_entry_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security invoker
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

  -- Lock the original transaction during this operation.
  select
    id,
    user_id,
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

  return v_reversal_id;
end;
$$;

-- Prevent direct calls from public API users.
revoke all on function public.reverse_pace_points(uuid, text)
from public, anon, authenticated;

-- Only the trusted server-side role can execute reversals.
grant execute on function public.reverse_pace_points(uuid, text)
to service_role;
