-- Keep each check-in's organization fixed after it is created.
--
-- The trigger from 20261110090000_check_in_schema.sql copies the volunteer's company onto
-- a check-in, but only on INSERT, so an UPDATE could still change check_ins.organization_id.
-- Now it also runs on UPDATE and always keeps the original value.
--
-- On update it keeps the OLD value instead of re-reading the profile: check-ins are updated
-- by normal operations (for example, points reversal), and re-reading the profile would move
-- old check-ins to the volunteer's current company.

create or replace function public.set_check_in_organization()
returns trigger
language plpgsql
security definer  -- reads the profile regardless of who is inserting
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.organization_id := old.organization_id;
  else
    select p.organization_id into new.organization_id
    from public.profiles p
    where p.id = new.user_id;
  end if;
  return new;
end;
$$;

revoke execute on function public.set_check_in_organization() from public, anon, authenticated;

drop trigger check_ins_set_organization on public.check_ins;

create trigger check_ins_set_organization
  before insert or update on public.check_ins
  for each row execute function public.set_check_in_organization();