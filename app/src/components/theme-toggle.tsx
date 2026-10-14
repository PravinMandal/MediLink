"use client";

import { useEffect, useState } from "react";

/**
 * Theme toggle — Obsidian/Daylight (system-respecting) with localStorage
 * persistence and a pre-hydration inline script (in layout.tsx) so there's
 * no flash. Renders interactive immediately (no disabled-until-mount state):
 * the icon resolves after mount without blocking the click.
 */
export type { ThemeChoice } from "@/lib/theme";
import {
  applyThemeChoice,
  cinematicApply,
  resolveIsDark,
  storedThemeChoice,
  type ThemeChoice,
} from "@/lib/theme";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Deferred a frame to satisfy the setState-in-effect purity rule (the
    // codebase's established pattern for capability probes). Buttons stay
    // interactive throughout — only the icon resolves after mount.
    const raf = requestAnimationFrame(() => {
      setIsDark(resolveIsDark(storedThemeChoice()));
    });

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (storedThemeChoice() === "system") {
        applyThemeChoice("system");
        setIsDark(mq.matches);
      }
    };
    mq.addEventListener("change", onChange);
    return () => {
      cancelAnimationFrame(raf);
      mq.removeEventListener("change", onChange);
    };
  }, []);

  const toggleTheme = (e?: React.MouseEvent) => {
    const next: ThemeChoice = isDark ? "light" : "dark";
    cinematicApply(() => applyThemeChoice(next), e);
    setIsDark(!isDark);
  };

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? "Switch to Daylight theme" : "Switch to Obsidian theme"}
        title={isDark ? "Switch to Daylight theme" : "Switch to Obsidian theme"}
        className={
          "cursor-pointer rounded-lg border border-line-strong bg-paper-raised p-1.5 text-ink-soft transition-colors hover:border-ink-faint hover:text-ink" +
          (compact ? "" : " ml-1")
        }
      >
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
          className={isDark ? "block" : "hidden"}
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
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
          className={isDark ? "hidden" : "block"}
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79" />
        </svg>
      </button>
    </span>
  );
}
