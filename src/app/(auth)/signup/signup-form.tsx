"use client";

import Link from "next/link";
import { startTransition, useActionState, useRef, useState } from "react";
import { signUp, type SignUpState } from "@/lib/auth/actions";
import { passwordChecks, signupErrors, type PasswordRule, type SignupFields } from "@/lib/auth/form-rules";
import { ErrorAlert, FieldError, Icon, icons } from "../page-chrome";

// Krishna's sign-up page (public/signup.html), connected to the signUp Server Action.
// Changes from her design, as decided by the team lead (Gavin):
//   * Volunteer is the only account type for now (her Nonprofit and Sponsor cards, and
//     their step-3 sections, are left out until those sign-ups exist).
//   * "Your group" is a dropdown of the organizations in the database instead of a free
//     text box, so volunteers can only pick a real one.
//   * Passwords need 8+ characters, a capital letter and a symbol (her checklist),
//     checked on the server too.

type Field = keyof SignupFields;
const FIELD_IDS: Record<Field, string> = {
  fullName: "full-name",
  email: "email",
  password: "password",
  confirmPassword: "confirm-password",
  agreeTerms: "agree-terms",
  agreeSharing: "agree-sharing",
};

const RULES: { key: PasswordRule; text: string }[] = [
  { key: "length", text: "At least 8 characters" },
  { key: "upper", text: "At least 1 capital letter (A–Z)" },
  { key: "symbol", text: "At least 1 symbol, like ! ? # or @" },
];

// `groupSelect` is the "Your group" dropdown, drawn by the server (./group-select.tsx)
// so the list of organizations can load without holding up the rest of the form.
export function SignupForm({ groupSelect }: { groupSelect: React.ReactNode }) {
  const [state, dispatch, pending] = useActionState<SignUpState, FormData>(signUp, { error: null, fieldErrors: {} });
  const [clientErrors, setClientErrors] = useState<Partial<Record<Field, string>>>({});
  const [password, setPassword] = useState("");
  const [shown, setShown] = useState({ password: false, confirm: false });
  const formRef = useRef<HTMLFormElement>(null);

  const errors = { ...state.fieldErrors, ...clientErrors };
  const checks = passwordChecks(password);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const found = signupErrors({
      fullName: String(data.get("fullName") ?? ""),
      email: String(data.get("email") ?? ""),
      password: String(data.get("password") ?? ""),
      confirmPassword: String(data.get("confirmPassword") ?? ""),
      agreeTerms: data.get("agreeTerms") === "on",
      agreeSharing: data.get("agreeSharing") === "on",
    });
    setClientErrors(found);
    const firstBad = (Object.keys(FIELD_IDS) as Field[]).find((f) => found[f]);
    if (firstBad) {
      form.querySelector<HTMLElement>(`#${FIELD_IDS[firstBad]}`)?.focus();
      return;
    }
    startTransition(() => dispatch(data));
  }

  // aria-invalid / aria-describedby, as PACE.setError does in the design.
  function errorProps(field: Field, describedBy?: string) {
    const message = errors[field];
    const ids = [describedBy, message ? `${FIELD_IDS[field]}-error` : undefined].filter(Boolean).join(" ");
    return { "aria-invalid": message ? true : undefined, "aria-describedby": ids || undefined };
  }

  return (
    <div className="card auth-card wide">
      <div className="auth-head">
        <h1>Create your account</h1>
        <p className="lead">It only takes a few minutes.</p>
      </div>

      {state.error && !pending && <ErrorAlert>{state.error}</ErrorAlert>}

      <form id="signup-form" ref={formRef} noValidate onSubmit={onSubmit}>
        {/* 1. Role (volunteer only for now) */}
        <fieldset>
          <legend>1. I am signing up as a…</legend>
          <div className="role-options">
            <div className="role-option">
              <input type="radio" name="role" id="role-volunteer" value="volunteer" defaultChecked />
              <label htmlFor="role-volunteer">
                <span className="role-icon">
                  <Icon>{icons.person}</Icon>
                </span>
                <span className="role-text">
                  <span className="role-title">Volunteer</span>
                  <span className="role-desc">I give my time at events</span>
                </span>
                <span className="role-tick" aria-hidden="true">
                  <Icon strokeWidth={3.5}>{icons.check}</Icon>
                </span>
              </label>
            </div>
          </div>
        </fieldset>

        {/* 2. Personal details */}
        <fieldset>
          <legend>2. Your details</legend>

          <div className="field">
            <label htmlFor="full-name">Full name</label>
            <input
              className="input"
              id="full-name"
              name="fullName"
              type="text"
              autoComplete="name"
              required
              maxLength={80}
              {...errorProps("fullName")}
            />
            <FieldError id="full-name-error" message={errors.fullName} />
          </div>

          <div className="field">
            <label htmlFor="email">Email address</label>
            <span className="hint" id="email-hint">
              We&apos;ll send a code to this address to confirm it&apos;s you.
            </span>
            <input
              className="input"
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              {...errorProps("email", "email-hint")}
            />
            <FieldError id="email-error" message={errors.email} />
          </div>

          <div className="grid-2">
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
                  {...errorProps("password", "pw-rules")}
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
                  {...errorProps("confirmPassword")}
                />
                <ShowButton shown={shown.confirm} onClick={() => setShown((s) => ({ ...s, confirm: !s.confirm }))} />
              </div>
              <FieldError id="confirm-password-error" message={errors.confirmPassword} />
            </div>
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
        </fieldset>

        {/* 3. Volunteer's group (optional): a dropdown of real organizations */}
        <fieldset className="role-fields" data-role="volunteer">
          <legend>
            3. Your group <span className="optional">(optional)</span>
          </legend>
          <div className="field">
            <label htmlFor="cohort">School, employer, or group you volunteer with</label>
            {groupSelect}
          </div>
        </fieldset>

        {/* 4. Agreements */}
        <fieldset>
          <legend>4. Please agree to continue</legend>
          <div className="check-group">
            <label className="check">
              <input type="checkbox" id="agree-terms" name="agreeTerms" required {...errorProps("agreeTerms")} />
              <span>
                I agree to the <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
              </span>
            </label>
            <FieldError id="agree-terms-error" message={errors.agreeTerms} />
            <label className="check">
              <input type="checkbox" id="agree-sharing" name="agreeSharing" required {...errorProps("agreeSharing")} />
              <span>
                I agree that my event attendance can be shared with the programs and sponsors I take part in. No
                medical information is ever collected.
              </span>
            </label>
            <FieldError id="agree-sharing-error" message={errors.agreeSharing} />
          </div>
        </fieldset>

        <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </button>
      </form>

      <div className="auth-foot">
        <p>
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </div>
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
