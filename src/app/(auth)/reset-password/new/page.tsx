import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { RECOVERY_COOKIE } from "@/lib/auth/auth-cookies";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthPage } from "../../page-chrome";
import { NewPassword } from "./new-password";

export const metadata: Metadata = { title: "Make a new password – Medwell PACE" };

// Where the password reset email's link lands.
export default function NewPasswordPage() {
  return (
    <AuthPage back="login">
      <Suspense fallback={<div className="card auth-card" style={{ minHeight: 560 }} aria-busy="true" />}>
        <NewPasswordGate />
      </Suspense>
    </AuthPage>
  );
}

async function NewPasswordGate() {
  const recoveryFor = (await cookies()).get(RECOVERY_COOKIE)?.value;
  const user = recoveryFor ? await getCurrentUser() : null;
  return <NewPassword verified={!!user && user.id === recoveryFor} />;
}
