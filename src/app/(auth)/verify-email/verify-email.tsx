"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import {
  resendConfirmationEmail,
  verifyEmailCode,
  type EmailSentState,
  type VerifyCodeState,
} from "@/lib/auth/password-actions";
import { Icon, icons } from "../page-chrome";
import { useCountdown } from "../use-countdown";

// Krishna's verify-email page (public/verify-email.html), connected to Supabase:
// the code boxes check the 6-digit code from the sign-up email, and "Send a new code"
// sends that email again. Her note for nonprofit/sponsor reviews is left out because
// only volunteers can sign up for now.
// `email` is the address just signed up with (from a cookie), or null.
export function VerifyEmail({ email }: { email: string | null }) {
  const [verify, dispatchVerify, verifying] = useActionState<VerifyCodeState, FormData>(verifyEmailCode, {
    error: null,
    done: false,
  });
  const [resend, dispatchResend, resending] = useActionState<EmailSentState, FormData>(resendConfirmationEmail, {
    error: null,
    email: email ?? "",
    sentAt: null,
  });
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [missing, setMissing] = useState(false); // fewer than 6 digits entered
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const doneTitle = useRef<HTMLHeadingElement>(null);
  const timer = useCountdown(45);

  useEffect(() => boxes.current[0]?.focus(), []);
  useEffect(() => {
    if (verify.done) doneTitle.current?.focus();
  }, [verify.done]);
  // A new code went out: restart the countdown.
  useEffect(() => {
    if (resend.sentAt) timer.start(45);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resend.sentAt]);

  const error = missing ? "Please enter all 6 digits of the code." : verifying ? null : verify.error;

  function fillFrom(index: number, typed: string) {
    const next = [...digits];
    typed.split("").forEach((d, i) => {
      if (index + i < 6) next[index + i] = d;
    });
    setDigits(next);
    boxes.current[Math.min(index + typed.length, 5)]?.focus();
  }

  function onInput(i: number, value: string) {
    setMissing(false);
    const typed = value.replace(/\D/g, "");
    if (typed) fillFrom(i, typed);
    else setDigits((d) => d.map((v, j) => (j === i ? "" : v)));
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      setDigits((d) => d.map((v, j) => (j === i - 1 ? "" : v)));
      boxes.current[i - 1]?.focus();
      e.preventDefault();
    } else if (e.key === "ArrowLeft" && i > 0) {
      boxes.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < 5) {
      boxes.current[i + 1]?.focus();
    }
  }

  function onPaste(i: number, e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    setMissing(false);
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) fillFrom(i, pasted);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = digits.join("");
    if (code.length < 6) {
      setMissing(true);
      boxes.current[digits.findIndex((d) => !d)]?.focus();
      return;
    }
    const data = new FormData();
    data.set("code", code);
    startTransition(() => dispatchVerify(data));
  }

  if (verify.done) {
    return (
      <div className="card auth-card">
        <section id="step-done">
          <div className="auth-head">
            <div className="auth-icon">
              <Icon large strokeWidth={3}>
                {icons.check}
              </Icon>
            </div>
            <h1 tabIndex={-1} id="done-title" ref={doneTitle}>
              Your email is confirmed
            </h1>
            <p className="lead" id="done-text">
              Your account is ready to use.
            </p>
          </div>
          <Link className="btn btn-primary btn-block" href="/login">
            Continue to log in
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="card auth-card">
      <section id="step-code">
        <div className="auth-head">
          <div className="auth-icon">
            <Icon large>{icons.mail}</Icon>
          </div>
          <h1>Check your email</h1>
          <p className="lead">
            We sent a 6-digit code to
            <br />
            <span className="email-chip" id="email-display">
              {email ?? "your email address"}
            </span>
          </p>
        </div>

        {error && (
          <div className="alert alert-error" id="code-error" role="alert">
            <Icon>{icons.alert}</Icon>
            <p id="code-error-text">{error}</p>
          </div>
        )}

        <form id="verify-form" noValidate onSubmit={onSubmit}>
          <fieldset>
            <legend className="legend-small">Enter the code from the email</legend>
            <div className="code-inputs" id="code-inputs" aria-invalid={error ? true : undefined}>
              {digits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    boxes.current[i] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={i === 0 ? "one-time-code" : undefined}
                  aria-label={`Digit ${i + 1} of 6`}
                  value={digit}
                  onChange={(e) => onInput(i, e.target.value)}
                  onKeyDown={(e) => onKeyDown(i, e)}
                  onPaste={(e) => onPaste(i, e)}
                  onFocus={(e) => e.target.select()}
                />
              ))}
            </div>
            <input type="hidden" name="code" id="code" value={digits.join("")} />
          </fieldset>
          <button className="btn btn-primary btn-block" type="submit" id="verify-btn" disabled={verifying}>
            Confirm email
          </button>
        </form>

        <div className="auth-foot">
          <p>Didn&apos;t get it? Check your spam or junk folder first.</p>
          <button
            className="btn btn-secondary btn-block"
            type="button"
            id="resend-btn"
            disabled={timer.left > 0 || resending}
            onClick={() => startTransition(() => dispatchResend(new FormData()))}
          >
            {timer.left > 0 ? `Send a new code in ${timer.left} seconds` : "Send a new code"}
          </button>
          <p className="status-msg" id="resend-status" role="status" aria-live="polite">
            {resend.sentAt && !resending ? "A new code is on its way. Please check your email." : ""}
          </p>
          {resend.error && !resending && <p className="field-error center">{resend.error}</p>}
          <p>
            Wrong email address? <Link href="/signup">Go back and change it</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
