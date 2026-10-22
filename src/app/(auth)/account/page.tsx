import type { Metadata } from "next";
import { Suspense } from "react";
import { signOut } from "@/lib/auth/actions";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Your account · PACE Platform" };

// Where people land after logging in, until role dashboards exist.
export default function AccountPage({ searchParams }: PageProps<"/account">) {
  return (
    <div className="flex w-full max-w-md flex-col gap-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-pace-line/60 sm:p-10">
      <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-pace-tint" />}>
        <AccountDetails searchParams={searchParams} />
      </Suspense>
    </div>
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
