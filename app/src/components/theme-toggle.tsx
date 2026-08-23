"use client";

import { useEffect, useState } from "react";

/**
 * Theme toggle — light/dark/system with localStorage persistence and a
 * pre-hydration inline script (in layout.tsx) so there's no flash.
 * The inline script owns the <html data-theme> attribute; this component
 * keeps it in sync and persists the choice.
 */
export type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "medilink-theme";

function applyChoice(choice: ThemeChoice) {
  const dark =
    choice === "dark" ||
    (choice === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  // Start from the DOM state set by the pre-hydration script.
  const [isDark, setIsDark] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Deferred a frame to satisfy the setState-in-effect purity rule (the
    // codebase's established pattern for capability probes).
    const raf = requestAnimationFrame(() => {
      setMounted(true);
      const stored = localStorage.getItem(STORAGE_KEY) as ThemeChoice | null;
      const choice: ThemeChoice = stored ?? "system";
      const dark =
        choice === "dark" ||
        (choice === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      setIsDark(dark);
    });

    // Follow OS changes while in system mode.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const current = (localStorage.getItem(STORAGE_KEY) ?? "system") as ThemeChoice;
      if (current === "system") {
        applyChoice("system");
        setIsDark(mq.matches);
      }
    };
    mq.addEventListener("change", onChange);
    return () => {
      cancelAnimationFrame(raf);
      mq.removeEventListener("change", onChange);
    };
  }, []);

  const toggle = () => {
    const next: ThemeChoice = isDark ? "light" : "dark";
    localStorage.setItem(STORAGE_KEY, next);
    applyChoice(next);
    setIsDark(!isDark);
  };

  // SSR / pre-mount: render a placeholder with identical dimensions to avoid
  // layout shift; it becomes interactive after hydration.
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!mounted}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={
        "cursor-pointer rounded-md border border-line-strong bg-paper-raised p-1.5 text-ink-soft transition-colors hover:border-ink-faint hover:text-ink disabled:opacity-50" +
        (compact ? "" : " ml-1")
      }
    >
      {/* Sun (shown in dark, to go light) */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className={mounted && isDark ? "block" : "hidden"}
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
      {/* Moon (shown in light, to go dark) */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className={mounted && !isDark ? "block" : "hidden"}
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79" />
      </svg>
    </button>
  );
}
