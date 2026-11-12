import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { ErrorAlert, Icon, icons } from "../../(auth)/page-chrome";
import { AppPage } from "../app-chrome";
import { cancelRegistration, registerForEvent } from "./actions";
import { getDashboardData, type CheckInRow, type UpcomingEvent } from "./data";

export const metadata: Metadata = { title: "Dashboard · PACE Platform" };

type SearchParams = Promise<{ registered?: string; cancelled?: string; error?: string }>;

// Dates and times are shown in the platform's local time zone (Arlington, TX).
const TIME_ZONE = "America/Chicago";
const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: TIME_ZONE });
const dayFmt = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: TIME_ZONE });
const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: TIME_ZONE });
const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: TIME_ZONE });

// Milestones based on verified events attended (no database needed).
const ACHIEVEMENTS = [
  { title: "First contribution", target: 1, body: "Attend your first event" },
  { title: "Showing up", target: 3, body: "Attend 3 events" },
  { title: "Community regular", target: 5, body: "Attend 5 events" },
];

const STATUS: Record<CheckInRow["status"], { label: string; className: string }> = {
  accepted: { label: "Verified", className: "badge badge-success" },
  flagged: { label: "Under review", className: "badge badge-warn" },
  rejected_on_review: { label: "Not counted", className: "badge badge-muted" },
};

export default function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AppPage>
      <Suspense fallback={<p className="lead">Loading your dashboard…</p>}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </AppPage>
  );
}

