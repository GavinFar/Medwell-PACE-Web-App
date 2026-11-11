-- Checks for public.list_organizations() (the sign-up page's organization list).
--
-- How to run: paste the whole file into the Supabase SQL Editor and click Run.
-- It creates two test organizations, checks what visitors can and cannot see,
-- then undoes every change. If anything is wrong it stops with "FAIL: ...".

do $$
declare
  org_a  uuid;
  org_b  uuid;
  n      int;
  cols   text;
  passed int := 0;
begin
  begin  -- everything in this block is undone at the end
    insert into public.organizations (name) values ('List test Zeta') returning id into org_a;
    insert into public.organizations (name) values ('list test alpha') returning id into org_b;

    -- 1. The function returns only id and name.
    select string_agg(a.attname, ',' order by a.attnum) into cols
    from pg_proc p
    cross join lateral unnest(p.proallargtypes, p.proargmodes, p.proargnames) as a0(t, m, attname)
    cross join lateral (select a0.attname, array_position(p.proargnames, a0.attname) as attnum) a
    where p.oid = 'public.list_organizations()'::regprocedure and a0.m = 't';
    if cols is distinct from 'id,name' then
      raise exception 'FAIL: list_organizations returns % instead of only id,name', cols;
    end if;
    passed := passed + 1;

    -- ===== Anonymous visitor (the sign-up page) =====
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    set local role anon;

    -- 2. Can get the list, including the test organizations.
    select count(*) into n from public.list_organizations() where id in (org_a, org_b);
    if n <> 2 then raise exception 'FAIL: visitor cannot see the organization list'; end if;
    passed := passed + 1;

    -- 3. The list is sorted by name, ignoring upper/lower case.
    select count(*) into n from (
      select id, row_number() over () as pos
      from public.list_organizations() where id in (org_a, org_b)
    ) s where (id = org_b and pos = 1) or (id = org_a and pos = 2);
    if n <> 2 then raise exception 'FAIL: organization list is not sorted by name'; end if;
    passed := passed + 1;

    -- 4. Still cannot read the organizations table directly.
    begin
      select count(*) into n from public.organizations;
      raise exception 'FAIL: visitor can read the organizations table';
    exception when insufficient_privilege then null;
    end;
    passed := passed + 1;

    -- 5. Cannot create an organization.
    begin
      insert into public.organizations (name) values ('Visitor-made company');
      raise exception 'FAIL: visitor created an organization';
    exception when insufficient_privilege then null;
    end;
    passed := passed + 1;

    reset role;

    raise exception using errcode = 'P0099', message = 'undo test changes';
  exception when sqlstate 'P0099' then
    null;  -- all test changes are rolled back here
  end;

  raise notice 'All % organization list checks passed', passed;
  perform set_config('test.passed', passed::text, false);
end;
$$;

select 'All ' || current_setting('test.passed') || ' organization list checks passed' as result;