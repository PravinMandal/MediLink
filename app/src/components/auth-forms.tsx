"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  forgotPasswordAction,
  resendVerificationAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
} from "@/server/actions/auth-actions";
import { signInWithApple, signInWithGoogle } from "@/lib/auth-client";
import { Field, Input, FormErrorSummary } from "./ui";
import { SubmitButton, CopyButton, useFocusFirstError } from "./interactive";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Brand marks                                                         */
/* ------------------------------------------------------------------ */

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.5h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.1.1 3.5 2.7.2.1c2.2-2 3.8-5 3.8-8.9z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5l-.1.1-3.6 2.8v.1C3.5 21.3 7.5 24 12 24z" />
      <path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-.1-.1-3.6-2.8-.1.1C.5 8.7 0 10.3 0 12s.5 3.3 1.4 4.7l3.8-2.3z" />
      <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.5 0 3.5 2.7 1.4 6.8l3.8 2.9c1-2.9 3.7-5 6.8-5z" />
    </svg>
  );
}

function AppleMark({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8.98-.2 1.92-.87 3.03-.83 1.32.11 2.31.63 2.97 1.57-2.73 1.63-2.28 5.21.44 6.27-.6 1.57-1.38 3.13-2.52 4.16l-.01.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Shell — the premium modal card (reference-inspired, MediLink tokens)*/
/* ------------------------------------------------------------------ */

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-[420px] animate-[auth-rise_0.7s_cubic-bezier(0.22,1,0.36,1)_both]">
      <div className="frost-strong relative overflow-hidden rounded-[28px] border border-line shadow-[0_24px_80px_-16px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.04)_inset]">
        {/* premium top sheen */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/25"
        />
        <Link
          href="/"
          aria-label="Close and go home"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-paper-sunk/70 text-ink-faint transition-all hover:rotate-90 hover:bg-paper-sunk hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </Link>
        <div className="px-7 pb-7 pt-8 sm:px-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-line bg-paper-raised text-ink-faint shadow-inner">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h1 className="mt-4 text-center font-display text-[22px] font-semibold tracking-tight text-ink">
            {title}
          </h1>
          <div className="mt-2 text-center text-[13.5px] leading-relaxed text-ink-soft">
            {subtitle}
          </div>
          <div className="mt-6">{children}</div>
        </div>
        {footer ? (
          <div className="border-t border-line bg-paper-sunk/50 px-7 py-4 text-center text-[12.5px] text-ink-faint sm:px-8">
            {footer}
          </div>
        ) : null}
      </div>
      <style>{`@keyframes auth-rise{from{opacity:0;transform:translateY(18px) scale(.985)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3" aria-hidden>
      <span className="h-px flex-1 bg-line" />
      <span className="num text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">OR</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Social buttons                                                      */
/* ------------------------------------------------------------------ */

export function SocialButtons({
  google,
  apple,
  mode: _mode,
  callbackURL = "/portal",
}: {
  google: boolean;
  apple: boolean;
  mode: "in" | "up";
  callbackURL?: string;
}) {
  void _mode;
  const [pending, setPending] = useState<"google" | "apple" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // Reference copy: always "Continue with …" for both sign-in and sign-up.
  const verb = "Continue";

  const btn =
    "flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl border border-line-strong bg-[#1E232E] px-4 text-[14px] font-semibold text-white transition-all duration-200 hover:border-white/20 hover:bg-[#262C38] hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#1E232E] dark:text-white [.light_&]:bg-[#1E232E]";

  const lightBtn =
    "flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl border border-line-strong bg-paper-raised px-4 text-[14px] font-semibold text-ink transition-all duration-200 hover:border-ink-faint hover:bg-paper-sunk active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60";

  // Reference-faithful: both providers always visible. Without keys the
  // button is disabled with an explanatory title — the layout never jumps
  // between environments, and the industry-standard email path stays primary.
  const renderBtn = (
    kind: "google" | "apple",
    enabled: boolean,
    icon: React.ReactNode,
    label: string,
    busyLabel: string,
  ) => {
    const start = async () => {
      if (!enabled) {
        setNote(
          "Social sign-in activates once Google keys are added — email works right now, no setup needed.",
        );
        return;
      }
      setPending(kind);
      setNote(null);
      try {
        if (kind === "google") await signInWithGoogle(callbackURL);
        else await signInWithApple(callbackURL);
      } catch {
        setNote(
          kind === "google"
            ? "Google sign-in didn't start. Check connection and retry."
            : "Apple sign-in didn't start. Check connection and retry.",
        );
        setPending(null);
      }
    };
    return (
      <button
        key={kind}
        type="button"
        disabled={pending !== null}
        title={enabled ? label : `${label} — needs OAuth keys (see .env.example)`}
        // Dark pill like the reference in both themes for instant recognition;
        // reduced-transparency + forced-colors fall back to the solid token.
        className={btn}
        style={{ background: "color-mix(in srgb, #1E232E 96%, var(--surface-data))" }}
        onClick={start}
        aria-disabled={!enabled}
      >
        {icon}
        {pending === kind ? busyLabel : label}
        {!enabled ? (
          <span className="ml-1 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/60">
            Soon
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <div className="space-y-2.5">
      {renderBtn(
        "google",
        google,
        <GoogleMark />,
        `${verb} with Google`,
        "Opening Google…",
      )}
      {renderBtn(
        "apple",
        apple,
        <AppleMark className="text-white" />,
        `${verb} with Apple`,
        "Opening Apple…",
      )}
      {!google && !apple ? (
        <p className="text-center text-[11.5px] leading-relaxed text-ink-faint">
          Email works right now — social lights up with API keys at deploy time.
        </p>
      ) : null}
      {note ? (
        <p role="alert" className="text-center text-[12px] text-alert">{note}</p>
      ) : null}
      {void lightBtn}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Password field with show/hide + strength                            */
/* ------------------------------------------------------------------ */

function strengthOf(pw: string): { score: number; label: string } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 2) return { score: s, label: "Weak" };
  if (s <= 3) return { score: s, label: "Okay" };
  if (s <= 4) return { score: s, label: "Strong" };
  return { score: s, label: "Excellent" };
}

function PasswordInput({
  id,
  name,
  autoComplete,
  placeholder,
  showStrength,
  invalid,
}: {
  id: string;
  name: string;
  autoComplete: string;
  placeholder: string;
  showStrength?: boolean;
  invalid?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState("");
  const s = strengthOf(value);
  return (
    <div>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          minLength={8}
          aria-invalid={invalid ? true : undefined}
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-12 rounded-2xl pr-16 text-[14px]"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-ink-faint transition-colors hover:bg-line/40 hover:text-ink"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {showStrength && value.length > 0 ? (
        <div className="mt-2 flex items-center gap-2" aria-live="polite">
          <div className="flex flex-1 gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  i < Math.min(s.score, 5) ? "bg-pine" : "bg-line",
                )}
              />
            ))}
          </div>
          <span className="text-[11px] font-medium text-ink-faint">{s.label}</span>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sign in                                                             */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Sign up                                                             */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Verify / forgot / reset                                             */
/* ------------------------------------------------------------------ */

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