async function Dashboard({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser("/dashboard");
  // Volunteers only. Other roles go to their account page until their dashboards exist.
  if (user.role !== "participant") redirect("/account");

  const [data, params] = await Promise.all([getDashboardData(user.id), searchParams]);

  return (
    <>
      <div className="dash-head">
        <h1>{data.firstName ? `Welcome back, ${data.firstName}` : "Welcome back"}</h1>
        <p className="lead">Here&apos;s your volunteering at a glance.</p>
      </div>

      {params.error === "register" && (
        <ErrorAlert>We couldn&apos;t register you for that event. It may have ended or been cancelled.</ErrorAlert>
      )}
      {params.error === "cancel" && <ErrorAlert>We couldn&apos;t cancel that registration. Please try again.</ErrorAlert>}
      {params.registered && (
        <div className="alert alert-success" role="status">
          <Icon>{icons.check}</Icon>
          <p>You&apos;re registered. See you there!</p>
        </div>
      )}
      {params.cancelled && (
        <div className="alert alert-info" role="status">
          <Icon>{icons.check}</Icon>
          <p>Your registration was cancelled.</p>
        </div>
      )}
      {data.loadError && <ErrorAlert>Some of your information couldn&apos;t be loaded. Please refresh the page.</ErrorAlert>}

      <div className="stats">
        <Stat label="PACE points" value={data.points} red icon={star} />
        <Stat label="Events attended" value={data.eventsAttended} icon={icons.check} />
        <Stat label="Registered events" value={data.registeredCount} icon={calendar} />
      </div>

      <div className="dash-grid">
        <div className="dash-col">
          <NextEvent event={data.nextEvent} />

          <section className="panel" aria-labelledby="upcoming-heading">
            <div className="panel-head">
              <h2 id="upcoming-heading">Upcoming events</h2>
              <p>Register to save your spot</p>
            </div>
            {data.upcoming.length === 0 ? (
              <p className="empty">No upcoming events right now. Check back soon.</p>
            ) : (
              <ul className="item-list">
                {data.upcoming.map((event) => (
                  <EventItem key={event.id} event={event} />
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="dash-col">
          <Achievements attended={data.eventsAttended} />

          <section className="panel" aria-labelledby="history-heading">
            <div className="panel-head">
              <h2 id="history-heading">Check-in history</h2>
            </div>
            {data.checkIns.length === 0 ? (
              <p className="empty">No check-ins yet. Scan an event&apos;s QR code when you arrive to earn points.</p>
            ) : (
              <ul className="item-list">
                {data.checkIns.map((checkIn) => (
                  <CheckInItem key={checkIn.id} checkIn={checkIn} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, icon, red = false }: { label: string; value: number; icon: React.ReactNode; red?: boolean }) {
  return (
    <div className="stat-card">
      <span className={red ? "icon-badge red" : "icon-badge"}>
        <Icon>{icon}</Icon>
      </span>
      <div>
        <p className="stat-label">{label}</p>
        <p className={red ? "stat-value red" : "stat-value"}>{value.toLocaleString("en-US")}</p>
      </div>
    </div>
  );
}

function NextEvent({ event }: { event: UpcomingEvent | null }) {
  if (!event) {
    return (
      <section className="next-card" aria-labelledby="next-heading">
        <h2 id="next-heading">Your next opportunity</h2>
        <p className="next-empty">You&apos;re not registered for any upcoming events yet. Pick one below to get started.</p>
      </section>
    );
  }
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  return (
    <section className="next-card" aria-labelledby="next-heading">
      <div className="panel-head">
        <h2 id="next-heading">Your next opportunity</h2>
        <span className="badge badge-success">
          <Icon strokeWidth={3}>{icons.check}</Icon>
          Registered
        </span>
      </div>
      <div className="next-body">
        <div className="date-block on-tint" aria-hidden="true">
          <span className="date-month">{monthFmt.format(start)}</span>
          <span className="date-day">{dayFmt.format(start)}</span>
        </div>
        <div className="item-body">
          <p className="next-title">{event.title}</p>
          <p className="item-meta">
            <span>
              <Icon>{icons.clock}</Icon>
              {dateFmt.format(start)}, {timeFmt.format(start)} – {timeFmt.format(end)}
            </span>
            {event.locationName && (
              <span>
                <Icon>{pin}</Icon>
                {event.locationName}
              </span>
            )}
          </p>
        </div>
      </div>
      <p className="next-foot">Scan the event&apos;s QR code when you arrive to earn {event.points} points.</p>
    </section>
  );
}

function Achievements({ attended }: { attended: number }) {
  return (
    <section className="panel" aria-labelledby="achievements-heading">
      <div className="panel-head">
        <h2 id="achievements-heading">Achievements</h2>
      </div>
      <ul className="achievement-list">
        {ACHIEVEMENTS.map((a) => {
          const earned = attended >= a.target;
          return (
            <li key={a.title} className={earned ? "earned" : "locked"}>
              <span className="achievement-icon">
                <Icon>{medal}</Icon>
              </span>
              <div className="item-body">
                <p className="item-title">{a.title}</p>
                <p className="achievement-desc">{a.body}</p>
              </div>
              <span className={earned ? "badge badge-success" : "badge badge-muted"}>
                {earned ? "Unlocked" : `${Math.min(attended, a.target)} of ${a.target}`}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function EventItem({ event }: { event: UpcomingEvent }) {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  return (
    <li>
      <div className="date-block" aria-hidden="true">
        <span className="date-month">{monthFmt.format(start)}</span>
        <span className="date-day">{dayFmt.format(start)}</span>
      </div>
      <div className="item-body">
        <p className="item-title">{event.title}</p>
        <p className="item-meta">
          <span>
            <Icon>{icons.clock}</Icon>
            <span className="sr-only">{dateFmt.format(start)}, </span>
            {timeFmt.format(start)} – {timeFmt.format(end)}
          </span>
          {event.locationName && (
            <span>
              <Icon>{pin}</Icon>
              {event.locationName}
            </span>
          )}
          <span>+{event.points} pts</span>
        </p>
        {event.description && (
          <details className="about">
            <summary>About this event</summary>
            <p>{event.description}</p>
          </details>
        )}
      </div>
      <div className="item-action">
        {event.registered ? (
          <div className="registered">
            <span className="badge badge-success">
              <Icon strokeWidth={3}>{icons.check}</Icon>
              Registered
            </span>
            <form action={cancelRegistration}>
              <input type="hidden" name="eventId" value={event.id} />
              <button type="submit" className="btn-link cancel-link">
                Cancel<span className="sr-only"> registration for {event.title}</span>
              </button>
            </form>
          </div>
        ) : (
          <form action={registerForEvent}>
            <input type="hidden" name="eventId" value={event.id} />
            <button type="submit" className="btn btn-primary btn-small">
              Register<span className="sr-only"> for {event.title}</span>
            </button>
          </form>
        )}
      </div>
    </li>
  );
}

function CheckInItem({ checkIn }: { checkIn: CheckInRow }) {
  // Flagged check-ins keep their points but wait for an admin to review them.
  const status =
  checkIn.status === "accepted" && checkIn.flagged ? STATUS.flagged : (STATUS[checkIn.status] ?? STATUS.flagged);
  return (
    <li>
      <div className="item-body">
        <p className="item-title">{checkIn.eventTitle}</p>
        <p className="item-meta">
          <span>{dateFmt.format(new Date(checkIn.checkedInAt))}</span>
          <span className={status.className}>{status.label}</span>
        </p>
      </div>
      <span className="points-earned">+{checkIn.pointsAwarded}</span>
    </li>
  );
}

// Icons in Krishna's line style (24×24, 2px stroke).
const star = <path d="M12 2l3 6.5 7 .9-5.1 4.8 1.3 7-6.2-3.5-6.2 3.5 1.3-7L2 9.4l7-.9z" />;
const medal = (
  <>
    <circle cx="12" cy="9" r="6" />
    <path d="M8.5 13.9 7 22l5-3 5 3-1.5-8.1" />
  </>
);
const calendar = (
  <>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M3 10h18" />
  </>
);
const pin = (
  <>
    <path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z" />
    <circle cx="12" cy="9" r="2.5" />
  </>
);
