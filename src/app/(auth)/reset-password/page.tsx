import type { Metadata } from "next";
import { AuthPage } from "../page-chrome";
import { ResetRequest } from "./reset-request";

export const metadata: Metadata = { title: "Reset your password – Medwell PACE" };

// Krishna's reset-password page (public/reset-password.html), made functional.
// The emailed link opens /reset-password/new, where the new password is chosen.
export default function ResetPasswordPage() {
  return (
    <AuthPage back="login">
      <ResetRequest />
    </AuthPage>
  );
}
