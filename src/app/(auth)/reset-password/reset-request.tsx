"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { requestPasswordReset, type EmailSentState } from "@/lib/auth/password-actions";
import { isEmail } from "@/lib/auth/form-rules";
import { FieldError, Icon, icons } from "../page-chrome";
import { useCountdown } from "../use-countdown";

// Krishna's reset-password page (public/reset-password.html), connected to Supabase:
// step 1 asks for the email, step 2 says the link was sent.
export function ResetRequest() {
  const [state, dispatch, pending] = useActionState<EmailSentState, FormData>(requestPasswordReset, {
    error: null,
    email: "",
    sentAt: null,
  });
  // "Use a different email address" goes back to step 1 until the next email is sent.
  const [editedAt, setEditedAt] = useState<number | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [lastClick, setLastClick] = useState<"send" | "resend">("send");
  const emailRef = useRef<HTMLInputElement>(null);
  const sentTitle = useRef<HTMLHeadingElement>(null);
  const timer = useCountdown(0);

  const step = state.sentAt !== null && state.sentAt !== editedAt ? "sent" : "request";
  const resent = step === "sent" && lastClick === "resend" && !pending && !state.error;

  // Each time an email goes out, restart the 60-second timer.
  useEffect(() => {
    if (state.sentAt) timer.start(60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sentAt]);

  // Move focus to the heading when step 2 appears (as in the design).
  useEffect(() => {
    if (step === "sent") sentTitle.current?.focus();
  }, [step]);

  function send(email: string) {
    const data = new FormData();
    data.set("email", email);
    startTransition(() => dispatch(data));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = emailRef.current?.value.trim() ?? "";
    const message = !email
      ? "Please enter your email address."
      : !isEmail(email)
        ? "Please enter a full email address, like name@example.com."
        : undefined;
    setFieldError(message);
    if (message) return emailRef.current?.focus();
    setLastClick("send");
    send(email);
  }

  function changeEmail() {
    timer.start(0);
    setEditedAt(state.sentAt);
    requestAnimationFrame(() => {
      emailRef.current?.focus();
      emailRef.current?.select();
    });
  }

  const emailError = fieldError ?? (step === "request" && !pending ? (state.error ?? undefined) : undefined);

  return (
    <div className="card auth-card">
      {/* STEP 1: ask for email */}
      <section id="step-request" hidden={step !== "request"}>
        <div className="auth-head">
          <div className="auth-icon red">
            <Icon large>{icons.key}</Icon>
          </div>
          <h1>Forgot your password?</h1>
          <p className="lead">
            No problem. Enter the email you signed up with and we&apos;ll send you a link to make a new one.
          </p>
        </div>

        <form id="reset-form" noValidate onSubmit={onSubmit}>
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
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? "email-error" : undefined}
            />
            <FieldError id="email-error" message={emailError} />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
            Send reset link
          </button>
        </form>

        <div className="auth-foot">
          <p>
            Remembered your password? <Link href="/login">Log in</Link>
          </p>
        </div>
      </section>

      {/* STEP 2: link sent */}
      <section id="step-sent" hidden={step !== "sent"}>
        <div className="auth-head">
          <div className="auth-icon">
            <Icon large>{icons.mail}</Icon>
          </div>
          <h1 tabIndex={-1} id="sent-title" ref={sentTitle}>
            Check your email
          </h1>
          <p className="lead">
            If there&apos;s an account for
            <br />
            <span className="email-chip" id="sent-email">
              {state.email}
            </span>
            <br />
            we&apos;ve sent a link to reset your password.
          </p>
        </div>

        <div className="alert alert-info">
          <Icon>{icons.clock}</Icon>
          <p>
            The link works for <strong>15 minutes</strong>. Can&apos;t find it? Check your spam or junk folder.
          </p>
        </div>

        <button
          className="btn btn-secondary btn-block"
          type="button"
          id="resend-btn"
          disabled={timer.left > 0 || pending}
          onClick={() => {
            setLastClick("resend");
            send(state.email);
          }}
        >
          {timer.left > 0 ? `Send again in ${timer.left} seconds` : "Send the link again"}
        </button>
        <p className="status-msg" id="resend-status" role="status" aria-live="polite">
          {resent ? "We sent the link again." : ""}
        </p>
        {step === "sent" && state.error && !pending && <p className="field-error center">{state.error}</p>}

        <div className="auth-foot">
          <p>
            <button className="btn-link" type="button" id="change-email" onClick={changeEmail}>
              Use a different email address
            </button>
          </p>
          <Link className="btn btn-navy btn-block" href="/login">
            Back to log in
          </Link>
        </div>
      </section>
    </div>
  );
}
