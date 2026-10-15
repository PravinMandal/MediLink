"use client";

import { useActionState, useState } from "react";
import { signUpAction } from "@/server/actions/auth-actions";
import { Field, Input, FormErrorSummary } from "./ui";
import { SubmitButton, useFocusFirstError } from "./interactive";
import { cn } from "@/lib/utils";
import { OrDivider } from "./auth-shell";
import { SocialButtons } from "./social-buttons";
import { PasswordInput } from "./password-input";

const ROLES: Array<{ value: string; title: string; desc: string }> = [
  { value: "patient", title: "Patient", desc: "Own your record, control access" },
  { value: "doctor", title: "Doctor", desc: "Verified clinicians contribute" },
];

export function SignUpForm({ google, apple }: { google: boolean; apple: boolean }) {
  const [state, action] = useActionState(signUpAction, {});
  const [role, setRole] = useState("patient");
  const formRef = useFocusFirstError(state.error);

  return (
    <div>
      {/* Reference order: primary email CTA first, social second. The blue
          Get Started submits the verified-email form; Google/Apple sit below
          the OR divider exactly like the provided reference. */}
      <form ref={formRef} action={action} className="space-y-3.5">
        <fieldset>
          <legend className="mb-2 block text-[13px] font-medium text-ink">I am joining as</legend>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Account type">
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={role === r.value}
                onClick={() => setRole(r.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                    e.preventDefault();
                    setRole(role === "patient" ? "doctor" : "patient");
                  }
                }}
                className={cn(
                  "cursor-pointer rounded-2xl border p-3 text-left transition-all",
                  role === r.value
                    ? "border-pine bg-pine-tint shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
                    : "border-line bg-paper-raised hover:border-line-strong",
                )}
              >
                <span className="block text-sm font-semibold text-ink">{r.title}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-ink-soft">{r.desc}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <input type="hidden" name="role" value={role} />

        <Field label="Full name" htmlFor="su-name" error={undefined}>
          <Input
            id="su-name"
            name="name"
            autoComplete="name"
            required
            placeholder="e.g. Rahul Sharma"
            className="h-12 rounded-2xl text-[14px]"
          />
        </Field>
        <Field label="Email" htmlFor="su-email" error={undefined}>
          <Input
            id="su-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            className="h-12 rounded-2xl text-[14px]"
          />
        </Field>
        <div>
          <label htmlFor="su-password" className="mb-1.5 block text-[13px] font-medium text-ink">
            Password
          </label>
          <PasswordInput
            id="su-password"
            name="password"
            autoComplete="new-password"
            placeholder="Min. 8 characters…"
            showStrength
            invalid={!!state.error}
          />
          <p className="mt-1.5 text-[11.5px] text-ink-faint">
            We&apos;ll email a verification link — it proves this address is really yours.
          </p>
        </div>

        <FormErrorSummary errors={[state.error]} />
        <SubmitButton
          className="h-12 w-full rounded-full bg-pine text-[15px] font-bold text-on-pine shadow-[0_8px_24px_-6px_rgba(26,86,196,0.55)] transition-all duration-200 hover:scale-[1.01] hover:brightness-110 active:scale-[0.99]"
          pendingLabel="Creating account…"
        >
          Get Started
        </SubmitButton>
        <p className="text-center text-[11.5px] leading-relaxed text-ink-faint">
          By continuing you agree to consented, auditable record-keeping. Free for patients.
        </p>
      </form>
      <OrDivider />
      <SocialButtons google={google} apple={apple} mode="up" />
    </div>
  );
}
