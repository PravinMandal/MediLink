import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell, SignInForm } from "@/components/auth-forms";
import { getSessionUser, portalHomeForRole } from "@/server/session";
import { authProviders } from "@/server/auth";
import { safeNextOr } from "@/server/modules/security/redirect";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; registered?: string; reset?: string; error?: string }>;
}) {
  const { next, registered, reset, error } = await searchParams;
  const user = await getSessionUser();
  if (user)
    redirect(safeNextOr(next, portalHomeForRole(user.role)));

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your health record."
      footer={
        <>
          New here?{" "}
          <Link href="/sign-up" className="font-semibold text-pine hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {registered ? (
        <p className="mb-4 rounded-xl border border-pine/40 bg-pine-tint px-4 py-2.5 text-[13px] text-pine-ink" role="status">
          Account created — sign in below.
        </p>
      ) : null}
      {reset ? (
        <p className="mb-4 rounded-xl border border-pine/40 bg-pine-tint px-4 py-2.5 text-[13px] text-pine-ink" role="status">
          Password updated — sign in with the new one.
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 rounded-xl border border-alert/40 bg-alert/10 px-4 py-2.5 text-[13px] text-alert" role="alert">
          Google sign-in didn&apos;t finish — please try again.
        </p>
      ) : null}
      <SignInForm next={next} google={authProviders.google} apple={authProviders.apple} />
    </AuthShell>
  );
}
