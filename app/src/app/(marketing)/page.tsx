import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Eye,
  FileBadge,
  Fingerprint,
  KeyRound,
  ScrollText,
  Siren,
} from "lucide-react";
import { LandingHero } from "@/components/marketing/landing-hero";
import { Reveal } from "@/components/marketing/reveal";
import { LogoMark } from "@/components/logo-mark";

export const metadata: Metadata = {
  title: "MediLink — Your history, sealed in glass",
  description:
    "A longitudinal health record where every fact carries its author, its source, and its place in an audited chain. You decide who sees what.",
};

const PILLARS = [
  {
    icon: FileBadge,
    title: "Sourced, not asserted",
    body: "Every entry links to the original document and the verified professional who attested it — down to the page.",
  },
  {
    icon: KeyRound,
    title: "You hold the key",
    body: "Nothing is readable without your explicit, scoped, expiring consent. Grant narrowly; revoke instantly.",
  },
  {
    icon: ScrollText,
    title: "An audit trail that can't be quietly rewritten",
    body: "Access, edits, and corrections live on a hash-chained log with periodic integrity checkpoints.",
  },
  {
    icon: Eye,
    title: "Honest about gaps",
    body: "Missing data is labelled as missing. Absence never becomes reassurance.",
  },
] as const;

const STEPS = [
  {
    icon: Fingerprint,
    step: "01",
    title: "Your record, your identity",
    body: "A verified facility creates your profile with a non-enumerable Patient ID. You claim it — possession of an ID is never enough to read anything.",
  },
  {
    icon: FileBadge,
    step: "02",
    title: "Professionals contribute",
    body: "Verified doctors and labs add prescriptions, reports, and results. Each one is sealed with a content hash and its author's credential snapshot.",
  },
  {
    icon: KeyRound,
    step: "03",
    title: "You grant precisely",
    body: "A treating clinician asks. You see exactly who, why, and for how long — then tick only the categories you approve. Decline is always one tap.",
  },
  {
    icon: Siren,
    step: "04",
    title: "Emergency, exceptionally",
    body: "If you can't consent, a verified clinician can break glass into the minimal emergency set — time-boxed, audited per read, and reviewed afterwards.",
  },
] as const;

export default function MarketingPage() {
  return (
    <main id="main">
      <LandingHero />

      {/* ---------------- Pillars ---------------- */}
      <section aria-label="Why MediLink" className="relative py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Reveal>
            <p className="eyebrow mb-3">Built on evidence</p>
            <h2 className="max-w-2xl font-display text-[clamp(1.9rem,4vw,2.7rem)] font-bold leading-[1.12] tracking-[-0.02em] text-ink">
              A record is only as strong as what it can prove.
            </h2>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((p, i) => (
              <Reveal key={p.title} delay={i * 80}>
                <article className="glass-hover h-full rounded-2xl border border-line frost rounded-2xl p-5">
                  <p.icon size={22} aria-hidden className="text-pine" />
                  <h3 className="mt-3.5 text-[15px] font-semibold tracking-tight text-ink">{p.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{p.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Journey ---------------- */}
      <section id="how" aria-label="How MediLink works" className="border-y border-line bg-paper-sunk/40 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Reveal>
            <p className="eyebrow mb-3">The journey</p>
            <h2 className="max-w-2xl font-display text-[clamp(1.9rem,4vw,2.7rem)] font-bold leading-[1.12] tracking-[-0.02em] text-ink">
              Four steps, zero blind trust.
            </h2>
          </Reveal>
          <ol className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.step} delay={i * 90}>
                <li className="relative">
                  <span
                    aria-hidden
                    className="num block bg-gradient-to-b from-pine to-pine-deep bg-clip-text font-display text-[44px] font-bold leading-none text-transparent dark:from-[#96C2FF] dark:to-[#3D7BFF]"
                  >
                    {s.step}
                  </span>
                  <h3 className="mt-3 flex items-center gap-2 text-[15.5px] font-semibold tracking-tight text-ink">
                    <s.icon size={17} aria-hidden className="text-pine" />
                    {s.title}
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{s.body}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------- Trust / honesty ---------------- */}
      <section id="trust" aria-label="What MediLink does not do" className="py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-5 sm:px-8">
          <Reveal>
            <div className="rounded-3xl frost-strong border border-line p-7 shadow-xl sm:p-10">
              <LogoMark size={40} aria-hidden />
              <h2 className="mt-5 font-display text-[clamp(1.6rem,3.4vw,2.2rem)] font-bold leading-tight tracking-[-0.02em] text-ink">
                What MediLink does <em>not</em> do.
              </h2>
              <ul className="mt-5 space-y-2.5 text-[13.5px] leading-relaxed text-ink-soft">
                {[
                  "It does not diagnose, prescribe, or triage — AI organises cited facts, never recommendations.",
                  "It is not a national identity system, and a Patient ID is never a password.",
                  "It does not promise a complete history — absence of a record is always labelled as absence.",
                  "It does not let anyone read without your decision — including us.",
                ].map((line) => (
                  <li key={line} className="flex gap-2.5">
                    <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-pine" />
                    {line}
                  </li>
                ))}
              </ul>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/sign-up"
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-b from-pine to-pine-deep px-6 text-sm font-semibold text-on-pine shadow-lg shadow-pine/25 transition-transform duration-200 hover:scale-[1.02]"
                >
                  Start your record
                  <ArrowRight size={15} aria-hidden className="ml-2" />
                </Link>
                <Link
                  href="/sign-in"
                  className="glass-hover inline-flex h-11 items-center justify-center rounded-xl border border-line-strong bg-paper-raised/60 px-6 text-sm font-semibold text-ink"
                >
                  I already have one
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
