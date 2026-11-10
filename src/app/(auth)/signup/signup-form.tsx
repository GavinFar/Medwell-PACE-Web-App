"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp, type SignUpState } from "@/lib/auth/actions";

const initialState: SignUpState = { error: null, message: null };

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUp, initialState);

  return (
    <>
      {state.error && (
        <p role="alert" className="mb-space-md rounded-xl bg-error-container p-space-sm text-on-error-container">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="mb-space-md rounded-xl bg-surface-container-low p-space-sm text-on-surface">
          {state.message}
        </p>
      )}

      <form action={formAction} className="space-y-space-md">
        <div className="space-y-1">
          <label className="block font-label-lg text-label-lg font-semibold text-on-surface" htmlFor="signup-name">
            Full name
          </label>
          <input
            id="signup-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            minLength={2}
            maxLength={80}
            placeholder="Alex Taylor"
            className="h-11 w-full rounded-lg bg-surface-container-low px-3 font-body-md text-body-md text-on-surface placeholder:text-outline focus:bg-surface-container-lowest focus:shadow-md focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="block font-label-lg text-label-lg font-semibold text-on-surface" htmlFor="signup-email">
            Email address
          </label>
          <input
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            placeholder="you@example.com"
            className="h-11 w-full rounded-lg bg-surface-container-low px-3 font-body-md text-body-md text-on-surface placeholder:text-outline focus:bg-surface-container-lowest focus:shadow-md focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="block font-label-lg text-label-lg font-semibold text-on-surface" htmlFor="signup-password">
            Password
          </label>
          <input
            id="signup-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            className="h-11 w-full rounded-lg bg-surface-container-low px-3 font-body-md text-body-md text-on-surface placeholder:text-outline focus:bg-surface-container-lowest focus:shadow-md focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="block font-label-lg text-label-lg font-semibold text-on-surface" htmlFor="signup-confirm-password">
            Confirm password
          </label>
          <input
            id="signup-confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Enter your password again"
            className="h-11 w-full rounded-lg bg-surface-container-low px-3 font-body-md text-body-md text-on-surface placeholder:text-outline focus:bg-surface-container-lowest focus:shadow-md focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="flex h-12 w-full items-center justify-center gap-space-xs rounded-lg bg-primary-container font-headline-sm text-label-lg font-bold text-on-primary shadow-md transition-colors hover:bg-tertiary-container disabled:cursor-wait disabled:opacity-75"
        >
          {pending ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-space-lg text-center font-body-sm text-body-sm text-on-surface-variant">
        Already have an account? <Link className="font-bold text-secondary hover:underline" href="/login">Log in</Link>
      </p>
      <p className="mt-space-sm text-center font-body-sm text-body-sm text-on-surface-variant">
        By creating an account, you agree to use the PACE community platform responsibly.
      </p>
    </>
  );
}
