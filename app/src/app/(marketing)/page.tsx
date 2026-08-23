import Link from "next/link";
import { EvidenceCard } from "@/components/marketing/evidence-card";
import { RecordJourneySection } from "@/components/marketing/record-journey-section";
import { RecordPreviewSection } from "@/components/marketing/record-preview";
import { SealLine } from "@/components/marketing/seal-line";
import { Reveal } from "@/components/marketing/reveal";

/**
 * Marketing home. Art direction: "clinical paper & the evidence chain".
 * The hero states the thesis and immediately proves it with the product's
 * signature interaction — a cited claim you can open. Graph-paper backdrop
 * references the ECG chart, not decoration. Numbering appears only where the
 * content is genuinely sequential.
 */

const heroStagger = (i: number) => ({
  animation: `rise 600ms cubic-bezier(0.2,0.8,0.2,1) ${i * 110}ms both`,
});

export default function MarketingHome() {
  return (
    <>
      <style>{`
        @keyframes rise { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: none } }
        @media (prefers-reduced-motion: reduce) { [data-hero] { animation: none !important } }
      `}</style>

      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden border-b border-line">
        {/* ECG graph-paper backdrop (theme-aware via color-mix on --pine) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, color-mix(in srgb, var(--color-pine) 9%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--color-pine) 9%, transparent) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            maskImage:
              "radial-gradient(ellipse 90% 80% at 60% 10%, black 30%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 90% 80% at 60% 10%, black 30%, transparent 75%)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-14 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16 lg:pb-24 lg:pt-20">
          <div data-hero style={heroStagger(0)}>
            <p className="eyebrow">Provenance-aware health records · India</p>
            <h1 className="mt-4 font-display text-[clamp(2.15rem,7.5vw,4.2rem)] font-semibold leading-[1.08] tracking-[-0.01em] text-ink sm:leading-[1.04] sm:tracking-[-0.015em]">
              A patient&apos;s history,{"\n"}
              <span className="text-pine">with receipts.</span>
            </h1>
            <p
              data-hero
              style={heroStagger(1)}
              className="mt-5 max-w-lg text-[15.5px] leading-relaxed text-ink-soft"
            >
              MediLink is a lifetime medical record where every fact carries its
              source. Verified doctors and labs contribute authenticated records,
              patients decide who sees what, and AI summaries cite every single
              claim — so a doctor can trust a number in seconds.
            </p>
            <div
              data-hero
              style={heroStagger(2)}
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
            >
              <Link
                href="/sign-in"
                className="inline-flex h-11 w-full items-center justify-center rounded-md border border-pine bg-pine px-5 text-[14.5px] font-medium text-on-pine transition-colors hover:border-pine-deep hover:bg-pine-deep sm:w-auto"
              >
                Open the live demo
              </Link>
              <Link
                href="#how"
                className="inline-flex h-11 w-full items-center justify-center rounded-md border border-line-strong bg-paper-raised px-5 text-[14.5px] font-medium text-ink transition-colors hover:border-ink-faint sm:w-auto"
              >
                How it works
              </Link>
            </div>
            <p
              data-hero
              style={heroStagger(3)}
              className="mt-5 text-[12px] text-ink-faint"
            >
              Demo accounts on the sign-in page — doctor, patient, lab, admin.
            </p>
            {/* Signature motion motif: the hash seal. Content-free (aria-hidden)
                because it is decorative; the thesis is stated in text above. */}
            <div data-hero style={heroStagger(4)}>
              <SealLine />
            </div>
          </div>
          <div data-hero style={heroStagger(2)} className="flex justify-center lg:justify-end">
            <EvidenceCard />
          </div>
        </div>
      </section>

      {/* ---------------- The problem — editorial beats ---------------- */}
      <section aria-label="The problem" className="border-b border-line">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Reveal>
            <div className="grid gap-8 py-16 lg:grid-cols-[220px_1fr] lg:gap-16 lg:py-20">
              <p className="eyebrow lg:pt-2">Why this exists</p>
              <div className="max-w-2xl space-y-8">
                {[
                  [
                    "The report exists.",
                    "Somewhere. On a WhatsApp thread from 2023, filed as IMG_2938.jpg. Another copy is a PDF the family can no longer find. A third says something different.",
                  ],
                  [
                    "The doctor waits.",
                    "In an emergency, the treating physician reconstructs allergies, medications and cardiac history from whoever in the family remembers best. Minutes matter.",
                  ],
                  [
                    "The record fragments.",
                    "Every hospital keeps its slice. The lab keeps another. The patient carries the rest — in folders, phones and memory. Nobody holds the whole story.",
                  ],
                ].map(([head, body], i) => (
                  <Reveal key={i} delay={i * 90}>
                    <div className="border-l-2 border-pine/50 pl-5 sm:pl-7">
                      <h2 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.01em] text-ink">
                        {head}
                      </h2>
                      <p className="mt-2.5 max-w-xl text-[15.5px] leading-relaxed text-ink-soft">
                        {body}
                      </p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- How it works — a true sequence ---------------- */}
      <section id="how" aria-label="How it works" className="scroll-mt-20 border-b border-line bg-paper-sunk/40">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
          <Reveal>
            <p className="eyebrow mb-2">How MediLink works</p>
            <h2 className="max-w-xl font-display text-[clamp(1.8rem,4vw,2.6rem)] font-semibold leading-tight tracking-[-0.01em] text-ink">
              Trust is built in four steps — in this order, every time.
            </h2>
          </Reveal>
          <ol className="mt-10 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {[
              [
                "Verified hands",
                "Only council-registered doctors and licensed hospitals, clinics and labs can contribute — identity checked against their registration before an account writes a single record.",
              ],
              [
                "Authenticated records",
                "Every entry is signed with its author, organization, timestamp and the hash of its source document. Originals are preserved byte-for-byte. Nothing silently overwrites.",
              ],
              [
                "Patient-held consent",
                "A doctor sees only what the patient granted: chosen categories, a stated purpose, a fixed expiry — revocable in one tap, effective immediately. DPDP-aligned by design.",
              ],
              [
                "Cited summaries",
                "The AI layer writes an SBAR summary a doctor can absorb in seconds — and every sentence links to the records it was built from. Uncited claims are dropped.",
              ],
            ].map(([title, body], i) => (
              <li key={i} className="bg-paper-raised">
                <Reveal delay={i * 80} className="h-full">
                  <div className="flex h-full flex-col p-6">
                    <span
                      aria-hidden
                      className="num font-display text-[42px] font-bold leading-none tracking-tight text-pine/25"
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="mt-3 font-display text-[19px] font-semibold text-ink">
                      {title}
                    </h3>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
                      {body}
                    </p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------- Record journey — scroll-driven 3D (D9) --------- */}
      <RecordJourneySection />

      {/* ---------------- Signature: the evidence chain ---------------- */}
      <section aria-label="Provenance" className="border-b border-line">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:py-24">
          <Reveal>
            <div>
              <p className="eyebrow mb-2">The MediLink standard</p>
              <h2 className="font-display text-[clamp(1.8rem,4vw,2.6rem)] font-semibold leading-tight tracking-[-0.01em] text-ink">
                &ldquo;Data exists&rdquo; is not&nbsp;&ldquo;data is&nbsp;trustworthy.&rdquo;
              </h2>
              <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink-soft">
                Eight questions a court — or a surgeon — would ask of every number:
              </p>
              <dl className="mt-6 grid max-w-lg grid-cols-2 gap-x-6 gap-y-2.5">
                {[
                  "Who created it?",
                  "Where was it created?",
                  "When was it created?",
                  "How was it verified?",
                  "What was the original source?",
                  "Has it been modified?",
                  "Who can access it?",
                  "Why are they accessing it?",
                ].map((q) => (
                  <div key={q} className="flex items-baseline gap-2">
                    <span aria-hidden className="num text-[10px] text-pine">✓</span>
                    <dt className="text-[13px] text-ink">{q}</dt>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="card p-6 sm:p-8">
              <p className="eyebrow mb-4">One record, as MediLink keeps it</p>
              <dl className="space-y-3 text-[13px]">
                {[
                  ["Record", "Serum Creatinine — 2.0 mg/dL", "num text-ink"],
                  ["Author", "Priya Kulkarni · Sunrise Diagnostics", "text-ink-soft"],
                  ["Verification", "✓ Verified facility · MMC-registered pathologist", "text-pine"],
                  ["Source", "Renal Function Panel — Jun 2026.pdf", "text-ink-soft"],
                  ["Integrity", "sha-256 9f86…08f4 · original preserved", "num text-ink-soft"],
                  ["Access", "Consented: cardiology team · expires with grant", "text-ink-soft"],
                  ["Audit", "Viewed 14 Jul, 21:04 · hash-chained log", "num text-ink-soft"],
                ].map(([k, v, cls]) => (
                  <div
                    key={k}
                    className="flex flex-wrap items-baseline justify-between gap-x-6 border-b border-dashed border-line pb-2.5"
                  >
                    <dt className="eyebrow">{k}</dt>
                    <dd className={cls}>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- Trust architecture ---------------- */}
      <section id="trust" aria-label="Trust architecture" className="scroll-mt-20 border-b border-line bg-paper-sunk/40">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
          <Reveal>
            <p className="eyebrow mb-2">Under the hood</p>
            <h2 className="max-w-xl font-display text-[clamp(1.8rem,4vw,2.6rem)] font-semibold leading-tight tracking-[-0.01em] text-ink">
              Three mechanisms, no exceptions.
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {[
              [
                "Consent you control",
                "Scoped grants — labs, imaging, prescriptions — with purpose and expiry. Revocation is instant and every access is logged where the patient can see it.",
                "Patient portal · Consents",
              ],
              [
                "Emergency break-glass",
                "For unconscious patients: a verified doctor states a clinical reason, gets 60 minutes of critical information — allergies, blood group, medications — and the patient is notified while the event goes to review.",
                "Doctor portal · Emergency",
              ],
              [
                "Tamper-evident audit",
                "Every sensitive action lands in a hash-chained, append-only log. Alter one row and the chain breaks visibly. Admins review; they cannot quietly read records.",
                "Admin console · Audit",
              ],
            ].map(([title, body, tag], i) => (
              <Reveal key={title} delay={i * 90} className="h-full">
                <div className="card flex h-full flex-col p-6">
                  <h3 className="font-display text-[19px] font-semibold text-ink">
                    {title}
                  </h3>
                  <p className="mt-2 flex-1 text-[13.5px] leading-relaxed text-ink-soft">
                    {body}
                  </p>
                  <p className="num mt-4 text-[10.5px] uppercase tracking-[0.12em] text-ink-faint">
                    {tag}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- See the record (static proof) ---------------- */}
      <RecordPreviewSection />

      {/* ---------------- Quantified proof band ---------------- */}
      <section aria-label="By the numbers" className="border-b border-line">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden bg-line sm:grid-cols-4">
          {[
            ["sha-256", "Every record sealed with a content hash"],
            ["100%", "Clinical writes from identity-verified practitioners"],
            ["60 min", "Maximum emergency access window, always audited"],
            ["0", "Records readable without consent or break-glass"],
          ].map(([num, label]) => (
            <div key={label} className="bg-paper px-5 py-8 text-center sm:py-10">
              <p className="num font-display text-[26px] font-semibold tracking-tight text-pine sm:text-3xl">
                {num}
              </p>
              <p className="mx-auto mt-1.5 max-w-40 text-[12px] leading-snug text-ink-soft">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section aria-label="Get started" className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, color-mix(in srgb, var(--color-pine) 8%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--color-pine) 8%, transparent) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            maskImage: "radial-gradient(ellipse 70% 90% at 50% 100%, black 20%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse 70% 90% at 50% 100%, black 20%, transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-5 py-20 text-center sm:px-8 lg:py-28">
          <Reveal>
            <h2 className="font-display text-[clamp(1.9rem,4.5vw,3rem)] font-semibold leading-tight tracking-[-0.01em] text-ink">
              See a record you can cross-examine.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-ink-soft">
              Sign in as a doctor and open Rahul Sharma&apos;s nine-year history —
              trending labs, flagged conflicts, and a summary where every claim opens
              its evidence.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/sign-in"
                className="inline-flex h-11 items-center justify-center rounded-md border border-pine bg-pine px-6 text-[14.5px]] font-medium text-on-pine transition-colors hover:border-pine-deep hover:bg-pine-deep"
              >
                Open the live demo
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex h-11 items-center justify-center rounded-md border border-line-strong bg-paper-raised px-6 text-[14.5px] font-medium text-ink transition-colors hover:border-ink-faint"
              >
                Create an account
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
