"use client";

import Link from "next/link";

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
