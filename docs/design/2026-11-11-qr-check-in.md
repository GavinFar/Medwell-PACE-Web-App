# QR check-in: design

Status: approved by Gavin, 2026-11-11.

## Why

The pilot (Nov 2026) needs the core promise of PACE to work for real: a volunteer at a
nonprofit event scans a QR code with their phone camera and gets verified credit (PACE
points) that rolls up to their company. Today only a demo exists (`/demo/qr`,
`/demo/check-in`) that checks a code but saves nothing.

## Goals

- An organizer opens one page on a laptop or tablet at the event. It shows a QR code that
  changes every 30 seconds, plus a live count and the latest few names.
- A volunteer scans it. If they're logged in, they share their location (or skip it) and
  are checked in, and see "You're checked in" with the points earned.
- If they're not logged in, they log in or sign up first **without scanning again**.
- One check-in per volunteer per event. Points are awarded once, in the same database
  transaction as the check-in.
- Only the distance from the event and the GPS accuracy are stored, never coordinates.

## Non-goals (for now)

- Creating events in the app. The pilot event is added directly in Supabase (SQL below).
- Organizer tools beyond the QR screen: manual check-ins, editing or reviewing check-ins,
  reports.
- Nonprofit/sponsor accounts, event registration, check-out or hours.
- Removing the old `/demo` pages (separate cleanup).

## Anti-goals (would be a failure even if it "works")

- A photo or screenshot of the QR code that works long after it was taken.
- The browser deciding the points, the event or the verification result.
- Raw GPS coordinates stored or logged anywhere.
- A volunteer who signs up at the event having to scan again.

## Decisions made with Gavin

- **Screens:** the mockups shown on 2026-11-11, in Krishna's design (her `styles.css`
  classes).
  - Volunteer: "Almost there" (log in / create account) → "One last step" (share
    location) → "You're checked in" (her landing-page check-in card with "+N" points).
  - Edge cases: already checked in, code expired, check-in not open.
  - Organizer: the QR code with a countdown, the event's details, and a "Checked in"
    count with the latest 4 names as "First L." plus the time.
- **Location:** explain first, then the phone's own permission popup. A "Check in without
  location" link is always available.
- **Points are always awarded.** The check-in stays `accepted`. Missing or far-away
  locations are only noted in `flag_reason` for review; an admin can reverse points later.
- **Not logged in:** the scan is saved for 30 minutes while they log in or sign up.
- **Pilot setup:** the QR screen runs on a laptop or tablet, and the pilot event is
  created directly in Supabase.

## How it works

### 1. The QR code (organizer screen)

- Page: `/events/[id]/qr`. Only that event's organizer or an admin can open it; anyone
  else is sent to `/account?denied=1`.
- The page polls `GET /api/events/[id]/qr` (same access rule) every 5 seconds. It returns:
  - the current check-in URL `https://<site>/check-in?e=<event id>&c=<code>`;
  - the seconds until the code changes;
  - the check-in count and the latest 4 check-ins (`First L.`, time).
- `code` = HMAC-SHA256(event secret, 30-second window), cut to 16 hex characters. This is
  the existing `src/lib/qr/rotating-code.ts`. The secret is in `event_qr_secrets`, created
  automatically for each event and readable only with the service-role key.
- The QR code is shown only while the event is running. Before it starts, the screen says
  when check-in opens; after it ends, it says check-in has closed.
- Names come from `profiles.display_name`, shortened to first name plus last initial, and
  are read with the service-role key after the access check.

### 2. Scanning (volunteer's phone)

- `/check-in?e=…&c=…`: the server checks the code (current or previous window, as today)
  and that the event is published and running.
  - **Valid:** redirect to `/check-in?pass=<pass>`.
  - **Invalid:** "This code has expired".
  - **Not running:** "Check-in isn't open".
- **The pass** is `<event id>.<issued-at seconds>.<HMAC of both, keyed by the event's
  secret>`. It's valid for 30 minutes and only for that event. Signing it with the event
  secret means no new secret to manage. It's carried in the URL, so it survives logging in
  or signing up.
