"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

/**
 * Record-content search within one patient's consented space.
 * Live (300ms debounce) with URL sync (?q=) — results render server-side,
 * scope-filtered by the access decision.
 */
export function RecordSearchForm({ patientId }: { patientId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const active = !!params.get("q");
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nav = (nextQ: string) => {
    const next = new URLSearchParams(params.toString());
    if (nextQ.trim()) next.set("q", nextQ.trim());
    else next.delete("q");
    startTransition(() =>
      router.replace(`/portal/doctor/patients/${patientId}?${next.toString()}`),
    );
  };

  // Live search: debounce keystrokes; skip the first run so a fresh mount
  // doesn't re-navigate.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => nav(q), 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <form
      role="search"
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        nav(q);
      }}
    >
      <label className="sr-only" htmlFor="record-search">Search this record</label>
      <input
        id="record-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search records — e.g. creatinine, 2021"
        className="w-44 rounded-md border border-line-strong bg-paper px-2.5 py-1.5 text-[12.5px] text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none sm:w-56"
      />
      <button
        type="submit"
        className="cursor-pointer rounded-md border border-line-strong bg-paper-raised px-2.5 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
      >
        {active ? "Search again" : "Search"}
      </button>
      {active ? (
        <button
          type="button"
          onClick={() => {
            setQ("");
            const next = new URLSearchParams(params.toString());
            next.delete("q");
            router.replace(`/portal/doctor/patients/${patientId}?${next.toString()}`);
          }}
          className="cursor-pointer text-[11px] text-ink-faint hover:text-ink underline"
        >
          Clear
        </button>
      ) : null}
    </form>
  );
}
