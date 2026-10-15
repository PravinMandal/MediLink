"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { cn, formatDate, TRUST_LABEL, KIND_LABEL } from "@/lib/utils";
import { buttonClass, Button } from "./ui";
import { useFocusTrap } from "./use-focus-trap";

/* ------------------------------------------------------------------ */
/* useFocusFirstError — focus summary or first invalid field on error  */
/* ------------------------------------------------------------------ */

export function useFocusFirstError(formError: string | undefined) {
  const formRef = useRef<HTMLFormElement>(null);
  const seen = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!formError || seen.current === formError) return;
    seen.current = formError;
    const form = formRef.current;
    if (!form) return;
    const summary = form.querySelector<HTMLElement>("[data-error-summary]");
    const invalid = form.querySelector<HTMLElement>("[aria-invalid='true']");
    (summary ?? invalid)?.focus();
  }, [formError]);

  return formRef;
}

/* ------------------------------------------------------------------ */
/* SubmitButton — shows pending state, keeps label                     */
/* ------------------------------------------------------------------ */

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={buttonClass(variant, size, className)}
      aria-busy={pending}
    >
      {pending ? (
        <span
          aria-hidden
          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent"
        />
      ) : null}
      {pending ? (pendingLabel ?? "Working…") : children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* SourceDrawer — the citation chain. The product's signature element. */
/* Click any claim's [n] chips → drawer opens with the provenance      */
/* chain: who recorded it, where, when, from which source document.    */
/* ------------------------------------------------------------------ */

export type ClaimSourceView = {
  recordType: string;
  recordId: string;
  documentId?: string;
  label: string;
  date?: string;
  trust: string;
};

export function CitationChips({
  sources,
  onOpen,
}: {
  sources: ClaimSourceView[];
  onOpen: (n: number) => void;
}) {
  if (!sources.length) return null;
  // Trust-ranked chip variants: the chip itself encodes the evidence level —
  // filled = verified, solid outline = extracted, dashed = self-reported.
  const chipClass = (trust: string) => {
    const base =
      "num inline-flex h-4 min-h-6 min-w-6 cursor-pointer items-center justify-center rounded-[3px] px-1.5 text-[10px] font-semibold leading-none transition-colors";
    if (trust === "verified")
      return `${base} border border-pine/40 bg-pine-tint text-pine-ink hover:border-pine hover:bg-pine hover:text-on-pine`;
    if (trust === "self_reported")
      return `${base} border border-dashed border-ink-faint/60 bg-transparent text-ink-faint hover:border-ink-faint hover:text-ink`;
    return `${base} border border-ink-faint/50 bg-paper-raised text-ink-soft hover:border-ink-faint hover:text-ink`;
  };
  return (
    <span className="ml-1.5 inline-flex gap-1 align-baseline">
      {sources.slice(0, 4).map((s, i) => (
        <button
          key={`${s.recordId}-${i}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(i);
          }}
          title={`Source ${i + 1}: ${s.label} · ${TRUST_LABEL[s.trust] ?? s.trust}`}
          aria-label={`Source ${i + 1}: ${s.label}, ${TRUST_LABEL[s.trust] ?? s.trust}`}
          className={chipClass(s.trust)}
        >
          {i + 1}
        </button>
      ))}
      {sources.length > 4 ? (
        <span className="num self-center text-[10px] text-ink-faint">
          +{sources.length - 4}
        </span>
      ) : null}
    </span>
  );
}

export function SourceDrawer({
  sources,
  openIndex,
  onClose,
  extra,
}: {
  sources: ClaimSourceView[];
  openIndex: number | null;
  onClose: () => void;
  extra?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, openIndex !== null, onClose);

  if (openIndex === null) return null;

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <button
        type="button"
        aria-label="Close sources"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-ink/20"
        style={{ animation: "fade-in 150ms ease-out" }}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-drawer-heading"
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-line bg-paper-raised shadow-xl focus:outline-none"
        style={{ animation: "slide-in 200ms cubic-bezier(0.2,0.8,0.2,1)" }}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div>
            <p className="eyebrow">Evidence chain</p>
            <p id="source-drawer-heading" className="font-display text-[15px] font-semibold text-ink">
              {sources.length} source{sources.length === 1 ? "" : "s"} behind this statement
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            Close
          </Button>
        </div>
        <ol className="flex-1 divide-y divide-line overflow-y-auto">
          {sources.map((s, i) => (
            <li key={`${s.recordId}-${i}`} className="flex gap-3 px-5 py-4">
              <span className="num mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-pine bg-pine-tint text-[11px] font-semibold text-pine-ink">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{s.label}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                  <span>{KIND_LABEL[s.recordType] ?? s.recordType}</span>
                  {s.date ? (
                    <span className="num">{formatDate(s.date, "short")}</span>
                  ) : null}
                </p>
                <p className="mt-2 flex items-center gap-2">
                  {s.trust === "verified" ? (
                    <span className="seal">✓ Verified</span>
                  ) : (
                    <span className="text-[11px] font-medium text-ink-faint">
                      {TRUST_LABEL[s.trust] ?? s.trust}
                    </span>
                  )}
                  {s.documentId ? (
                    <a
                      href={`/api/files/${s.documentId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-pine underline decoration-pine/40 underline-offset-2 hover:decoration-pine"
                    >
                      Open source document ↗
                    </a>
                  ) : null}
                </p>
              </div>
            </li>
          ))}
        </ol>
        {extra ? (
          <div className="border-t border-line px-5 py-3 text-xs text-ink-faint">
            {extra}
          </div>
        ) : null}
      </div>
      <style>{`
        @keyframes slide-in { from { transform: translateX(24px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
        @keyframes fade-in { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </div>
  );
}

/** One AI-summary claim with its citation chips wired to the drawer. */
export function ClaimLine({
  text,
  sources,
  tone,
}: {
  text: string;
  sources: ClaimSourceView[];
  tone?: "alert";
}) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <li
        className={cn(
          "group flex items-start gap-2 text-[13.5px] leading-relaxed",
          tone === "alert" ? "text-alert" : "text-ink",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full",
            tone === "alert" ? "bg-alert" : "bg-pine",
          )}
        />
        <span>
          {text}
          <CitationChips sources={sources} onOpen={(n) => setOpen(n)} />
        </span>
      </li>
      <SourceDrawer
        sources={sources}
        openIndex={open}
        onClose={() => setOpen(null)}
        extra="Every statement in a MediLink summary resolves to records it was generated from. AI-generated — verify against sources."
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Copyable (for demo accounts etc.)                                   */
/* ------------------------------------------------------------------ */

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Unmount-safe: a stale timeout firing after unmount warns in dev and
  // flips dead state. The live region announces the copy to screen readers
  // (the visual label change alone is silent).
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 1200);
        } catch {
          /* clipboard unavailable */
        }
      }}
      aria-live="polite"
      className="num cursor-pointer rounded border border-line-strong bg-paper-raised px-1.5 py-0.5 text-[10px] text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
    >
      {copied ? "Copied ✓" : (label ?? "Copy")}
    </button>
  );
}
