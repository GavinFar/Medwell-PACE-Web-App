import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getSupabaseEnv } from "@/lib/supabase/env";

// Placeholder home page. The Supabase status line confirms each deployment
// can reach the database; remove it once login is built.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Medwell Solutions
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">PACE Platform</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Verified community participation, scored across Performance, Accountability,
          Community and Engagement.
        </p>
      </div>
      <Link
        href="/demo/qr"
        className="w-fit rounded-full bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Try the QR check-in demo →
      </Link>
      <Suspense fallback={<StatusLine label="Checking Supabase…" tone="neutral" />}>
        <SupabaseStatus />
      </Suspense>
    </main>
  );
}

async function SupabaseStatus() {
  // Check on every request, not once at build time.
  await connection();

  const env = getSupabaseEnv();
  if (!env) return <StatusLine label="Supabase: not configured" tone="bad" />;

  let status: number | null;
  try {
    const res = await fetch(`${env.url}/auth/v1/health`, {
      headers: { apikey: env.key },
    });
    status = res.status;
  } catch {
    status = null;
  }

  if (status === 200) return <StatusLine label="Supabase: connected" tone="good" />;
  return (
    <StatusLine
      label={status === null ? "Supabase: unreachable" : `Supabase: error ${status}`}
      tone="bad"
    />
  );
}

function StatusLine({ label, tone }: { label: string; tone: "good" | "bad" | "neutral" }) {
  const dot = { good: "bg-green-500", bad: "bg-red-500", neutral: "bg-zinc-400" }[tone];
  return (
    <p className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </p>
  );
}
