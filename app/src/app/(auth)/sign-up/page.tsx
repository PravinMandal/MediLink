import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-pine font-display text-[15px] font-bold text-on-pine"
          >
            M
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-ink">
            MediLink
          </span>
        </Link>
        <h1 className="font-display text-[24px] font-semibold leading-tight text-ink">
          Create your account
        </h1>
        <p className="mb-6 mt-1 text-sm text-ink-soft">
          One identity for a lifetime of medical records.
        </p>
        <p className="mb-6 rounded-lg border border-line bg-paper-sunk px-3 py-2 text-[12px] leading-relaxed text-ink-soft">
          Just exploring? Use the demo accounts on the{" "}
          <Link href="/sign-in" className="font-medium text-pine hover:underline">
            sign-in page
          </Link>{" "}
          instead — no signup needed.
        </p>
        <SignUpForm />
      </div>
    </main>
  );
}
