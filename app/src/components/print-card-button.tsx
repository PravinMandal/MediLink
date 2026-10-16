"use client";

import { useState } from "react";

/**
 * Print helper — isolates the emergency card for printing via a body class
 * toggled before/after window.print().
 */
export function PrintEmergencyCard({ label }: { label?: string }) {
  const [printing, setPrinting] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      disabled={printing}
      onClick={async () => {
        setPrinting(true);
        document.body.classList.add("printing-card");
        try {
          await new Promise<void>((resolve) => {
            const done = () => {
              window.removeEventListener("afterprint", done);
              resolve();
            };
            window.addEventListener("afterprint", done);
            window.print();
            // afterprint can be unreliable in some browsers
            setTimeout(done, 1500);
          });
        } finally {
          document.body.classList.remove("printing-card");
          setPrinting(false);
        }
      }}
      className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-pine bg-pine px-4 text-[13.5px] font-medium text-on-pine transition-colors hover:border-pine-deep hover:bg-pine-deep disabled:opacity-60"
    >
      {printing ? "Preparing…" : "🖨 Print / save card"}
    </button>
  );
}
