"use client";

import { useActionState, useState } from "react";
import { signIn, type SignInState } from "@/lib/auth/actions";

const initialState: SignInState = { error: null };

// The form half of Krishna's login design. Field names (email, password, remember,
// next) are what the signIn Server Action reads, so keep them if restyling.
export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const [showPassword, setShowPassword] = useState(false);
  // Controlled, because React resets uncontrolled fields after every form action,
  // which would wipe the email after a wrong password.
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<"reset" | "signup" | null>(null);

  return (
    <>
      {state.error && (
        <div role="alert" className="mb-space-md rounded-xl bg-error-container p-space-sm text-on-error-container">
          <div className="flex items-start gap-space-xs">
            <span className="material-symbols-outlined mt-0.5 shrink-0 text-xl text-error">error</span>
            <div className="min-w-0 text-left">
              <p className="font-label-lg text-label-lg font-bold text-error">Authentication Failed</p>
              <p className="font-body-sm text-body-sm text-on-error-container">{state.error}</p>
            </div>
          </div>
        </div>
      )}

      <form action={formAction} className="space-y-space-md">
        <input type="hidden" name="next" value={next} />

        <div className="space-y-1">
          <label className="block font-label-lg text-label-lg font-semibold text-on-surface" htmlFor="email">
            Email Address
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px]">alternate_email</span>
            </div>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@organization.org"
              className="h-11 w-full rounded-lg bg-surface-container-low pr-3 pl-10 font-body-md text-body-md text-on-surface transition-all placeholder:text-outline focus:bg-surface-container-lowest focus:shadow-md focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="block font-label-lg text-label-lg font-semibold text-on-surface" htmlFor="password">
            Password
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px]">key</span>
            </div>
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              placeholder="••••••••••••"
              className="h-11 w-full rounded-lg bg-surface-container-low pr-10 pl-10 font-body-md text-body-md text-on-surface transition-all placeholder:text-outline focus:bg-surface-container-lowest focus:shadow-md focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((shown) => !shown)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-on-surface-variant transition-colors hover:text-primary"
            >
              <span className="material-symbols-outlined text-[20px]">
                {showPassword ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <label className="flex cursor-pointer items-center gap-2 select-none">
            <input
              type="checkbox"
              name="remember"
              defaultChecked
              className="h-4 w-4 cursor-pointer rounded accent-primary-container focus:ring-0"
            />
            <span className="font-label-lg text-label-lg text-on-surface-variant">Remember Me</span>
          </label>
          <button
            type="button"
            onClick={() => setNotice(notice === "reset" ? null : "reset")}
            className="font-label-lg text-label-lg font-bold text-primary-container transition-colors hover:text-secondary"
          >
            Forgot Password?
          </button>
        </div>
        {notice === "reset" && (
          <Notice>Password reset is coming soon. For now, ask the PACE team to reset it for you.</Notice>
        )}

        <button
          type="submit"
          disabled={pending}
          className="group flex h-12 w-full items-center justify-center gap-space-xs rounded-lg bg-primary-container font-headline-sm text-label-lg font-bold text-on-primary shadow-md transition-all hover:bg-tertiary-container hover:shadow-lg active:scale-[0.99] disabled:cursor-wait disabled:opacity-90"
        >
          {pending ? (
            <span className="flex items-center gap-2">
              <svg className="h-5 w-5 animate-spin text-on-primary" fill="none" viewBox="0 0 24 24" aria-hidden>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  fill="currentColor"
                />
              </svg>
              <span>Verifying Credentials...</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <span>Log In</span>
              <span className="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-1">
                arrow_forward
              </span>
            </span>
          )}
        </button>
      </form>

      <div className="my-space-lg text-center">
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Don&apos;t have an active PACE credential?
          <button
            type="button"
            onClick={() => setNotice(notice === "signup" ? null : "signup")}
            className="ml-1 font-label-lg text-label-lg font-bold text-secondary hover:underline"
          >
            Sign Up
          </button>
        </p>
        {notice === "signup" && <Notice>Sign-up is coming soon.</Notice>}
      </div>

      <div className="flex items-center gap-1 pt-space-sm font-label-sm text-label-sm text-on-surface-variant/70">
        <span className="material-symbols-outlined text-[16px] text-emerald-600">verified</span>
        <span>No Health Data Collected • 256-Bit TLS</span>
      </div>
    </>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="mt-space-xs rounded-lg bg-surface-container-low px-3 py-2 font-body-sm text-body-sm text-on-surface-variant">
      {children}
    </p>
  );
}
