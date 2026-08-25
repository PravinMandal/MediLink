# ADR-0007: Daylight theme as an operational requirement

- **Status:** Proposed (August 2026, per root `BuildPlan.md`)
- **Date:** 2026-08-24
- **Deciders:** Design lead; Product owner — unassigned

## Context

The original plan treated a dark-only product as acceptable, with "light mode
is not shipping". The August 2026 review (BuildPlan §2, P1) rejects this as
an accessibility fallback problem: clinical work happens under bright ambient
light, on low-quality displays, and on printed handoffs. Glass/transparency
treatments add contrast and privacy risks of their own (legible information
behind an overlay).

## Decision

1. **Ship three themes from the foundation phase** (BuildPlan §7.2, Phase 1):
   - **Obsidian** — default dark brand environment;
   - **Daylight** — an opaque light operational theme for bright clinics and
     visual comfort, treated as an operational requirement, not a nice-to-have;
   - **Print** — paper-first, high-contrast exported artefacts.
2. **Reduce transparency is independent of theme:** it switches elevated
   panels to solid surfaces, persists per user, and is honoured together with
   `prefers-reduced-motion`, `prefers-contrast`, and forced-colors modes.
3. **Semantic token layers** (primitive → semantic → component) so themes
   override meaning, not aesthetics; contrast semantics must not silently
   change between modes.
4. **Glass budget** (BuildPlan §7.1): glass is a restrained elevation
   treatment for the shell and transient layers only; core clinical data is
   always on opaque, high-contrast surfaces, with an opaque
   `backdrop-filter` fallback.

## Consequences

- Every component must be checked in each shipped mode; WCAG 2.2 AA is
  verified in Obsidian, Daylight, reduced-transparency, and forced-colors
  modes (BuildPlan §13.4).
- Daylight-mode contrast checks are a Phase 1 exit criterion; brand assets
  include `logo-daylight.svg`.
- The glass/transparency accessibility risk is tracked in the risk register
  (CS-10).
