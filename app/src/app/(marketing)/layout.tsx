import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoMark } from "@/components/logo-mark";
import "@/components/marketing/landing.css";
import { SmoothScroll } from "@/components/marketing/smooth-scroll";

const FOOT_COLS: Array<{ title: string; links: Array<[string, string]> }> = [
  {
    title: "Product",
    links: [
      ["How it works", "/#how"],
      ["Trust & honesty", "/#trust"],
      ["Create account", "/sign-up"],
      ["Sign in", "/sign-in"],
    ],
  },
  {
    title: "Roles",
    links: [
      ["Patients", "/sign-up"],
      ["Doctors", "/sign-up"],
      ["Labs & facilities", "/sign-up"],
      ["Platform admins", "/sign-in"],
    ],
  },
  {
    title: "Safety",
    links: [
      ["Consent & access", "/#how"],
      ["Emergency access", "/#trust"],
      ["Audit trail", "/#trust"],
      ["Questions", "/#trust"],
    ],
  },
];

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-paper">
      <SmoothScroll />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:border focus:border-[#6fa8ff] focus:bg-[#0d1424] focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#060a14]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="MediLink home">
            <LogoMark size={30} aria-hidden />
            <span className="font-display text-[19px] font-bold tracking-tight text-white">
              MediLink
            </span>
          </Link>
          <nav aria-label="Site" className="flex items-center gap-0.5 sm:gap-2">
            <span className="[&_button]:!border-white/15 [&_button]:!bg-white/[0.06] [&_button]:!text-[#c9d6ee]">
              <ThemeToggle />
            </span>
            <Link
              href="/#how"
              className="hidden rounded-lg px-3 py-2 text-[13.5px] font-medium text-[#b9c4d6] transition-colors hover:text-white md:block"
            >
              How it works
            </Link>
            <Link
              href="/#trust"
              className="hidden rounded-lg px-3 py-2 text-[13.5px] font-medium text-[#b9c4d6] transition-colors hover:text-white md:block"
            >
              Trust
            </Link>
            <Link
              href="/sign-in"
              className="rounded-lg px-2.5 py-2 text-[13px] font-medium text-[#b9c4d6] transition-colors hover:text-white sm:px-3 sm:text-[13.5px]"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="btn-shine rounded-xl bg-gradient-to-b from-[#4d8dff] to-[#1a56c4] px-3 py-2 text-[13px] font-semibold text-white shadow-md shadow-[#2e6fe8]/40 transition-all duration-200 hover:shadow-lg hover:brightness-110 active:scale-[0.98] sm:px-4 sm:text-[13.5px]"
            >
              Create account
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="landing-dark grain relative overflow-hidden border-t border-white/10">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-5 py-12 sm:px-8 md:grid-cols-5">
          <div className="col-span-2">
            <div className="flex items-center gap-2.5">
              <LogoMark size={28} aria-hidden />
              <span className="font-display text-[17px] font-bold tracking-tight text-white">
                MediLink
              </span>
            </div>
            <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-[#8d99ae]">
              Consented, sourced, auditable health records. Every fact carries
              its author — every read carries your decision.
            </p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-[11.5px] font-medium text-[#8d99ae]">
              <span aria-hidden className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Pilot demo · synthetic data only
            </p>
          </div>
          {FOOT_COLS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#7d8aa0]">{col.title}</p>
              <ul className="space-y-2">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-[13px] text-[#b9c4d6] transition-colors hover:text-white"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-5 py-5 text-[11.5px] text-[#7d8aa0] sm:flex-row sm:items-center sm:px-8">
            <p>MediLink — a consent-governed record exchange. Not medical advice.</p>
            <p className="num">Sealed with sha-256 · DPDP-aligned</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
