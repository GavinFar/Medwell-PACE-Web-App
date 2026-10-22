import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { safeNextPath } from "@/lib/auth/redirect";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in · PACE Platform" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-pace-line/60 md:grid-cols-2">
      <section className="hidden flex-col justify-between gap-8 bg-pace-navy p-10 text-white md:flex">
        <div className="flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/60">
            Medwell Solutions
          </p>
          <h1 className="font-heading text-4xl font-bold leading-tight">
            Welcome back to <span className="text-[#ffb3b3]">PACE.</span>
          </h1>
          <p className="text-white/75">
            Track your verified participation, earn PACE points, and see the impact your
            community makes.
          </p>
        </div>
        <ul className="flex flex-col gap-3 text-sm text-white/85">
          <li>✓ Check in at events by scanning a QR code</li>
          <li>✓ Points across Performance, Accountability, Community and Engagement</li>
          <li>✓ Verified reports for organizations and sponsors</li>
        </ul>
      </section>

      <section className="flex flex-col gap-6 p-6 sm:p-10">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-2xl font-bold text-pace-navy">Log in</h2>
          <p className="text-sm text-pace-muted">Use the email and password for your PACE account.</p>
        </div>
        <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-pace-tint" />}>
          <LoginGate searchParams={searchParams} />
        </Suspense>
        <p className="text-sm text-pace-muted">New to PACE? Sign-up is coming soon.</p>
      </section>
    </div>
  );
}

// Already signed in? Skip the form and go where they were headed.
async function LoginGate({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  if (await getCurrentUser()) redirect(nextPath);
  return <LoginForm next={nextPath} />;
}
