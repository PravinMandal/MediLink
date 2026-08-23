import Link from "next/link";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:border focus:border-pine focus:bg-paper-raised focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-pine"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="MediLink home">
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-md bg-pine font-display text-[15px] font-bold text-white"
            >
              M
            </span>
            <span className="font-display text-[18px] font-semibold tracking-tight text-ink">
              MediLink
            </span>
          </Link>
          <nav aria-label="Site" className="flex items-center gap-0.5 sm:gap-2">
            {/* In-page sections are hidden on desktop behind the story flow;
                on mobile there is no other navigation, so they stay visible. */}
            <Link
              href="/#how"
              className="rounded-md px-2 py-2 text-[12.5px] font-medium text-ink-soft transition-colors hover:text-ink sm:hidden"
            >
              How
            </Link>
            <Link
              href="/#trust"
              className="rounded-md px-2 py-2 text-[12.5px] font-medium text-ink-soft transition-colors hover:text-ink sm:hidden"
            >
              Trust
            </Link>
            <Link
              href="/sign-in"
              className="rounded-md px-2.5 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:text-ink sm:px-3 sm:text-[13.5px]"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-md border border-pine bg-pine px-2.5 py-2 text-[13px] font-medium text-white transition-colors hover:border-pine-deep hover:bg-pine-deep sm:px-3.5 sm:text-[13.5px]"
            >
              Create account
            </Link>
          </nav>
        </div>
      </header>

      <main id="main">{children}</main>

      <footer className="border-t border-line bg-paper-sunk">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-10 sm:grid-cols-3 sm:px-8">
          <div>
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="flex h-6 w-6 items-center justify-center rounded bg-pine font-display text-[11px] font-bold text-white"
              >
                M
              </span>
              <span className="font-display text-[15px] font-semibold text-ink">
                MediLink
              </span>
            </div>
            <p className="mt-3 max-w-xs text-[12.5px] leading-relaxed text-ink-soft">
              A provenance-aware longitudinal health record for India. Verified
              professionals contribute; patients consent; every claim cites its source.
            </p>
          </div>
          <div className="text-[12.5px] leading-relaxed text-ink-soft">
            <p className="eyebrow mb-2">Direction</p>
            <p>
              ABDM-aligned architecture — ABHA numbers are supported on patient
              records today; HPR/HFR registry integration is planned. Designed
              against the consent, notice and security obligations of the DPDP
              Act, 2023.
            </p>
          </div>
          <div className="text-[12.5px] leading-relaxed text-ink-soft">
            <p className="eyebrow mb-2">This deployment</p>
            <p>
              Demonstration environment with synthetic patients only. No real medical
              data. AI outputs are summaries of records — never diagnoses.
            </p>
          </div>
        </div>
        <div className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-3 text-[11px] text-ink-faint sm:px-8">
            <span>© 2026 MediLink · Working title</span>
            <span className="num">Synthetic data · Demo build</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
