import Link from "next/link";
import { ArrowRight, FileCheck2, Play, ShieldCheck } from "lucide-react";
import "./landing.css";

const SCOPES = ["conditions", "medications", "lab_results", "documents"];

/**
 * Landing hero — "obsidian vault". Dark-first, cinematic, pure CSS:
 * aurora field + blueprint grid + grain, glass consent card with float,
 * live-pattern chips, stat rail. No canvas, no WebGL, mobile-first.
 */
export function LandingHero() {
  return (
    <section
      className="landing-dark grain relative flex min-h-[calc(100svh-4rem)] items-start overflow-hidden"
      aria-label="MediLink introduction"
    >
      <div aria-hidden className="aurora">
        <div className="aurora-blob aurora-a" />
        <div className="aurora-blob aurora-b" />
        <div className="aurora-blob aurora-c" />
      </div>
      <div aria-hidden className="blueprint" />

      {/* Content padding is flow spacing, not viewport compensation: the
          section is already centered in the space BELOW the sticky header
          (min-h minus the h-16 bar), so pt-32/pt-36 double-counted and left
          a ~240px dead gap at wide viewports. */}
      <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-14 px-5 pb-20 pt-12 sm:px-8 lg:grid-cols-[1.02fr_0.98fr] lg:pb-24 lg:pt-16">
        <div className="max-w-2xl text-center lg:text-left">
          <p className="rise rise-1 inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.06] py-1.5 pl-2 pr-4 text-[12px] font-medium text-[#c9d6ee] backdrop-blur-xl">
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-b from-[#4d8dff] to-[#1a56c4] px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-white">
              <ShieldCheck size={11} aria-hidden /> New
            </span>
            Cited AI summaries for every patient
          </p>

          <h1 className="rise rise-2 mt-7 font-display text-[clamp(2.9rem,8vw,5.4rem)] font-bold leading-[0.98] tracking-[-0.04em] text-[#f2f6fd]">
            Your history,
            <br />
            <span className="display-gradient">sealed in glass.</span>
          </h1>

          <p className="rise rise-3 mx-auto mt-6 max-w-xl text-[16.5px] leading-relaxed text-[#b9c4d6] lg:mx-0">
            Every entry carries its author, its source document, and its place
            in an audited chain. You decide who sees what — and you can prove
            exactly who saw it, and when.
          </p>

          <div className="rise rise-4 mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Link
              href="/sign-up"
              className="btn-shine group inline-flex w-full items-center justify-center rounded-full bg-gradient-to-b from-[#4d8dff] to-[#1a56c4] px-8 py-4 text-[15px] font-bold text-white shadow-[0_16px_48px_-10px_rgba(46,111,232,0.8)] transition-all duration-200 hover:scale-[1.03] hover:shadow-[0_20px_60px_-10px_rgba(46,111,232,0.95)] active:scale-[0.98] sm:w-auto"
            >
              Create your record
              <ArrowRight size={16} aria-hidden className="ml-2 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="#how"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/[0.06] px-8 py-4 text-[15px] font-semibold text-white backdrop-blur-xl transition-all duration-200 hover:border-white/40 hover:bg-white/[0.1] sm:w-auto"
            >
              <Play size={15} aria-hidden className="text-[#8fb4ff]" />
              See how it works
            </Link>
          </div>

          <div className="rise rise-5 mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <div className="flex -space-x-2" aria-hidden>
              {["M", "A", "R", "S"].map((c, i) => (
                <span
                  key={i}
                  className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#060a14] bg-gradient-to-br from-[#4d8dff] to-[#12429e] text-[10px] font-bold text-white"
                >
                  {c}
                </span>
              ))}
            </div>
            <p className="text-[12.5px] text-[#7d8aa0]">
              Free for patients · No credit card · Synthetic demo data
            </p>
          </div>
        </div>

        {/* Product proof — visible on ALL viewports, stacked below on mobile */}
        <div className="rise rise-3 relative mx-auto w-full max-w-[400px]">
          <div className="floaty glass-dark relative rounded-3xl p-6 sm:p-7">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#7d8aa0]">
              Consent request · live pattern
            </p>
            <div className="mt-3 flex items-center gap-3">
              <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4d8dff] to-[#12429e] text-[14px] font-bold text-white">M</span>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-white">Dr. Meera Nair · Cardiology</p>
                <p className="text-[12px] text-[#8d99ae]">Sunrise Clinic · consultation · 7 days</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {SCOPES.map((s) => (
                <span key={s} className="num rounded-full border border-[#6fa8ff]/35 bg-[#6fa8ff]/12 px-2.5 py-1 font-mono text-[11px] font-medium text-[#a8c8ff]">{s}</span>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Link href="/sign-up" className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-gradient-to-b from-[#4d8dff] to-[#1a56c4] text-sm font-semibold text-white shadow-lg">Grant selected</Link>
              <Link href="/sign-up" className="inline-flex h-11 items-center justify-center rounded-xl border border-white/20 px-5 text-sm font-semibold text-[#c9d6ee]">Decline</Link>
            </div>
            <div className="absolute -bottom-5 -left-4 flex items-center gap-2 rounded-2xl border border-white/15 bg-[#0d1424]/95 px-4 py-3 shadow-2xl backdrop-blur-xl sm:-left-8">
              <FileCheck2 size={16} aria-hidden className="shrink-0 text-[#6fa8ff]" />
              <p className="num whitespace-nowrap text-[11.5px] font-semibold text-white">sha-256 sealed · attested 12 Aug</p>
            </div>
            <div className="absolute -right-2 -top-5 flex items-center gap-2 rounded-full border border-white/15 bg-[#0d1424]/95 px-4 py-2 shadow-2xl backdrop-blur-xl sm:-right-4">
              <span aria-hidden className="live-dot relative h-1.5 w-1.5 rounded-full bg-emerald-400 text-emerald-400" />
              <p className="num whitespace-nowrap text-[11px] font-semibold text-white">0 reads without consent</p>
            </div>
          </div>
        </div>

        {/* Proof strip */}
        <div className="rise rise-5 lg:col-span-2">
          <dl className="glass-dark mx-auto grid max-w-2xl grid-cols-3 gap-px overflow-hidden rounded-2xl lg:mx-0">
            {[
              ["sha-256", "every entry sealed"],
              ["100%", "cited AI claims"],
              ["0", "reads without consent"],
            ].map(([num, label]) => (
              <div key={label} className="flex flex-col px-3 py-4 text-center sm:py-5 lg:pl-6 lg:text-left">
                <dt className="num order-2 mt-0.5 text-[9.5px] uppercase tracking-wider text-[#7d8aa0] sm:text-[10.5px]">{label}</dt>
                <dd className="num order-1 text-xl font-bold tracking-tight text-white sm:text-2xl">{num}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div aria-hidden className="absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-2 sm:flex">
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#7d8aa0]">Scroll</span>
        <span className="h-9 w-px animate-pulse bg-gradient-to-b from-[#6fa8ff] to-transparent" />
      </div>
    </section>
  );
}
