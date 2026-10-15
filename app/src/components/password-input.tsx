"use client";

import { useState } from "react";
import { Input } from "./ui";
import { cn } from "@/lib/utils";

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

export function PasswordInput({
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
