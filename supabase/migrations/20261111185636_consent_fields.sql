-- Consent at sign-up (SRS: Personal Data Protection).
--
-- What this adds
--   profiles.consent_version      Which version of the consent agreement the user accepted, e.g. '1.0'.
--   profiles.consent_accepted_at  When they accepted it. Set by the database (server time),
--                                 never taken from the browser.
--
-- How it is filled in
--   The sign-up form sends consent_version in the sign-up metadata, next to display_name
--   and organization_id. The profile trigger
--   (runs when the account is created) copies it into the profile and stamps the time.
--   Users cannot change either column afterwards (only display_name is writable).
--
-- Not enforced yet: sign-ups without consent still succeed (both columns stay empty),
-- so the current sign-up form keeps working until the consent checkbox is added.
-- A later migration will reject sign-ups without consent.
--
-- Run test: supabase/tests/consent_checks.sql

alter table public.profiles
  add column consent_version     text
    check (consent_version ~ '^[A-Za-z0-9._-]{1,20}$'),
  add column consent_accepted_at timestamptz,
  -- Both set or both empty.
  add constraint profiles_consent_complete
    check ((consent_version is null) = (consent_accepted_at is null));

-- No grant needed: signed-in users may only update profiles.display_name
-- (column grant in the RLS policies migration), so they cannot change consent.

-- Same as the sign-up organization migration (20261111090000), plus the consent columns.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer  -- runs as the table owner, so it can read organizations and write profiles
set search_path = ''
as $$
declare
  picked  text := new.raw_user_meta_data ->> 'organization_id';
  org_id  uuid;
  version text := new.raw_user_meta_data ->> 'consent_version';
begin
  -- Organization: only accept a well-formed id of an organization that exists.
  if picked ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select o.id into org_id from public.organizations o where o.id = picked::uuid;
  end if;

  -- Consent: ignore anything that is not a short, plain version string.
  if version !~ '^[A-Za-z0-9._-]{1,20}$' then
    version := null;
  end if;

  insert into public.profiles (id, display_name, organization_id, consent_version, consent_accepted_at)
  values (
    new.id,
    left(new.raw_user_meta_data ->> 'display_name', 80),
    org_id,
    version,
    case when version is not null then now() end  -- database time, never the browser's
  );
  return new;
end;
$$;