"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

/**
 * Timeline filter: text query (FTS over record content) + kind filter,
 * URL-driven (?q=&kind=) with 300ms debounced live search.
 */
export function TimelineFilter({ basePath }: { basePath: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const kind = params.get("kind") ?? "";
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apply = (nextQ: string, nextKind: string) => {
    const next = new URLSearchParams();
    if (nextQ.trim()) next.set("q", nextQ.trim());
    if (nextKind) next.set("kind", nextKind);
    startTransition(() =>
      router.replace(next.toString() ? `${basePath}?${next.toString()}` : basePath),
    );
  };

  // Debounced live search; skip the mount run so server-rendered state stays.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => apply(q, kind), 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const kindBtn = (value: string, label: string) => (
    <button
      key={value}
      type="button"
      aria-pressed={kind === value}
      onClick={() => apply(q, value === kind ? "" : value)}
      className={
        "shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors " +
        (kind === value
          ? "border-pine bg-pine text-on-pine"
          : "border-line-strong bg-paper-raised text-ink-soft hover:border-ink-faint hover:text-ink")
      }
    >
      {label}
    </button>
  );

  return (
    <div className="mb-6 space-y-3">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          apply(q, kind);
        }}
        className="flex gap-2"
      >
        <label className="sr-only" htmlFor="timeline-search">Search your history</label>
        <input
          id="timeline-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your history — e.g. creatinine, 2021, penicillin"
          className="h-11 flex-1 rounded-lg border border-line-strong bg-paper-raised px-3.5 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none"
        />
        <button
          type="submit"
          className="h-11 cursor-pointer rounded-lg border border-line-strong bg-paper-raised px-4 text-[13px] font-medium text-ink transition-colors hover:border-ink-faint"
        >
          Search
        </button>
      </form>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by kind">
        {kindBtn("condition", "Conditions")}
        {kindBtn("medication", "Medications")}
        {kindBtn("observation", "Labs")}
        {kindBtn("allergy", "Allergies")}
        {kindBtn("procedure", "Procedures")}
        {kindBtn("document", "Documents")}
      </div>
    </div>
  );
}
