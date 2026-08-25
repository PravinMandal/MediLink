# MediLink Build Plan

> **Status:** proposed implementation plan, revised after product, security,
> architecture, and UX review on August 23, 2026.
>
> **Audience:** product, design, clinical-safety, security, and engineering
> teams.
>
> **Important:** this is a product and engineering plan, not legal or clinical
> advice. A real-patient pilot must not start until counsel, a clinical-safety
> lead, and a security owner approve the applicable controls.

---

## 1. Executive decision

MediLink should be built as a **consent-governed longitudinal clinical record
exchange and evidence viewer**, not as an unqualified "universal medical
identity" or a replacement for a hospital EHR.

The product promise is:

> When an authorized treating professional needs a patient's history, MediLink
> can show the most relevant available facts, their source, their author,
> their review state, and the access basis - quickly and without pretending the
> record is complete.

The distinction matters:

- A **MediLink Patient ID** is an application identifier. It is not a national
  identifier and must never be marketed as one.
- A record being present does **not** mean the history is complete.
- A verified doctor or facility is not the same thing as a clinically
  verified data item.
- A hash chain makes later tampering detectable under defined assumptions; it
  does not, by itself, make the database immutable or medically correct.
- AI can organize cited evidence. It must not diagnose, prescribe, triage, or
  convert missing information into a reassuring conclusion.

The initial commercial wedge should be narrower than "all healthcare in
India":

1. One city or health-system pilot.
2. A small group of verified clinicians and one or two diagnostic labs.
3. Document ingestion and a doctor-readable, consented patient view.
4. A patient-controlled access flow that is easy enough to use during a real
   consultation.
5. Only after those workflows are reliable: ABDM connectivity, richer
   integrations, and emergency expansion.

This preserves the original thesis while making it credible, safe, and
buildable.

---

## 2. What is wrong or incomplete in the original "Obsidian Glass" plan

The original plan has strong instincts: provenance, explicit consent, cited
AI, cautious use of glass, reference ranges, and an emergency workflow. It
also contains product and security mistakes that must be corrected before
implementation.

| Priority | Original assumption | Why it is risky or incomplete | Decision in this plan |
|---|---|---|---|
| P0 | "Universal patient identity" | An app-generated ID cannot safely establish that two records represent the same person. Duplicate and mistaken merges are patient-safety incidents. | Call it **MediLink Patient ID**. Build identity proofing, match review, merge/split, aliases, and account-claim flows before broad onboarding. |
| P0 | ID-only search is sufficient privacy | A predictable or widely shared ID becomes a bearer identifier. It prevents name-directory enumeration but does not establish treatment relationship or authorization. | Use ID/verified ABHA lookup only for routine discovery, rate-limit it, return no clinical facts before authorization, and add patient-present QR/session handoff. |
| P0 | "Verified records" is one status | Author verification, document integrity, extraction confidence, clinical review, and record correction are different facts. Combining them in one `trust` enum produces misleading UI. | Model provenance as separate dimensions and render them separately. |
| P0 | A hash chain equals tamper-proof data | A privileged database operator can rewrite a local chain from genesis. Hashes also do not prove that the underlying clinical statement was true. | Keep a hash chain, add immutable event semantics, signed record attestations, protected storage, periodic externally anchored checkpoints, and operational access controls. |
| P0 | Consent is only scopes + expiry | A defensible access decision also needs requester, purpose, care context, requested duration, policy version, patient decision, and an immutable artefact. A pending request must be data, not an inferred audit event. | Add first-class `access_requests`, consent artefacts, policy snapshots, selected-grant evaluation, and a denial/expiry lifecycle. |
| P0 | Any organisation grant lets any staff member read | A broad organisation-wide grant can expose records to unrelated reception, lab, or administrator staff. | Authorize a named professional or tightly permissioned work role plus organisation membership and a declared care/task relationship. |
| P0 | Break-glass is only "reason + 60 minutes" | Emergency access is the highest-risk workflow. A QR or ID must not directly reveal health data, and every emergency access needs strong identity, minimal data, monitoring, and review. | Make emergency access a separate high-assurance policy with step-up authentication, minimal disclosure, rate limits, notification, review SLA, and abuse response. |
| P0 | "No allergies documented" is a safe fact | Absence of a record is not evidence that no allergy exists. This is dangerous in an emergency or AI summary. | Use "No allergy record found in MediLink as of [date]" only where useful; never present it as a clinical negative. |
| P0 | Current records can be overwritten by "amended" | A correction needs a version relationship, reason, author, status, and display policy. `amended` is not a trust level. | Use immutable versions and a supersession/dispute workflow. |
| P1 | Upload, parse, and seal are one action | A user cannot safely attest to extracted facts if OCR/parser output, original document, failed fields, and upload state are blurred together. | Separate upload, extraction, review, attestation, and release into explicit states. |
| P1 | A lab reference range is universal | Ranges depend on source lab, method, specimen, age, sex, pregnancy status, and units. "Normal" cannot be inferred reliably from a generic threshold. | Preserve the source range and flag; show a range bar only when the source provides a compatible numeric range. |
| P1 | "Write Record" is a global doctor tab | Clinicians should not start a record without unmistakable patient, encounter, author, organisation, and access context. It creates wrong-patient risk. | Put **Add record** inside the selected patient workspace and require a patient-context confirmation. |
| P1 | A patient consent controls provider writes | Permission to contribute a record and permission to disclose history are related but not identical. The legal/operational rule needs review. | Create separate policy concepts: authoring authority / care relationship, then patient-controlled disclosure consent. Do not silently treat one as the other. |
| P1 | Lab batch confirmation can be simple | Batch confirmation is a wrong-patient and wrong-field risk. | Batch only homogeneous low-risk fields after sample review; require an individual attestation per report. |
| P1 | AI SBAR can have "Assessment" and "Plan" | Those labels can imply diagnosis or treatment advice. A model can create authoritative-sounding prose even with citations. | Default to **Key facts**, **Relevant history**, **Recent changes**, and **Open data issues**. Offer SBAR only as a clinician-facing formatting mode, with no recommendations. |
| P1 | A dark-only product is an accessibility fallback problem | Clinical work happens under bright ambient light, on low-quality displays, and on printed handoffs. "Light mode is not shipping" is not acceptable. | Preserve Obsidian as the brand/default visual mode, but ship a solid **Daylight** operational theme and print styles from the beginning. |
| P1 | Glass is a shell architecture | Backdrop blur adds rendering cost, visual noise, and privacy issues when information behind an overlay is legible. | Use glass only as a restrained decoration layer; core clinical data is always on opaque, high-contrast surfaces. |
| P1 | Marketing redesign should precede core risk work | A polished landing page cannot compensate for unsafe identity, access, document, or incident workflows. | Brand and marketing run in parallel after the trust foundation is specified; they do not lead the delivery critical path. |
| P2 | Timeline semantic zoom is an MVP requirement | It is expensive and less valuable than correct filters, evidence preview, date fidelity, and useful empty states. | Build a fast, accessible chronological timeline first; add semantic density controls only after usability testing. |
| P2 | "No green" is a system rule | A palette rule is fine, but status cannot rely on any color and blue must not make dangerous states look safe. | Blue may represent product identity and verified status; labels, icons, wording, and shape carry all state meaning. |

### Important codebase findings that change the plan

The existing application already has valuable foundations: an access guard,
scoped consent, patient-scoped search, file hashing, a hash-chained audit
log, cited summaries, and a test suite. The next plan should extend those
assets rather than rewrite the app for fashion.

The current implementation also reveals concrete gaps:

1. `patientService.search()` currently searches name and phone. The proposed
   privacy change is a real breaking change, not a visual placeholder update.
2. `record_trust` currently mixes `verified`, `extracted`, `self_reported`,
   and `amended`; these need to become independent provenance and lifecycle
   fields.
3. Documents have content hashes, but a clinical record version does not yet
   have a canonical payload hash, author attestation, or immutable version
   model.
4. `access_requests` do not exist as a table. The current pending-consent UI
   derives a request from audit events, so a request has no proper status,
   expiry, requested scope snapshot, or requester response history.
5. The document pipeline code performs extraction inline. Durable,
   idempotent background processing, extraction review, page/field evidence,
   and malware scanning are not yet implemented.
6. A facility-level consent can be evaluated from an organisation ID alone;
   staff permissions and care/task relationship must be narrowed.
7. The current emergency implementation correctly limits scopes, logs, and
   notifies, but needs high-assurance authentication, abuse throttling,
   operational review SLAs, and a safer QR design before real use.
8. Some UI and documentation say "verified" where the system can only prove
   an uploaded source or verified contributor. The language needs correction
   everywhere.

---

## 3. Product charter

### 3.1 The problem

At a new consultation or emergency, an authorized clinician often lacks
reliable access to old prescriptions, lab reports, scans, discharge summaries,
allergies, and treatment history. The patient and family may not know the
details. Existing files are fragmented and difficult to evaluate quickly.

### 3.2 The job to be done

**When I am treating a patient with their permission, I need a fast,
evidence-backed picture of the relevant history, so I can spend the visit on
care rather than reconstruction.**

The patient equivalent is:

**When a provider asks for history, I need to understand exactly who is asking,
why, what they can see, and how to stop that access.**

### 3.3 Non-goals for the first pilot

