# ADR-0006: Audit checkpoints and externally anchored tamper evidence

- **Status:** Proposed (August 2026, per root `BuildPlan.md`)
- **Date:** 2026-08-24
- **Deciders:** Security owner — unassigned; Engineering

## Context

The codebase has an append-only hash-chained audit log. The August 2026
review (BuildPlan §2, P0) found its limits: a privileged database operator
can rewrite a local chain from genesis, and hashes do not prove the
underlying clinical statement was true. "A hash chain equals tamper-proof
data" is a P0 misconception; "blockchain" must not substitute for key
management, backups, staff access control, and incident response.

## Decision

Per BuildPlan §9.6, keep the hash chain and add stronger tamper evidence:

1. **Database-level immutability:** triggers/permissions prevent application
   roles from `UPDATE` or `DELETE` on audit and version rows.
2. **Transactional pairing:** audit events are written through the same
   transactional outbox as the originating business event (ADR-0005), with
   daily reconciliation for missing pairs.
3. **Periodic signed checkpoint manifests** are stored in a separate,
   access-controlled location, and their hashes are **anchored to an
   independent system controlled separately from the primary database**.
4. **Alerting:** chain/checkpoint mismatch raises an alert; verification
   results are retained.
5. **Event contract:** every audited action stores actor, subject, target
   version, access basis, purpose, decision result, reason code, correlation
   ID, minimized request metadata, timestamp, preceding hash, event hash,
   and checkpoint ID.

## Consequences

- Rewriting history requires compromising two independently controlled
  systems, not one privileged database role.
- Daily integrity verification, checkpoint reconciliation, and a rehearsed
  mismatch-response path become operational requirements (BuildPlan §10.4,
  §13.2: intentional tampering must be detected in tests).
- Claims language is bounded: the system makes later tampering *detectable
  under defined assumptions*; it does not claim immutability or medical
  correctness, and marketing must not say "tamper-proof" (BuildPlan §1,
  Phase 10 exit criteria).
