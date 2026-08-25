# Requirements Compliance Matrix — BuildPlan.md vs code (2026-08-25)

Method: every row verified against actual code by direct inspection this
session (the delegated compliance agent was lost to infrastructure failure;
its scope is covered here). Line references reflect the tree as of this
audit. Companion report: `build-plan-execution-audit.md`.

Legend: ✅ done · 🟡 partial · ❌ missing · ⛔ process-required (not
code-verifiable) · N/A not applicable to a code pilot.

## 1. Plan §14 backlog

### A. Documentation and decisions
| Requirement | Status | Evidence |
|---|---|---|
| Mark plan as successor to docs/BUILD-PLAN.md | ✅ | BuildPlan.md at repo root; docs/BUILD-PLAN.md retained with pointer note |
| ADRs: patient ID, merge policy, provenance facets, authoring-vs-disclosure, durable jobs, audit checkpoints, Daylight | ✅ | docs/adr/0001…0007 all present (8 ADRs incl. 0008 discovery/handoff) |
| DPDP checklist → owned workstreams with owner/evidence/review date | 🟡 | docs/DPDP-CHECKLIST.md has workstream table with owner roles + evidence columns; all owners "unassigned", review dates "—" |
| Clinical-safety risk register + abuse-case catalogue | ✅ | CLINICAL-SAFETY-RISK-REGISTER.md (CS-01…) with owner/status columns; ABUSE-CASES.md AB-01…AB-10 mapped to §13.2 gates |

### B. P0 data/policy work
| Requirement | Status | Evidence |
|---|---|---|
| `access_requests` + explicit state machine | ✅ | schema.ts accessRequests (draft→submitted→patient_viewed→approved/declined/expired/cancelled enum); consent/access-requests.ts implements transitions |
| Consent artefact/policy-version storage + selected-grant audit refs | ✅ | consentArtifacts table + SHA-256 artefact + receiptCode; consents.accessRequestId/policyVersion; audits carry correlationId |
| `AccessContext` + policy-evaluation result types; migrate reads one path at a time | ✅ | access/policy.ts AccessContext + PolicyDecision; guard delegates; file route uses fresh decisions |
| Remove name/phone doctor search after handoff exists | ✅ | patients/service.ts NOTE: search removed; discovery.ts ID/ABHA-only + handoff |
| Identity caution, claim, duplicate, merge, split structures | 🟡 | Tables exist (patientIdentityState, identityClaims, identityMatches, patientMergeCases, patientAliases) + policy blocks on caution — but no service/UI flow exercises claims or merge/split yet |
| Decompose record_trust into facets | 🟡 | clinicalResourceVersions carries source/author/review/lifecycle/integrity separately AND legacy `trust` enum still on rows + UI TRUST_LABEL fallback |
| Immutable resource versions + attestations | ✅ | clinicalResourceVersions append-only w/ payloadSha256; attestations table; corrections create linked versions (tested) |

### C. P0 file/job/security work
| Requirement | Status | Evidence |
|---|---|---|
| Durable idempotent job mechanism + outbox | ✅ | outboxEvents/jobRuns tables, jobs/outbox.ts claim-and-run FOR UPDATE SKIP LOCKED, DLQ, requeue; /api/worker cron |
| Quarantine, magic-byte validation, scan state, safe preview policy | ✅ | pipeline-v2 sniffMime must match declared type; documentScanState; files route refuses infected/unscanned-when-scanner-configured; nosniff; inline only pdf/image |
| Signed file URLs bound to fresh decision + short expiry | ✅ | files route evaluates policy on EVERY read then redirects to short-lived signed URL (Supabase) or streams |
| MFA/step-up for privileged + emergency actions | 🟡 | step-up password re-check (session.ts confirmStepUp, TTL 15m) enforced in breakGlassAction; no TOTP/WebAuthn MFA yet |
| Rate limits: lookup, requests, export/download, break-glass | ✅ | rate-limit.ts LIMITS wired into lookup, handoff, accessRequest, breakGlass, fileDownload |
| External checkpointing of audit integrity | 🟡 | integrityCheckpoints table + Merkle manifests + markAnchored(); actual external anchoring job is infra-side, absent |

