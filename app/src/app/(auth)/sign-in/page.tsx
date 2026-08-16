import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth-forms";
import { getSessionUser, portalHomeForRole } from "@/server/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // Real session check (not cookie optimism) — stale cookies render the form.
  const user = await getSessionUser();
  if (user) redirect(next && next.startsWith("/") ? next : portalHomeForRole(user.role));
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
        <p className="mb-6 mt-1 text-sm text-ink-soft">
          Sign in to your health record.
        </p>
        <SignInForm next={next} />
      </div>
    </main>
  );
}
