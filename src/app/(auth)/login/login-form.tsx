"use client";

import { useActionState, useState } from "react";
import { signIn, type SignInState } from "@/lib/auth/actions";

const initialState: SignInState = { error: null };

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const [showPassword, setShowPassword] = useState(false);
  // Controlled, because React resets uncontrolled fields after every form action,
  // which would wipe the email after a wrong password.
  const [email, setEmail] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      {state.error && (
        <p role="alert" className="rounded-lg bg-pace-error-bg px-4 py-3 text-sm text-pace-error">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-semibold">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="h-11 rounded-lg border border-pace-line bg-pace-tint/40 px-3 outline-none focus:border-pace-navy focus:ring-2 focus:ring-pace-navy/20"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-semibold">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className="h-11 w-full rounded-lg border border-pace-line bg-pace-tint/40 px-3 pr-16 outline-none focus:border-pace-navy focus:ring-2 focus:ring-pace-navy/20"
          />
          <button
            type="button"
            onClick={() => setShowPassword((shown) => !shown)}
            className="absolute inset-y-0 right-0 px-3 text-sm font-medium text-pace-muted hover:text-pace-navy"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 h-11 rounded-lg bg-pace-navy font-semibold text-white transition-colors hover:bg-pace-navy-light disabled:opacity-70"
      >
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
