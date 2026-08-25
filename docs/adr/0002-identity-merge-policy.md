# ADR-0002: Identity merge policy — reversible, audited merge/split

- **Status:** Proposed (August 2026, per root `BuildPlan.md`)
- **Date:** 2026-08-24
- **Deciders:** Product owner — unassigned; Clinical-safety lead — unassigned; Engineering

## Context

Duplicate and mistaken identity merges are patient-safety incidents (BuildPlan
§2, P0). The current codebase has no identity-confidence state, duplicate
candidate queue, or merge/split case model. The August 2026 plan requires
identity lifecycle states (BuildPlan §8.1): provisional profile, claim pending,
claim verified, identity caution, merged, split/restored.

## Decision

1. **Merge is a case, not an action.** Merging two patient profiles goes
   through a `patient_merge_cases` workflow with a human decision-maker, a
   recorded basis, and full audit.
2. **Merges are reversible.** An incorrect merge is reversed by a
   split/restore operation that fully restores the original profiles. Source
   ownership of every record, document, and consent remains traceable to the
   pre-merge profile via `patient_aliases` and preserved provenance.
3. **Identity caution blocks high-risk writes.** When identifiers or
   demographics conflict (identity caution state), high-risk writes and
   further merges are blocked pending review.
4. **Data model:** `patient_identifiers`, `identity_claims`,
   `identity_matches`, `patient_merge_cases`, `patient_aliases` preserve
   aliases and every merge/split decision (BuildPlan §9.2).
5. **No automatic cross-provider matching** in the pilot; match candidates
   are queued for human review (BuildPlan §5.1).

## Consequences

- Merge/split test cases must preserve all original provenance (BuildPlan
  Phase 2 exit criteria).
- Storage and queries must be designed so a merge is cheap to reverse:
  records are never physically re-owned, only logically linked.
- Every merge, split, claim, and dispute is an audited event (BuildPlan §9.6).
- The wrong-patient-merge risk is tracked in the clinical-safety risk
  register (CS-01 in `docs/CLINICAL-SAFETY-RISK-REGISTER.md`).
