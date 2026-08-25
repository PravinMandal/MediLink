# UI Consistency Findings — MediLink Portal (post-redesign audit)

Date: 2026-08-25 · Scope: all pages under `src/app/portal/**` + their components (`src/components/**`). Read-only audit; no files modified.

## Verdicts on the flagged defect classes

| Check | Verdict |
|---|---|
| Dead links (href vs. actual routes) | **Clean.** Every internal link in `*.tsx` resolves to a real route folder (incl. `[id]`, `[documentId]` dynamics). See stale-route rows below for redirect-only targets. |
| Old surface pattern `bg-paper-raised/70 + backdrop-blur-*` | **Clean.** Zero occurrences. `.frost` / `.frost-strong` / `.glass-hover` / `.glass-shell` defined in `globals.css:357–616` with transparency-toggle fallbacks. Solid `bg-paper-raised` on buttons/inputs/cards is correct token use, not the old pattern. Only `backdrop-blur-xl` left is `src/components/ui/shader-hero.tsx:85,138` (white/black glass over shader hero — marketing asset, intentional). |
| Hardcoded hex colors in tsx | **Clean.** Zero hex literals anywhere under `src/**/*.tsx` (the brand/error exclusions aren't even needed). |
| Stale `/portal/patient/timeline` refs | **Found — 2**, both in `api/worker/route.ts`. Details below. |
| PageHeader `title` / icon-button a11y | **Clean.** `title` is a required TS prop (`ui.tsx:298–307`) and every usage passes it; all icon-only controls checked (notification-bell, theme-toggle, filter chips, drawer closes) carry `aria-label`s or visible text. |

## ThemeToggle reachability (flagged bug candidate #5) — VERIFIED NOT A BUG

The toggle is mounted **only** via the `notificationBell` slot, but that slot renders on **both** breakpoints, so it is reachable everywhere:

- `src/app/portal/layout.tsx:31–33` — `<ThemeToggle />` + `<NotificationBell />` wrapped in a fragment passed as `notificationBell`.
- Desktop: `src/components/portal-shell.tsx:280–285` — header strip renders `{notificationBell}` inside a `pointer-events-auto absolute right-6 top-4` container (rail itself has no toggle).
- Mobile: `portal-shell.tsx:246–253` — sticky top bar renders `{notificationBell}` next to the brand link.
- Redundant path: every role's "Profile & themes" page embeds full `<ThemeSettings />` (patient/doctor/org profile pages).

Residual nits (low/info): the desktop toggle floats over page content at viewport top-right with `z-20` and can visually collide with wide `PageHeader action` areas; discoverability depends on noticing the floating strip. Consider promoting theme/transparency toggles into the rail footer alongside sign-out.

## Findings table

| file:line | class | finding | severity | fix direction |
|---|---|---|---|---|
| `src/app/portal/admin/roles/page.tsx:17–36` | Scope/gating | **Missing `platform_admin` gate.** Only `requireUser()` (auth-only, `server/session.ts:30–32`) — unlike every sibling admin page which gates. Any signed-in user hitting `/portal/admin/roles` gets the GrantRoleForm **plus up to 200 users' names + emails** (`grantableUsers` selects `email`). Server action is safe (`setUserRoleAction` → `requireAdmin()`, `admin-actions.ts:102`), so this is a directory-PII leak, not escalation. | **High** | Add the same `user.role !== "platform_admin"` restricted branch used by `admin/page.tsx`; drop `email` from the select or fetch users client-side post-gate. |
| `src/app/portal/doctor/patients/[id]/page.tsx:493–515` | Scope/gating (tabs) | **Contribute tab renders write forms during emergency (break-glass) access** — gated only by practitioner verification, ignoring `viaEmergency`. Server side, clinical writes *pass* under the emergency basis (`policy.ts:224–245`, `EMERGENCY_SCOPES` = demographics/conditions/allergies/medications/lab_results, `policy.ts:27–33`) while the red banner promises "critical scopes only"; `UploadDocumentForm` can **never succeed** because `documents ∉ EMERGENCY_SCOPES` — a guaranteed-failing form is offered mid-emergency. | **High** | Hide Contribute tab when `viaEmergency` (or render a read-only notice); if emergency writes are intended, update banner copy and exclude documents explicitly. |
| `src/app/portal/admin/audit/page.tsx:101–136` | EmptyState | Event-stream list page has **no EmptyState**: with `audit.recent(60) === []` the Card shows a bare header "Recent (0)" over an empty scrollable `<ul>`; the checkpoint strip (`:84–99`) also renders nothing when empty. Fresh-install/low-traffic deployments hit this. | Medium | Wrap the `<ul>` in `{recentAudit.length ? … : <EmptyState title="No events yet" …/>}` like admin/verification does. |
| `src/app/portal/doctor/patients/[id]/page.tsx:388–401` | Scope/gating (tabs) | Tab-strip gating is **inconsistent between access modes**: emergency mode computes `allowed` from `EMERGENCY_SCOPES` (dims Documents tab), but consent mode hardcodes `allowed: true` for every tab — out-of-scope Labs/Documents tabs render enabled and only reveal an "outside consent scope" EmptyState after a click. Same data, two different gating idioms. | Medium | Compute `allowed = t.scopes.every(s => scopes.includes(s)) || t.scopes.length === 0` for both modes so the strip matches the panels. |
| `src/server/actions/../api/worker/route.ts:74,94` (file: `src/app/api/worker/route.ts`) | Stale route | Background-worker notifications set `link: "/portal/patient/timeline"` — a redirect-only stub (`patient/timeline/page.tsx:15` → `/portal/patient/record`). Patients tapping these bell/inbox items take a pointless redirect hop. | Low | Emit `/portal/patient/record` directly. |
| `src/components/portal-shell.tsx:80–81, 90–91` | Stale route | Nav items for `lab_staff`/`org_admin` point "Upload" at `/portal/org/upload`, which is a 6-line redirect stub to `/portal/org#upload` (`org/upload/page.tsx:5`). Every click bounces through a redirect. | Low | Point nav at `/portal/org#upload` (anchor exists, `org/page.tsx:165`) and delete the stub. |
| `src/components/section-tabs.tsx:45–63` | A11y / consistency | "Disallowed" tabs get `aria-disabled` + `opacity-40` but stay real `<Link>`s — keyboard/AT users are told disabled, then activation navigates anyway (to an out-of-scope panel). Comment acknowledges the choice; interaction contradicts the semantics. | Low | Render disallowed tabs as non-navigating (omit `href`/use `<span role="tab">`), or drop `aria-disabled` since navigation is intended. |
| `src/app/portal/org/page.tsx:129,159–161` (+ `src/components/lab-review.tsx:64–69`) | EmptyState pattern | Zero-data fallbacks are plain-text `<li>`s ("No staff attached yet.", "No uploads yet.", queue text) instead of the shared `EmptyState` component used on every other list surface — visual pattern drift within the same redesign. | Low | Swap the three inline fallbacks for `<EmptyState />`. |
| `src/app/portal/org/page.tsx:171–185` | EmptyState pattern | Consent-registry card is **omitted entirely** when `consentedPatients.length === 0` — the only list section in the portal that vanishes instead of explaining its emptiness. | Low | Always render the Card with an EmptyState body ("No patients have granted document consent yet"). |
| `src/components/portal-shell.tsx:280–285` | Layout/a11y polish | ThemeToggle+bell float unanchored over page content at top-right (`absolute right-6 top-4`, `z-20`, container `h-0`); wide `PageHeader action` blocks can slide underneath it. Functional today, fragile tomorrow. | Low | Give the desktop strip real height/flex row aligned with the rail brand bar, or move toggles into the rail footer. |
| `src/components/ui/shader-hero.tsx:85,138` | Surface pattern (exception) | `backdrop-blur-xl` on `bg-black/20`/`bg-white/10` glass chips over the shader hero — marketing hero asset, deliberately not `.frost` (which keys off paper tokens). Documented exception, no action. | Info | None (keep exempt from frost migration). |
| `src/app/portal/patient/page.tsx:141` | Surface pattern (nit) | `bg-paper-sunk/60` translucent coverage-note strip without a frost class — the lone opacity-modified surface token in the portal. Renders fine (no blur expected), just off-pattern. | Info | Use solid `bg-paper-sunk` or `.frost`. |
| `src/app/portal/admin/audit/page.tsx:141–144` | Housekeeping | Dead imports kept alive via `void emergencyAccessEvents; void practitioners; void eq;` with a TODO comment — noise in a shipped page. | Info | Delete the imports and the `void` block. |

## Severity counts

| Severity | Count |
|---|---|
| High | 2 |
| Medium | 2 |
| Low | 6 |
| Info | 3 |
| **Total** | **13** |

## Top 5

1. **Admin roles page ungated** (`admin/roles/page.tsx`) — any authenticated user can load the role-grant console and the user directory (names + ~200 emails); only the submit action is protected.
2. **Break-glass Contribute tab** (`doctor/patients/[id]/page.tsx:493–515`) — emergency sessions are offered write forms; uploads are guaranteed to fail server-side, contradicting the "critical scopes only" banner.
3. **Audit trail has no EmptyState** (`admin/audit/page.tsx:101–136`) — the flagship integrity page shows a bare empty list on fresh deployments.
4. **Tab gating differs by access mode** (`doctor/patients/[id]/page.tsx:388–401`) — consent mode leaves every tab enabled while emergency mode dims out-of-scope ones; unify on the same `allowed` predicate.
5. **Stale timeline links from the background worker** (`api/worker/route.ts:74,94`) — patient notifications still deep-link the retired `/portal/patient/timeline` route.

## Clean bill of health (explicitly verified)

- All internal hrefs across `src/app` + `src/components` resolve to real routes; `not-found.tsx` → `/portal` valid.
- No `bg-paper-raised/70`, no `backdrop-blur-*` on paper surfaces, no hex color literals in tsx.
- `PageHeader.title` enforced by types and always provided; icon-only buttons labeled (bell, theme, transparency, drawer closes, filter chips).
- EmptyStates present on: patient dashboard/record/documents/access-history/consents, doctor home/patients/inbox, patient workspace tabs (summary search, timeline, labs, documents), admin verification/emergency queues.
- Doctor workspace reads are correctly scope-filtered end-to-end (glance tiles, scoped summary fetch, server-filtered timeline, fail-closed labs/documents panels).
