import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DEFAULT_AFTER_LOGIN, safeNextPath } from "@/lib/auth/redirect";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in · PACE Platform" };

// Krishna's login design (public/login.html), made functional. Wording that described
// features we don't have (SSO, clinical analytics, SOC 2) was changed to what's true.
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="mx-auto my-auto flex w-full max-w-7xl flex-col items-center justify-center p-0 md:p-margin-mobile">
      <div className="grid w-full grid-cols-1 overflow-hidden rounded-2xl bg-surface-container-lowest shadow-2xl shadow-primary-container/10 lg:grid-cols-12">
        {/* Left: branding and what PACE does */}
        <div className="relative flex flex-col justify-between overflow-hidden bg-primary-container p-space-lg text-on-primary md:p-space-xl lg:col-span-6 xl:col-span-7">
          <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-secondary-container/15 blur-3xl" />
          <div className="pointer-events-none absolute right-0 -bottom-24 h-80 w-80 rounded-full bg-on-tertiary-container/10 blur-3xl" />

          <div className="relative z-10">
            <div className="mb-space-lg flex items-center gap-space-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-lowest/10 backdrop-blur-md">
                <span
                  className="material-symbols-outlined animate-pulse text-2xl text-secondary-container"
                  style={{ fontVariationSettings: '"FILL" 1' }}
                >
                  ecg_heart
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-headline-sm text-headline-sm font-bold tracking-tight text-surface-container-lowest">
                  Medwell Solutions
                </span>
                <span className="font-label-sm text-label-sm uppercase tracking-widest text-primary-fixed-dim">
                  PACE Measurement Platform
                </span>
              </div>
            </div>

            <div className="mb-space-md inline-flex items-center gap-2 rounded-full bg-secondary-container/20 px-3 py-1 text-secondary-fixed">
              <span className="material-symbols-outlined text-sm">verified_user</span>
              <span className="font-label-sm text-label-sm font-bold uppercase tracking-wider">
                Secure Authentication • PACE Platform
              </span>
            </div>

            <h1 className="mb-space-sm font-display-lg text-headline-lg leading-tight font-bold text-surface-container-lowest md:text-display-lg">
              Welcome Back to{" "}
              <span className="bg-linear-to-r from-secondary-fixed-dim via-secondary-container to-secondary-fixed bg-clip-text text-transparent">
                PACE.
              </span>
            </h1>
            <p className="mb-space-lg max-w-xl font-body-md text-body-md leading-relaxed text-primary-fixed-dim">
              Your community impact journey continues here. Sign in to track your verified
              participation, join community events, and watch your PACE points grow.
            </p>

            <div className="mb-space-lg grid grid-cols-1 gap-space-sm">
              <BenefitCard
                icon="qr_code_scanner"
                iconClass="text-primary-fixed"
                title="Track Verified Participation"
                badge="Geostamped"
                text="QR check-ins with location checks and fraud-resistant attendance records."
              />
              <BenefitCard
                icon="military_tech"
                iconClass="text-secondary-fixed"
                title="Earn PACE Points"
                badge="Civic Merit"
                text="Points across Performance, Accountability, Community and Engagement."
              />
              <BenefitCard
                icon="monitoring"
                iconClass="text-primary-fixed-dim"
                title="Measure Meaningful Impact"
                badge="Impact Reports"
                text="Verified participation reports for organizations, nonprofits and sponsors."
              />
            </div>
          </div>

          <div className="relative z-10 pt-space-sm">
            <div className="mb-space-sm h-8 w-full opacity-40">
              <svg
                className="h-full w-full text-secondary-container"
                fill="none"
                preserveAspectRatio="none"
                viewBox="0 0 500 40"
                aria-hidden
              >
                <path
                  d="M0 20 L180 20 L195 20 L205 3 L215 37 L225 10 L235 28 L242 20 L320 20 L330 8 L338 32 L345 20 L500 20"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <Suspense fallback={<ContextBanner next={DEFAULT_AFTER_LOGIN} />}>
              <ContextBannerFromParams searchParams={searchParams} />
            </Suspense>
          </div>
        </div>

        {/* Right: the sign-in form */}
        <div className="flex flex-col justify-center bg-surface-container-lowest p-space-lg md:p-space-xl lg:col-span-6 xl:col-span-5">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-space-lg">
              <div className="mb-space-xs inline-flex items-center gap-1 font-label-md text-label-md font-bold uppercase tracking-wider text-secondary">
                <span className="material-symbols-outlined text-sm">lock_open</span>
                <span>Member Portal</span>
              </div>
              <h2 className="font-headline-lg text-headline-lg font-bold text-primary-container">
                Welcome Back!
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Sign in to your Medwell PACE account.
              </p>
            </div>

            <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-surface-container-low" />}>
              <LoginGate searchParams={searchParams} />
            </Suspense>
          </div>
        </div>
      </div>
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

async function ContextBannerFromParams({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next } = await searchParams;
  return <ContextBanner next={safeNextPath(next)} />;
}

// The design's bottom callout. Tells people where they'll go after signing in,
// or how check-in works if they came straight to the login page.
function ContextBanner({ next }: { next: string }) {
  const returning = next !== DEFAULT_AFTER_LOGIN;
  return (
    <div className="flex items-center gap-space-sm rounded-xl bg-surface-container-lowest/10 p-space-sm backdrop-blur-md">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary-container text-on-secondary shadow-md">
        <span className="material-symbols-outlined text-lg">
          {returning ? "login" : "event_available"}
        </span>
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-1.5">
          <span className="font-label-sm text-label-sm font-bold text-secondary-fixed">
            {returning ? "Sign in to continue" : "QR Check-in"}
          </span>
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
        </div>
        <p className="truncate font-body-sm text-body-sm text-primary-fixed-dim">
          {returning
            ? `You'll go back to ${next} after you sign in.`
            : "At an event? Scan the organizer's QR code with your phone camera."}
        </p>
      </div>
    </div>
  );
}

function BenefitCard({
  icon,
  iconClass,
  title,
  badge,
  text,
}: {
  icon: string;
  iconClass: string;
  title: string;
  badge: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-space-sm rounded-xl bg-surface-container-lowest/5 p-space-sm backdrop-blur-sm transition-colors hover:bg-surface-container-lowest/10">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-low/15 ${iconClass}`}
      >
        <span className="material-symbols-outlined text-xl">{icon}</span>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-space-xs">
          <h4 className="font-headline-sm text-label-lg font-bold text-surface-container-lowest">{title}</h4>
          <span className="rounded-full bg-surface-container-low/20 px-2 py-0.5 font-label-sm text-[10px] uppercase text-primary-fixed">
            {badge}
          </span>
        </div>
        <p className="font-body-sm text-body-sm text-primary-fixed-dim">{text}</p>
      </div>
    </div>
  );
}
