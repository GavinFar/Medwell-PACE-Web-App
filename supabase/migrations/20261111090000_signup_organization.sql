-- Volunteers pick their organization on the sign-up form.
--
-- How it works
--   The sign-up form sends the chosen organization's id along with the display name
--   (supabase.auth.signUp({ options: { data: { display_name, organization_id } } })).
--   The trigger that creates each new user's profile now copies that id onto the profile,
--   but only if it is a real organization. Anything else (blank, made up, malformed) is
--   ignored, so the volunteer simply has no company and sign-up still succeeds.
--
-- Why volunteers can't change it later
--   This trigger only runs once, when the account is created. Signed-in users can edit
--   their own user metadata, but that no longer affects the profile, and they still
--   can't update profiles.organization_id directly (only display_name is writable).
--   An admin can correct a wrong pick on the server with the service-role key.
--
-- Run test: supabase/tests/signup_organization_checks.sql

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer  -- runs as the table owner, so it can read organizations and write profiles
set search_path = ''
as $$
declare
  picked text := new.raw_user_meta_data ->> 'organization_id';
  org_id uuid;
begin
  -- Only accept a well-formed id of an organization that exists.
  if picked ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select o.id into org_id from public.organizations o where o.id = picked::uuid;
  end if;

  insert into public.profiles (id, display_name, organization_id)
  values (new.id, left(new.raw_user_meta_data ->> 'display_name', 80), org_id);
  return new;
end;
$$;
