-- MedWell PACE Points System
-- Flexible scoring rules and points transaction history.

-- 1. Configurable scoring rules
create table public.pace_scoring_rules (
  id uuid primary key default gen_random_uuid(),

  activity_type text not null unique,

  category text,

  points integer not null
    check (points >= 0),

  calculation_type text not null default 'fixed'
    check (calculation_type in ('fixed', 'per_unit')),

  is_active boolean not null default true,

  created_at timestamptz not null default now()
);

-- 2. Points transaction ledger
create table public.pace_points_ledger (
  id uuid primary key default gen_random_uuid(),

  user_id uuid
    references public.profiles(id) on delete set null,

  scoring_rule_id uuid
    references public.pace_scoring_rules(id),

  check_in_id uuid
    references public.check_ins(id) on delete set null,

  activity_type text not null,

  -- Unique identifier for each points-awarding operation
  idempotency_key text not null unique,

  category text,

  -- Positive points are awards; negative points are reversals.
  points integer not null
    check (points <> 0),

  reverses_entry_id uuid
    references public.pace_points_ledger(id)
    unique,

  description text,

  created_at timestamptz not null default now(),

  unique (check_in_id)
);

-- 3. Index for retrieving user points
create index pace_points_ledger_user_id_idx
  on public.pace_points_ledger(user_id);

-- 4. Enable Row Level Security
alter table public.pace_scoring_rules
  enable row level security;

alter table public.pace_points_ledger
  enable row level security;

-- Participants must not award or modify their own points.
-- Only the trusted backend will manage points transactions.

revoke insert, update, delete
  on public.pace_points_ledger
  from anon, authenticated;

-- Scoring rules cannot be changed directly by users.

revoke insert, update, delete
  on public.pace_scoring_rules
  from anon, authenticated;

-- Anonymous visitors get no access.
revoke all on public.pace_points_ledger, public.pace_scoring_rules
  from anon;

-- Participants see their own points; admins see everyone's.
create policy pace_ledger_select_own on public.pace_points_ledger
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy pace_ledger_select_admin on public.pace_points_ledger
  for select to authenticated
  using ((select public.app_role()) = 'admin');

-- Any signed-in user can see how points are earned.
create policy pace_rules_select_authenticated on public.pace_scoring_rules
  for select to authenticated
  using (true);


-- Prevent existing points transactions from being edited or deleted.
create or replace function public.prevent_pace_ledger_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Only exception: clearing user_id / check_in_id when the user or check-in is deleted.
  if tg_op = 'UPDATE'
     and (new.user_id is null or new.user_id = old.user_id)
     and (new.check_in_id is null or new.check_in_id = old.check_in_id)
     and (to_jsonb(new) - 'user_id' - 'check_in_id') = (to_jsonb(old) - 'user_id' - 'check_in_id')
  then
    return new;
  end if;
  raise exception 'PACE ledger entries cannot be modified or deleted';
end;
$$;

create trigger prevent_pace_ledger_update
before update on public.pace_points_ledger
for each row
execute function public.prevent_pace_ledger_changes();

create trigger prevent_pace_ledger_delete
before delete on public.pace_points_ledger
for each row
execute function public.prevent_pace_ledger_changes();