MediLink v1 is not:

- a diagnosis, triage, prescription, or dosage engine;
- a substitute for a hospital's medico-legal system of record;
- an emergency dispatch service;
- a national identity system;
- a full EMR, billing, appointment, pharmacy, PACS, or claims system;
- a marketplace for doctors;
- a promise that every Indian provider or record is connected;
- a place for real patient data in development, demo, screenshots, or
  generative-model evaluation.

### 3.4 Primary users

| User | Core job | Primary success condition |
|---|---|---|
| Patient / family caregiver | Control history access and carry a usable emergency artefact | Can understand and act on access in under a minute. |
| Treating doctor | Get a trustworthy, scoped patient picture in a consultation | Can identify critical facts, evidence, and uncertainty in 10 seconds. |
| Lab reviewer / facility staff | Deliver source-backed result documents accurately | Can review extracted fields against originals without wrong-patient ambiguity. |
| Facility administrator | Manage staff authority and operational exceptions | Can prove who was allowed to act for the facility. |
| Platform trust and safety reviewer | Verify providers and investigate exceptional access | Can review the event trail without casually opening clinical data. |

### 3.5 Product principles

1. **Evidence before eloquence.** A concise fact with a visible source is more
   valuable than a polished unsupported summary.
2. **No false completeness.** Always communicate record coverage, latest
   activity, and missing/unknown fields.
3. **The patient controls disclosure.** The UI explains the actual disclosure
   boundary in plain language before the patient approves.
4. **The clinician works in context.** Patient, encounter, purpose, scope,
   and time limit are visible while viewing or contributing.
5. **Correctability is a feature.** Medical records are corrected by
   amendment and dispute, never silently overwritten.
6. **Minimum necessary disclosure.** Start from the smallest usable view and
   request more only when required.
7. **Emergency is exceptional.** It must be quick when justified and
   intentionally inconvenient when it is not.
8. **AI is an evidence navigator.** It may not become an invisible clinical
   authority.
9. **Every status is textual.** Color, animation, and icons reinforce the
   meaning; they never carry it alone.
10. **Operational reality beats a demo.** Security incidents, failed
    extraction, duplicate patients, outages, and patient disputes are
    first-class product states.

---

## 4. Product model and terminology

Use precise terms consistently in code, UI, support material, and marketing.

| Term | Meaning | Do not call it |
|---|---|---|
| MediLink Patient ID | Application-scoped identifier with a non-enumerable random component and check characters | Universal ID, national ID, proof of identity |
| Identifier | ABHA, verified provider MRN, or another linked identifier | Patient account |
| Patient account | Login account that has successfully claimed or been linked to a patient profile | The patient record itself |
| Source document | Original uploaded report, prescription, or scan report, stored unchanged | Verified clinical truth |
| Extracted candidate | Machine-produced field candidate derived from a document | Confirmed result |
| Attested record version | Structured record version signed/attested by an authorized contributor | Immutable forever without qualification |
| Contributor verified | Person/facility credentials checked at a point in time | Record medically verified |
| Clinical review state | Whether a human reviewer has checked an extracted candidate or record | Provider verification |
| Consent grant | Patient-approved disclosure permission with a specific policy snapshot | General access |
| Access request | A request awaiting a patient decision | Consent |
| Emergency access event | Exceptional, time-boxed disclosure under a stricter policy | Normal treatment consent |
| Data dispute | Patient or provider challenge to accuracy, identity, or linkage | Deletion request |

### 4.1 Trust model: replace the single `trust` badge

Every displayed clinical item must resolve to a structured trust descriptor:

```ts
type ProvenanceState = {
  sourceType:
    | "native_entry"
    | "source_document"
    | "patient_reported"
    | "external_exchange";
  author: {
    userId?: string;
    practitionerId?: string;
    organizationId?: string;
    credentialStatus: "unverified" | "pending" | "verified" | "expired";
    credentialCheckedAt?: string;
  };
  document: {
    documentId?: string;
    sha256?: string;
    pageRefs?: Array<{ page: number; region?: string }>;
  };
  review: {
    state: "not_required" | "machine_extracted" | "human_reviewed" | "attested";
    reviewedBy?: string;
    reviewedAt?: string;
  };
  lifecycle: {
    status: "active" | "corrected" | "superseded" | "entered_in_error" | "disputed";
    replacesVersionId?: string;
  };
  integrity: {
    payloadHash: string;
    signatureId?: string;
    sealedAt: string;
  };
};
```

The default UI does not dump this object on every row. It uses a compact,
human-readable line such as:

> Attested by Dr. R. Mehta, City Diagnostics - 12 Aug 2026 - derived from
> CBC report, page 1.

Clicking **Evidence** opens the full provenance drawer. The drawer makes
uncertainty explicit:

> Extracted from the original report; not yet reviewed by a lab professional.

---

## 5. Scope, rollout strategy, and success metrics

### 5.1 Pilot scope

The first safe pilot supports:

- patient profiles claimed through a supervised identity flow;
- verified clinician and lab/facility onboarding;
- source document upload and source-preserving storage;
- structured conditions, allergies, medications, selected lab observations,
  procedures, and encounter summaries;
- explicit patient access requests and time-boxed grants;
- a clinician patient workspace with a critical-facts band, timeline,
  documents, and cited evidence;
- correction/dispute handling;
- a minimal emergency profile under a monitored policy;
- no automated clinical decision, medication recommendation, or unattended
  result release.

The pilot deliberately excludes:

- automatic cross-provider record matching;
- automatic ABHA linking;
- direct integration into a live hospital production system;
- bulk backfill from unconstrained archives;
- free-text clinical notes shared by default;
- generative AI as the only extraction or summary path.

### 5.2 Outcome metrics

Measure outcomes, not page views.

| Metric | Definition | Pilot target |
|---|---|---|
| Time to useful record | Median time from authorized record opening to clinician viewing critical facts and source context | < 15 seconds on a normal connection |
| Consent completion | Patients who complete a valid access decision after opening a request | Establish baseline; optimize comprehension before conversion |
| Decision comprehension | Test participants correctly identify requester, purpose, expiry, included scopes, and excluded scopes | >= 90% in moderated usability tests |
| Evidence coverage | Displayed high-stakes fact cards with at least one accessible source or explicit self-report label | 100% |
| Source retrieval | Open-source-document success rate after an evidence click | >= 99% in controlled pilot |
| Extraction review rate | Extracted clinical fields human-reviewed before appearing as attested data | 100% for released lab values in pilot |
| Wrong-patient prevention | Confirmed wrong-patient writes, merges, or disclosures | 0 |
| Unauthorized access | Confirmed unauthorized clinical disclosures | 0 |
| Emergency oversight | Emergency events reviewed within policy SLA | 100% |
| AI citation validity | AI claims whose cited source/version/page can be opened by the same viewer | 100% |

Do not use "records uploaded" or "AI summaries generated" as success metrics
without quality and safety denominators.

---

## 6. Information architecture

The original navigation has too many global destinations and makes critical
actions feel disconnected. The revised structure keeps information close to
the patient and the task.

### 6.1 Patient portal

1. **Home**
   - critical health snapshot;
   - pending access decisions;
   - recent additions and corrections;
   - Patient ID handoff tools;
   - record coverage indicator;
   - concise, cited personal summary.
2. **Health record**
   - timeline, conditions, medications, allergies, labs, procedures, and
     documents in one route with tabs/filters;
   - deep links to a date, item, or document.
3. **Access**
   - requests inbox, active grants, revoked/expired history, and access log;
   - this is the patient's control centre, not a generic settings page.
4. **Emergency**
   - emergency profile, emergency card, ICE contacts, and a "what a treating
     clinician may see" preview.
5. **Profile and data**
   - account/security, identity linkage, communication preferences, data
     export, disputes, and support.

On mobile, use a five-item bottom bar. More nested destinations belong within
the relevant page, not in a horizontally scrolling global nav.

### 6.2 Doctor portal

1. **Workspace**
   - My patients with active grants, expiring access, pending responses, new
     evidence since last reviewed, and optional saved worklists.
2. **Find patient**
   - ID/ABHA lookup, patient-present handoff, and access request creation;
   - no pre-consent name/phone directory.
3. **Emergency access**
   - explicitly separate, red-coded high-assurance workflow.
4. **Inbox**
   - consent changes, record correction responses, access expiry, facility
     review tasks, and system notices.
5. **Profile and verification**
   - credentials, organisation memberships, device security, default request
     wording, and signature/attestation settings.

**Add record is not global navigation.** It appears only inside an authorized
patient workspace, with an encounter context visible.

### 6.3 Facility / lab portal

1. **Work queue** - verification, upload, correction, and failed extraction
   tasks; this is the primary landing page.
2. **Upload and match** - controlled patient identification, upload,
   extraction, and delivery status.
3. **Delivered records** - source document and release history, correction
   actions, and patient notification status.
4. **People and organisation** - staff memberships, permissions,
   accreditation/verification evidence, service locations, and settings.

### 6.4 Platform trust and safety portal

Platform administrators are not clinical viewers. Their portal exposes:

1. **Provider verification**
2. **Emergency review**
3. **Security and audit**
4. **Identity and dispute cases**
5. **Roles and organisation governance**

