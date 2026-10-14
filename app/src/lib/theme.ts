/**
 * Shared theme core (single definition).
 *
 * ThemeToggle (header quick-flip) and ThemeSettings (profile picker) used to
 * carry their own copies of the storage keys and DOM writes — which drifted.
 * Every reader/writer goes through here. Glass is unconditional: there is no
 * transparency option, surfaces are always frosted.
 */
export type ThemeChoice = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "medilink-theme";

export function resolveIsDark(choice: ThemeChoice): boolean {
  if (typeof window === "undefined") return false;
  return (
    choice === "dark" ||
    (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  );
}

/** Persist + apply a theme choice (no flash: matches the pre-hydration script). */
export function applyThemeChoice(choice: ThemeChoice): void {
  localStorage.setItem(THEME_STORAGE_KEY, choice);
  document.documentElement.dataset.theme = resolveIsDark(choice) ? "dark" : "light";
}

/** Stored theme choice, defaulting to system. */
export function storedThemeChoice(): ThemeChoice {
  return (localStorage.getItem(THEME_STORAGE_KEY) as ThemeChoice | null) ?? "system";
}

/**
 * Cinematic swap: circular wipe from the click point, instant fallback when
 * view transitions are unavailable or the user prefers reduced motion.
 */
export function cinematicApply(fn: () => void, e?: { clientX: number; clientY: number }): void {
  const root = document.documentElement;
  if (e) {
    root.style.setProperty("--theme-x", `${e.clientX}px`);
    root.style.setProperty("--theme-y", `${e.clientY}px`);
  }
  const vt = (
    document as Document & { startViewTransition?: (fn: () => void) => unknown }
  ).startViewTransition;
  if (typeof vt === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    vt.call(document, fn);
  } else {
    fn();
  }
}
