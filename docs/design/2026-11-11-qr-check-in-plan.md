# QR Check-in Implementation Plan

**Goal:** Organizers show a rotating QR code on a laptop. Volunteers scan it, log in or sign up if needed, share their location or skip it, and are checked in with PACE points in one transaction.

**Architecture:**
- Pure helpers in `src/lib/checkin/`: the pass, distance, flag reason, event state, access rule and display formats, all unit-tested.
- One service-role-only Postgres function, `record_qr_check_in`, does the insert and the points award atomically.
- Server Actions and route handlers in `src/lib/checkin/` and `src/app/api/events/[id]/qr/`. Pages in `src/app/(auth)/` use Krishna's classes from `src/app/(auth)/pace-ui.css`.

**Tech Stack:** Next.js 16 App Router (Cache Components on: request-time reads go in `<Suspense>`), Supabase (supabase-js, service-role admin client), Postgres plpgsql, vitest, `react-qr-code` (already installed).

**Spec:** `docs/design/2026-11-11-qr-check-in.md`

## Global Constraints

- QR code: `codeForWindow`/`verifyCode` from `src/lib/qr/rotating-code.ts` (30-second windows; current or previous window accepted). The secret comes from `public.event_qr_secrets.secret` via `createAdminClient()` only.
- Pass lifetime: **30 minutes**. Format: `<eventId>.<issuedAtSeconds>.<hex HMAC-SHA256(event secret, "pass:<eventId>.<issuedAtSeconds>")>`.
- Never store, log or audit raw latitude/longitude. Only `distance_m` and `accuracy_m` go in `check_ins`.
- `flag_reason` values: `no_location`, `outside_radius`, `low_accuracy` (accuracy worse than **200 m**), or null. Precedence follows that order. The status always stays `accepted`.
- Event "open" means `status = 'published'` and `starts_at <= now < ends_at`.
- Display times in **`America/Chicago`**, e.g. "Sat, Nov 21 · 9:00 AM – 12:00 PM".
- Organizer screen: polls every **5 s**, shows the latest **4** names as "First L." with the time.
- Copy comes from the 2026-11-11 mockups (spec §"Decisions"). Krishna's verify page changes only its done-button label to **"Finish checking in"** when a check-in is waiting.

## Review Focus

1. **Event ends while the volunteer is on the location screen.** Expect "Check-in isn't open", with no row and no points (Task 2 SQL test, Task 4 action test).
2. **Double-tap or two tabs.** Expect exactly one check-in and one ledger row; the second call returns `already` (Task 2 SQL test).
3. **A pass from event A sent with event B's id, or with an edited timestamp.** Expect it rejected (Task 1 pass tests).
4. **Location permission denied or timing out.** Expect a message plus the "Check in without location" button; check-in still works (Task 5 walkthrough step).
5. **An organizer of a different event opens `/events/<id>/qr` or its API.** Expect a redirect to `/account?denied=1` / a 403 (Task 1 `canManageEvent` test, Task 6 walkthrough step).

---

### Task 1: Pure check-in helpers

**Files:**
- Create: `src/lib/checkin/pass.ts`, `src/lib/checkin/rules.ts`, `src/lib/checkin/display.ts`
- Test: `src/lib/checkin/pass.test.ts`, `src/lib/checkin/rules.test.ts`, `src/lib/checkin/display.test.ts`

**Interfaces (Produces):**
- `pass.ts` (node:crypto, server-only usage):
  - `PASS_TTL_MS = 30 * 60 * 1000`
  - `createPass(eventId: string, secret: string, nowMs: number): string`
  - `parsePass(pass: unknown): { eventId: string; issuedAtSeconds: number; signature: string } | null`. Checks the shape only: uuid, integer, 64 hex.
  - `verifyPass(parsed: ParsedPass, secret: string, nowMs: number): boolean`. Constant-time compare; rejects passes older than the TTL or more than 60 s in the future.
