import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md text-center">
        <p className="eyebrow">404</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink">
          This page isn&apos;t on the record.
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-[14.5px] leading-relaxed text-ink-soft">
          The address may be mistyped, or the record it pointed to was never
          yours to open — access is consent-scoped by design.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-pine bg-pine px-5 text-[14.5px] font-medium text-on-pine transition-colors hover:border-pine-deep hover:bg-pine-deep"
          >
            Back to the home page
          </Link>
          <Link
            href="/portal"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-line-strong bg-paper-raised px-5 text-[14.5px] font-medium text-ink transition-colors hover:border-ink-faint"
          >
            Go to my portal
          </Link>
        </div>
      </div>
    </main>
  );
}
