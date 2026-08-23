# MediLink — Research Findings (Aug 2026)

Facts that shaped the build plan. Sources cited where captured.

## India regulatory

- **DPDP Rules 2025: notified 13 Nov 2025** (MeitY). Phased ~18-month rollout: Data Protection Board live; Consent Managers expected Nov 2026; core obligations enforce from ~13 May 2027. Breach reporting norms defined; verifiable parental consent for children. → Build consent-first now; legal review before real patients. (dpdpa.in, MeitY)
- **ABDM**: ~79 crore ABHA created (PIB, Oct 2025). Sandbox live (sandbox.abdm.gov.in), new **V3 APIs**; milestones M1 (ABHA creation), M2 (HIP), M3 (HIU); official NHA wrapper: github.com/NHA-ABDM/ABDM-wrapper; Postman collections + community docs exist. → Mock adapters first; sandbox spike in M7.
- HPR/HFR registries exist for professional/facility verification; third-party API access requires onboarding → adapter pattern.

## Infrastructure (verified)

- **Vercel**: `bom1` (ap-south-1 Mumbai) is a function region. Hobby = single region (selectable), Pro = 5. Default is `iad1`. (vercel.com/docs/regions)
- **Neon**: NO Mumbai region (closest Singapore) → rejected. **Supabase**: ap-south-1 Mumbai available with pgvector.
- **Next.js**: current stable 16.x (npm latest). Prisma 7.1 current; Drizzle ~0.45 current.

## Competitive landscape (summary)

- **Eka Care**: strongest dual-sided (doctor EMR + patient records, ABDM, $15M Series A). Weakness: no AI summaries/lab trends per comparisons; provenance implicit.
- **HealthSetu** (govt PHR): free, lab ingestion (3300+ labs claimed); weak doctor-side utility.
- **Driefcase**: ABDM-first records, WhatsApp-native ABHA creation; doctor-side thin.
- **HealthLocker**: domain dead — cautionary (patient-only PHR died).
- **Medibuddy/Practo**: records are side features, not longitudinal clinical records.
- **Doctor-side reality**: HealthPlix ("largest" EMR) ~14k doctors of ~1.3M registered — market wide open. Labs deliver PDFs over WhatsApp by default → ingestion wedge.
- **Global prior art**: PicnicHealth (collection-as-a-service), Abridge/Dragon Copilot/Ambience (ambient scribing, citation discipline), OpenEvidence (numbered per-claim citations — the UX bar), 1up/Redox/Particle (interop rails), Guava (timeline-first PHR).

## Differentiation thesis

1. Doctor-first PHR (demand-pull, not patient-push).
2. Authenticated provenance as the product (medico-legal feature).
3. Cited AI summaries — first in India.
4. Ride ABDM rails, sell the intelligence layer.
5. Emergency break-glass wedge.

## UX patterns to adopt

- SBAR-structured Patient-at-a-Glance (AHRQ TeamSTEPPS).
- LifeLines-style faceted timeline (UMD HCIL).
- OpenEvidence numbered citations → click → source.
- Sparklines for lab trends (HbA1c/creatinine).
- Consent cards: purpose + scope + expiry + one-tap revoke + audit trail.
- Break-glass: red banner, reason required, always audited, patient notified.
- Cold-start mitigation: "collection mode" (patient forwards PDFs; system structures them).

## Cautionary notes

- PHR graveyard (Google Health 2008–12, HealthVault → 2019): no daily utility. Mitigate via doctor demand-pull + passive patient value.
- Doctor time poverty: zero-input UX, 30-second payoff.
- Trust: AI labels + citations + consent artifacts.
- Platform dependency: multi-channel ingestion; stay additive to ABDM.
