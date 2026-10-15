"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInAction } from "@/server/actions/auth-actions";
import { Field, Input, FormErrorSummary } from "./ui";
import { SubmitButton, CopyButton, useFocusFirstError } from "./interactive";
import { OrDivider } from "./auth-shell";
import { SocialButtons } from "./social-buttons";
import { PasswordInput } from "./password-input";

export function SignInForm({
  next,
  google,
  apple,
}: {
  next?: string;
  google: boolean;
  apple: boolean;
}) {
  const [state, action] = useActionState(signInAction, {});
  const formRef = useFocusFirstError(state.error);
  // `next` was allow-listed server-side (same guard as the form action).
  const callbackURL = next && /^\/[^/](.*)?$/.test(next) ? next : "/portal";

  return (
    <div>
      <SocialButtons google={google} apple={apple} mode="in" callbackURL={callbackURL} />
      <OrDivider />
      <form ref={formRef} action={action} className="space-y-3.5">
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label="Email" htmlFor="si-email" error={undefined}>
          <Input
            id="si-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            className="h-12 rounded-2xl text-[14px]"
          />
        </Field>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="si-password" className="block text-[13px] font-medium text-ink">
              Password
            </label>
            <Link href="/forgot-password" className="text-[12.5px] font-medium text-pine hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="si-password"
            name="password"
            autoComplete="current-password"
            placeholder="Your password…"
            invalid={!!state.error}
          />
        </div>
        <FormErrorSummary errors={[state.error]} />
        <SubmitButton
          className="h-12 w-full rounded-full bg-pine text-[15px] font-bold text-on-pine shadow-[0_8px_24px_-6px_rgba(26,86,196,0.55)] transition-all duration-200 hover:scale-[1.01] hover:brightness-110 active:scale-[0.99]"
          pendingLabel="Signing in…"
        >
          Sign in
        </SubmitButton>

        <details className="group rounded-2xl border border-line bg-paper-sunk/60">
          <summary className="cursor-pointer list-none px-4 py-3 text-[12.5px] font-medium text-ink-soft transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
            Demo accounts — password “Password123!”
          </summary>
          <div className="grid grid-cols-1 gap-1.5 px-3 pb-3 text-xs">
            {[
              ["meera@medilink.health", "Verified doctor · has consent"],
              ["arjun@medilink.health", "Verified cardiologist · no consent yet"],
              ["rahul@example.com", "Patient (Rahul Sharma)"],
              ["lab@sunrise.health", "Lab staff · Sunrise Diagnostics"],
              ["admin@medilink.health", "Platform admin"],
            ].map(([email, desc]) => (
              <div
                key={email}
                className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-paper-raised"
              >
                <span>
                  <span className="num block text-[11.5px] text-ink">{email}</span>
                  <span className="text-ink-faint">{desc}</span>
                </span>
                <CopyButton value={email} label="Copy" />
              </div>
            ))}
          </div>
        </details>
      </form>
    </div>
  );
}
