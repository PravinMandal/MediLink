# UX Audit — portal & components vs BuildPlan §6/§7/§11/§13.4 (2026-08-25)

Method: direct code inspection of all portal pages, shell, and component
library (the delegated UX agent was lost to API rate-limiting; scope covered
first-hand this session). Line refs as of this tree.

## A) Component inventory (plan §7.5)

| Component | Status | Notes / evidence |
|---|---|---|
| AppShell | ✅ | portal-shell.tsx: skip-link, glass-shell header (solid under reduce-transparency), theme toggle, bell, aria-current nav, 44px mobile targets |
| Button | ✅ | ui.tsx buttonVariants primary/secondary/ghost/danger + sizes; SubmitButton shows spinner + pendingLabel + aria-busy |
| EvidenceChip | ✅ | evidence-chip.tsx; states: disputed/corrected/superseded/entered_in_error/needs_review + trust styling; opens ProvenanceDrawer |
| ProvenanceDrawer | ✅ | dialog semantics, Escape close, real focus trap cycling Tab (evidence-chip.tsx:104-116), source link, hash fragment, version history, dispute entry point |
| AccessBanner | ✅ | doctor workspace sticky banner: purpose, scopes, exact expiry, renewal link, emergency red variant |
| PatientContextBar | ✅ | name + Patient ID + "← Leave patient record" escape (patients/[id]/page.tsx ~210-220) |
| RangeBar | ✅ | compatibility gate renders only numeric value+range+unit; accessible text fallback; 7 tests |
| AuditRow | 🟡 | admin audit stream shows actor/action/patient/time; missing correlation-ID column and saved filters |
| DataState | ✅ | EmptyState everywhere; per-route error.tsx/loading.tsx on every portal page; RouteError/RouteSkeleton shared |
| SealDialog | 🟡 | lab attestation footer = explicit confirm checkbox + plan-verbatim attestation text; doctor add-record saves without an equivalent final review dialog |
| IdentityConfirmation | 🟡 | identity-caution blocks writes (policy layer); no explicit demographic confirmation UI before high-risk writes |

## B) Worst UX offenders (ranked by user impact)

1. **Doctor "Add record" lacks a final review/seal dialog** (doctor-forms.tsx
   AddRecordForm submits directly). Plan §7.10 steps 3–4 call for a
   human-readable review + attest step. Redesign: two-step form → review card
   ("You are adding X to patient Y") with ATTESTATION_TEXT confirm.
2. **10px type in interactive/secondary contexts** — 17 occurrences of
   `text-[10px]` outside the print-only emergency card (notification bell
   timestamps notification-bell.tsx:128, role chip portal-shell.tsx:91,
   citation chips interactive.tsx:92). Below the 14px dense-table minimum of
   §7.4. Fix: raise to ≥11px for non-data chips, 12px for timestamps.
3. **`text-ink-faint` used 106×**, some for actionable-adjacent copy. Token
   contrast passes AA (5.77:1 light / 6.58:1 dark) but faint-on-tint
   combinations (e.g. inside amber alerts) should be audited per-surface;
   standardize secondary→ink-soft for anything users must act on.
4. **Mobile nav is a scrollable strip, not the §7.1 five-item bottom bar**
   (portal-shell.tsx:111). Patient role has 7 destinations horizontally
   scrolled; plan calls for ≤5 fixed bottom items w/ safe-area-inset. Deep
   redesign candidate; current strip does pass tap-target sizing.
5. **Admin audit table has no correlation-ID column or filters** — §7.5
   AuditRow requires them; reviewers currently can't trace a request across
   events. Add column + filter chips (quick win).
6. **Consent grant form defaults 5 scopes pre-checked** (consent-forms.tsx
   SCOPES `default: true`). For direct grants (not request-driven, which
   correctly has zero preselection) this nudges over-sharing; consider
   unchecked-by-default with an explicit "select what they need" nudge.
7. **Emergency profile page issues a new token row on first visit then reuses
   it** — good — but the "Replace code" affordance sits next to Print with
   only a JS confirm; a destructive-ish action pair that close together risks
   misclicks (emergency page actions row). Add spacing + icon differentiation.
8. **Doctor lookup result for `record_may_exist` shows only a text message**
   (patient-search.tsx); the request-access form is one click away but the
   state change could be more visually distinct from plain failure states.
9. **Org console empty states for unverified facilities** could better route
   to verification status instead of generic empties (org/page.tsx).
10. **Timeline density**: comfortable default is right per §7.7, but the
    compact/comfortable toggle promised as the low-risk alternative to
    semantic zoom hasn't shipped.

## C) Visual inconsistencies

- Glass discipline holds: `.glass-shell` only on headers; all data surfaces
  opaque `.card`. No violations found.
- Badge tones consistent (pine/amber/alert/info/neutral with text labels);
  no color-only status found.
- Minor: mixed radii (`rounded-lg` dominant, occasional `rounded-[3px]`,
  `rounded-full` chips) — acceptable system, but chip radius could be
  tokenized.
- Marketing uses display serif at large sizes while portal caps at 34px —
  intentional split per §7.4; fine.

## D) Journey friction log

- **Patient approves request**: excellent — who/why/see/not-see/duration/
  decline-consequence ordering, zero preselection, narrowing supported,
  receipt shown. No dead ends found.
- **Doctor finds patient → adds record**: lookup → request flow solid;
  friction is #1 above (no final review before write) and that the
  request-granted path lands the patient on the doctor home list only after
  approval (no in-product signal beyond the bell).
- **Lab upload → review → attest**: strong; queue position context, iframe
  preview via authorized route, per-field candidates, mandatory confirm,
  unable-to-verify path. Friction: keyboard-first navigation for high-volume
  review (§7.11) isn't specialized yet.
- **Emergency initiation**: step-up password enforced, reason length checked,
  rate-limited, flagged-blocks-rearm, patient notified in-app + email when
  configured. Friction: step-up prompt appears inline after submit rather
  than up-front on first use.
- **Revoking a grant**: immediate + audited (ownership now enforced);
  consequence preview present on the access centre cards.
- **Correcting a record**: inline correct-record form with mandatory reason;
  superseded original remains viewable; dispute entry point adjacent. Good.

## E) Quick wins vs deep redesign

Quick wins (≤ half-day each):
1. Raise sub-12px type to ≥11–12px in bell/shell/chips.
2. Add correlation-ID column + basic filters to admin audit table.
3. Space/differentiate Replace-code vs Print on emergency page.
4. Compact/comfortable timeline toggle (density prop on ClinicalList).
5. Make `record_may_exist` lookup state visually distinct (info panel style).

Deep redesigns (schedule deliberately):
A. Mobile bottom-bar navigation ≤5 items with safe-area support (§7.1) —
   requires IA consolidation of patient destinations.
B. Add-record review-and-seal dialog (§7.10 steps 3–4) across all record kinds.
C. Keyboard-specialized lab review layout (j/k field navigation, sticky zoom).

Marketing claims: quantified band and preview section avoid the forbidden
words; "0 records readable without consent" scoped to product enforcement —
compliant with §17 honesty bar.
