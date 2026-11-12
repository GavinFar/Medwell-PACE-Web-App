import Link from "next/link";
import { formatTime } from "@/lib/checkin/display";
import { Icon, icons } from "../page-chrome";

// The volunteer's check-in screens, copied from the mockups approved on 2026-11-11
// (built with Krishna's styles). Used by the server page (./page.tsx) and the
// client flow (./check-in-flow.tsx), so nothing here may be server-only.

export const checkInIcons = {
  qr: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3M21 14v.01M17 21h4v-4M14 21v.01" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
};

// The volunteer dashboard shows their points and check-ins (it sends other roles to /account).
const POINTS_HREF = "/dashboard";

// The light box with the event's name and one line under it.
export function EventBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="event-box">
      <strong>{title}</strong>
      {children}
    </div>
  );
}

// A: scanned, not logged in.
export function AlmostThere({
  title,
  when,
  loginHref,
  signupHref,
}: {
  title: string;
  when: string;
  loginHref: string;
  signupHref: string;
}) {
  return (
    <div className="card auth-card">
      <div className="auth-head">
        <div className="auth-icon">
          <Icon large>{checkInIcons.qr}</Icon>
        </div>
        <h1>Almost there</h1>
        <p className="lead">Log in or create an account to finish checking in. No need to scan again.</p>
      </div>
      <EventBox title={title}>{when}</EventBox>
      <Link className="btn btn-primary btn-block" href={loginHref}>
        Log in
      </Link>
      <div className="gap" />
      <Link className="btn btn-secondary btn-block" href={signupHref}>
        Create an account
      </Link>
    </div>
  );
}

// C: checked in. Krishna's "You're checked in" card from the landing page.
export function CheckedIn({
  title,
  locationName,
  checkedInAt,
  points,
}: {
  title: string;
  locationName: string | null;
  checkedInAt: string;
  points: number;
}) {
  return (
    <div className="demo-card">
      <span className="pill">Today</span>
      <p className="demo-title">{title}</p>
      {locationName && (
        <p className="demo-sub">
          <Icon>{checkInIcons.pin}</Icon>
          {locationName}
        </p>
      )}
      <div className="demo-success" role="status">
        <div className="demo-check">
          <Icon large strokeWidth={3}>
            {icons.check}
          </Icon>
        </div>
        <p className="demo-success-title">You&apos;re checked in</p>
        <p className="demo-success-sub">Thank you for volunteering today · {formatTime(checkedInAt)}</p>
      </div>
      <div className="demo-points">
        <span>Points earned</span>
        <strong>+{points}</strong>
      </div>
      <div className="gap" />
      <Link className="btn btn-secondary btn-block" href={POINTS_HREF}>
        See my points
      </Link>
    </div>
  );
}

export function AlreadyCheckedIn({
  title,
  checkedInAt,
  points,
}: {
  title: string;
  checkedInAt: string;
  points: number;
}) {
  return (
    <div className="card auth-card">
      <div className="auth-head">
        <div className="auth-icon">
          <Icon large strokeWidth={3}>
            {icons.check}
          </Icon>
        </div>
        <h1>You&apos;re already checked in</h1>
        <p className="lead">
          You checked in to <strong>{title}</strong> at {formatTime(checkedInAt)}
          {points > 0 ? ` and got your ${points} points` : ""}. Nothing else to do.
        </p>
      </div>
      <Link className="btn btn-secondary btn-block" href={POINTS_HREF}>
        See my points
      </Link>
    </div>
  );
}

export function CodeExpired() {
  return (
    <div className="card auth-card">
      <div className="auth-head">
        <div className="auth-icon red">
          <Icon large>{icons.clock}</Icon>
        </div>
        <h1>This code has expired</h1>
        <p className="lead">Scan the QR code on the event screen again. It changes every 30 seconds.</p>
      </div>
    </div>
  );
}

export function NotOpen({
  title,
  when,
  reason,
}: {
  title: string;
  when: string;
  reason: "not_started" | "ended" | "unavailable";
}) {
  return (
    <div className="card auth-card">
      <div className="auth-head">
        <div className="auth-icon red">
          <Icon large>{icons.alert}</Icon>
        </div>
        <h1>Check-in isn&apos;t open</h1>
        <p className="lead">
          {reason === "unavailable" ? (
            <>
              <strong>{title}</strong> isn&apos;t taking check-ins right now.
            </>
          ) : (
            <>
              <strong>{title}</strong> runs {when}.{" "}
              {reason === "ended" ? "Check-in has closed." : "Check-in opens when it starts."}
            </>
          )}
        </p>
      </div>
    </div>
  );
}
