-- Organization list for the sign-up page.
--
-- Volunteers pick their organization on the sign-up form, before they are signed in.
-- Anonymous visitors still cannot read the organizations table; this function returns
-- ONLY each organization's id and name, sorted by name, and nothing else.
--
-- Front end: const { data } = await supabase.rpc('list_organizations')
--   -> [{ id, name }, ...]
--
-- Run test: supabase/tests/organization_list_checks.sql

create function public.list_organizations()
returns table (id uuid, name text)
language sql
stable
security definer  -- reads organizations for visitors who cannot read the table themselves
set search_path = ''
as $$
  select o.id, o.name
  from public.organizations o
  order by lower(o.name);
$$;

revoke execute on function public.list_organizations() from public;
grant execute on function public.list_organizations() to anon, authenticated;