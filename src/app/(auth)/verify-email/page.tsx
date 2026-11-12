import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { PENDING_EMAIL_COOKIE, readPendingEmail } from "@/lib/auth/auth-cookies";
import { AuthPage } from "../page-chrome";
import { VerifyEmail } from "./verify-email";

export const metadata: Metadata = { title: "Confirm your email – Medwell PACE" };

// Krishna's verify-email page (public/verify-email.html). Sign-up sends people here.
export default function VerifyEmailPage() {
  return (
    <AuthPage back="home">
      <Suspense fallback={<div className="card auth-card" style={{ minHeight: 640 }} />}>
        <VerifyEmailGate />
      </Suspense>
    </AuthPage>
  );
}

// No "already signed in" redirect here: a correct code signs the volunteer in, and the
// page must still show "Your email is confirmed" afterwards.
async function VerifyEmailGate() {
  const pending = readPendingEmail((await cookies()).get(PENDING_EMAIL_COOKIE)?.value);
  return <VerifyEmail email={pending?.email ?? null} next={pending?.next ?? null} />;
}