- `rules.ts`:
  - `type FlagReason = "no_location" | "outside_radius" | "low_accuracy"`
  - `LOW_ACCURACY_M = 200`
  - `distanceMeters(a: {lat:number;lng:number}, b: {lat:number;lng:number}): number` (haversine, R = 6 371 000)
  - `flagReason(loc: { distanceM: number; accuracyM: number } | null, radiusM: number): FlagReason | null`
  - `eventState(e: { status: string; starts_at: string; ends_at: string }, nowMs: number): "open" | "not_started" | "ended" | "unavailable"`
  - `canManageEvent(user: { id: string; role: Role }, e: { organizer_id: string }): boolean`
- `display.ts`:
  - `EVENT_TIME_ZONE = "America/Chicago"`
  - `shortName(displayName: string | null): string`
  - `formatEventWhen(startsAt: string, endsAt: string): string`
  - `formatTime(iso: string): string` (e.g. "9:04 AM")

- [ ] **Step 1: Write failing tests**
  - `pass.test.ts`:
    - round-trip `verifyPass(parsePass(createPass(id,s,t))!, s, t + 29*60_000) === true`;
    - false at `t + 31*60_000`;
    - false with another secret;
    - false when the eventId is swapped for a different uuid;
    - false when the timestamp is edited;
    - `parsePass("x.y.z")`, `parsePass(42)` and `parsePass(null)` are all null.
  - `rules.test.ts`:
    - `distanceMeters({lat:32.7300,lng:-97.1100},{lat:32.7309,lng:-97.1100})` ≈ 100 (±1);
    - `flagReason(null, 150)` → `"no_location"`;
    - `flagReason({distanceM:200,accuracyM:20},150)` → `"outside_radius"`;
    - `flagReason({distanceM:80,accuracyM:350},150)` → `"low_accuracy"`;
    - `flagReason({distanceM:80,accuracyM:20},150)` → `null`;
    - `eventState` returns `open` inside the window, `not_started` before, `ended` at `ends_at`, and `unavailable` for `draft`/`cancelled`;
    - `canManageEvent` is true for the organizer and for an admin, false for another organizer and for a participant.
  - `display.test.ts`:
    - `shortName("Pat Volunteer")` → `"Pat V."`;
    - `shortName("  ana  maria lopez ")` → `"Ana L."`. The first letter of the first name is capitalized; the initial comes from the last word.
    - `shortName("Pat")` → `"Pat"`;
    - `shortName(null)` and `shortName("")` → `"Volunteer"`;
    - `formatEventWhen("2026-11-21T15:00:00Z","2026-11-21T18:00:00Z")` → `"Sat, Nov 21 · 9:00 AM – 12:00 PM"`;
    - `formatTime("2026-11-21T15:04:00Z")` → `"9:04 AM"`.
- [ ] **Step 2:** Run `npx vitest run src/lib/checkin`. Expected: FAIL (modules missing).
- [ ] **Step 3:** Implement the three modules with the signatures above. `formatEventWhen`/`formatTime` use `Intl.DateTimeFormat("en-US", { timeZone: EVENT_TIME_ZONE, … })`.
- [ ] **Step 4:** Run `npx vitest run`. Expected: all pass.
- [ ] **Step 5:** Commit: `git add src/lib/checkin && git commit -m "Add check-in pass, distance, flag and display helpers"`

### Task 2: `record_qr_check_in` database function

**Files:**
- Create: `supabase/migrations/20261112090000_record_qr_check_in.sql`
- Test: `supabase/tests/qr_check_in_checks.sql`, in the style of `check_in_schema_checks.sql`: DO block, test accounts, everything undone with the P0099 exception, ending in `select 'All N QR check-in checks passed'`.

**Interfaces (Produces):**
- `public.record_qr_check_in(p_user_id uuid, p_event_id uuid, p_distance_m numeric, p_accuracy_m numeric, p_flag_reason text) returns table (check_in_id uuid, already_checked_in boolean, checked_in_at timestamptz, points_awarded integer, total_points bigint)`
- It is `security definer`, `set search_path = ''`, with execute revoked from public, anon and authenticated and granted to service_role.
- Errors:
  - `raise exception 'event_not_open' using errcode = 'PC001'` when the event is missing, not published, or outside the window;
  - `raise exception 'bad_flag_reason' using errcode = 'PC002'` when the flag isn't one of the three values or null.
