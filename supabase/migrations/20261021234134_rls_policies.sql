-- Access rules (row-level security policies) for the core tables.
--
-- Roles live in app_metadata.role, which only the server can change:
--   participant (default when no role is set), organizer, sponsor, admin.
-- A role change takes effect when the user's session token refreshes
-- (at most about an hour, or immediately after signing in again).
--
-- Summary
--   profiles             read: self, admin, organizers (their attendees) | update: own display_name
--   events               read: published, own, admin | create: organizer/admin | edit: own (organizer), admin | delete: admin
--   event_registrations  read: self, event's organizer, admin | create: participant for self | delete: self
--   check_ins            read: self, event's organizer, admin | NO writes from the browser
--                        (only the server's verified check-in pipeline can insert or review)
--
-- Policies use (select auth.uid()) so Postgres evaluates it once per query.

-- ---------------------------------------------------------------------------
-- Role helper
-- ---------------------------------------------------------------------------
create function public.app_role()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'participant');
$$;

-- Anonymous visitors get no access to any of these tables.
revoke all on public.profiles, public.events, public.event_registrations, public.check_ins
  from anon;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_select_admin on public.profiles
  for select to authenticated
  using ((select public.app_role()) = 'admin');

-- Organizers can see the names of people registered for or checked in to their events.
create policy profiles_select_attendees on public.profiles
  for select to authenticated
  using (
    exists (
      select 1
      from public.event_registrations r
      join public.events e on e.id = r.event_id
      where r.user_id = profiles.id
        and e.organizer_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.check_ins c
      join public.events e on e.id = c.event_id
      where c.user_id = profiles.id
        and e.organizer_id = (select auth.uid())
    )
  );

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Users may change only their display name, never their id.
revoke insert, update, delete on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
create policy events_select_published on public.events
  for select to authenticated
  using (status = 'published');

create policy events_select_own on public.events
  for select to authenticated
  using (organizer_id = (select auth.uid()));

create policy events_select_admin on public.events
  for select to authenticated
  using ((select public.app_role()) = 'admin');

create policy events_insert_organizer on public.events
  for insert to authenticated
  with check (
    (select public.app_role()) in ('organizer', 'admin')
    and organizer_id = (select auth.uid())
  );

create policy events_update_own on public.events
  for update to authenticated
  using (
    organizer_id = (select auth.uid())
    and (select public.app_role()) = 'organizer'
  )
  with check (organizer_id = (select auth.uid()));

create policy events_update_admin on public.events
  for update to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

create policy events_delete_admin on public.events
  for delete to authenticated
  using ((select public.app_role()) = 'admin');

-- ---------------------------------------------------------------------------
-- event_registrations
-- ---------------------------------------------------------------------------
create policy registrations_select_own on public.event_registrations
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy registrations_select_organizer on public.event_registrations
  for select to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_registrations.event_id
        and e.organizer_id = (select auth.uid())
    )
  );

create policy registrations_select_admin on public.event_registrations
  for select to authenticated
  using ((select public.app_role()) = 'admin');

-- Participants register themselves for published events that have not ended.
create policy registrations_insert_self on public.event_registrations
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.app_role()) = 'participant'
    and exists (
      select 1 from public.events e
      where e.id = event_registrations.event_id
        and e.status = 'published'
        and e.ends_at > now()
    )
  );

create policy registrations_delete_self on public.event_registrations
  for delete to authenticated
  using (user_id = (select auth.uid()));

revoke update on public.event_registrations from authenticated;

-- ---------------------------------------------------------------------------
-- check_ins: read-only from the browser
-- ---------------------------------------------------------------------------
create policy check_ins_select_own on public.check_ins
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy check_ins_select_organizer on public.check_ins
  for select to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = check_ins.event_id
        and e.organizer_id = (select auth.uid())
    )
  );

create policy check_ins_select_admin on public.check_ins
  for select to authenticated
  using ((select public.app_role()) = 'admin');

-- No insert, update or delete policies, and no privileges: a participant must
-- never be able to create a check-in or change points directly.
revoke insert, update, delete on public.check_ins from authenticated;