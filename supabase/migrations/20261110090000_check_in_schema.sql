-- Check-in schema: organizations, a QR secret for each event, and how each check-in was verified.
--
-- What this adds
--   organizations                 Companies whose volunteers earn points (sponsors get reports on these).
--   profiles.organization_id      The company a volunteer belongs to. Volunteers cannot change it;
--                                 the server sets it (with the service-role key, after checking the
--                                 caller is an admin), the same way roles work.
--   event_qr_secrets              One random secret per event, used to make the rotating QR codes.
--                                 Created automatically for every event. Only the server can read it.
--   check_ins.verification_method How the check-in was verified: 'qr' now, 'manual' later for
--                                 organizer-entered check-ins.
--   check_ins.organization_id     The volunteer's company AT THE TIME of the check-in, filled in
--                                 automatically from their profile. If they change companies later,
--                                 old points still count for the company they were with.
--
-- Run test: supabase/tests/check_in_schema_checks.sql


-- ---------------------------------------------------------------------------
-- 1. Organizations, and each volunteer's company
-- ---------------------------------------------------------------------------
create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 120 and name = btrim(name)),
  created_at timestamptz not null default now()
);

-- "Acme" and "acme" count as the same company.
create unique index organizations_name_key on public.organizations (lower(name));

-- A volunteer's company.
alter table public.profiles
  add column organization_id uuid references public.organizations (id) on delete set null;

create index profiles_organization_id_idx on public.profiles (organization_id);

-- No grant needed: signed-in users may only update profiles.display_name
-- (column grant in the RLS policies migration), so they cannot change this.

alter table public.organizations enable row level security;
revoke all on public.organizations from anon;

-- Members can see their own company; admins can see and manage all of them.
create policy organizations_select_member on public.organizations
  for select to authenticated
  using (id = (select p.organization_id from public.profiles p where p.id = (select auth.uid())));

create policy organizations_select_admin on public.organizations
  for select to authenticated
  using ((select public.app_role()) = 'admin');

create policy organizations_insert_admin on public.organizations
  for insert to authenticated
  with check ((select public.app_role()) = 'admin');

create policy organizations_update_admin on public.organizations
  for update to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

-- Deleting a company that has check-ins is blocked below (on delete restrict).
create policy organizations_delete_admin on public.organizations
  for delete to authenticated
  using ((select public.app_role()) = 'admin');


-- ---------------------------------------------------------------------------
-- 2. QR secrets, one per event
-- ---------------------------------------------------------------------------
-- Kept out of the events table on purpose: every signed-in user can read
-- published events, and anyone holding the secret could make valid codes.
create table public.event_qr_secrets (
  event_id   uuid primary key references public.events (id) on delete cascade,
  secret     text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  created_at timestamptz not null default now()
);

-- RLS on with no policies, and no privileges: the browser can never read or
-- write secrets, whatever the user's role. The server reads them with the
-- service-role key.
alter table public.event_qr_secrets enable row level security;
revoke all on public.event_qr_secrets from anon, authenticated;

create function public.create_event_qr_secret()
returns trigger
language plpgsql
security definer  -- runs as the table owner, so organizers' inserts can create the secret
set search_path = ''
as $$
begin
  insert into public.event_qr_secrets (event_id) values (new.id);
  return new;
end;
$$;

revoke execute on function public.create_event_qr_secret() from public, anon, authenticated;

create trigger events_create_qr_secret
  after insert on public.events
  for each row execute function public.create_event_qr_secret();

-- Events created before this migration get a secret too.
insert into public.event_qr_secrets (event_id)
select id from public.events
on conflict (event_id) do nothing;


-- ---------------------------------------------------------------------------
-- 3. Check-ins: how they were verified, and the volunteer's company at the time
-- ---------------------------------------------------------------------------
alter table public.check_ins
  add column verification_method text not null default 'qr'
    check (verification_method in ('qr', 'manual')),
  add column organization_id uuid references public.organizations (id) on delete restrict;

create index check_ins_organization_id_idx on public.check_ins (organization_id);

-- Always copy the company from the volunteer's profile, ignoring any value
-- the inserting code passed in, so a check-in can't be credited to the wrong company.
create function public.set_check_in_organization()
returns trigger
language plpgsql
security definer  -- reads the profile regardless of who is inserting
set search_path = ''
as $$
begin
  select p.organization_id into new.organization_id
  from public.profiles p
  where p.id = new.user_id;
  return new;
end;
$$;

revoke execute on function public.set_check_in_organization() from public, anon, authenticated;

create trigger check_ins_set_organization
  before insert on public.check_ins
  for each row execute function public.set_check_in_organization();
