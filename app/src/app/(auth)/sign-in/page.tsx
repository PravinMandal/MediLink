import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth-forms";
import { getSessionUser, portalHomeForRole } from "@/server/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; registered?: string }>;
}) {
  const { next, registered } = await searchParams;
  // Real session check (not cookie optimism) — stale cookies render the form.
  const user = await getSessionUser();
  // Same guard as auth-actions: "/" + non-slash start blocks "//evil.com"
  const SAFE_NEXT = /^\/[^/](.*)?$/;
  if (user)
    redirect(next && SAFE_NEXT.test(next) ? next : portalHomeForRole(user.role));
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-md bg-pine font-display text-[15px] font-bold text-white"
          >
            M
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-ink">
            MediLink
          </span>
        </Link>
        <h1 className="font-display text-[24px] font-semibold leading-tight text-ink">
          Welcome back
        </h1>
        {registered ? (
          <p className="mb-2 mt-2 rounded-md border border-pine/40 bg-pine-tint px-3 py-2 text-[13px] text-pine-ink" role="status">
            Account created — sign in below.
          </p>
        ) : null}
        <p className="mb-6 mt-1 text-sm text-ink-soft">
          Sign in to your health record.
        </p>
        <SignInForm next={next} />
      </div>
    </main>
  );
}
