-- Audit log: an append-only record of security-relevant actions.
--
-- Who can do what:
--   * Admins can read it (through RLS).
--   * Nobody writes through the browser. The server writes with the
--     service-role key, through src/lib/audit/log.ts.
--   * Nobody can update, delete or truncate rows, not even the service role:
--     triggers reject those statements.
--
-- Never store: check-in codes, full check-in URLs, passwords, tokens, or raw
-- GPS coordinates. Store a distance or a reason code instead.

create table public.audit_log (
  id          bigint generated always as identity primary key,
  ts          timestamptz not null default now(),
  request_id  uuid,
  actor_id    uuid,                       -- the user who acted (null for anonymous)
  actor_role  text,
  action      text not null check (char_length(action) <= 100),   -- e.g. 'checkin.attempt'
  target_type text check (char_length(target_type) <= 50),         -- e.g. 'event'
  target_id   text check (char_length(target_id) <= 100),
  outcome     text not null check (outcome in ('success', 'failure', 'flagged')),
  reason_code text check (char_length(reason_code) <= 50),         -- e.g. 'OUT_OF_RANGE'
  ip_hash     text,                       -- keyed hash, never the raw IP
  metadata    jsonb not null default '{}'
);

create index audit_log_ts_idx on public.audit_log (ts desc);
create index audit_log_actor_id_idx on public.audit_log (actor_id);
create index audit_log_action_idx on public.audit_log (action);

-- Row-level security: admins can read; there are no write policies.
alter table public.audit_log enable row level security;

create policy audit_log_select_admin on public.audit_log
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

revoke all on public.audit_log from anon;
revoke insert, update, delete, truncate on public.audit_log from authenticated;

-- Append-only, enforced even for the service role (which bypasses RLS).
create function public.audit_log_reject_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log is append-only';
end;
$$;

create trigger audit_log_no_update_delete
  before update or delete on public.audit_log
  for each row execute function public.audit_log_reject_change();

create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function public.audit_log_reject_change();