# MediLink — DPDP & Compliance Workstreams

An owned governance programme for India's Digital Personal Data Protection
Act, 2023 and the DPDP Rules, 2025 (notified 13 Nov 2025; phased obligations
through ~May 2027), restructured per BuildPlan §10.3: "a continuously owned
governance programme rather than a list of UI features."

**This is an engineering-organized workstream tracker, not legal advice.
Production deployment requires legal review.** Owner roles are currently
unassigned; each workstream needs a named accountable human before real
patient data is processed (BuildPlan §15, §17).

## Workstream register

| # | Workstream | Accountable owner role | Evidence required | Review date | Legal dependency |
|---|---|---|---|---|---|
| 1 | Consent & consent artefacts | Privacy engineering lead — unassigned | Working `access_requests` state machine; consent artefact export with policy version + verification code; counsel-approved notice copy and version history | — | Yes: consent notice wording, artefact format (align with ABDM consent-artefact structure), policy versioning |
| 2 | Data principal rights (access, correction, erasure, grievance) | Product owner — unassigned | Correction/dispute flow with immutable versions; erasure/retention decision record per record class; published grievance channel with response SLA | — | Yes: retention vs erasure conflict for medical records; correction/grievance timelines under the Rules |
| 3 | Security safeguards (technical) | Security owner — unassigned | Threat model for lookup/consent/document/emergency/AI/admin flows; MFA coverage for privileged roles; penetration test report with findings resolved or risk-accepted; rate-limit instrumentation | — | Partial: contractual security terms with processors |
| 4 | Tamper evidence & audit integrity | Security owner — unassigned | Daily chain verification results; signed checkpoint manifests anchored externally; tamper-detection test evidence (BuildPlan §13.2) | — | Partial: evidentiary weight of audit logs if disputed |
| 5 | Emergency (break-glass) policy | Clinical-safety lead — unassigned + Security owner — unassigned | Approved emergency data set, MFA/step-up policy, event duration, review SLA, notification fallback; tabletop exercise record | — | Yes: legal basis for emergency disclosure; notification obligations |
| 6 | Data minimization & retention schedule | Privacy engineering lead — unassigned + Legal counsel — unassigned | Retention schedule per resource/document class signed by counsel; role-to-data access matrix; data inventory and flow diagrams | — | Yes: retention periods per record class and pilot partner agreements |
| 7 | Encryption & key management | Security owner — unassigned | KMS/HSM selection ADR; envelope-encryption design for documents and sensitive fields; key rotation and key-loss response rehearsed | — | Partial: subprocessor security review |
| 8 | Infrastructure, subprocessors & residency | Infrastructure owner — unassigned | Processor/subprocessor register with data-residency review; hosting region documented per environment; DPAs executed (Vercel, Supabase, AI provider); separate demo vs pilot accounts/credentials/datasets | — | Yes: data processing agreements, residency terms; current free-tier stack is a demo environment only, not a production plan (BuildPlan §10.5) |
| 9 | Significant Data Fiduciary readiness | Legal counsel — unassigned + DPO — unassigned | SDF assessment once thresholds are approached; DPO appointment; DPIA cadence defined | — | Yes: SDF determination, DPO obligations, DPIA requirements under the Rules |
| 10 | Breach & incident response | Security owner — unassigned | Incident playbook with owners and notification decision tree; rehearsed breach exercise meeting the 72-hour notification requirement; CERT-In reporting procedure | — | Yes: breach notification timelines; CERT-In Directions compliance |
| 11 | Guardianship & caregiver authority | Product owner — unassigned + Legal counsel — unassigned | Child/guardian and caregiver authority policy; tested guardian flows | — | Yes: guardian consent rules, age thresholds |
| 12 | Staff access governance | Trust-and-safety lead — unassigned | Staff confidentiality undertakings; access review and offboarding process; production-data access policy requiring just-in-time, case-bound approval | — | Partial: employment/contract terms |
| 13 | ABDM interoperability (adjacent track) | Engineering lead — unassigned | Adapter seams (VerificationProvider, ABHA identifier table); sandbox V3 spike results (M1/M2/M3); NRCES/FHIR conformance mapping | — | Yes: ABDM onboarding credentials/terms before any production exchange |
| 14 | Localisation & accessibility of notices | Product owner — unassigned | Consent notice copy in pilot languages; accessibility conformance (WCAG 2.2 AA) for all consent screens | — | Yes: required languages and literacy standards for the pilot population |

## Standing rules

- Every workstream records its evidence artefacts in this repository or a
  linked governance store; a checkbox without an artefact is not compliance.
- Review dates are set when an owner is assigned; owners must review their
  workstream at least quarterly and on any regulatory change (e.g., new DPDP
  Rules phases through ~May 2027).
- Engineering may prototype controls behind feature flags with synthetic
  data, but must not silently invent production policy (BuildPlan §15).
- Primary sources to re-validate at each review: MeitY (DPDP Act/Rules),
  ABDM Health Data Management Policy, CERT-In directions — see BuildPlan §16.
