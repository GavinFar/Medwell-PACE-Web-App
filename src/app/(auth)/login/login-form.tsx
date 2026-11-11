"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { signIn, type SignInState } from "@/lib/auth/actions";
import { loginErrors } from "@/lib/auth/form-rules";
import { FieldError, Icon, icons } from "../page-chrome";

// Krishna's login form (public/login.html), connected to the signIn Server Action.
// Field names (email, password, remember, next) are what signIn reads.
export function LoginForm({ next, confirmationError = false }: { next: string; confirmationError?: boolean }) {
  const [state, dispatch, pending] = useActionState<SignInState, FormData>(signIn, {
    // Usually the email *was* confirmed, but the link opened in a different browser
    // (e.g. inside the Gmail app), so it couldn't sign them in automatically.
    error: confirmationError ? "That link couldn't log you in here, but your email is probably confirmed. Please log in below." : null,
  });
  const [errors, setErrors] = useState<ReturnType<typeof loginErrors>>({});
  const [showPassword, setShowPassword] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // After a failed login: clear the password and put the cursor back in it (as in the design).
  useEffect(() => {
    if (state.error && !confirmationError && passwordRef.current) {
      passwordRef.current.value = "";
      passwordRef.current.focus();
    }
  }, [state, confirmationError]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const found = loginErrors({ email: emailRef.current?.value ?? "", password: passwordRef.current?.value ?? "" });
    setErrors(found);
    if (found.email) return emailRef.current?.focus();
    if (found.password) return passwordRef.current?.focus();
    startTransition(() => dispatch(new FormData(form)));
  }

  return (
    <div className="card auth-card">
      <div className="auth-head">
        <div className="auth-icon">
          <Icon large>{icons.lock}</Icon>
        </div>
        <h1>Welcome back</h1>
        <p className="lead">Log in to your PACE account.</p>
      </div>

      {state.error && !pending && (
        <div className="alert alert-error" id="login-error" role="alert">
          <Icon>{icons.alert}</Icon>
          <p>
            <strong>We couldn&apos;t log you in.</strong>
            <br />
            {state.error}
          </p>
        </div>
      )}

      <form id="login-form" noValidate onSubmit={onSubmit}>
        <input type="hidden" name="next" value={next} />
        <div className="field">
          <label htmlFor="email">Email address</label>
          <input
            ref={emailRef}
            className="input"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          <FieldError id="email-error" message={errors.email} />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <div className="password-wrap">
            <input
              ref={passwordRef}
              className="input"
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? "password-error" : undefined}
            />
            <button
              className="toggle-pw"
              type="button"
              aria-pressed={showPassword}
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((shown) => !shown)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <FieldError id="password-error" message={errors.password} />
        </div>

        <div className="row field">
          <label className="check">
            {/* The space matters: this label isn't a flex row, so it sets the gap (as in her HTML). */}
            <input type="checkbox" id="remember" name="remember" />{" "}
            <span>Keep me logged in</span>
          </label>
          <Link href="/reset-password">Forgot password?</Link>
        </div>

        <button className="btn btn-primary btn-block" type="submit" id="login-btn" disabled={pending}>
          {pending ? "Logging in…" : "Log in"}
        </button>
      </form>

      <div className="auth-foot">
        <p>New to PACE?</p>
        <Link className="btn btn-secondary btn-block" href="/signup">
          Create an account
        </Link>
      </div>
    </div>
  );
}
