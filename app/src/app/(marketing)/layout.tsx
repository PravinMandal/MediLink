import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoMark } from "@/components/logo-mark";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:border focus:border-pine focus:bg-paper-raised focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-pine"
      >
        Skip to main content
      </a>
      <header className="glass-shell sticky top-0 z-30 border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="MediLink home">
            <LogoMark size={30} aria-hidden />
            <span className="font-display text-[19px] font-bold tracking-tight text-ink">
              MediLink
            </span>
          </Link>
          <nav aria-label="Site" className="flex items-center gap-0.5 sm:gap-2">
            <ThemeToggle />
            <Link
              href="/#how"
              className="rounded-lg px-2 py-2 text-[12.5px] font-medium text-ink-soft transition-colors hover:text-ink sm:hidden"
            >
              How
            </Link>
            <Link
              href="/sign-in"
              className="glass-hover rounded-lg px-2.5 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:text-ink sm:px-3 sm:text-[13.5px]"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-xl bg-gradient-to-b from-pine to-pine-deep px-3 py-2 text-[13px] font-semibold text-on-pine shadow-md shadow-pine/25 transition-all duration-200 hover:shadow-lg hover:shadow-pine/35 hover:brightness-110 active:scale-[0.98] sm:px-4 sm:text-[13.5px]"
            >
              Create account
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-5 py-8 sm:flex-row sm:items-center sm:px-8">
          <div className="flex items-center gap-2.5">
            <LogoMark size={22} aria-hidden />
            <p className="text-[12.5px] text-ink-faint">
              MediLink — consented, sourced, auditable health records.
            </p>
          </div>
          <p className="text-[11.5px] text-ink-faint">
            Demo environment · synthetic data only · not medical advice
          </p>
        </div>
      </footer>
    </div>
  );
}
