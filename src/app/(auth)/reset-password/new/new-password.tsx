"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { passwordChecks, passwordErrors, type PasswordRule } from "@/lib/auth/form-rules";
import { startPasswordRecovery, updatePassword, type NewPasswordState } from "@/lib/auth/password-actions";
import { readRecoveryLink } from "@/lib/auth/recovery";
import { ErrorAlert, FieldError, Icon, icons } from "../../page-chrome";

// Where the password reset email's link lands. Krishna's design has no page for this
// step, so it's put together from her pieces: the reset page's card and key icon, and
// the password fields and checklist from her sign-up page.
// `verified` is true when the server already accepted a reset link in the last
// 15 minutes (e.g. the page was reloaded after the link was read).

type Phase = "checking" | "form" | "expired";
type Field = "password" | "confirmPassword";

const RULES: { key: PasswordRule; text: string }[] = [
  { key: "length", text: "At least 8 characters" },
  { key: "upper", text: "At least 1 capital letter (A–Z)" },
  { key: "symbol", text: "At least 1 symbol, like ! ? # or @" },
];

export function NewPassword({ verified }: { verified: boolean }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [state, dispatch, pending] = useActionState<NewPasswordState, FormData>(updatePassword, {
    error: null,
    fieldErrors: {},
    done: false,
  });
  const [clientErrors, setClientErrors] = useState<Partial<Record<Field, string>>>({});
  const [password, setPassword] = useState("");
  const [shown, setShown] = useState({ password: false, confirm: false });

  // Read the link only once: it's removed from the address bar straight after, and
  // React runs effects twice in development.
  const checked = useRef(false);
  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    const link = readRecoveryLink(window.location.hash, window.location.search);
    // Take the sign-in out of the address bar and browser history right away.
    window.history.replaceState(null, "", window.location.pathname);

    async function check(): Promise<Phase> {
      if (link.kind === "tokens") {
        return (await startPasswordRecovery(link.accessToken, link.refreshToken)).ok ? "form" : "expired";
      }
      return link.kind === "none" && verified ? "form" : "expired";
    }
    void check().then(setPhase);
  }, [verified]);

  const errors = { ...state.fieldErrors, ...clientErrors };
  const checks = passwordChecks(password);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const found = passwordErrors({
      password: String(data.get("password") ?? ""),
      confirmPassword: String(data.get("confirmPassword") ?? ""),
    });
    setClientErrors(found);
    if (found.password) return form.querySelector<HTMLElement>("#password")?.focus();
    if (found.confirmPassword) return form.querySelector<HTMLElement>("#confirm-password")?.focus();
    startTransition(() => dispatch(data));
  }

  if (state.done) {
    return (
      <div className="card auth-card">
        <div className="auth-head">
          <div className="auth-icon">
            <Icon large strokeWidth={3}>
              {icons.check}
            </Icon>
          </div>
          <h1>Your password is changed</h1>
          <p className="lead">You&apos;re logged in with your new password. We logged you out everywhere else.</p>
        </div>
        <Link className="btn btn-primary btn-block" href="/account">
          Continue
        </Link>
      </div>
    );
  }

  if (phase === "checking") {
    return <div className="card auth-card" style={{ minHeight: 560 }} aria-busy="true" />;
  }

  if (phase === "expired") {
    return (
      <div className="card auth-card">
        <div className="auth-head">
          <div className="auth-icon red">
            <Icon large>{icons.key}</Icon>
          </div>
          <h1>This link has expired</h1>
          <p className="lead">Reset links work for 15 minutes and only once. Please ask for a new one.</p>
        </div>
        <Link className="btn btn-primary btn-block" href="/reset-password">
          Send a new link
        </Link>
        <div className="auth-foot">
          <p>
            Remembered your password? <Link href="/login">Log in</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card auth-card">
      <div className="auth-head">
        <div className="auth-icon red">
          <Icon large>{icons.key}</Icon>
        </div>
        <h1>Make a new password</h1>
        <p className="lead">Choose a new password for your PACE account.</p>
      </div>

      {state.error && !pending && <ErrorAlert>{state.error}</ErrorAlert>}

      <form id="new-password-form" noValidate onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="password">Create a password</label>
          <div className="password-wrap">
            <input
              className="input"
              id="password"
              name="password"
              type={shown.password ? "text" : "password"}
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? "pw-rules password-error" : "pw-rules"}
            />
            <ShowButton shown={shown.password} onClick={() => setShown((s) => ({ ...s, password: !s.password }))} />
          </div>
          <FieldError id="password-error" message={errors.password} />
        </div>
        <div className="field">
          <label htmlFor="confirm-password">Type the password again</label>
          <div className="password-wrap">
            <input
              className="input"
              id="confirm-password"
              name="confirmPassword"
              type={shown.confirm ? "text" : "password"}
              autoComplete="new-password"
              required
              aria-invalid={errors.confirmPassword ? true : undefined}
              aria-describedby={errors.confirmPassword ? "confirm-password-error" : undefined}
            />
            <ShowButton shown={shown.confirm} onClick={() => setShown((s) => ({ ...s, confirm: !s.confirm }))} />
          </div>
          <FieldError id="confirm-password-error" message={errors.confirmPassword} />
        </div>

        <div className="rules-box" id="pw-rules">
          <p className="label">Your password needs:</p>
          <ul className="rules">
            {RULES.map((rule) => (
              <li key={rule.key} data-rule={rule.key} className={checks[rule.key] ? "ok" : undefined}>
                <span className="mark">
                  <Icon strokeWidth={4}>{icons.check}</Icon>
                </span>
                {rule.text}
              </li>
            ))}
          </ul>
        </div>

        <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save new password"}
        </button>
      </form>
    </div>
  );
}

function ShowButton({ shown, onClick }: { shown: boolean; onClick: () => void }) {
  return (
    <button
      className="toggle-pw"
      type="button"
      aria-pressed={shown}
      aria-label={shown ? "Hide password" : "Show password"}
      onClick={onClick}
    >
      {shown ? "Hide" : "Show"}
    </button>
  );
}