- Behavior:
  - It locks the event row, then runs `insert … on conflict (user_id, event_id) do nothing returning id`.
  - If nothing was inserted, it returns the existing row with `already_checked_in = true`.
  - Otherwise it calls `public.award_pace_event_points(id)` when `events.points > 0`.
  - `total_points = public.get_pace_points_balance(p_user_id)`.

- [ ] **Step 1: Write the failing SQL test.** It checks, using `set local role service_role` for calls:
  1. The first call returns `already=false`, `points_awarded=10`, `total_points` increased by 10, and exactly one ledger row for the check-in.
  2. A second call for the same user and event returns `already=true` and the same `check_in_id`, with still one ledger row.
  3. `flag_reason`, `distance_m` and `accuracy_m` are stored, and `verification_method = 'qr'`.
  4. A `draft` event, an event with `starts_at` in the future, and one with `ends_at` in the past each raise `PC001`.
  5. `p_flag_reason = 'whatever'` raises `PC002`.
  6. An event with `points = 0` gives a check-in with `points_awarded = 0` and no ledger row.
  7. As `authenticated` (participant claims), calling it raises `insufficient_privilege`.
- [ ] **Step 2:** Run it with the PGlite harness (`node <scratchpad>/pgtest/run.mjs <repo> supabase/tests/qr_check_in_checks.sql`). Expected: FAIL (function missing).
- [ ] **Step 3:** Write the migration (header comment in the style of `20261110090000_check_in_schema.sql`).
- [ ] **Step 4:** Run all `supabase/tests/*.sql` with the harness. Expected: all PASS.
- [ ] **Step 5:** Commit: `git commit -m "Add record_qr_check_in: one check-in and its points in one transaction"`

### Task 3: Event data access (server-only)

**Files:**
- Create: `src/lib/checkin/events.ts` (`import "server-only"`; uses `createAdminClient()`; every function calls `await connection()` first)

**Interfaces:**
- Consumes: `eventState`, `canManageEvent` (Task 1).
- Produces:
  - `type CheckInEvent = { id: string; organizer_id: string; title: string; location_name: string | null; latitude: number; longitude: number; radius_m: number; starts_at: string; ends_at: string; points: number; status: string }`
  - `getEvent(eventId: string): Promise<CheckInEvent | null>` (returns null for a non-uuid without querying)
  - `getEventSecret(eventId: string): Promise<string | null>`
  - `listManagedEvents(user: CurrentUser): Promise<CheckInEvent[]>`. These are events not yet ended (`ends_at > now`), ordered by `starts_at`: all of them for admins, `organizer_id = user.id` for organizers, `[]` otherwise.
  - `checkInSummary(eventId: string): Promise<{ count: number; recent: { name: string; at: string }[] }>`. This counts the event's check-ins and gives the latest 4 joined to `profiles.display_name`; the name is passed raw, and the caller applies `shortName`.
  - `hasCheckedIn(userId: string, eventId: string): Promise<{ checked_in_at: string; points_awarded: number } | null>`

- [ ] **Step 1:** Implement. There are no unit tests: it's a thin query layer, exercised by the Task 5/6 walkthrough with the fake Supabase. Extend the fake with `GET /rest/v1/events`, `/rest/v1/event_qr_secrets`, `/rest/v1/check_ins`, `/rest/v1/profiles` and `POST /rest/v1/rpc/record_qr_check_in`.
- [ ] **Step 2:** Run `npx tsc --noEmit && npx eslint src`. Expected: clean.
- [ ] **Step 3:** Commit together with Task 4.

### Task 4: `checkIn` Server Action

**Files:**
- Create: `src/lib/checkin/actions.ts` (`"use server"`)
- Test: `src/lib/checkin/actions.test.ts` (vitest; `vi.mock` `./events`, `@/lib/auth/session`, `@/lib/supabase/admin`, `@/lib/audit/log`)

