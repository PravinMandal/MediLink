import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell, ForgotPasswordForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset password"
      subtitle="Enter your account email — we'll send a one-hour reset link."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/sign-in" className="font-semibold text-pine hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
