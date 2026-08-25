"use client";

import { useState } from "react";

/**
 * Generic print helper — isolates the nearest .print-card ancestor for
 * printing via a body class toggled around window.print().
 */
export function PrintCardButton({
  label = "🖨 Print",
  className,
}: {
  label?: string;
  className?: string;
}) {
  const [printing, setPrinting] = useState(false);
  return (
    <button
      type="button"
      disabled={printing}
      onClick={async () => {
        setPrinting(true);
        const host = document.body;
        host.classList.add("printing-card");
        try {
          await new Promise<void>((resolve) => {
            const done = () => {
              window.removeEventListener("afterprint", done);
              resolve();
            };
            window.addEventListener("afterprint", done);
            window.print();
            setTimeout(done, 1500);
          });
        } finally {
          host.classList.remove("printing-card");
          setPrinting(false);
        }
      }}
      className={
        className ??
        "inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-line-strong bg-paper-raised px-3 text-xs font-medium text-ink transition-colors hover:border-ink-faint disabled:opacity-60"
      }
    >
      {printing ? "Preparing…" : label}
    </button>
  );
}
