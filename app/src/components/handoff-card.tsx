"use client";

import { useState, useTransition } from "react";
import { createHandoffAction } from "@/server/actions/discovery-actions";
import { CopyButton } from "@/components/interactive";
import { formatIst } from "@/lib/utils";

/** Patient-present handoff (BuildPlan §8.2): single-use, 10-minute code. */
export function HandoffCard({ patientCode }: { patientCode?: string | null }) {
  const [result, setResult] = useState<
    { code: string; expiresAt: string } | { message: string } | null
  >(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const start = () =>
    startTransition(async () => {
      setCopied(false);
      const r = await createHandoffAction();
      setResult(r.ok ? { code: r.code, expiresAt: r.expiresAt } : { message: r.message });
    });

  return (
    <div className="px-4 py-4 sm:px-5">
      {patientCode ? (
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-line bg-paper-sunk/60 px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
              Your Patient ID
            </p>
            <p className="num text-[15px] font-semibold tracking-wide text-ink">
              {patientCode}
            </p>
          </div>
          <CopyButton value={patientCode} label="Copy ID" />
          <p className="w-full text-[11.5px] leading-relaxed text-ink-faint">
            Read it to your clinician for lookup — or create a one-time code below.
          </p>
        </div>
      ) : null}
      <p className="text-[13px] text-ink-soft">
        Sitting with a clinician? Create a one-time sharing code they can enter while you are
        there. The code is single-use and expires in 10 minutes.
      </p>
      {result && "code" in result ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <p className="num rounded-lg border border-line bg-paper px-3 py-2 text-lg font-semibold tracking-wide text-ink">
              {result.code}
            </p>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(result.code);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
              className="rounded-lg border border-line px-3 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-line/40"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-ink-faint">
            Single-use · expires {formatIst(result.expiresAt)}
          </p>
        </div>
      ) : null}
      {result && "message" in result ? (
        <p role="status" className="mt-2 text-[13px] text-alert">
          {result.message}
        </p>
      ) : null}
      <button
        type="button"
        onClick={start}
        disabled={pending}
        className="mt-3 rounded-lg bg-pine px-3.5 py-2 text-[13px] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-60 print:hidden"
      >
        {pending ? "Creating…" : result && "code" in result ? "New code" : "Share with a clinician now"}
      </button>
    </div>
  );
}
