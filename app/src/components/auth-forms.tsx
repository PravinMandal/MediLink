"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signInAction, signUpAction } from "@/server/actions/auth-actions";
import { Field, Input, Badge, FormErrorSummary } from "./ui";
import { SubmitButton, CopyButton, useFocusFirstError } from "./interactive";

export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signInAction, {});
  const formRef = useFocusFirstError(state.error);
  const fieldErrors = {
    email:
      state.error === "Enter your email and password."
        ? "Enter your email."
        : state.error === "Email or password is incorrect."
          ? "Email or password is incorrect."
          : undefined,
    password:
      state.error === "Enter your email and password."
        ? "Enter your password."
        : state.error === "Email or password is incorrect."
          ? "Email or password is incorrect."
          : undefined,
  };

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email" htmlFor="si-email" error={fieldErrors.email}>
        <Input
          id="si-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={fieldErrors.email ? "si-email-error" : undefined}
          placeholder="you@example.com"
        />
      </Field>
      <Field label="Password" htmlFor="si-password" error={fieldErrors.password}>
        <Input
          id="si-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={fieldErrors.password ? true : undefined}
          aria-describedby={fieldErrors.password ? "si-password-error" : undefined}
          placeholder="Your password…"
        />
      </Field>
      <FormErrorSummary errors={[state.error]} />
      <SubmitButton className="w-full" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>

      <div className="rounded-lg border border-line bg-paper-sunk/60 p-3">
        <p className="eyebrow mb-2">Demo accounts — password “Password123!”</p>
        <div className="grid grid-cols-1 gap-1.5 text-xs">
          {[
            ["meera@medilink.health", "Verified doctor · has consent"],
            ["arjun@medilink.health", "Verified cardiologist · no consent yet"],
            ["rahul@example.com", "Patient (Rahul Sharma)"],
            ["lab@sunrise.health", "Lab staff · Sunrise Diagnostics"],
            ["admin@medilink.health", "Platform admin"],
          ].map(([email, desc]) => (
            <div
              key={email}
              className="flex items-center justify-between gap-2 rounded border border-transparent px-2 py-1 text-left transition-colors hover:border-line hover:bg-paper-raised"
            >
              <span>
                <span className="num block text-[11px] text-ink">{email}</span>
                <span className="text-ink-faint">{desc}</span>
              </span>
              <CopyButton value={email} label="Copy" />
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-[13px] text-ink-soft">
        New here?{" "}
        <Link href="/sign-up" className="font-medium text-pine underline underline-offset-2">
          Create an account
        </Link>
      </p>
    </form>
  );
}

// Server-side signUpAction only registers patient/doctor; other roles are
// granted by a platform admin after sign-up.
const ROLES: Array<{ value: string; title: string; desc: string }> = [
  { value: "patient", title: "Patient", desc: "Own your lifetime record, control access" },
  { value: "doctor", title: "Doctor", desc: "Verified clinicians — read, contribute, summarize" },
];

export function SignUpForm() {
  const [state, action] = useActionState(signUpAction, {});
  const [role, setRole] = useState("patient");
  const formRef = useFocusFirstError(state.error);
  const fieldErrors = {
    name:
      state.error === "Enter your name and email." ? "Enter your full name." : undefined,
    email:
      state.error === "Enter your name and email."
        ? "Enter your email."
        : state.error === "An account with this email already exists. Sign in instead."
          ? "An account with this email already exists."
          : undefined,
    password:
      state.error === "Password must be at least 8 characters."
        ? "Password must be at least 8 characters."
        : undefined,
  };

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <fieldset>
        <legend className="mb-2 block text-[13px] font-medium text-ink">
          I am joining as
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              aria-pressed={role === r.value}
              onClick={() => setRole(r.value)}
              className={
                "cursor-pointer rounded-lg border p-3 text-left transition-colors " +
                (role === r.value
                  ? "border-pine bg-pine-tint"
                  : "border-line bg-paper-raised hover:border-line-strong")
              }
            >
              <span className="block text-sm font-medium text-ink">{r.title}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-ink-soft">
                {r.desc}
              </span>
            </button>
          ))}
        </div>
      </fieldset>
      <input type="hidden" name="role" value={role} />

      <Field label="Full name" htmlFor="su-name" error={fieldErrors.name}>
        <Input
          id="su-name"
          name="name"
          autoComplete="name"
          required
          aria-invalid={fieldErrors.name ? true : undefined}
          aria-describedby={fieldErrors.name ? "su-name-error" : undefined}
          placeholder="e.g. Rahul Sharma"
        />
      </Field>
      <Field label="Email" htmlFor="su-email" error={fieldErrors.email}>
        <Input
          id="su-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={fieldErrors.email ? "su-email-error" : undefined}
          placeholder="you@example.com"
        />
      </Field>
      <Field
        label="Password"
        htmlFor="su-password"
        hint="At least 8 characters."
        error={fieldErrors.password}
      >
        <Input
          id="su-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          aria-invalid={fieldErrors.password ? true : undefined}
          aria-describedby={
            fieldErrors.password ? "su-password-error" : undefined
          }
          placeholder="Create a password…"
        />
      </Field>

      {role === "doctor" ? (
        <Badge tone="info">
          Doctor accounts submit council registration for verification after sign-up.
        </Badge>
      ) : null}

      <FormErrorSummary errors={[state.error]} />
      <SubmitButton className="w-full" pendingLabel="Creating account…">
        Create account
      </SubmitButton>
      <p className="text-center text-[13px] text-ink-soft">
        Already registered?{" "}
        <Link href="/sign-in" className="font-medium text-pine underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </form>
  );
}
