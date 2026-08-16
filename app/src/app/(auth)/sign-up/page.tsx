import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <a href="/" className="mb-8 flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-md bg-pine font-display text-[15px] font-bold text-white"
          >
            M
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-ink">
            MediLink
          </span>
        </a>
        <h1 className="font-display text-[24px] font-semibold leading-tight text-ink">
          Create your account
        </h1>
        <p className="mb-6 mt-1 text-sm text-ink-soft">
          One identity for a lifetime of medical records.
        </p>
        <SignUpForm />
      </div>
    </main>
  );
}
