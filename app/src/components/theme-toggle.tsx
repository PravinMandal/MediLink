"use client";

import { useEffect, useState } from "react";

/**
 * Theme toggle — Obsidian/Daylight (system-respecting) with localStorage
 * persistence and a pre-hydration inline script (in layout.tsx) so there's
 * no flash. The inline script owns the <html data-theme> attribute; this
 * component keeps it in sync and persists the choice.
 *
 * Also exposes a "Reduce transparency" toggle (independent of theme,
 * BuildPlan §7.2) persisted under "medilink-transparency" and applied as
 * <html data-transparency="reduced">. The OS `prefers-reduced-transparency`
 * preference is honored by CSS regardless of this toggle.
 */
export type ThemeChoice = "light" | "dark" | "system";
export type TransparencyChoice = "default" | "reduced";

const STORAGE_KEY = "medilink-theme";
const TRANSPARENCY_KEY = "medilink-transparency";

function applyChoice(choice: ThemeChoice) {
  const dark =
    choice === "dark" ||
    (choice === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

function applyTransparency(choice: TransparencyChoice) {
  if (choice === "reduced") {
    document.documentElement.dataset.transparency = "reduced";
  } else {
    delete document.documentElement.dataset.transparency;
  }
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  // Start from the DOM state set by the pre-hydration script.
  const [isDark, setIsDark] = useState<boolean | null>(null);
  const [reducedTransparency, setReducedTransparency] = useState(false);
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
      setReducedTransparency(
        localStorage.getItem(TRANSPARENCY_KEY) === "reduced" ||
          document.documentElement.dataset.transparency === "reduced",
      );
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

  const toggleTheme = () => {
    // Obsidian (dark) is the brand default; the toggle cycles Obsidian ⇄ Daylight.
    const next: ThemeChoice = isDark ? "light" : "dark";
    localStorage.setItem(STORAGE_KEY, next);
    applyChoice(next);
    setIsDark(!isDark);
  };

  const toggleTransparency = () => {
    const next: TransparencyChoice = reducedTransparency ? "default" : "reduced";
    localStorage.setItem(TRANSPARENCY_KEY, next);
    applyTransparency(next);
    setReducedTransparency(!reducedTransparency);
  };

  // SSR / pre-mount: render a placeholder with identical dimensions to avoid
  // layout shift; it becomes interactive after hydration.
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={toggleTheme}
        disabled={!mounted}
        aria-label={isDark ? "Switch to Daylight theme" : "Switch to Obsidian theme"}
        title={isDark ? "Switch to Daylight theme" : "Switch to Obsidian theme"}
        className={
          "cursor-pointer rounded-lg border border-line-strong bg-paper-raised p-1.5 text-ink-soft transition-colors hover:border-ink-faint hover:text-ink disabled:opacity-50" +
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
      <button
        type="button"
        onClick={toggleTransparency}
        disabled={!mounted}
        aria-pressed={reducedTransparency}
        aria-label={
          reducedTransparency
            ? "Transparency reduced: elevated panels are solid. Switch back to full transparency"
            : "Reduce transparency: make elevated panels solid"
        }
        title={
          reducedTransparency ? "Transparency reduced — restore" : "Reduce transparency"
        }
        className={
          "cursor-pointer rounded-lg border p-1.5 transition-colors disabled:opacity-50 " +
          (reducedTransparency
            ? "border-pine bg-pine-tint text-pine-ink"
            : "border-line-strong bg-paper-raised text-ink-soft hover:border-ink-faint hover:text-ink")
        }
      >
        {/* Layered squares: solid base + outlined top layer */}
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
        >
          <rect x="3" y="11" width="10" height="10" rx="2" />
          <rect x="9" y="3" width="12" height="12" rx="2" strokeDasharray={reducedTransparency ? undefined : "4 3"} />
        </svg>
      </button>
    </span>
  );
}
