import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create an account · PACE Platform" };

export default function SignupPage() {
  return (
    <div className="flex w-full max-w-md flex-col gap-space-md rounded-2xl bg-surface-container-lowest p-space-lg shadow-xl shadow-primary-container/10 md:p-space-xl">
      <div>
        <p className="mb-space-xs font-label-sm text-label-sm font-bold uppercase tracking-wider text-secondary">
          Join the community
        </p>
        <h1 className="font-headline-lg text-headline-lg font-bold text-primary-container">
          Create your PACE account
        </h1>
        <p className="mt-space-xs font-body-md text-body-md text-on-surface-variant">
          Sign up to get started. New accounts begin with the participant role.
        </p>
      </div>
      <SignupForm />
      <Link className="text-center font-label-lg text-label-lg text-on-surface-variant hover:text-primary" href="/">
        ← Back to home
      </Link>
    </div>
  );
}