Any clinical preview needed to resolve a dispute must be a narrowly scoped,
dual-authorized "case evidence" workflow with a separate audit event. It must
not be an incidental admin page capability.

---

## 7. Detailed experience design

### 7.1 Global shell and visual language

Keep the name **Obsidian Glass**, but redefine it:

- **Obsidian** is the dark, low-distraction brand environment.
- **Glass** is a restrained elevation treatment, never the information
  surface for dense medical data.
- **Evidence** is the signature visual language: source chips, ledger lines,
  page references, author stamps, and deliberately quiet data panels.

#### Layout

- Desktop: 252 px detached navigation rail, 16 px from viewport edges,
  20 px radius. The content frame remains flat and opaque.
- Top bar: 56 px, breadcrumb plus patient-context chip when inside a patient
  record. No breadcrumb should expose a patient name on a shared/public
  screen before authorization.
- Content max width: 1440 px for full record pages; 1120 px for decisions,
  forms, and profile settings.
- Mobile: bottom navigation has five destinations maximum, 48 px tap targets,
  `safe-area-inset-bottom` support, and a visible active label.
- Dense clinical pages use a 12-column desktop grid, 8-column tablet grid,
  and 4-column mobile grid. Do not force cards into a generic responsive
  mosaic.

#### Glass budget

Per page:

- 1 detached sidebar;
- 1 top bar or mobile bottom bar;
- up to 2 transient layers (menu, drawer, dialog);
- never stack translucent panels over long text, tables, charts, or forms;
- `backdrop-filter` must have an opaque fallback for unsupported browsers,
  reduced-transparency preference, high-contrast mode, and Daylight theme.

### 7.2 Themes and accessibility

Ship all three from the foundation phase:

1. **Obsidian** - default dark product theme.
2. **Daylight** - opaque light operational theme for bright clinics and
   visual comfort.
3. **Print** - paper-first, high-contrast exported artefacts.

`Reduce transparency` is independent of theme. It changes elevated panels to
solid surfaces and persists per user. Honor `prefers-reduced-motion`,
`prefers-contrast`, and forced-colors modes.

Do not make "dark mode" an aesthetic toggle that silently changes contrast
semantics. Components must use semantic tokens and be checked in each shipped
mode.

### 7.3 Colour and status policy

The blue identity can remain, but clinical meaning requires a larger semantic
system:

| Semantic state | Visual treatment | Required text/icon |
|---|---|---|
| Verified contributor / active non-risk state | Blue seal, blue rule, check icon | "Contributor verified" or "Access active" |
| Pending / needs review | Amber icon/rule | "Needs review", "Expires in 3 days" |
| Critical clinical alert / emergency | Red band/rule | "Emergency access", "Critical value reported" |
| Error / blocked | Red with clear remedy | "Could not open source document. Try again." |
| Unknown / unavailable | Neutral slate | "Not recorded", "Source unavailable" |
| Corrected / superseded | Neutral with version icon | "Corrected on 12 Aug 2026" |

Never use a blue check to imply clinical correctness. It means exactly what its
label says.

### 7.4 Typography

- Display/marketing: Fraunces only for large editorial moments.
- Application UI: Space Grotesk or an equally legible UI sans, with a
  fall-back stack tested for Indian-language text.
- Data: IBM Plex Mono for IDs, hash fragments, dates, numeric values, and
  ranges; never for long paragraphs.
- Body default: 16 px minimum; dense table text: 14 px minimum with a 20 px
  line height.
- Numerals: tabular figures throughout labs, dates, counts, and audit tables.
- Internationalization: all layouts must survive longer labels and
  non-Latin scripts. Store canonical dates/times; render in the user's locale
  and explicitly label time zones where relevant.

### 7.5 Component inventory

Build primitives before feature pages:

| Component | Requirements |
|---|---|
| `AppShell` | Theme, reduced-transparency, responsive navigation, safe-area support, skip links |
| `Button` | Explicit primary/secondary/destructive/emergency variants; loading and disabled semantics; 44 px mobile target |
| `EvidenceChip` | Shows source/review/lifecycle label; opens drawer; never an unexplained colored pill |
| `ProvenanceDrawer` | Focus trap, Escape, source preview, author/org, attestation, hash, version history, access-safe file link |
| `AccessBanner` | Displays purpose, scopes, expiry, request/grant ID, access basis, and renewal action in every professional patient workspace |
| `PatientContextBar` | Persistent patient identifier, identity-confidence status, active encounter, and "wrong patient?" escape |
| `RangeBar` | Numeric range only when compatible range exists; shows result, unit, source range, flag, date, and accessible textual fallback |
| `AuditRow` | Actor, action, target, reason, timestamp, result, correlation ID, and integrity checkpoint; filters never reveal unauthorized data |
| `DataState` | Loading, empty, error, partial, stale, and permission-denied states; copy tells the user what happened and what to do |
| `SealDialog` | Shows exact attested payload summary, source references, corrections, validation warnings, signature, and final confirmation |
| `IdentityConfirmation` | Displays minimum demographic confirmation after valid lookup; requires explicit confirmation before write/request actions |

### 7.6 Patient home

The patient home is a calm control surface, not a dashboard full of cards.

#### Page order

1. **Attention strip** - only when action is required:
   - pending access request;
   - emergency access used;
   - identity/dispute action;
   - recently corrected record;
   - expiring access grant.
2. **Critical profile** - blood group only if known, dangerous allergies,
   active medications, emergency contact, and "last updated" coverage note.
3. **Your record today** - source count, newest verified/attested addition,
   extraction items awaiting review if patient action is relevant, and
   uncertainty ("No lab results added in the last 18 months").
4. **Patient ID handoff** - copy, large text, printable QR/card, and
   "Start an in-person access session" action.
5. **Recent activity** - readable sentences such as "City Diagnostics added
   a CBC report. It is awaiting review." Do not expose hash strings as the
   primary experience.
6. **Personal evidence summary** - optional cited facts, clearly labelled
   "Generated from records currently in MediLink"; use patient language.

#### Critical profile rules

- Show a fact only if its provenance/review state supports the display.
- Blood group displays its source state: "Lab-attested", "Patient-reported",
  or "Conflicting records - verify before use."
- Allergies show an explicit "recorded allergy" label; do not claim
  "no allergies" from absence.
- Medicines distinguish "recorded as active" from "currently taking".
- No card may imply that this is a complete medical clearance.

### 7.7 Patient health record

Use a flat record workspace with tabs inside the route:

1. **Timeline**
2. **Labs**
3. **Medications and allergies**
4. **Conditions and procedures**
5. **Documents**

#### Timeline

- Chronological descending by default; user can switch to ascending.
- Date buckets use clinical effective date when known; otherwise visibly use
  "document uploaded" date.
- Each event includes kind, concise fact, contributor/source line, trust
  label, correction state, and evidence affordance.
- Filters: date range, category, contributor, source state, review state,
  and corrected/disputed. Filters become URL state and are shareable only
  within an authorized session.
- Search runs only inside the already authorized patient record.
- Do not implement semantic zoom before a usability study shows that dense
  patient histories need it. A "compact / comfortable" density toggle is
  lower risk and more accessible.

#### Labs

Group by source report and collection date before grouping by "normal."

For every observation:

- value and unit;
- source-provided range and/or source flag;
- specimen/collection date if available;
- source laboratory;
- evidence page;
- comparable-series indicator.

Range bar rules:

- Render only for numeric value + numeric source range + compatible unit.
- Keep the source's own high/low/critical flag visible.
- Do not calculate a new normal flag from generic thresholds.
- Do not join a trend series across incompatible units, methods, or unclear
  analyte identity.
- Explain "Why this is marked high/low" in plain language: "The source lab
  reported this value above its stated reference range."
- Use shape and text in addition to amber/red position color.

#### Documents

Documents are evidence, not decorative tiles:

- List/table view is default for large collections; grid view is optional for
  visual thumbnails.
- Each row includes type, clinical date, uploader, organisation, hash
  fragment, status, linked structured facts count, and **Used by** count.
- "Used by 3 facts" opens the three actual record versions or AI claims,
  never a vague provenance count.
- File preview is sandboxed/served safely. Original download is clear.
- Upload is allowed only where product policy permits patient-provided
  documents; its UI says "Patient-provided - not clinically reviewed."

### 7.8 Access centre

This is the most important patient-control experience.

#### Pending access request card

The first screen must answer, in this order:

1. **Who is asking?** Full clinician name, verified credential, organisation,
   specialty, and secure contact route.
2. **Why?** Plain language declared purpose and optional visit/encounter
   reference.
3. **What will they see?** Explicit selected categories, not an opaque
   "full record" default.
4. **What will they not see?** Show excluded categories in a muted list.
5. **For how long?** Exact local expiry date/time and duration.
6. **What happens if I decline?** "They will not be able to open your
   MediLink record. You can still share documents another way."

Actions:

- **Review and grant** - opens a review screen with no preselected scopes.
- **Ask to narrow** - lets a patient choose a shorter duration and smaller
  scope, with a reason optional.
- **Decline** - confirms what will happen and offers an optional reason.
- **Report concern** - distinct from decline; routes to trust and safety.

The requester cannot pre-check scopes. They may supply a suggested minimum
set, which the UI labels as "requested by Dr. Mehta," and the patient must
explicitly select every approved category.

#### Active grant

Display:

- who, purpose, exact scopes, selected time limit, start/expiry;
- last access and access count, with a link to detailed audit entries;
- "request renewal" state when fewer than seven days remain;
- **Revoke access** as a destructive action with a plain consequence preview;
- exportable consent artefact with policy version and a verification code.

Revocation must be effective before the success toast appears. In-flight
downloads/viewer sessions must have a documented short authorization lease and
re-check path; revocation cannot mean "effective next day."

### 7.9 Doctor workspace

#### My patients

Use a practical list, not a card wall:

- patient initials/avatar only after a current authorization exists;
- patient name, optional age band, consent purpose and scopes;
- expiry countdown;
- "new since you last reviewed" count with exact types;
- last encounter/date;
- severe conflict or critical-value indicators only when permission includes
  that data;
- sort: recent activity, expiring access, last opened, and name.

The "new" calculation is based on a per-user, per-patient,
per-consent-version view checkpoint. It must not read changes outside the
active grant in order to calculate the count.

#### Find patient

The normal lookup form has:

- a single `Patient ID or verified ABHA` input;
- paste support, input formatting, check-digit validation where applicable;
- a "Patient is with me" option that starts a short-lived patient-present QR
  or numeric handoff session;
- a visible rate-limit/error state that does not leak whether an arbitrary ID
  exists.

After a valid identifier:

- if no active authorization: show only "A MediLink record may exist" plus a
  request form; do not reveal name, DOB, city, phone, or clinical metadata;
- if active authorization: open the patient workspace;
- if the identity has a match warning: stop write access and require the
  approved identity confirmation workflow;
- if no record exists: offer the appropriate patient-enrollment/claim path,
  never a loose directory search.

#### Patient workspace

The page begins with a sticky **Access Banner**:

> Viewing under treatment access - allergies, medicines, labs - expires
> 28 Aug 2026, 17:30 IST - Request renewal

Then:

1. **Critical facts band**
   - allergies;
   - recorded active medications;
   - major active conditions;
   - blood group with source/conflict state;
   - key data conflicts;
   - record coverage and last updated date.
2. **Key facts**
   - evidence-backed concise facts and changes;
   - source chips open the exact item/page;
   - no clinical recommendation.
3. **Timeline**
4. **Labs and trends**
5. **Documents**
6. **Add record**

The patient context bar is always visible while the workspace is open. It
shows at least name/identifier after authorization, the source of identity,
and an explicit **Leave patient record** control. This reduces wrong-patient
errors.

### 7.10 Add record and the sealing flow

The write flow needs clinical and legal clarity. It is not a glow effect.

#### Preconditions

Before opening the form, require:

- verified practitioner/facility status;
- active staff membership and write permission;
- a selected patient with no unresolved identity block;
- an authoring basis/encounter context;
- any policy-required disclosure/authoring authority;
- a supported record type.

#### Step 1: choose record type

Start with a compact, high-value set:

- encounter summary;
- condition/problem;
- allergy/intolerance;
- medication statement;
- lab observation or diagnostic report;
- procedure;
- source document.

Do not launch with dozens of FHIR resource forms. Each form captures only
fields required for clinical meaning and provenance.

#### Step 2: structured entry

- patient name and Patient ID remain pinned in the form;
- fields use medical terms with help text, but no unbounded custom coding
  taxonomy in the MVP;
- record date and data-source date are distinct;
- source document can be attached or linked;
- validation is inline and server-authoritative;
- draft autosaves locally/encrypted only if threat modelling approves it;
  otherwise warn before navigation.

#### Step 3: review

Present a human-readable review, not raw JSON:

> Medication statement: Metformin 500 mg, oral, twice daily  
> Effective from: 12 Aug 2026  
> Patient: Rahul Sharma (ML-7F3K-...)  
> Author: Dr. R. Mehta, City Clinic  
> Evidence: prescription_2026-08-12.pdf, page 1

Show warnings for:

- duplicate-looking entry;
- known conflict;
- future/past improbable date;
- missing source where policy expects one;
- high-risk allergy or blood-group conflict.

Warnings must be explainable and never silently block a clinician without a
remedy.

#### Step 4: attest and seal

Replace "Seal record" glamour with clear legal/product language:

> **Attest and add record**  
> You confirm this structured entry accurately represents the source or your
> clinical entry. Later corrections create a linked correction; they do not
> overwrite this version.

On confirmation:

1. canonicalize payload;
2. calculate payload hash;
3. persist immutable record version and provenance in one transaction;
4. create an attestation/signature event;
5. append audit event through the transactional outbox;
6. enqueue derived indexing and notification;
7. show the sealed version ID and evidence link.

Use a browser-appropriate re-authentication/step-up policy for high-risk
actions. Do not depend on an animation as confirmation.

#### Corrections

- Contributor selects **Correct record**, never edits the original.
- New version identifies fields changed and correction reason.
- Original remains readable under a "Superseded" banner for authorized
  viewers unless legal policy requires special handling.
- Patient can flag a dispute; they cannot rewrite a provider's attestation.
- A disputed high-risk fact appears with a clear warning in the critical band.

### 7.11 Lab/facility work queue

#### Upload and match

1. Select/scan Patient ID or use patient-present handoff.
2. Confirm minimum demographic information according to policy.
3. Upload supported file. Immediately show checksum, file type, page count,
   and virus-scan state.
4. Create a source document in `received` state. The source is preserved
   before extraction begins.
5. Durable job extracts text/OCR candidates and stores page/region evidence.
6. Work queue assigns an item based on organisation role/permissions.

Never make a patient name/phone autocomplete the default way a lab identifies
a record. If operational matching is required, place it in a separate,
permissioned identity-resolution workflow with stricter audit and a clear
facility policy.

#### Verification queue

Layout:

- left 55%: original document viewer, page thumbnails, zoom, and page
  location highlight;
- right 45%: structured candidate fields grouped by report/panel;
- sticky footer: save draft, mark unable to verify, attest and deliver.

Every candidate field has:

- value, unit, source range/flag, collection date;
- confidence if machine extracted;
- original-page reference;
- Confirm, Correct, Exclude controls;
- keyboard navigation for high-volume review.

Rules:

- No candidate becomes "human reviewed" by simply viewing a report.
- Require an individual attestation for each patient report.
- Batch action may pre-fill a reviewed choice only for homogeneous,
  non-clinical metadata after a sampled review; it never seals all clinical
  values at once.
- If source quality is insufficient, deliver the original document as
  `source_available / structured_data_unavailable` rather than inventing
  fields.
- Patient notification happens only after a release state is reached and
  follows facility policy.

### 7.12 Emergency access

Emergency access should be designed with clinical leaders, legal counsel, and
pilot facilities before release. The workflow below is the product baseline.

#### Emergency profile contents

Minimum necessary data only:

- patient identity confirmation fields permitted by policy;
- blood group plus source/conflict state;
- recorded critical allergies/intolerances;
- recorded active medications;
- high-value conditions and major procedures;
- emergency contact;
- selected recent critical laboratory values only with date/source;
- a bold coverage caveat: "MediLink may not contain the complete history."

Do not expose all source documents, detailed notes, full timeline, or broad
search as part of emergency access.

#### Start path

1. Doctor signs in with a verified account and step-up authentication.
2. Doctor enters Patient ID or scans an **opaque signed QR token**. The QR
   must not encode raw health data or a reusable public patient URL.
3. Server verifies token, device/session, credential status, rate limit, and
   whether the event is blocked by a prior abuse flag.
4. Doctor chooses a structured reason and enters a free-text clinical reason
   with a meaningful minimum length.
5. A review screen repeats patient context and the exact emergency data set.
6. Doctor confirms. Access begins for the shortest policy-approved duration.
7. A persistent red banner shows remaining time, data boundary, event ID,
   and **End emergency access now**.

#### Controls

- strong MFA / step-up auth;
- idempotency key so double-clicks do not create multiple events;
- per-doctor, per-patient, per-organisation, and IP/device abuse limits;
- instant in-app notification and configured out-of-band notification;
- every data read/download under emergency mode individually audited;
- no emergency session renewal without a new reason and policy evaluation;
- automatic case creation for trust-and-safety review;
- review SLA and escalation path; flagged cases block new emergency events
  according to policy;
- support path for mistaken scan, wrong patient, or bad record.

### 7.13 AI and cited evidence

AI is a separate safety product, not a decorative summary card.

#### Supported v1 tasks

- document text extraction and structured field candidates;
- patient-scoped search with source snippets;
- chronological grouping and duplicate candidates;
- clinician-facing evidence summary;
- patient-facing plain-language record overview;
- suggested contradiction candidates for human review.

#### Prohibited tasks

- diagnosis, differential diagnosis, triage, severity scoring;
- medication/dose/treatment recommendations;
- declaring a patient safe/normal/clear based on absent data;
- automatic record finalization;
- unsupervised communication of abnormal results;
- using unrelated patient records as retrieval context.

#### Claim contract

Each generated sentence/claim stores:

- generated text;
- summary version;
- model/provider/model version;
- prompt template version;
- retrieval query/policy version;
- source record **version IDs**, document IDs, page references, and source
  hashes;
- generation time and expiry/refresh condition;
- consent scope snapshot used to generate it.

The interface guarantees:

- an evidence chip opens an accessible source;
- a user cannot see a claim whose source is out of current scope;
- a stale summary is labelled and can be regenerated;
- a missing citation prevents display;
- sources say "recorded" or "reported" rather than turning them into a
  medical conclusion.

#### Wording

Default heading: **Evidence summary**  
Subheading: **Generated from records currently available in MediLink; review
original sources before clinical use.**

For clinicians, a compact SBAR export may be available after safety review.
Rename its sections to avoid unsupported interpretation:

- Situation: Recorded critical facts
- Background: Relevant recorded history
- Assessment: Recent documented changes
- Plan: Recorded follow-up / current medicines

The UI must make clear that "Plan" is a factual record of documented plans,
not a recommendation generated by MediLink.

---

## 8. Identity, consent, access, and policy design

### 8.1 Identity lifecycle

Identity errors can be more dangerous than missing data. Implement these
states:

1. **Provisional profile** - created by an authorized facility with minimum
   demographics and source context.
2. **Claim pending** - a patient has initiated account linking.
3. **Claim verified** - appropriate proofing/link procedure has succeeded.
4. **Identity caution** - conflicting identifiers or demographics require
   review; no high-risk write/merge.
5. **Merged** - two profiles are linked through a reversible, audited merge
   decision; source ownership remains traceable.
6. **Split/restored** - an incorrect merge is reversed with full audit.

#### Patient ID format

- Random, non-sequential base32/URL-safe identifier.
- Human-friendly grouping and a check character/checksum for transcription
  errors.
- Never derive from name, date of birth, phone, ABHA, Aadhaar, or database
  primary-key order.
- Do not treat possession as authorization.
- Do not expose it in public logs, analytics, referrers, filenames, or
  unauthenticated URLs.

### 8.2 Patient-present handoff

ID-only lookup is useful but inconvenient in a real consultation. Add a safer
alternative:

1. Patient opens **Share with a clinician now**.
2. App creates an opaque, single-use, short-lived handoff QR/numeric code.
3. Clinician scans/enters it after signing in.
4. Patient sees the named clinician, purpose, requested scope, and duration
   before approving.
5. On approval, the clinician goes directly to the scoped workspace.

This reduces typing errors and avoids treating a static Patient ID as a
password.

### 8.3 Access request data model

Create an explicit table and state machine:

```text
draft -> submitted -> patient_viewed -> approved
                              |             |
                              v             v
                           declined      active_grant
                              |
                              v
                           expired / cancelled
```

`access_requests` includes:

- requester practitioner and organisation membership snapshot;
- patient ID;
- declared purpose and visit/reference;
- requested categories, date window, and duration;
- requester-suggested minimum scope separately from patient-selected scope;
- status, submitted/viewed/responded timestamps;
- patient response/reason;
- policy version and display-copy version;
- correlation ID and audit event IDs.

`consent_grants` includes:

- immutable request reference where created from a request;
- exact approved scope and restrictions;
- requester/grantee identity;
- purpose;
- valid-from and expires-at;
- revoke/expire metadata;
- consent artefact JSON and artefact hash;
- policy version;
- a non-secret receipt/reference code.

### 8.4 Access policy evaluation

Access should be evaluated as a policy decision, not scattered conditionals.
The evaluation inputs are:

- authenticated actor and session assurance level;
- role, credential state, organisation membership, and role permission;
- patient identity state;
- target record/version/category/sensitivity;
- active grant or emergency event;
- declared purpose and task/care relationship;
- time, device/session posture, and rate limit result;
- policy version.

The evaluation output includes:

- allow / deny / step-up-required;
- selected access basis (specific grant or emergency event);
- allowed categories and restrictions;
- reason code suitable for audit;
- user-safe explanation for denials.

### 8.5 Scope model

Use a small set of resource-based disclosure categories:

- identity and demographics;
- problems/conditions;
- allergies and intolerances;
- medications;
- lab results;
- imaging and diagnostic reports;
- procedures and immunizations;
- source documents;
- clinical notes / encounter narratives (off by default in pilot).

Avoid a generic `sensitive` checkbox that maps to nothing. If policy requires
extra protections for data classes, model them as **sensitivity labels** on
records plus explicit policy rules. A sensitive label may further restrict a
resource that is otherwise in an allowed category; it should not create an
unexplainable second universe of access.

Future scope restrictions can add:

- date range;
- named source organisation;
- encounter;
- one-time view;
- patient-present session;
- particular document;
- a purpose-specific policy.

Unknown resource types, unclassified data, and missing sensitivity policy
must fail closed.

### 8.6 Consent versus authoring authority

Separate the following questions in policy and UI:

1. May this verified person/facility create or correct this record as part of
   a documented care/lab workflow?
2. May a patient opt out of keeping that record in their MediLink profile?
3. May another treating party later read it?

The third is the patient-controlled consent interaction. The first two need
jurisdiction- and organisation-specific legal review. Do not make an
unexamined UI assumption that a patient must grant a facility `documents`
scope before the facility can accurately deliver a record created during care.

---

## 9. Data architecture and provenance implementation

### 9.1 Architecture direction

Retain the current modular monolith and Next.js App Router for the pilot.
Change the boundaries:

```text
Browser
  -> Server action / route handler (input parsing, session)
  -> Use-case service (policy decision + transaction)
  -> Domain repository (authorized query/write only)
  -> Postgres / object storage / outbox
  -> Durable worker(s) for OCR, extraction, indexing, notification, anchoring
```

Pages and React components must not construct clinical data queries directly.
All clinical reads go through a named use case that obtains and records an
access decision. This makes authorization reviewable and testable.

### 9.2 Authoritative data entities

Keep existing tables where sensible, but evolve toward the following entities.

| Domain | Required entities | Notes |
|---|---|---|
| Identity | `patients`, `patient_identifiers`, `identity_claims`, `identity_matches`, `patient_merge_cases`, `patient_aliases` | Preserve aliases and every merge/split decision. |
| Providers | `organizations`, `organization_locations`, `memberships`, `practitioners`, `credential_verifications`, `membership_permissions` | Snapshot credential/membership at attestation time. |
| Encounters | `encounters`, `care_relationships` | Records should have an encounter or documented authoring basis where possible. |
| Source documents | `documents`, `document_versions`, `document_derivatives`, `document_page_refs`, `malware_scan_results` | Original bytes are immutable; derivatives are replaceable and labelled. |
| Clinical data | `clinical_resources`, `clinical_resource_versions`, or existing typed tables plus a shared immutable version table | Typed relational projections may remain for fast views, but version identity is canonical. |
| Provenance | `provenance_links`, `attestations`, `signing_keys`, `integrity_checkpoints` | Link every structured field/version to source, author, and seal. |
| Extraction | `extraction_jobs`, `extraction_candidates`, `candidate_evidence`, `review_decisions` | Preserve rejected candidates and reviewer action. |
| Consent | `access_requests`, `consent_grants`, `consent_artifacts`, `access_policy_evaluations` | A grant selects exact policy scope; audit is not the source of truth. |
| Emergency | `emergency_access_events`, `emergency_read_events`, `emergency_reviews` | Event and each read/download are separately traceable. |
| Safety | `data_disputes`, `conflicts`, `safety_cases`, `incident_cases` | Distinguish clinical conflict from identity dispute and security incident. |
| Audit/jobs | `audit_events`, `outbox_events`, `job_runs`, `idempotency_keys` | Every external side effect comes through an outbox. |

### 9.3 Immutable record version design

For each clinical resource:

- allocate a stable resource ID;
- create a new version row for every create/correction;
- canonicalize the version payload with deterministic key ordering;
- calculate `payload_sha256`;
- link source document IDs/page references;
- capture contributor, organisation, credential/membership snapshots;
- record lifecycle status;
- attach attestation metadata;
- make updates to version content impossible at the database permission level;
- materialize "current" projections separately for fast views.

`superseded_by_id` alone is insufficient because it cannot express multiple
versions, correction reason, entered-in-error, patient dispute, or author
attestation.

### 9.4 Document ingestion pipeline

```text
Upload request
  -> validate file/name/type/size and authorize
  -> stream to private quarantine storage
  -> malware scan + MIME signature validation
  -> persist immutable document/version metadata and SHA-256
  -> commit outbox event
  -> durable worker extracts text/OCR into a derived artefact
  -> create candidate fields with page references
  -> reviewer confirms/corrects/rejects candidates
  -> attested structured versions are released
  -> indexing, patient notification, and search projections update
```

Requirements:

- Use direct-to-private-object-storage uploads with short-lived signed upload
  grants for production; do not route large medical files through a server
  action request body.
- Validate magic bytes, not only browser MIME type.
- Quarantine unknown/unscanned files. Never render active content inline.
- PDFs/images must be previewed through a safe, non-executable viewer.
- Store original bytes unchanged and never replace them when OCR is retried.
- Treat OCR and LLM output as untrusted data. Delimit it from instructions,
  validate against schemas, and retain source coordinates.
- Workers are durable and idempotent. Serverless `after()` is useful for
  best-effort work, not the durability mechanism for clinical processing.
- Failure states must be visible and retryable with an operator-readable
  error code.

### 9.5 Search

Search has two distinct modes:

1. **Patient discovery** - ID/verified ABHA/patient-present handoff only;
   no name/phone directory in routine doctor UI.