### D. P1 feature work
| Requirement | Status | Evidence |
|---|---|---|
| Patient Access page: pending/grants/exclusions/expiry/consequence-aware revoke | ✅ | portal/patient/consents page + access-centre.tsx (who/why/see/not-see/duration/decline-consequence order per §7.8); revoke immediate (ownership-checked) |
| Doctor workspace: sticky Access Banner, context bar, critical facts, contextual Add record | ✅ | patients/[id]/page.tsx sticky banner w/ purpose+scopes+expiry+renewal; patient-context strip w/ Leave-patient-record escape (line ~210); AddRecordForm only inside workspace tab |
| Provenance drawer with version/page sources | ✅ | records/provenance.ts resolver + evidence-chip.tsx drawer (hash, history, review text, dispute flag) |
| Lab review queue w/ candidate evidence + individual attestation | ✅ | org/review/[documentId] 55/45 layout, CandidateFieldsTable, mandatory confirm checkbox, single-documentId attest action |
| Range bars only after unit/range compatibility logic | ✅ | range-bar.ts rangeBarCompat gate (value+low+high+unit finite, low<high), source flag verbatim; 7 dedicated tests |
| Correction/dispute flows | ✅ | correctRecordAction (new version + supersede + reason); disputes.raise flags version without rewriting |

### E. P1 design work
| Requirement | Status | Evidence |
|---|---|---|
| Semantic token layers + Daylight | ✅ | globals.css 3-layer tokens (prim-/semantic/component) with measured contrast table; Daylight default, Obsidian override, Print |
| Reduce transparency, forced-colors, contrast harness | ✅ | globals.css reduce-transparency overrides + @media (forced-colors); scripts/contrast-check.mjs |
| Record surfaces flat/opaque; glass shell-only | ✅ | .card opaque; glass-shell class confined to header (portal-shell comment cites §7.1 budget) |
| Status components state their meaning | ✅ | Badge tones always paired with text labels; textual statuses throughout (§7.3) |
| Preserve working evidence language | ✅ | citation chips/trust labels kept from prior sessions |

## 2. §9.2 Data entities vs schema.ts

Present (exact names): user, session, account, verification, organizations,
organizationVerifications, practitioners, practitionerVerifications,
patients, patientIdentifiers, encounters, conditions, allergies,
medicationStatements, observations, procedures, immunizations,
diagnosticReports, documents, consents, auditEvents, emergencyAccessEvents,
aiSummaries, aiSummaryClaims, conflicts, notifications, searchChunks,
accessRequests, consentArtifacts, patientIdentityState, identityClaims,
identityMatches, patientMergeCases, patientAliases, patientHandoffTokens,
emergencyCardTokens (added this pass), clinicalResourceVersions,
attestations, dataDisputes, outboxEvents, jobRuns, idempotencyKeys,
extractionJobs, documentScanState, accessPolicyEvaluations,
integrityCheckpoints, emergencyReadEvents.

Missing vs §9.2 aspirational list: organizationLocations, credentialVerifications
(as own table; snapshots live in version rows), careRelationships,
documentVersions/documentDerivatives/documentPageRefs/malwareScanResults as
separate tables (documents + documentScanState cover the pilot subset),
provenanceLinks/signingKeys (attestations are session-bound signatures),
consentPolicySnapshots as own table (snapshot embedded in artefact JSON),
safetyCases/incidentCases. Verdict: pilot-sufficient; the missing ones map
to pre-pilot/ABDM-era phases.

## 3. §7.5 Component inventory

