# ADR-0009: Device-scope position and quality-system alignment

- **Status:** Proposed (October 2026, from deep-research synthesis)
- **Date:** 2026-10-14
- **Deciders:** Product owner — unassigned; Clinical-safety owner — unassigned; Engineering

## Context

External research (deep-research run `wf_7b919109-8fe`, 100 agents, 25
claims adversarially voted) confirmed two high-confidence findings relevant
to MediLink's regulatory posture:

1. FDA's Quality Management System Regulation (QMSR) took effect
   2026-02-02, replacing the Quality System Regulation and aligning with
   ISO 13485 by reference (vote 3-0 against FDA QMSR pages + Federal
   Register 2024-01709).
2. Baking WCAG/HIPAA/GDPR compliance in from day one avoids expensive
   retrofit (conventional best practice, corroborated by IBM/Deque
   defect-cost sources; direct quote commercial, votes 3-0 + 2-1).

MediLink already states "does not diagnose, prescribe, or triage — AI
organises cited facts, never recommendations" (marketing page, trust
section). That statement is a scope claim with regulatory weight and has
never been recorded as an ADR.

## Decision

1. **MediLink is not a medical device as currently scoped.** It stores,
   displays, and cites patient records under explicit consent; it performs
   no diagnosis, triage, dosing, or treatment recommendation. The
   no-diagnosis statement on the marketing page is normative, not copy.
2. **The guardrails that keep (1) true are load-bearing, not cosmetic:**
   AI summaries carry numbered citations and drop sourceless claims
   (`summarize.ts` claim-gating); the record page labels absence as absence;
   emergency access is minimal/time-boxed/reviewed. Any future feature that
   adds assessment, plan, risk scoring, or triage language reopens this ADR
   and requires a device-scope review first.
3. **Quality-system alignment is proactive, not retrofitted:** hash-chained
   audit trail with external checkpoints, immutable versioned records with
   attestations, consent artefacts with policy versions, and the
   requirements compliance matrix (`docs/audit/compliance-matrix.md`) are
   maintained as QMS-compatible evidence from day one.

## Consequences

- Product proposals containing diagnostic, triage, dosing, or risk-score
  language must cite this ADR and obtain clinical-safety sign-off before
  implementation.
- The compliance matrix gains a device-scope row pointing here.
- No FDA submission is pursued under the current scope; if scope changes,
  QMSR/ISO 13485 alignment starts from the existing audit/version/consent
  evidence rather than from zero.

## Sources

- FDA QMSR final rule (effective 2026-02-02): Federal Register 2024-01709.
- Deep-research synthesis: `find things to improve, and do it`
  (run `wf_7b919109-8fe`, 2026-10-14).
