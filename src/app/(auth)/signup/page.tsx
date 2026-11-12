import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { safeNextPath } from "@/lib/auth/redirect";
import { AuthPage } from "../page-chrome";
import { GroupSelect, GroupSelectLoading } from "./group-select";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create an account – Medwell PACE" };

// Krishna's sign-up page (public/signup.html), made functional.
export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return (
    <AuthPage back="home">
      <SignupForm
        groupSelect={
          <Suspense fallback={<GroupSelectLoading />}>
            <GroupSelect />
          </Suspense>
        }
        nextField={
          <Suspense fallback={null}>
            <NextField searchParams={searchParams} />
          </Suspense>
        }
        loginLink={
          <Suspense fallback={<Link href="/login">Log in</Link>}>
            <LoginLink searchParams={searchParams} />
          </Suspense>
        }
      />
    </AuthPage>
  );
}

// Where to go after the email is confirmed: only set when a check-in is waiting
// (/signup?next=/check-in?pass=...). safeNextPath keeps it on this site.
async function nextFrom(searchParams: PageProps<"/signup">["searchParams"]): Promise<string | null> {
  const next = safeNextPath((await searchParams).next);
  return next === "/account" ? null : next;
}

async function NextField({ searchParams }: Pick<PageProps<"/signup">, "searchParams">) {
  const next = await nextFrom(searchParams);
  return next ? <input type="hidden" name="next" value={next} /> : null;
}

async function LoginLink({ searchParams }: Pick<PageProps<"/signup">, "searchParams">) {
  const next = await nextFrom(searchParams);
  return <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>Log in</Link>;
}
