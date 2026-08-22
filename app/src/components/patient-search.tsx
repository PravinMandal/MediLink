"use client";

import { useState } from "react";

/** Patient search with pending feedback while the server query runs. */
export function PatientSearchForm({ initialQuery }: { initialQuery?: string }) {
  const [pending, setPending] = useState(false);

  return (
    <form
      action="/portal/doctor"
      method="get"
      role="search"
      aria-busy={pending}
      onSubmit={() => setPending(true)}
      className="mb-5 flex gap-2"
    >
      <input
        type="search"
        name="q"
        defaultValue={initialQuery ?? ""}
        placeholder="Search “Rahul”, “98765…”, “cardiac”…"
        aria-label="Search patients"
        className="h-11 flex-1 rounded-md border border-line-strong bg-paper-raised px-3.5 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="h-11 cursor-pointer rounded-md border border-pine bg-pine px-4 text-sm font-medium text-white transition-colors hover:bg-pine-deep disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? (
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent"
            />
            Searching…
          </span>
        ) : (
          "Search"
        )}
      </button>
    </form>
  );
}
