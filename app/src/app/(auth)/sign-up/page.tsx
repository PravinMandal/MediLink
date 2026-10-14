import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell, SignUpForm } from "@/components/auth-forms";
import { authProviders } from "@/server/auth";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <AuthShell
      title="Create an account"
      subtitle={
        <>
          Free for patients.
          <br />
          Your record, controlled by you.
        </>
      }
      footer={
        <>
          Already registered?{" "}
          <Link href="/sign-in" className="font-semibold text-pine hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignUpForm google={authProviders.google} apple={authProviders.apple} />
      <p className="mt-4 rounded-xl border border-line bg-paper-sunk/60 px-3.5 py-2.5 text-center text-[12px] leading-relaxed text-ink-soft">
        Just exploring? Use the demo accounts on the{" "}
        <Link href="/sign-in" className="font-medium text-pine hover:underline">
          sign-in page
        </Link>{" "}
        — no signup needed.
      </p>
    </AuthShell>
  );
}
