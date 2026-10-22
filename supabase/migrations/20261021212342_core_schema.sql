-- Core schema: profiles, events, registrations, check-ins.
--
-- Security notes:
--   * User roles are NOT stored here. They live in auth.users.app_metadata, which only the server (service role) can change.
--   * RLS is enabled on every table with no policies yet, so the browser (anon/authenticated keys) can read and write NOTHING until the access
--     policies migration is added. This is deliberate: deny by default.
--   * Check-ins store distance from the event, not raw GPS coordinates.
 

-- Profiles: one row per user, created automatically on sign-up.

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  created_at   timestamptz not null default now()
);
 
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(new.raw_user_meta_data ->> 'display_name', 80));
  return new;
end;
$$;
 
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
 

-- Events

create table public.events (
  id            uuid primary key default gen_random_uuid(),
  organizer_id  uuid not null references public.profiles (id) on delete restrict,
  title         text not null check (char_length(title) between 1 and 120),
  description   text check (char_length(description) <= 5000),
  location_name text check (char_length(location_name) <= 200),
  latitude      double precision not null check (latitude between -90 and 90),
  longitude     double precision not null check (longitude between -180 and 180),
  radius_m      integer not null default 100 check (radius_m between 10 and 1000),
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  points        integer not null default 10 check (points between 0 and 1000),
  status        text not null default 'draft'
                check (status in ('draft', 'published', 'cancelled')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (ends_at > starts_at)
);
 
create index events_organizer_id_idx on public.events (organizer_id);
create index events_starts_at_idx on public.events (starts_at);
 
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
 
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();
 

-- Event registrations: which participants signed up for which events.

create table public.event_registrations (
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
 
create index event_registrations_user_id_idx on public.event_registrations (user_id);
 

-- Check-ins: one per user per event. Rejected attempts are not stored here;
-- they go to the audit log.

create table public.check_ins (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  checked_in_at  timestamptz not null default now(),
  distance_m     numeric(8, 1) check (distance_m >= 0),
  accuracy_m     numeric(8, 1) check (accuracy_m >= 0),
  status         text not null default 'accepted'
                 check (status in ('accepted', 'flagged', 'rejected_on_review')),
  flag_reason    text,
  points_awarded integer not null default 0 check (points_awarded >= 0),
  reviewed_by    uuid references public.profiles (id),
  reviewed_at    timestamptz,
  unique (user_id, event_id)  -- blocks farming points by checking in twice
);
 
create index check_ins_event_id_idx on public.check_ins (event_id);
 

-- Row-level security: on for every table, no policies yet (deny all).

alter table public.profiles            enable row level security;
alter table public.events              enable row level security;
alter table public.event_registrations enable row level security;
alter table public.check_ins           enable row level security;
 