2. **In-record search** - full-text search only after policy authorization;
   every query constrains patient ID, selected scopes, lifecycle state, and
   sensitivity policy before ranking.

For the pilot, Postgres full-text search is enough. Do not add vector search
because a roadmap says "RAG." Introduce embeddings only after:

- a documented retrieval failure that FTS cannot solve;
- patient/tenant and scope filters are enforced before vector ranking;
- the embedding provider/data-residency/security review is complete;
- deletion/supersession reindexing is implemented;
- a recall, privacy, and red-team evaluation passes.

### 9.6 Audit integrity

Keep the append-only hash chain, but make its limits explicit.

#### Event requirements

Audit every:

- sign-in, MFA, session/device change, and failed high-risk auth;
- patient lookup attempt (privacy-safe metadata only);
- request, consent grant, renewal, decline, revoke, and expiry;
- patient record view, section view, source document view/download, export,
  search, and AI generation;
- clinical write, correction, attestation, document upload/release;
- provider verification/membership/role change;
- emergency start/read/end/review;
- identity claim/merge/split/dispute;
- admin case-evidence access;
- policy/configuration change.

Store actor, subject/patient, target version/resource, access basis, purpose,
decision result, reason code, correlation ID, request metadata minimized for
privacy, timestamp, preceding hash, event hash, and checkpoint ID.

#### Stronger tamper evidence

- Database triggers/permissions prevent application roles from `UPDATE` or
  `DELETE` on audit and version rows.
- Write audit through the same transactional outbox as the originating
  business event; reconcile daily for missing pairs.
- Create periodic signed checkpoint manifests and store them in a separate,
  access-controlled location. Anchor their hash to an independent system
  controlled separately from the primary database.
- Alert on chain/checkpoint mismatch and retain verification results.
- Do not use "blockchain" as a marketing substitute for key management,
  backups, staff access control, and incident response.

### 9.7 Migration from the current schema

Execute in additive, reversible migrations:

1. Add new lifecycle/provenance fields and tables without changing reads.
2. Backfill legacy rows with explicit `legacy_import` provenance and a
   migration source note; do not label them newly attested.
3. Add `access_requests` and dual-write pending requests while retaining the
   old UI temporarily.
4. Add a policy evaluation service and shadow-log decisions against the
   existing access guard.
5. Move clinical read paths to the new authorized repositories one use case
   at a time.
6. Replace the `record_trust` display with provenance facets; retain the
   legacy enum only as a migration input until all rows are backfilled.
7. Replace global "current row" mutation paths with resource-version writes.
8. Remove old name/phone doctor search only after the patient-present handoff
   and assisted-enrollment alternatives are tested.

No destructive migration occurs before backup restore rehearsal and a
rollback plan.

---

## 10. Security, privacy, resilience, and operations

### 10.1 Security baseline

Before a real-patient pilot:

- threat model the patient lookup, consent, document, emergency, AI, and
  admin-case flows;
- use MFA for clinicians, facility administrators, platform administrators,
  and emergency access;
- add short session lifetime, re-authentication for sensitive actions,
  device/session management, suspicious-login detection, and secure recovery;
- rate-limit and monitor identifier lookup, consent requests, source download,
  export, emergency initiation, and authentication;
- use a secrets manager, key rotation process, environment separation, and
  no production secrets in local `.env` files;
- encrypt transport, database storage, backups, and private documents;
- evaluate application-level envelope encryption for documents and especially
  sensitive fields with a managed KMS/HSM and tested rotation;
- keep object storage private; use short-lived, authorization-checked URLs;
- implement malware scanning/quarantine for uploads;
- maintain dependency scanning, SAST, secret scanning, DAST, and an external
  penetration test before launch;
- centralize structured security logging without placing raw clinical content,
  ABHA values, access tokens, or document text in logs;
- rehearse backup restoration, key-loss response, and incident communication.

### 10.2 Defense in depth for authorization

The application access guard is valuable but cannot remain the sole barrier.

Target controls:

1. Server-side policy service is the primary decision point.
2. Authorized repositories take an `AccessContext`; they cannot be called
   with just `patientId`.
3. Database connection roles have least privilege.
4. Where feasible, PostgreSQL RLS/transaction-local viewer context adds a
   second patient/scope constraint. Do not set session context globally on a
   pooled connection.
5. Object/file routes re-evaluate access immediately before issuing a signed
   URL.
6. AI retrieval uses the same authorized repository and its output carries a
   scope snapshot.
7. Test every route/action against cross-patient, cross-organisation,
   post-revocation, expired, and partial-scope cases.

### 10.3 Privacy and data governance

Create and maintain:

- data inventory and data-flow diagrams;
- role-to-data access matrix;
- records retention schedule by resource/document class;
- correction, dispute, access, export, and grievance workflows;
- consent notice copy, version history, and local-language plan;
- processor/subprocessor register and data-residency review;
- breach/incident playbook with responsible owners and notification
  decision tree;
- child/guardian and caregiver authority policy;
- staff confidentiality, access review, and offboarding process;
- production-data access policy requiring just-in-time, case-bound approval.

The existing DPDP checklist is a useful engineering start, but it must become
a continuously owned governance programme rather than a list of UI features.

### 10.4 Reliability

Define and test:

| Area | Requirement |
|---|---|
| Record writes | Idempotent request keys, transaction/outbox, clear final state |
| Jobs | Retry policy, dead-letter queue, operator requeue, duplicate-safe workers |
| Notifications | Delivery status is separate from the clinical event; retry without duplicating event |
| Storage | Checksummed uploads, immutable originals, restore test, signed URL expiry |
| Database | Automated backups, point-in-time recovery where available, restore drills |
| Audit | Daily integrity verification and alerting; checkpoint reconciliation |
| Availability | Graceful read-only/degraded state; do not claim emergency readiness during outage |
| Observability | Correlation IDs across request, audit, job, notification, and UI error |

### 10.5 Production environment

The current free-tier stack can remain a demo environment. It is not the
production plan for sensitive health data.

Before pilot, choose infrastructure based on:

- contractual data processing terms and data residency;
- business-appropriate availability, backup, and support commitments;
- private object storage and malware scanning;
- managed KMS/secrets;
- network isolation and audit capabilities;
- durable jobs/queues;
- monitored incident response.

Document the hosting region and every subprocessor for each deployed
environment. A public demo and a clinical pilot must use separate accounts,
credentials, datasets, telemetry, and access policies.

---

## 11. Design tokens and brand system

### 11.1 Brand

Keep the provenance hexagon as a useful metaphor, but do not turn the logo
into a medical certification mark. The mark means:

> A connected, traceable record path.

The wordmark remains normal text in accessible contexts; decorative alternate
"i" dots belong only in SVG artwork with an accessible name.

Required assets:

```text
app/public/brand/
  logo.svg
  logo-mark.svg
  logo-daylight.svg
  logo-obsidian.svg
  favicon.svg
  app-icon-192.png
  app-icon-512.png
  emergency-card-mark.svg
```

### 11.2 Three-layer token system

Do not put raw colour values directly into component classes.

```css
/* Primitive */
--blue-400: #6badff;
--blue-500: #4d9fff;
--blue-700: #1e6fe0;
--neutral-950: #0a0a0c;

/* Semantic - overridden by Obsidian / Daylight / Print */
--surface-canvas;
--surface-data;
--surface-elevated;
--text-primary;
--text-secondary;
--border-subtle;
--action-primary;
--status-warning;
--status-danger;

/* Component */
--record-row-background;
--evidence-chip-border;
--access-banner-background;
--range-bar-track;
```

### 11.3 Obsidian semantic direction

The original palette remains a candidate, subject to automated contrast
testing:

| Token | Candidate | Use |
|---|---|---|
| `--surface-canvas` | `#0A0A0C` | Page background |
| `--surface-data` | `#101014` | Opaque tables, forms, and record surfaces |
| `--surface-elevated` | translucent neutral | Navigation, menus, transient elevation only |
| `--action-primary` | `#1E6FE0` | Filled primary action |
| `--action-link` | `#6BADFF` | Link/evidence text where contrast passes |
| `--text-primary` | `#EDF1F7` | Primary text |
| `--text-secondary` | `#B6C0CD` | Secondary text |
| `--text-tertiary` | tested muted value | Metadata; never below the applicable text contrast threshold |
| `--status-danger` | `#FF6B6B` | Emergency/critical/error |
| `--status-warning` | `#FFB95C` | Pending/conflict/expiry |

Do not state a contrast ratio in the plan until it is measured for the exact
foreground/background/size combination. Automated tests should reject token
pairs that fail the adopted accessibility standard.

### 11.4 Motion

Motion has one job: clarify change, hierarchy, or time.

- duration tokens: 120 ms, 180 ms, 260 ms;
- easing tokens: standard and emphasize;
- only opacity and transform in interactive/scroll paths;
- no automatic continuous pulsing on emergency/critical content;
- a sealing confirmation may have one subtle line-draw/settle transition;
- timers update text without frantic animation;
- all motion has a reduced-motion equivalent that preserves state change.

### 11.5 Content style

Use calm, concrete copy:

- "Access expires 28 Aug 2026 at 17:30 IST," not "Expiring soon."
- "Original report available. Structured fields have not been reviewed,"
  not "Verified report."
