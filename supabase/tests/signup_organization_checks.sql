-- Checks that volunteers pick their organization at sign-up, and only then.
--
-- How to run: paste the whole file into the Supabase SQL Editor and click Run.
-- No test accounts needed: it creates throwaway users and organizations.
-- Every change it makes is undone at the end.
-- If anything is wrong it stops with "FAIL: ...".

do $$
declare
  org_a   uuid;
  org_b   uuid;
  u_id    uuid;
  got     uuid;
  passed  int := 0;
begin
  begin  -- everything in this block is undone at the end

    insert into public.organizations (name) values ('Signup Test Company A') returning id into org_a;
    insert into public.organizations (name) values ('Signup Test Company B') returning id into org_b;

    -- ===== The organization picked on the sign-up form is saved to the profile =====
    u_id := gen_random_uuid();
    insert into auth.users (id, email, raw_user_meta_data)
      values (u_id, 'signup-test-1@example.com',
              jsonb_build_object('display_name', 'Pat Picker', 'organization_id', org_a));
    select organization_id into got from public.profiles where id = u_id;
    if got is distinct from org_a then
      raise exception 'FAIL: the organization picked at sign-up was not saved';
    end if;
    if (select display_name from public.profiles where id = u_id) is distinct from 'Pat Picker' then
      raise exception 'FAIL: the display name is no longer saved at sign-up';
    end if;
    passed := passed + 1;

    -- ===== Picking "Not with a company" leaves it empty =====
    u_id := gen_random_uuid();
    insert into auth.users (id, email, raw_user_meta_data)
      values (u_id, 'signup-test-2@example.com', jsonb_build_object('display_name', 'No Company'));
    if (select organization_id from public.profiles where id = u_id) is not null then
      raise exception 'FAIL: a volunteer who picked no organization got one';
    end if;
    passed := passed + 1;

    -- ===== A made-up organization id is ignored, and sign-up still works =====
    u_id := gen_random_uuid();
    insert into auth.users (id, email, raw_user_meta_data)
      values (u_id, 'signup-test-3@example.com',
              jsonb_build_object('display_name', 'Faker', 'organization_id', gen_random_uuid()));
    if not exists (select 1 from public.profiles where id = u_id) then
      raise exception 'FAIL: sign-up with an unknown organization did not create a profile';
    end if;
    if (select organization_id from public.profiles where id = u_id) is not null then
      raise exception 'FAIL: an organization that does not exist was saved';
    end if;
    passed := passed + 1;

    -- ===== Garbage in the organization field is ignored, and sign-up still works =====
    u_id := gen_random_uuid();
    insert into auth.users (id, email, raw_user_meta_data)
      values (u_id, 'signup-test-4@example.com',
              jsonb_build_object('display_name', 'Garbage', 'organization_id', 'not-a-uuid'));
    if not exists (select 1 from public.profiles where id = u_id) then
      raise exception 'FAIL: sign-up with a malformed organization id did not create a profile';
    end if;
    if (select organization_id from public.profiles where id = u_id) is not null then
      raise exception 'FAIL: a malformed organization id was saved';
    end if;
    passed := passed + 1;

    -- ===== Changing sign-up data later does not change the organization =====
    -- (Signed-in users can edit their own user metadata, so it must only be read once.)
    u_id := gen_random_uuid();
    insert into auth.users (id, email, raw_user_meta_data)
      values (u_id, 'signup-test-5@example.com',
              jsonb_build_object('display_name', 'Switcher', 'organization_id', org_a));
    update auth.users
      set raw_user_meta_data = jsonb_build_object('display_name', 'Switcher', 'organization_id', org_b)
      where id = u_id;
    if (select organization_id from public.profiles where id = u_id) is distinct from org_a then
      raise exception 'FAIL: editing user metadata after sign-up changed the organization';
    end if;
    passed := passed + 1;

    raise exception using errcode = 'P0099', message = 'undo test changes';
  exception when sqlstate 'P0099' then
    null;
  end;

  perform set_config('test.passed', passed::text, false);
end;
$$;

select 'All ' || current_setting('test.passed') || ' sign-up organization checks passed' as result;
