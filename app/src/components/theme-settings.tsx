"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  applyThemeChoice,
  cinematicApply,
  storedThemeChoice,
  type ThemeChoice,
} from "@/lib/theme";

const OPTIONS: Array<{ value: ThemeChoice; label: string; icon: typeof Sun; hint: string }> = [
  { value: "light", label: "Daylight", icon: Sun, hint: "Bright clinic surfaces" },
  { value: "dark", label: "Obsidian", icon: Moon, hint: "Midnight sapphire" },
  { value: "system", label: "System", icon: Monitor, hint: "Follow your device" },
];

/**
 * Themes section (profile): one-click whole-site appearance. State syncs
 * through src/lib/theme (same keys + attributes the pre-hydration script in
 * layout.tsx reads, so there is no flash on reload).
 */
export function ThemeSettings() {
  const [theme, setTheme] = useState<ThemeChoice>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setMounted(true);
      setTheme(storedThemeChoice());
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  function applyTheme(choice: ThemeChoice) {
    setTheme(choice);
    cinematicApply(() => applyThemeChoice(choice));
  }

  return (
    <div className="space-y-6 px-4 py-5 sm:px-6">
      <fieldset>
        <legend className="mb-2.5 text-[13px] font-semibold text-ink">Appearance</legend>
        <div role="radiogroup" aria-label="Appearance" className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = mounted && theme === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => applyTheme(opt.value)}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                  e.preventDefault();
                  const idx = OPTIONS.findIndex((o) => o.value === opt.value);
                  const next = OPTIONS[(idx + (e.key === "ArrowRight" ? 1 : OPTIONS.length - 1)) % OPTIONS.length];
                  applyTheme(next.value);
                  const group = e.currentTarget.parentElement;
                  group?.querySelectorAll<HTMLButtonElement>("[role='radio']")[
                    OPTIONS.findIndex((o) => o.value === next.value)
                  ]?.focus();
                }}
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
    </div>
  );
}
