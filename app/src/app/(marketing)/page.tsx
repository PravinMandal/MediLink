import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Eye,
  FileBadge,
  FileCheck2,
  Fingerprint,
  FlaskConical,
  KeyRound,
  Lock,
  Quote,
  ScrollText,
  ShieldCheck,
  Siren,
  Stethoscope,
} from "lucide-react";
import { LandingHero } from "@/components/marketing/landing-hero";
import { ChainSection } from "@/components/marketing/chain-section";
import { FaqAccordion } from "@/components/marketing/faq";
import { Reveal } from "@/components/marketing/reveal";
import { LogoMark } from "@/components/logo-mark";
import "@/components/marketing/landing.css";

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

const ROLES = [
  {
    icon: Stethoscope,
    name: "Doctors",
    points: ["Consent-scoped patient view", "Cited AI summaries", "One-tap access requests"],
  },
  {
    icon: FlaskConical,
    name: "Labs",
    points: ["Original-document uploads", "Sealed content hashes", "Attestation review queue"],
  },
  {
    icon: ShieldCheck,
    name: "Admins",
    points: ["Verification pipelines", "Emergency break-glass review", "Tamper-evident audit stream"],
  },
] as const;

const FAQS: Array<[string, string]> = [
  [
    "Is MediLink a national health ID?",
    "No. Your MediLink Patient ID is an application identifier for this pilot — it is never marketed as a national identity, and an optional ABHA number can be stored alongside it.",
  ],
  [
    "Does MediLink diagnose or prescribe?",
    "Never. AI organises cited facts — key events, history, recent changes, open data issues. It offers no assessment, plan, or triage.",
  ],
  [
    "What happens if my data is incomplete?",
    "The interface says so, plainly: “no record found in MediLink as of this date.” Absence is labelled as absence — never as a clinical negative.",
  ],
  [
    "Can anyone read my record without asking?",
    "No — including us. Every professional read needs your active, unexpired consent grant, or a time-boxed emergency access that is notified and reviewed.",
  ],
  [
    "How much does it cost?",
    "Free for patients in this pilot. The stack runs on free tiers (Vercel Hobby + Supabase Free) — no credit card, no trial clock.",
  ],
];

const MARQUEE = [
  "DPDP-aligned consent",
  "FHIR-inspired records",
  "sha-256 sealed files",
  "ABDM-ready payloads",
  "Hash-chained audit log",
  "Expiring scoped grants",
];

