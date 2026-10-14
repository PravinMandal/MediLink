import { Card } from "./ui";

/** Route-level loading skeleton — server-safe (no hooks, no browser APIs). */
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
            <div key={i} className="h-10 animate-pulse rounded-lg bg-paper-sunk" />
          ))}
        </div>
      </Card>
    </div>
  );
}
