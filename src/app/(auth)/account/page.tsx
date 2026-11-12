import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/lib/auth/actions";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { requireUser, type CurrentUser } from "@/lib/auth/session";
import { formatEventWhen } from "@/lib/checkin/display";
import { listManagedEvents } from "@/lib/checkin/events";
import { AuthPage } from "../page-chrome";

export const metadata: Metadata = { title: "Your account · PACE Platform" };

// Where people land after logging in, until role dashboards exist.
export default function AccountPage({ searchParams }: PageProps<"/account">) {
  return (
    <AuthPage back="home">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-pace-line/60 sm:p-10">
        <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-pace-tint" />}>
          <AccountDetails searchParams={searchParams} />
        </Suspense>
      </div>
    </AuthPage>
  );
}

async function AccountDetails({ searchParams }: Pick<PageProps<"/account">, "searchParams">) {
  const user = await requireUser("/account");
  const { denied } = await searchParams;

  return (
    <>
      {denied && (
        <p role="alert" className="rounded-lg bg-pace-error-bg px-4 py-3 text-sm text-pace-error">
          You don&apos;t have access to that page.
        </p>
      )}
      <h1 className="font-heading text-2xl font-bold text-pace-navy">Your account</h1>
      <dl className="flex flex-col gap-3 text-sm">
        <div className="flex justify-between gap-4 border-b border-pace-line/60 pb-3">
          <dt className="text-pace-muted">Email</dt>
          <dd className="truncate font-medium">{user.email ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-pace-muted">Role</dt>
          <dd className="font-medium">{ROLE_LABELS[user.role]}</dd>
        </div>
      </dl>
      {user.role === "participant" && (
        <Link className="btn btn-primary" href="/dashboard">
          Go to my dashboard
        </Link>
      )}
      {(user.role === "organizer" || user.role === "admin") && <YourEvents user={user} />}
      <form action={signOut}>
        <button
          type="submit"
          className="h-11 w-full rounded-lg border border-pace-line font-semibold text-pace-navy transition-colors hover:bg-pace-tint"
        >
          Log out
        </button>
      </form>
    </>
  );
}

// Organizers (and admins) open the QR screen for an event from here.
// Lists events that haven't ended yet, soonest first.
async function YourEvents({ user }: { user: CurrentUser }) {
  const events = await listManagedEvents(user);
  return (
    <section aria-labelledby="your-events" className="flex flex-col gap-3">
      <h2 id="your-events" className="font-heading text-lg font-bold text-pace-navy">
        Your events
      </h2>
      {events.length === 0 ? (
        <p className="text-sm text-pace-muted">No upcoming events.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((e) => (
            <li key={e.id} className="flex flex-col gap-2 border-b border-pace-line/60 pb-3">
              <span className="font-semibold">{e.title}</span>
              <span className="text-sm text-pace-muted">{formatEventWhen(e.starts_at, e.ends_at)}</span>
              <Link className="btn btn-primary" href={`/events/${e.id}/qr`}>
                Show QR code
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
