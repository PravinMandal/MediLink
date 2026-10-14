import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell, ResetPasswordForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Set a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Minimum 8 characters. This link works once and expires in an hour."
      footer={
        <>
          Link expired?{" "}
          <Link href="/forgot-password" className="font-semibold text-pine hover:underline">
            Request a new one
          </Link>
        </>
      }
    >
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
