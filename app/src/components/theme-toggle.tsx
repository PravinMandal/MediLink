"use client";

import { useEffect, useState } from "react";

/**
 * Theme toggle — Obsidian/Daylight (system-respecting) with localStorage
 * persistence and a pre-hydration inline script (in layout.tsx) so there's
 * no flash. Renders interactive immediately (no disabled-until-mount state):
 * the icon resolves after mount without blocking the click.
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

/** Cinematic swap: circular wipe from the click point, instant fallback. */
function cinematicApply(fn: () => void, e?: React.MouseEvent) {
  const root = document.documentElement;
  if (e) {
    root.style.setProperty("--theme-x", `${e.clientX}px`);
    root.style.setProperty("--theme-y", `${e.clientY}px`);
  }
  const vt = (
    document as Document & {
      startViewTransition?: (fn: () => void) => { finished: Promise<void> };
    }
  ).startViewTransition;
  if (typeof vt === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    vt.call(document, fn);
  } else {
    fn();
  }
}

function applyTransparency(choice: TransparencyChoice) {
  if (choice === "reduced") {
    document.documentElement.dataset.transparency = "reduced";
  } else {
    delete document.documentElement.dataset.transparency;
  }
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [isDark, setIsDark] = useState(false);
  const [reducedTransparency, setReducedTransparency] = useState(false);

  useEffect(() => {
    // Deferred a frame to satisfy the setState-in-effect purity rule (the
    // codebase's established pattern for capability probes). Buttons stay
    // interactive throughout — only the icon resolves after mount.
    const raf = requestAnimationFrame(() => {
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

  const toggleTheme = (e?: React.MouseEvent) => {
    const next: ThemeChoice = isDark ? "light" : "dark";
    localStorage.setItem(STORAGE_KEY, next);
    cinematicApply(() => applyChoice(next), e);
    setIsDark(!isDark);
  };

  const toggleTransparency = () => {
    const next: TransparencyChoice = reducedTransparency ? "default" : "reduced";
    localStorage.setItem(TRANSPARENCY_KEY, next);
    applyTransparency(next);
    setReducedTransparency(!reducedTransparency);
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
      <button
        type="button"
        onClick={toggleTransparency}
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
          "cursor-pointer rounded-lg border p-1.5 transition-colors " +
          (reducedTransparency
            ? "border-pine bg-pine-tint text-pine-ink"
            : "border-line-strong bg-paper-raised text-ink-soft hover:border-ink-faint hover:text-ink")
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
        >
          <rect x="3" y="11" width="10" height="10" rx="2" />
          <rect x="9" y="3" width="12" height="12" rx="2" strokeDasharray={reducedTransparency ? undefined : "4 3"} />
        </svg>
      </button>
    </span>
  );
}
