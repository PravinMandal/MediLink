"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun, Droplets } from "lucide-react";
import { cn } from "@/lib/utils";

type ThemeChoice = "light" | "dark" | "system";
type TransparencyChoice = "default" | "reduced";

const STORAGE_KEY = "medilink-theme";
const TRANSPARENCY_KEY = "medilink-transparency";

const OPTIONS: Array<{ value: ThemeChoice; label: string; icon: typeof Sun; hint: string }> = [
  { value: "light", label: "Daylight", icon: Sun, hint: "Bright clinic surfaces" },
  { value: "dark", label: "Obsidian", icon: Moon, hint: "Midnight sapphire" },
  { value: "system", label: "System", icon: Monitor, hint: "Follow your device" },
];

/**
 * Themes section (profile): one-click whole-site appearance. Writes the same
 * localStorage keys + data-theme/data-transparency attributes the
 * pre-hydration script in layout.tsx reads, so there is no flash on reload.
 */
/* eslint-disable react-hooks/immutability -- DOM writes are the point of this
   client component: it syncs React state to documentElement attributes and
   localStorage, the same pattern as theme-toggle.tsx. */
export function ThemeSettings() {
  const [theme, setTheme] = useState<ThemeChoice>("system");
  const [transparency, setTransparency] = useState<TransparencyChoice>("default");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setMounted(true);
      setTheme((localStorage.getItem(STORAGE_KEY) as ThemeChoice | null) ?? "system");
      setTransparency(
        (localStorage.getItem(TRANSPARENCY_KEY) as TransparencyChoice | null) ?? "default",
      );
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  function applyTheme(choice: ThemeChoice, e?: React.MouseEvent) {
    setTheme(choice);
    localStorage.setItem(STORAGE_KEY, choice);
    const swap = () => {
      const dark =
        choice === "dark" ||
        (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };
    const root = document.documentElement;
    if (e) {
      root.style.setProperty("--theme-x", `${e.clientX}px`);
      root.style.setProperty("--theme-y", `${e.clientY}px`);
    }
    const vt = (
      document as Document & { startViewTransition?: (fn: () => void) => unknown }
    ).startViewTransition;
    if (typeof vt === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      vt.call(document, swap);
    } else {
      swap();
    }
  }

  function applyTransparency(choice: TransparencyChoice) {
    setTransparency(choice);
    localStorage.setItem(TRANSPARENCY_KEY, choice);
    if (choice === "reduced") {
      document.documentElement.dataset.transparency = "reduced";
    } else {
      delete document.documentElement.dataset.transparency;
    }
  }

  return (
    <div className="space-y-6 px-4 py-5 sm:px-6">
      <fieldset>
        <legend className="mb-2.5 text-[13px] font-semibold text-ink">Appearance</legend>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = mounted && theme === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={(e) => applyTheme(opt.value, e)}
                aria-pressed={active}
                className={cn(
                  "glass-hover flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left",
                  active
                    ? "border-pine/40 bg-pine-tint shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
                    : "border-line bg-paper-raised",
                )}
              >
                <Icon
                  size={19}
                  aria-hidden
                  className={active ? "text-pine" : "text-ink-faint"}
                />
                <span className="text-[13.5px] font-semibold text-ink">{opt.label}</span>
                <span className="text-[11.5px] leading-snug text-ink-faint">{opt.hint}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2.5 text-[13px] font-semibold text-ink">Glass effects</legend>
        <div className="flex gap-2">
          {(
            [
              ["default", "Frosted glass", true],
              ["reduced", "Solid surfaces", false],
            ] as Array<[TransparencyChoice, string, boolean]>
          ).map(([value, label, recommended]) => (
            <button
              key={value}
              type="button"
              onClick={() => applyTransparency(value)}
              aria-pressed={mounted && transparency === value}
              className={cn(
                "glass-hover inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[13px] font-medium",
                mounted && transparency === value
                  ? "border-pine/40 bg-pine-tint text-pine-ink"
                  : "border-line bg-paper-raised text-ink-soft hover:text-ink",
              )}
            >
              <Droplets size={15} aria-hidden className={value === "reduced" ? "opacity-40" : "text-pine"} />
              {label}
              {recommended ? <span className="text-[10.5px] text-ink-faint">recommended</span> : null}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint">
          Solid surfaces remove blur for low-power devices or if translucency
          bothers you — everything stays readable either way.
        </p>
      </fieldset>
    </div>
  );
}