- `/check-in?pass=…`:
  - **Not logged in:** "Almost there". "Log in" goes to `/login?next=<this URL>`; "Create
    an account" goes to `/signup?next=<this URL>`.
  - **Already checked in to this event:** "You're already checked in".
  - **Otherwise:** "One last step" (the location screen).
- **Sign-up keeps the pass.** `next` travels in the pending-email cookie. After the code is
  confirmed (which logs them in), the verify page's button reads "Finish checking in" and
  goes to `next`. **This changes Krishna's verify page only when a check-in is waiting.**

### 3. Checking in

- "Share location and check in" calls `navigator.geolocation.getCurrentPosition` (high
  accuracy, 15-second timeout). It then sends the pass, latitude, longitude and accuracy to
  the `checkIn` Server Action.
  - If the browser refuses or times out, the screen says so and shows the "without
    location" button.
- "Check in without location" calls the same action with no location.
- **`checkIn` (server):**
  1. Requires a logged-in user, a valid pass, and an event that is published and running.
  2. Computes the distance to the event server-side (haversine, in meters) and then
     discards the coordinates. They are never stored or logged.
  3. Sets `flag_reason`:
     - `no_location` when there's no location;
     - `outside_radius` when the distance is more than `events.radius_m`;
     - `low_accuracy` when the accuracy is worse than 200 m and the distance can't be
       trusted;
     - otherwise empty.
  4. Calls a new database function, `record_qr_check_in`. It's service-role only.
  5. Writes `checkin.attempt` to the audit log (success, or the failure reason), with no
     coordinates.
- **`record_qr_check_in(user, event, distance, accuracy, flag_reason)`** runs as one
  transaction:
  - It checks again that the event is published and running.
  - It inserts the check-in (`verification_method` `qr`; the organization is copied by the
    existing trigger). If one already exists for this user and event, it returns it with
    `already = true` and changes nothing.
  - When `events.points > 0`, it calls the existing `award_pace_event_points`. That writes
    the ledger row and `points_awarded`, and an audit row.
  - It returns the check-in id, the time, the points awarded, `already`, and the
    volunteer's new total.
- **Result screens:** "You're checked in" (with points), "You're already checked in",
  "Check-in isn't open" (if the event ended while they were logging in), and "This code has
  expired" (the 30-minute pass ran out).

### 4. Finding the QR screen

On `/account`, organizers and admins see their events that haven't ended, each with a
"Show QR code" button that opens `/events/[id]/qr`.

## Pilot setup (SQL Editor, done by Gavin)

- Make someone an organizer:
  `update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"organizer"}' where email = '…';`
- Create the event. Times are in UTC; 9 AM in Texas is 15:00Z during CST:

  ```sql
  insert into public.events (organizer_id, title, location_name, latitude, longitude, radius_m, starts_at, ends_at, points, status)
  values ('<organizer user id>', 'Event name', 'Place', 32.73, -97.11, 150, '…', '…', 10, 'published');
  ```

## Left to the builder (my calls; Gavin can override)

- **Which flag wins:** if more than one applies, the first in this order is used:
  `no_location`, `outside_radius`, `low_accuracy`.
- **Where the pages live:** `/check-in` and `/events/[id]/qr` go in the `(auth)` route
  group, so they get Krishna's stylesheet and header and footer.

- **Time zone:** event times are shown in Texas time (`America/Chicago`) for now, because
  events have no time zone column yet.
- **Check-in window:** check-in is open from `starts_at` to `ends_at`, with no early grace
  period.
- **Organizer screen:** while the event is running, the screen keeps working on its own,
  with no need to refresh.
- **Recent names:** the latest 4, refreshed every 5 seconds.
- **Points category:** the existing award function leaves the ledger `category` empty for
  event attendance. Tagging it with a PACE category is left to the scoring work.
- **Tests:**
  - unit tests for the pass, the distance, the flag reason and the name shortening;
  - a SQL test, `supabase/tests/qr_check_in_checks.sql`, for `record_qr_check_in` (once
    per user per event, points once, service-role only, the event must be running,
    `flag_reason` stored);
  - an end-to-end walkthrough against a fake Supabase, as for PR #20.
