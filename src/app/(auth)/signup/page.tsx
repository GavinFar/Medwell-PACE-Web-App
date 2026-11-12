import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPage } from "../page-chrome";
import { GroupSelect, GroupSelectLoading } from "./group-select";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create an account – Medwell PACE" };

// Krishna's sign-up page (public/signup.html), made functional.
export default function SignupPage() {
  return (
    <AuthPage back="home">
      <SignupForm
        groupSelect={
          <Suspense fallback={<GroupSelectLoading />}>
            <GroupSelect />
          </Suspense>
        }
      />
    </AuthPage>
  );
}