export default function MarketingPage() {
  return (
    <main id="main">
      <LandingHero />

      {/* ---------------- Trust marquee ---------------- */}
      <section aria-label="Trusted for" className="landing-dark overflow-hidden border-y border-white/10 py-6">
        <div className="marquee-mask">
          <div className="marquee-track gap-12 pr-12">
            {[...MARQUEE, ...MARQUEE].map((t, i) => (
              <span
                key={`${t}-${i}`}
                aria-hidden={i >= MARQUEE.length}
                className="num inline-flex shrink-0 items-center gap-2 text-[11.5px] font-medium uppercase tracking-[0.14em] text-[#8d99ae]"
              >
                <BadgeCheck size={14} aria-hidden className="text-[#6fa8ff]" />
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Pillars (bento) ---------------- */}
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
              <Reveal key={p.title} delay={i * 80} className="h-full">
                <article className="bento h-full rounded-2xl border border-line bg-paper-raised p-5">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-pine-tint">
                    <p.icon size={20} aria-hidden className="text-pine" />
                  </span>
                  <h3 className="mt-3.5 text-[15px] font-semibold tracking-tight text-ink">{p.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{p.body}</p>
                </article>
              </Reveal>
            ))}
          </div>

          {/* Live consent mock — single instance of the pattern */}
          <Reveal delay={120}>
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
              <div className="bento rounded-2xl border border-line bg-paper-raised p-6 lg:col-span-3">
                <p className="eyebrow mb-1">Live pattern · consent request</p>
                <h3 className="font-display text-xl font-bold tracking-tight text-ink">
                  Dr. Meera asks. You decide — precisely.
                </h3>
                <div className="mt-4 rounded-xl border border-line bg-paper-sunk/60 p-4">
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pine to-pine-deep text-[13px] font-bold text-on-pine">M</span>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-ink">Dr. Meera Nair · Cardiology</p>
                      <p className="text-[12px] text-ink-faint">Sunrise Clinic · purpose: consultation · 7 days</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {["conditions", "medications", "lab_results", "documents"].map((s) => (
                      <span key={s} className="num rounded-full border border-pine/30 bg-pine-tint px-2.5 py-1 text-[11px] font-medium text-pine-ink">{s}</span>
                    ))}
                    <span className="num rounded-full border border-line px-2.5 py-1 text-[11px] text-ink-faint">+ sensitive — not requested</span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <span className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-gradient-to-b from-pine to-pine-deep text-sm font-semibold text-on-pine">Grant selected</span>
                    <span className="inline-flex h-10 items-center justify-center rounded-xl border border-line-strong px-5 text-sm font-semibold text-ink-soft">Decline</span>
                  </div>
                </div>
              </div>
              <div className="bento flex flex-col justify-center rounded-2xl border border-pine/25 bg-pine-tint p-6 lg:col-span-2">
                <Bell size={20} aria-hidden className="text-pine" />
                <p className="mt-3 text-[14.5px] font-semibold leading-snug text-ink">
                  The request arrives as a one-tap card in your inbox.
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
                  Who, why, which categories, for how long — all visible before you decide.
                  Expiry is automatic; revocation is instant.
                </p>
                <Link href="/sign-up" className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-pine hover:underline">
                  Try it with a demo account <ArrowRight size={14} aria-hidden />
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- Chain: a record, followed ---------------- */}
      <ChainSection />

      {/* ---------------- Journey steps ---------------- */}
      <section id="how" aria-label="How MediLink works" className="scroll-mt-20 border-y border-line bg-paper-sunk/40 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Reveal>
            <p className="eyebrow mb-3">The journey</p>
            <h2 className="max-w-2xl font-display text-[clamp(1.9rem,4vw,2.7rem)] font-bold leading-[1.12] tracking-[-0.02em] text-ink">
              Four steps, zero blind trust.
            </h2>
          </Reveal>
          <ol className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.step} delay={i * 90} as="li" className="relative">
                  <span
                    aria-hidden
                    className="num block bg-gradient-to-b from-pine to-pine-deep bg-clip-text font-display text-[44px] font-bold leading-none text-transparent dark:from-[#96C2FF] dark:to-[#3D7BFF]"
                  >
                    {s.step}
                  </span>
                  <h3 className="mt-3 flex items-center gap-2 text-[15.5px] font-semibold tracking-tight text-ink">
                    <s.icon size={17} aria-hidden className="shrink-0 text-pine" />
                    {s.title}
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{s.body}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------- Roles ---------------- */}
      <section aria-label="Built for every role" className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Reveal>
            <p className="eyebrow mb-3">One vault, every role</p>
            <h2 className="max-w-2xl font-display text-[clamp(1.9rem,4vw,2.7rem)] font-bold leading-[1.12] tracking-[-0.02em] text-ink">
              Each role sees exactly what it should.
            </h2>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {ROLES.map((r, i) => (
              <Reveal key={r.name} delay={i * 90} className="h-full">
                <article className="bento h-full rounded-2xl border border-line bg-paper-raised p-6">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-pine-tint">
                    <r.icon size={20} aria-hidden className="text-pine" />
                  </span>
                  <h3 className="mt-3 font-display text-lg font-bold tracking-tight text-ink">{r.name}</h3>
                  <ul className="mt-3 space-y-2">
                    {r.points.map((pt) => (
                      <li key={pt} className="flex gap-2 text-[13px] text-ink-soft">
                        <FileCheck2 size={14} aria-hidden className="mt-0.5 shrink-0 text-pine" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Honesty + security ---------------- */}
      <section id="trust" aria-label="What MediLink does not do" className="scroll-mt-20 pb-20 sm:pb-28">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-5 sm:px-8 lg:grid-cols-2">
          <Reveal className="h-full">
            <div className="h-full rounded-3xl frost-strong border border-line p-7 shadow-xl sm:p-10">
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
                  className="btn-shine inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-b from-pine to-pine-deep px-6 text-sm font-semibold text-on-pine shadow-lg shadow-pine/25 transition-transform duration-200 hover:scale-[1.02]"
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
          <Reveal delay={100} className="h-full">
            <div className="flex h-full flex-col justify-center rounded-3xl border border-line bg-paper-raised p-7 sm:p-10">
              <p className="eyebrow mb-3 flex items-center gap-2">
                <Lock size={13} aria-hidden /> Security, plainly
              </p>
              <ul className="space-y-4 text-[13.5px] leading-relaxed text-ink-soft">
                <li className="flex gap-3">
                  <ScrollText size={17} aria-hidden className="mt-0.5 shrink-0 text-pine" />
                  Append-only audit log — every read, grant, revocation and break-glass is hash-chained and checkpointed.
                </li>
                <li className="flex gap-3">
                  <KeyRound size={17} aria-hidden className="mt-0.5 shrink-0 text-pine" />
                  Scoped, expiring consents with purpose, policy snapshot and one-tap revocation.
                </li>
                <li className="flex gap-3">
                  <Siren size={17} aria-hidden className="mt-0.5 shrink-0 text-pine" />
                  Emergency access is minimal, time-boxed, notified and reviewed — never a backdoor.
                </li>
              </ul>
              <div className="mt-6 rounded-2xl border border-dashed border-line-strong bg-paper-sunk/60 p-4 text-[12.5px] text-ink-faint">
                <Quote size={14} aria-hidden className="mb-1 text-pine" />
                Synthetic demo data only. A real-patient pilot needs counsel, clinical-safety and security sign-off first.
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- FAQ ---------------- */}
      <section aria-label="Questions" className="border-t border-line bg-paper-sunk/40 py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-5 sm:px-8">
          <Reveal>
            <p className="eyebrow mb-3 text-center">Questions</p>
            <h2 className="text-center font-display text-[clamp(1.7rem,3.4vw,2.3rem)] font-bold tracking-[-0.02em] text-ink">
              Asked often, answered honestly.
            </h2>
          </Reveal>
          <FaqAccordion items={FAQS} />
          <Reveal delay={120}>
            <div className="landing-dark grain relative mt-10 overflow-hidden rounded-3xl p-8 text-center shadow-2xl sm:p-10">
              <div aria-hidden className="aurora">
                <div className="aurora-blob aurora-a" />
                <div className="aurora-blob aurora-b" />
              </div>
              <h2 className="relative font-display text-[clamp(1.6rem,3.4vw,2.2rem)] font-bold tracking-tight text-white">
                Your history deserves proof.
              </h2>
              <p className="relative mx-auto mt-2 max-w-md text-[14px] text-white/75">
                Create your record in a minute. Grant access in seconds. Revoke it in one tap.
              </p>
              <div className="relative mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href="/sign-up"
                  className="btn-shine inline-flex h-12 items-center justify-center rounded-2xl bg-white px-7 text-[15px] font-bold text-[#12429E] transition-transform hover:scale-[1.02]"
                >
                  Get started — it&apos;s free
                </Link>
                <Link
                  href="/sign-in"
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/40 px-7 text-[15px] font-semibold text-white transition-colors hover:bg-white/10"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