- "No allergy record found in MediLink," not "No allergies."
- "Emergency access was used," not "Your record was breached."
- "Request access," "Review and grant," "Attest and add record," and
  "Correct record" are stable action labels across the product.

---

## 12. Delivery plan

The previous phase ordering starts with a visual redesign. This revised order
starts with safety, policy, and data integrity. Visual foundation work occurs
early enough to avoid rework, but it does not block correctness work.

### Phase 0 - Product safety and pilot definition

**Goal:** turn a compelling concept into an approved pilot boundary.

Deliver:

- clinical-safety charter and named safety owner;
- data-flow map, threat model, abuse cases, and privacy review;
- legal review queue covering consent, authoring authority, retention,
  grievance, guardianship, emergency basis, and data residency;
- initial information architecture and clickable prototype;
- identity/merge policy and patient-present handoff decision;
- provider verification policy, staff role matrix, and organisation membership
  model;
- pilot partner selection and synthetic-data test corpus;
- architecture decision records for durable jobs, storage, KMS, and audit
  checkpoints.

Exit criteria:

- no unresolved P0 decision is hidden behind a UI placeholder;
- clinical-safety and security owners approve the MVP boundary;
- five patients/caregivers and five clinicians complete prototype testing;
- every high-risk workflow has an owner, failure mode, and user-visible
  recovery path.

### Phase 1 - Trust foundation and application shell

**Goal:** establish the design system and the technical boundaries that every
future feature relies on.

Deliver:

- Obsidian, Daylight, Print, reduced-transparency, high-contrast, and
  reduced-motion foundations;
- accessible `AppShell`, navigation, buttons, drawers, dialogs, form states,
  evidence chips, and access banners;
- centralized policy decision interface and `AccessContext`;
- MFA/session/device baseline for privileged roles;
- structured audit event contract and correlation IDs;
- outbox schema and durable worker interface;
- provider membership/permission model;
- patient ID generation/check validation;
- feature flags and environment separation.

Exit criteria:

- keyboard-only and screen-reader smoke tests pass for shell and primitives;
- every new clinical route requires an `AccessContext`;
- tests prove no clinical page queries raw records directly;
- Daylight/Obsidian contrast and forced-color checks pass;
- audit events and business events reconcile in integration tests.

### Phase 2 - Identity and controlled discovery

**Goal:** eliminate wrong-patient and directory-enumeration assumptions.

Deliver:

- patient identifier schema and claim flow;
- identity confidence state, duplicate candidate queue, merge/split case model;
- ID/verified-ABHA lookup endpoint with rate limit, abuse logging, and
  no-pre-consent disclosure response;
- patient-present QR/numeric handoff;
- corrected doctor **Find patient** flow;
- assisted enrollment/claim workflow;
- tests for enumeration, wrong patient, token replay, QR expiry, and
  pre-consent data leakage.

Exit criteria:

- no doctor name/phone directory path remains in normal UI/API;
- a user cannot learn a patient's name, phone, DOB, city, record count, or
  clinical fact from an identifier before authorization;
- handoff tokens are opaque, single-use, short-lived, and cannot be replayed;
- merge/split test cases preserve all original provenance.

### Phase 3 - Immutable documents, records, and correction

**Goal:** make the evidence model real before making it beautiful.

Deliver:

- document quarantine, storage, malware scan integration point, original
  hashing, versioning, and safe preview;
- durable extraction job pipeline and page-level candidate evidence;
- record version/attestation schema and canonical payload hashing;
- encounter-context record authoring;
- structured high-value record forms;
- correction, entered-in-error, supersession, and patient dispute flows;
- provenance drawer and source-document link;
- record/document indexing through outbox events.

Exit criteria:

- original document bytes are unchanged after retry/re-extraction;
- an attested structured record can be traced to author, organisation,
  source/page, version, and payload hash;
- correction creates a new version rather than mutating the old one;
- all document/record writes are idempotent and have audit/outbox events;
- source preview respects current authorization at open time.

### Phase 4 - Explicit consent and auditable disclosure

**Goal:** make patient control understandable and enforce it everywhere.

Deliver:

- `access_requests`, `consent_grants`, consent artefacts, and policy
  snapshots;
- patient request inbox and active-grant management;
- granular scope selection without preselected acceptance;
- expiry, renewal, revocation, decline, concern report, and download/export
  of the consent receipt;
- access banner in professional workspaces;
- per-read/view/download audit events;
- authorization re-check before source URL issue and AI retrieval.

Exit criteria:

- all clinical reads, documents, exports, search, and AI use selected grant
  or emergency event ID;
- revoked and expired grants fail immediately in integration tests;
- patient usability study demonstrates comprehension of who/purpose/scope/
  expiry/exclusions;
- admin cannot casually read clinical data;
- no active request/grant is represented only by an audit log.

### Phase 5 - Doctor and lab workflow wedge

**Goal:** prove that the product saves time for real care work.

Deliver:

- My Patients list with scope/expiry/new-since-reviewed;
- patient workspace critical facts, record timeline, documents, lab view, and
  Add record in context;
- evidence summary v1 from deterministic, scoped data;
- lab work queue, upload/match, review/correct/attest/release;
- range bars with source-aware safeguards;
- operational exceptions: failed extraction, source unavailable, duplicate
  warning, and patient identity caution.

Exit criteria:

- realistic synthetic-patient usability sessions show clinicians can locate
  critical facts and open evidence within target time;
- every released extracted lab observation has reviewer and page evidence;
- no lab batch operation can accidentally attest multiple clinical reports;
- analytics capture workflow timing without clinical-content leakage.

### Phase 6 - Patient record and emergency artefacts

**Goal:** give patients a useful, comprehensible product without overstating
what is known.

Deliver:

- patient Home, Health record, Access, Emergency, Profile/data routes;
- coverage/freshness language and no-false-negative copy;
- emergency card with opaque QR and print/wallpaper/export controls;
- ICE contact management and emergency-profile preview;
- record export and dispute initiation;
- notification preference centre.

Exit criteria:

- patients can distinguish patient-reported, source-derived, reviewed, and
  corrected data in testing;
- emergency card scan cannot expose data without verified clinician
  authentication and emergency confirmation;
- print output is readable and contains no hidden interactive-only
  assumptions;
- account and emergency contact updates are audited.

### Phase 7 - Emergency policy release

**Goal:** release only after the exceptional access workflow is operationally
safe, not merely implemented.

Deliver:

- MFA/step-up emergency initiation;
- opaque QR verifier and high-assurance emergency policy;
- minimal emergency profile;
- session countdown/end control;
- patient notification channels and delivery status;
- trust-and-safety case queue, reviewer SLAs, abuse detection, and escalation;
- tabletop exercise with clinicians, support, security, and pilot facility.

Exit criteria:

- emergency scenario passes tabletop and browser simulation with no
  unauthorized broad record access;
- every emergency read is auditable and appears in the patient log;
- reviewer workflow has owners and measured SLA;
- a failed notification is visible to operations and does not falsely claim
  success to the patient.

### Phase 8 - AI assistance, carefully

**Goal:** add useful evidence navigation only after source and access models
are mature.

Deliver:

- source-bound deterministic summary;
- AI extraction candidate evaluation;
- citation contract, scope snapshot, prompt/model version metadata, and stale
  summary policy;
- red-team suite for hallucination, prompt injection, cross-patient retrieval,
  unsupported negative statements, and scope leakage;
- model fallback and provider outage behaviour;
- clinical-safety review and clinician feedback loop.

Exit criteria:

- 100% displayed claims resolve to sources the current user may access;
- no unsupported recommendation appears in adversarial evaluation;
- source documents with malicious instructions cannot alter system behavior;
- clinician evaluation confirms the summary is useful but not treated as a
  substitute for source review.

### Phase 9 - Interoperability and ABDM spike

**Goal:** validate interoperability without putting the core product at the
mercy of an unfinished integration.

Deliver:

- adapter interface for ABHA, provider/facility registry, consent artefacts,
  HIP/HIU exchange, and FHIR/NRCES mapping;
- sandbox-only proof of one selected exchange path;
- conformance mapping and gap log;
- user consent and error UX for any external exchange;
- integration monitoring, idempotency, retry, and reconciliation design.

Exit criteria:

- official sandbox test cases pass for the chosen milestone;
- every inbound/outbound payload has a mapping version and correlation ID;
- external failure does not block local record access or corrupt state;
- legal/privacy review approves the production onboarding plan.

### Phase 10 - Marketing and brand launch

**Goal:** explain the product honestly after its guarantees exist.

Deliver:

- final logo, asset system, and accessible brand implementation;
- marketing page built around a real evidence journey, not generic glass;
- security/trust page with plain-language explanation of consent,
  provenance, corrections, and emergency access;
- "What MediLink does not do" section;
- synthetic record demo only;
- performance budget and reduced-motion fallback for any 3D explainer.

Exit criteria:

- no marketing claim says "complete," "tamper-proof," "universal," or
  "verified" beyond what the product can prove;
- marketing facts have an owner and review date;
- 3D is lazy-loaded, optional, and does not affect portal performance.

---

## 13. Quality gates

Every phase has a release checklist; no feature is "done" because it renders.

### 13.1 Engineering gates

- TypeScript strict build, lint, unit tests, integration tests, and production
  build pass.
