"use client";

import { useActionState } from "react";
import {
  forgotPasswordAction,
  resendVerificationAction,
  resetPasswordAction,
} from "@/server/actions/auth-actions";
import { Field, Input, FormErrorSummary } from "./ui";
import { SubmitButton, useFocusFirstError } from "./interactive";
import { PasswordInput } from "./password-input";

export function ResendVerificationForm({ email }: { email?: string }) {
  const [state, action] = useActionState(resendVerificationAction, {});
  const formRef = useFocusFirstError(state.error);
  return (
    <form ref={formRef} action={action} className="mt-5 space-y-3.5">
      <Field label="Email" htmlFor="ve-email" error={undefined}>
        <Input
          id="ve-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={email ?? ""}
          placeholder="you@example.com"
          className="h-12 rounded-2xl text-[14px]"
        />
      </Field>
      <FormErrorSummary errors={[state.error]} />
      {state.ok ? (
        <p role="status" className="rounded-xl border border-pine/40 bg-pine-tint px-4 py-3 text-[13px] text-pine-ink">
          {state.ok}
        </p>
      ) : null}
      <SubmitButton
        className="h-12 w-full rounded-2xl bg-gradient-to-b from-[#2E7BFF] to-[#12429E] text-[15px] font-bold text-white shadow-lg shadow-pine/30 hover:brightness-110"
        pendingLabel="Sending…"
      >
        Resend link
      </SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, {});
  const formRef = useFocusFirstError(state.error);
  return (
    <form ref={formRef} action={action} className="mt-5 space-y-3.5">
      <Field label="Email" htmlFor="fp-email" error={undefined}>
        <Input
          id="fp-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          className="h-12 rounded-2xl text-[14px]"
        />
      </Field>
      <FormErrorSummary errors={[state.error]} />
      {state.ok ? (
        <p role="status" className="rounded-xl border border-pine/40 bg-pine-tint px-4 py-3 text-[13px] text-pine-ink">
          {state.ok}
        </p>
      ) : null}
      <SubmitButton
        className="h-12 w-full rounded-2xl bg-gradient-to-b from-[#2E7BFF] to-[#12429E] text-[15px] font-bold text-white shadow-lg shadow-pine/30 hover:brightness-110"
        pendingLabel="Sending…"
      >
        Send reset link
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token?: string }) {
  const [state, action] = useActionState(resetPasswordAction, {});
  const formRef = useFocusFirstError(state.error);
  return (
    <form ref={formRef} action={action} className="mt-5 space-y-3.5">
      <input type="hidden" name="token" value={token ?? ""} />
      <div>
        <label htmlFor="rp-password" className="mb-1.5 block text-[13px] font-medium text-ink">
          New password
        </label>
        <PasswordInput
          id="rp-password"
          name="password"
          autoComplete="new-password"
          placeholder="Min. 8 characters…"
          showStrength
          invalid={!!state.error}
        />
      </div>
      <FormErrorSummary errors={[state.error]} />
      <SubmitButton
        className="h-12 w-full rounded-2xl bg-gradient-to-b from-[#2E7BFF] to-[#12429E] text-[15px] font-bold text-white shadow-lg shadow-pine/30 hover:brightness-110"
        pendingLabel="Saving…"
      >
        Set new password
      </SubmitButton>
    </form>
  );
}
