"use client";

import { useState } from "react";
import { signInWithApple, signInWithGoogle } from "@/lib/auth-client";

export function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.5h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.1.1 3.5 2.7.2.1c2.2-2 3.8-5 3.8-8.9z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5l-.1.1-3.6 2.8v.1C3.5 21.3 7.5 24 12 24z" />
      <path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-.1-.1-3.6-2.8-.1.1C.5 8.7 0 10.3 0 12s.5 3.3 1.4 4.7l3.8-2.3z" />
      <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.5 0 3.5 2.7 1.4 6.8l3.8 2.9c1-2.9 3.7-5 6.8-5z" />
    </svg>
  );
}

export function AppleMark({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8.98-.2 1.92-.87 3.03-.83 1.32.11 2.31.63 2.97 1.57-2.73 1.63-2.28 5.21.44 6.27-.6 1.57-1.38 3.13-2.52 4.16l-.01.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

export function SocialButtons({
  google,
  apple,
  callbackURL = "/portal",
}: {
  google: boolean;
  apple: boolean;
  mode?: "in" | "up";
  callbackURL?: string;
}) {
  const [pending, setPending] = useState<"google" | "apple" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // Reference copy: always "Continue with …" for both sign-in and sign-up.
  const verb = "Continue";

  const btn =
    "flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl border border-line-strong bg-[#1E232E] px-4 text-[14px] font-semibold text-white transition-all duration-200 hover:border-white/20 hover:bg-[#262C38] hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#1E232E] dark:text-white [.light_&]:bg-[#1E232E]";

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
    </div>
  );
}