- Server actions/routes validate input with schemas and reject unknown fields.
- Idempotency tests cover all write and external side-effect paths.
- Database migration is tested against a production-like backup copy and has a
  documented rollback/forward-fix path.
- No raw clinical database query appears in React page components.
- No clinical route bypasses authorization context.
- Dependency, license, secret, and static security scans pass.
- Performance budgets are measured: LCP/INP/CLS for marketing and record
  workspace; large documents/3D do not block first useful content.

### 13.2 Security and privacy gates

- Cross-patient, cross-organisation, partial-scope, post-revocation,
  expired-grant, stale-session, and emergency-boundary tests pass.
- Patient lookup enumeration/replay/rate-limit tests pass.
- File upload abuse suite covers MIME spoofing, path traversal, oversized
  file, polyglot file, malware-scan failure, and unscanned preview denial.
- Audit chain/checkpoint verification passes and intentional tampering is
  detected.
- Logs, error reports, analytics, and screenshots are reviewed for PHI/PII.
- Penetration test findings are resolved or formally risk-accepted by an
  accountable owner before real-patient launch.

### 13.3 Clinical-safety gates

- Synthetic "golden patient" set covers allergy conflict, wrong blood group,
  stale medication, unit mismatch, lab range mismatch, duplicate person,
  scanned unreadable report, correction, and emergency access.
- Clinical reviewer signs off on critical-fact terminology, source labels,
  lab interpretation wording, and emergency data set.
- AI evaluation checks citation validity, source faithfulness, scope isolation,
  missing-data wording, and non-recommendation constraints.
- No clinician-facing UI treats machine extraction as human attestation.

### 13.4 UX and accessibility gates

- Keyboard-only workflows: sign in, lookup, consent decision, document
  review, record attestation, revocation, and emergency access.
- Screen-reader smoke tests for landmark structure, form labels/errors,
  dynamic updates, drawers/dialogs, range-bar text equivalents, and audit
  tables.
- WCAG 2.2 AA target, including focus appearance and target size, verified in
  Obsidian, Daylight, solid/reduced-transparency, and forced-colors modes.
- Desktop 1280 px, laptop 1024 px, tablet 768 px, and mobile 390 px browser
  tests for every changed workflow.
- Empty, loading, partial, stale, offline/degraded, permission-denied, and
  error states are designed and tested.
- Moderated usability test evidence is required for consent, identity,
  emergency card, and lab verification changes.

---

## 14. Initial implementation backlog

This is the recommended next sequence in the existing repository.

### A. Documentation and decisions

- [ ] Mark this file as the proposed successor to `docs/BUILD-PLAN.md`; do
      not silently replace the earlier plan until owners approve it.
- [ ] Add ADRs for patient ID semantics, identity merge policy, provenance
      facets, authoring authority versus disclosure consent, durable jobs,
      audit checkpoints, and Daylight theme.
- [ ] Update `docs/DPDP-CHECKLIST.md` into owned workstreams with accountable
      owner, evidence, review date, and legal dependency.
- [ ] Add a clinical-safety risk register and abuse-case catalogue.

### B. P0 data/policy work

- [ ] Introduce `access_requests` and an explicit state machine.
- [ ] Add consent artefact/policy-version storage and selected-grant audit
      references.
- [ ] Build `AccessContext` and policy-evaluation result types; migrate one
      read path at a time.
- [ ] Remove patient name/phone search from doctor discovery after a
      patient-present handoff path exists.
- [ ] Add patient identity caution, claim, duplicate, merge, and split data
      structures before claiming a universal identity.
- [ ] Decompose `record_trust` into source, author credential, review,
      lifecycle, and integrity information.
- [ ] Add immutable clinical resource versions and attestation records.

### C. P0 file/job/security work

- [ ] Replace inline production extraction with a durable, idempotent job
      mechanism and outbox.
- [ ] Add source document quarantine, magic-byte validation, scan state, and
      safe preview policy.
- [ ] Bind every signed file URL to a fresh policy decision and short expiry.
- [ ] Add MFA/step-up requirements for privileged and emergency actions.
- [ ] Add rate-limit instrumentation for lookup, access request, document
      export, and break-glass.
- [ ] Add external checkpointing to audit integrity plan.

### D. P1 feature work

- [ ] Rebuild the patient Access page around pending requests/active grants,
      scope exclusions, exact expiry, and consequence-aware revocation.
- [ ] Rebuild the doctor patient page with sticky Access Banner, Patient
      Context Bar, evidence-backed critical facts, and contextual Add record.
- [ ] Build provenance drawer with version and page-level sources.
- [ ] Build lab review queue with candidate field evidence and individual
      attestation.
- [ ] Implement range bars only after unit/range compatibility logic exists.
- [ ] Create correction/dispute user flows.

### E. P1 design work

- [ ] Establish semantic token layers and Daylight mode.
- [ ] Add `Reduce transparency`, forced-colors, and contrast test harness.
- [ ] Refactor existing `Card` usage so record data surfaces are flat/opaque;
      use glass only in the shell and transient layers.
- [ ] Replace broad decorative badges with evidence/status components that
      state their meaning.
- [ ] Preserve the existing strong "clinical evidence" visual language where
      it improves readability; do not redesign working secure components only
      to chase a glass trend.

---

## 15. Open decisions requiring accountable review

These questions must be answered before the relevant release. Engineering can
prototype with feature flags and synthetic data, but must not silently invent
production policy.

1. What exact proofing process links a patient login to a provisional profile?
2. Who is allowed to create a patient profile, under what minimum data, and
   how is mistaken creation corrected?
3. What legal/policy basis permits provider contribution versus patient
   disclosure to a future provider?
4. Which record categories need extra sensitivity restrictions?
5. What data retention, correction, deletion, and grievance rules apply to
   each record class and pilot partner?
6. What provider registry/credential verification can be relied on, how often
   is it refreshed, and what happens when a credential expires?
7. What exact emergency data set, MFA policy, event duration, review SLA, and
   patient-notification fallback do pilot clinicians approve?
8. What languages and literacy/accessibility needs are required for the pilot?
9. Which infrastructure and subprocessors meet the pilot's contractual
   requirements for health data, backups, incident support, and region?
10. What ABDM integration milestone offers real pilot value, and what official
    onboarding credentials/terms are required?
11. What clinical safety governance reviews AI extraction and summary changes?
12. Which patient support channel handles locked accounts, false identity
    matches, record disputes, and emergency-access concerns?

---

## 16. Research and standards to validate at implementation time

The following are the primary sources and frameworks that should be reviewed
again before each production-facing decision. They are not a substitute for
legal, security, or clinical review.

- Government of India / MeitY: Digital Personal Data Protection Act, 2023 and
  the currently applicable Digital Personal Data Protection Rules:
  `https://www.meity.gov.in/`
- Ayushman Bharat Digital Mission (ABDM), Health Data Management Policy,
  developer sandbox, consent/exchange documentation, and provider/facility
  registries:
  `https://abdm.gov.in/`
  `https://sandbox.abdm.gov.in/`
- National Resource Center for EHR Standards / India EHR standards and
  implementation guidance:
  `https://www.nrces.in/`
- CERT-In Directions and current incident-reporting guidance:
  `https://www.cert-in.org.in/`
- HL7 FHIR R4, especially Provenance, DocumentReference, Composition,
  Observation, Consent, and AuditEvent:
  `https://hl7.org/fhir/R4/`
- W3C Web Content Accessibility Guidelines 2.2:
  `https://www.w3.org/TR/WCAG22/`
- OWASP Application Security Verification Standard:
  `https://owasp.org/www-project-application-security-verification-standard/`
- WHO guidance on ethics and governance of AI for health:
  `https://www.who.int/publications/i/item/9789240029200`
- AHRQ TeamSTEPPS SBAR communication tool:
  `https://www.ahrq.gov/teamstepps/index.html`

For every integration, record the exact document version, access date,
interpretation, owner, and resulting ADR. External policies and APIs change;
the implementation must not rely on an old research note as a live contract.

---

## 17. Definition of done for the first real-patient pilot

MediLink is ready for a constrained real-patient pilot only when all of the
following are true:

1. A patient can be safely identified, claim their record, and understand
   what MediLink contains and does not contain.
2. A verified clinician can discover a patient through an approved ID/handoff
   flow without directory leakage.
3. The patient can review, narrow, approve, decline, and revoke a request
   with clear comprehension of who/purpose/scope/time.
4. The clinician can open only the authorized categories and can identify
   critical facts, conflicts, freshness, and evidence quickly.
5. A lab can upload an immutable original, review structured candidates
   against the original, and attest an accurate release.
6. A correction creates a visible linked version; a patient can raise a
   dispute without losing evidence.
7. Every high-stakes displayed item has provenance and every AI claim has
   source evidence available to the current viewer.
8. Emergency access is minimal, step-up authenticated, time-boxed,
   notified, audited per read, monitored, and reviewed by an operating team.
9. Cross-patient, cross-organisation, scope, revocation, identity, document,
   AI, and emergency abuse tests pass.
10. Backup restore, audit verification, incident response, and support
    escalation have been rehearsed.
11. Legal, clinical-safety, security, and pilot-organisation owners sign the
    release record.

Only then should the marketing message make a focused, honest promise:

> Your health history can travel with you - with your permission, clear
> evidence, and a record of who accessed it.