| Component | Status | Notes |
|---|---|---|
| AppShell | ✅ | portal-shell: skip link, theme toggle, bell, responsive nav, aria-current, 44px targets |
| Button variants | ✅ | ui.tsx primary/secondary/ghost/danger + sizes; loading via SubmitButton aria-busy |
| EvidenceChip | ✅ | evidence-chip.tsx states incl. disputed/corrected/needs_review; opens drawer |
| ProvenanceDrawer | ✅ | focus handling, Escape, source link, hash, version history, dispute entry |
| AccessBanner | ✅ | sticky banner on doctor workspace w/ purpose/scopes/expiry/renewal |
| PatientContextBar | ✅ | name + Patient ID + identity source + "Leave patient record" escape |
| RangeBar | ✅ | compatibility gate + accessible text fallback + tests |
| AuditRow | 🟡 | admin audit stream renders actor/action/target/time; no correlation-ID column, filters limited |
| DataState | ✅ | EmptyState + per-page error.tsx/loading.tsx across portal routes |
| SealDialog | 🟡 | lab attestation footer w/ explicit confirm checkbox + ATTESTATION_TEXT; doctor add-record lacks an equivalent final confirmation dialog |
| IdentityConfirmation | 🟡 | lookup returns existence-only + handoff confirms requester before approval; explicit demographic confirmation step for write actions not built (identity-caution block exists instead) |

## 4. §11.5 copy rules spot-checks (15)

1. "No allergy record found in MediLink." — summarize.ts (fixed this pass) ✅
2. Coverage caveat on patient home snapshot ✅ ("may not contain your complete history")
3. Record-page description "not a complete medical history" ✅
4. "Review and grant" stable label — access-centre ✅
5. "Correct record" stable label — clinical-rows ✅
6. "Request access" stable label — doctor-forms ✅
7. Attestation wording matches plan §7.10 verbatim — versions.ts ✅
8. Lab confirm checkbox "compared each value against the original" ✅
9. Decline consequence preview ("will not be able to open your MediLink record") ✅
10. Emergency notification wording factual ("Emergency access was used…") ✅
11. Exact expiry rendering (date + time + IST formatting helpers) ✅
12. Machine-extracted disclosure line ("not yet reviewed by a lab professional") ✅
13. Uniform no-record lookup message (no existence leak) ✅
14. Revocation toast claims immediacy — now true post-fix (was false promise risk) ✅
15. Marketing quantified band avoids "complete/tamper-proof/universal" ✅ ("0 records readable without consent" is scoped to the product's own enforcement)

## 5. Documentation deliverables

- 8 ADRs present ✅ (list above)
- DPDP checklist restructured into owned workstreams 🟡 (owners unassigned)
- Risk register + abuse catalogue ✅
- Decision log current through D29 (this pass) ✅

## 6. Biggest gaps to production-ready (prioritized)

1. **MFA (TOTP/WebAuthn)** for clinicians/admins/emergency — only password step-up exists.
2. **Shared-store rate limiting** (Redis/Upstash) replacing per-instance buckets.
3. **Real malware scanning** wired to MALWARE_SCANNER integration point.
4. **External checkpoint anchoring** job publishing manifest hashes off-database.
5. **Identity claim/merge/split flows** — tables + policy blocks exist, no workflows.
6. **Admin dual-authorized case-evidence workflow** (§6.4) — currently admins are simply denied.
7. **Stale-session & revoke-race tests** (§13.2 explicitly lists them).
8. **DB-level hardening**: least-privilege roles, RLS where feasible, UPDATE/DELETE revocation on audit/version rows.
9. **Backup restore rehearsal + incident playbook** (process + infra).
10. **Penetration test** against §13.2 suite before pilot.
11. **Patient data export** (§6.1 Profile promises export/disputes; disputes done, export absent).
12. **Notification preference centre** (§6.1) — profile page has none.
13. **Doctor "My patients" enrichment**: new-since-reviewed counts + saved worklists (§6.2) absent.
14. **Encounter/authoring-basis capture** on add-record forms (§9.2 encounters under-used).
15. **DPDP owners/dates assignment** — checklist structure done, accountability unfilled.

Overall estimate: Phase 1–5 engineering substance ~85% implemented;
Phase 6 patient surfaces ~80%; Phases 7–8 (emergency ops hardening, AI
red-team) ~60% implemented with controls-in-code but unexercised operationally;
Phases 9–10 intentionally deferred (N/A). The blocking distance to a real
pilot is dominated by items 1–4 and 9–10, which are infrastructure and
assurance work rather than application code.
