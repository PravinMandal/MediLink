import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell, ResendVerificationForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Verify your email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return (
    <AuthShell
      title="Check your inbox"
      subtitle={
        email ? (
          <>
            We sent a verification link to <span className="num font-semibold text-ink">{email}</span>.
            <br />
            It expires in 24 hours.
          </>
        ) : (
          <>We sent a verification link — it expires in 24 hours.</>
        )
      }
      footer={
        <>
          Wrong address?{" "}
          <Link href="/sign-up" className="font-semibold text-pine hover:underline">
            Start over
          </Link>
        </>
      }
    >
      <div className="rounded-2xl border border-line bg-paper-sunk/60 px-4 py-3 text-[12.5px] leading-relaxed text-ink-soft">
        Click the link to prove this address is really yours — then you&apos;re in.
        Nothing in spam? Give it a minute, then resend below.
      </div>
      <ResendVerificationForm email={email} />
    </AuthShell>
  );
}
