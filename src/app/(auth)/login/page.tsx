import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { afterLoginPath, safeNextPath } from "@/lib/auth/redirect";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthPage } from "../page-chrome";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in – Medwell PACE" };

// Krishna's login page (public/login.html), made functional.
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthPage back="home">
      <Suspense fallback={<LoginForm next="/account" />}>
        <LoginGate searchParams={searchParams} />
      </Suspense>
    </AuthPage>
  );
}

// Already signed in? Skip the form and go where they were headed.
async function LoginGate({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next, error } = await searchParams;
  const nextPath = safeNextPath(next);
  const user = await getCurrentUser();
  if (user) redirect(afterLoginPath(nextPath, user.role));
  return <LoginForm next={nextPath} confirmationError={error === "confirmation"} />;
}
