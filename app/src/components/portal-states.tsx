"use client";

import { useEffect } from "react";
import { Card } from "./ui";

/** Route-level loading skeleton — matches the card/hairline design language. */
export function RouteSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-5">
      <div className="space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-paper-sunk" />
        <div className="h-7 w-64 animate-pulse rounded bg-paper-sunk" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-paper-sunk" />
      </div>
      <Card className="p-5">
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-paper-sunk" />
          ))}
        </div>
      </Card>
    </div>
  );
}

/** Route-level error boundary body — client component with reset. */
const DB_CONNECTION_RE =
  /ECONNREFUSED|SASL|timeout|ETIMEDOUT|terminating connection|Connection terminated/i;

export function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface for diagnostics; the boundary itself stays user-facing. In
    // production only the digest goes to the client console — raw messages
    // can embed internal hostnames.
    if (process.env.NODE_ENV === "production") console.error(error.digest ?? "route-error");
    else console.error(error);
  }, [error]);

  const isDbDown = DB_CONNECTION_RE.test(
    error instanceof Error ? error.message : String(error),
  );

  return (
    <Card className="p-6">
      <div className="flex flex-col items-start gap-3">
        <p className="eyebrow">Something went wrong</p>
        <p className="text-sm text-ink">
          {isDbDown
            ? "The database connection dropped — it may be waking up. Retry in a few seconds."
            : "This section failed to load. Nothing was lost — your record and its audit chain are intact. Try again."}
        </p>
        {error.digest ? (
          <p className="num text-[11px] text-ink-faint">ref {error.digest}</p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="mt-1 cursor-pointer rounded-md border border-pine bg-pine px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pine-deep"
        >
          Try again
        </button>
      </div>
    </Card>
  );
}