**Interfaces:**
- Consumes: Task 1 helpers, Task 3 `getEvent`/`getEventSecret`, Task 2 RPC, `getCurrentUser`, `logAudit`.
- Produces:
  - `type CheckInLocation = { latitude: number; longitude: number; accuracy: number }`
  - `type CheckInResult = { kind: "checked_in"; eventTitle: string; checkedInAt: string; points: number; total: number } | { kind: "already"; eventTitle: string; checkedInAt: string; points: number } | { kind: "expired" } | { kind: "not_open"; eventTitle: string; when: string } | { kind: "signed_out" }`
  - `checkIn(pass: string, location: CheckInLocation | null): Promise<CheckInResult>`

- [ ] **Step 1: Write failing tests:**
  - signed out → `signed_out`;
  - an expired or tampered pass → `expired`;
  - an ended event → `not_open`, with the RPC not called;
  - a location 200 m away with radius 150 → the RPC is called with `p_flag_reason: "outside_radius"` and a rounded `p_distance_m`;
  - **no argument or audit call contains the input latitude or longitude** (assert on `JSON.stringify` of all mock calls);
  - an RPC returning `already_checked_in: true` → `already`;
  - an RPC error with code `PC001` → `not_open`.
- [ ] **Step 2:** Run `npx vitest run src/lib/checkin/actions.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement:
  1. Validate that the location numbers are finite (lat ±90, lng ±180, accuracy ≥ 0); otherwise treat the location as `null`.
  2. Round the distance and accuracy to 0.1 m.
  3. Call `logAudit({ action: "checkin.attempt", outcome, reasonCode, actorId, actorRole, targetType: "event", targetId, metadata: { distance_m, flag_reason } })` for every outcome except `signed_out`.
- [ ] **Step 4:** Run `npx vitest run`. Expected: all pass.
- [ ] **Step 5:** Commit: `git commit -m "Add the checkIn action and event lookups"`

### Task 5: Volunteer pages (`/check-in`)

**Files:**
- Create: `src/app/(auth)/check-in/page.tsx` (server), `src/app/(auth)/check-in/check-in-flow.tsx` (client), `src/app/(auth)/check-in/screens.tsx` (static screens)
- Modify:
  - `src/lib/auth/auth-cookies.ts`: `writePendingEmail(email, sentAt, next?: string)`; `readPendingEmail` returns `{ email, sentAt, next: string | null }`, with next through `safeNextPath`. Add a test to `auth-cookies.test.ts`.
  - `src/lib/auth/actions.ts` (`signUp` stores `safeNextPath(formData.get("next"))` when it isn't `/account`).
  - `src/app/(auth)/signup/page.tsx` + `signup-form.tsx` (hidden `next` input from `searchParams`, inside `<Suspense>`).
  - `src/app/(auth)/verify-email/page.tsx` + `verify-email.tsx` (prop `next: string | null`; done button: `href={next ?? "/login"}`, label `next ? "Finish checking in" : "Continue to log in"`).

**Interfaces:** Consumes Tasks 1, 3 and 4.

- [ ] **Step 1: Write the failing test** for the `auth-cookies` `next` round-trip (`next` of `"https://evil.example"` → `null`). Run it, see it fail, implement, see it pass.
- [ ] **Step 2: Build `page.tsx`.** Wrap it in `AuthPage back="home"` and `<Suspense>`.
  - `?e&c`: check the code with the event secret, then check `eventState`.
    - Open: `redirect("/check-in?pass=" + createPass(...))`.
    - Not open: the "Check-in isn't open" screen.
    - Bad code: the "This code has expired" screen.
    - Audit a failed scan as `checkin.attempt` failure, reason `CODE_INVALID`.
  - `?pass`: parse and verify it, load the event and the current user.
    - Signed out: "Almost there", with links to `/login?next=` and `/signup?next=` (encodeURIComponent of `/check-in?pass=…`).
    - Already checked in (`hasCheckedIn`): "You're already checked in".
    - Otherwise: `<CheckInFlow pass event={{title, when, location_name}} />`.
  - Nothing else in the URL: "This code has expired".
- [ ] **Step 3: Build `check-in-flow.tsx`.**
  - "One last step" screen.
  - The button calls `navigator.geolocation.getCurrentPosition(ok, err, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })`, then `checkIn(pass, loc)`.
  - On a location error it shows `<div class="alert alert-error">` with "We couldn't get your location." and keeps the "Check in without location" button.
  - It renders the result: her landing `demo-card` "You're checked in" with `+{points}`, or the already / not-open / expired screens.
  - Copy and markup as in the mockup (`checkin-flow.html`).
- [ ] **Step 4: Walkthrough** (headless Edge + fake Supabase; phone 390×844). Each of these must reach the expected screen with no console errors:
  - logged-out scan → Almost there → log in → One last step;
  - share location (granted via `Browser.grantPermissions` + `Emulation.setGeolocationOverride`) → checked in with +10;
  - deny location (no grant) → the error alert, then "without location" → checked in;
  - rescan → already;
  - old code → expired;
  - event not started → isn't open;
  - sign up with `next` → verify → "Finish checking in" → One last step.
- [ ] **Step 5:** Commit: `git commit -m "Add the volunteer check-in pages"`

### Task 6: Organizer QR screen and account list

**Files:**
- Create: `src/app/api/events/[id]/qr/route.ts`, `src/app/(auth)/events/[id]/qr/page.tsx`, `src/app/(auth)/events/[id]/qr/organizer-qr.tsx` (client)
- Modify: `src/app/(auth)/account/page.tsx` (organizers and admins: "Your events" list with a `btn btn-primary` "Show QR code" link per event, using `formatEventWhen`)

**Interfaces:**
- `GET /api/events/[id]/qr` → 401 if signed out; 403 unless `canManageEvent`; 404 if there's no event.
- Otherwise `{ state: "open"|"not_started"|"ended"|"unavailable", url: string | null, secondsRemaining: number | null, count: number, recent: { name: string; time: string }[], opensAt: string, closesAt: string }`, with `Cache-Control: no-store`.
- `url` = `${origin}/check-in?e=${id}&c=${code}`, and only when `state === "open"`.

- [ ] **Step 1: Build the route.** Uses `getCurrentUser`, `getEvent`, `canManageEvent`, `getEventSecret`, `currentCode`, `checkInSummary` and `shortName`/`formatTime`.
- [ ] **Step 2: Build `page.tsx`.** `requireUser("/events/<id>/qr")`, then `getEvent`; redirect to `/account?denied=1` when `!canManageEvent`; render the laptop layout from the mockup (`org-grid` styles go in `pace-ui.css`, outside Krishna's section, clearly commented).
- [ ] **Step 3: Build `organizer-qr.tsx`.** It polls every 5 s, plus an immediate refetch when `secondsRemaining` reaches 0. `react-qr-code` at 330 px; countdown bar; "New code in N seconds".
  - When not open: "Check-in opens at {time}" or "Check-in has closed".
  - On a fetch error: keep the last code and retry in 5 s.
- [ ] **Step 4: Walkthrough** (desktop 1280×800):
  - the organizer sees the QR code and the count updates after a volunteer checks in;
  - the QR value changes after 30 s;
  - another organizer is redirected to `/account?denied=1`, and the API returns 403;
  - the account page shows the event with "Show QR code".
- [ ] **Step 5:** Commit: `git commit -m "Add the organizer QR screen and event list"`

### Task 7: Final checks and PR

- [ ] Run `npx vitest run`, `npx eslint src next.config.ts`, `npx tsc --noEmit`, `next build` (real env) and `next build` with blank `NEXT_PUBLIC_SUPABASE_*`, plus all `supabase/tests/*.sql` via PGlite. Expected: all pass.
- [ ] Commit the design doc and this plan. Push branch `qr-check-in` and open a PR with:
  - the design decisions;
  - the pilot setup SQL (spec §"Pilot setup");
  - a note to run `supabase/tests/qr_check_in_checks.sql` after merge;
  - the test results.
