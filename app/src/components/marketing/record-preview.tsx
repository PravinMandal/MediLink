import { Reveal } from "@/components/marketing/reveal";

/**
 * "See the record" — a static, synthetic record-page preview closing the
 * marketing story before the CTA. Mirrors the real doctor glance band
 * (blood-group tile, red-line allergies, provenance micro-lines) so the
 * visitor sees the product's promise without logging in. All data synthetic.
 */
export function RecordPreviewSection() {
  return (
    <section aria-label="What a doctor sees" className="border-b border-line bg-paper-sunk/40">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
        <Reveal>
          <p className="eyebrow mb-2">The payoff</p>
          <h2 className="max-w-xl font-display text-[clamp(1.8rem,4vw,2.6rem)] font-semibold leading-tight tracking-[-0.01em] text-ink">
            Ten seconds after opening a patient, a doctor knows this much.
          </h2>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-soft">
            Not a mock — this is the real record page layout, with synthetic data.
            Every number carries its provenance; every claim opens its source.
          </p>
        </Reveal>

        <Reveal delay={90}>
          <div className="card mt-10 overflow-hidden border-line-strong p-4 sm:p-5 lg:col-span-2">
            {/* header row */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <div>
                <p className="eyebrow">Emergency view · audited</p>
                <p className="font-display text-[22px] font-semibold tracking-tight text-ink">
                  Rahul S., 51M
                </p>
                <p className="num text-[11px] text-ink-faint">
                  9-year history · 3 facilities · accessed via consent
                </p>
              </div>
              <span className="seal">✓ Consent active · 7 scopes</span>
            </div>

            {/* glance band */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="relative flex flex-col justify-between overflow-hidden rounded-lg bg-pine p-4 text-on-pine">
                <p className="eyebrow eyebrow-on-fill text-on-pine-soft">Blood group</p>
                <p className="num font-display text-4xl font-bold leading-none tracking-tight">B+</p>
                <p className="mt-1 text-[11px] leading-tight text-on-pine-soft">lab-verified · ⚠ conflicts with self-report</p>
              </div>
              <div className="rounded-lg border-l-2 border-l-alert bg-paper-raised p-4">
                <p className="eyebrow mb-2 text-alert">Red-line allergies</p>
                <p className="text-sm font-semibold text-alert">Penicillin</p>
                <p className="text-xs text-ink-soft">high · anaphylaxis</p>
                <p className="mt-2 text-[10.5px] text-ink-faint">✓ recorded Mar 2024</p>
              </div>
              <div className="rounded-lg bg-paper-raised p-4">
                <p className="eyebrow mb-2">Active problems</p>
                <ul className="space-y-1 text-[13px] text-ink">
                  <li>Type 2 diabetes <span className="text-ink-faint">· 2017</span></li>
                  <li>Hypertension <span className="text-ink-faint">· 2019</span></li>
                  <li>CKD stage 3a <span className="text-ink-faint">· 2021</span></li>
                </ul>
              </div>
              <div className="rounded-lg bg-paper-raised p-4">
                <p className="eyebrow mb-2">Record activity</p>
                <p className="text-[13px] text-ink">Last encounter <span className="num font-medium">Jan 2025</span></p>
                <p className="mt-1 text-[11.5px] text-ink-faint">26 encounters · history since 2016</p>
                <p className="num mt-2 text-[11px] text-ink-soft">3 problems · 4 meds · 1 allergy</p>
              </div>
            </div>

            {/* claim sample */}
            <div className="mt-4 rounded-lg border border-line bg-paper-raised px-4 py-3">
              <p className="eyebrow">Summary claim · Assessment</p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-ink">
                Creatinine has risen steadily since 2021 and now sits above range —
                consistent with CKD stage 3a.
                <span className="ml-1.5 inline-flex gap-1 align-baseline">
                  <span className="num inline-flex h-4 min-h-6 min-w-6 items-center justify-center rounded-[3px] border border-pine/40 bg-pine-tint px-1.5 text-[10px] font-semibold leading-none text-pine-ink">1</span>
                  <span className="num inline-flex h-4 min-h-6 min-w-6 items-center justify-center rounded-[3px] border border-ink-faint/50 bg-paper px-1.5 text-[10px] font-semibold leading-none text-ink-soft">2</span>
                </span>
                <span className="ml-1 text-[11px] text-ink-faint">— tap a number to open its source record</span>
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
