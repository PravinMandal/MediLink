# Design Principles — Distilled Reference

Reference notes distilled from the seven resources studied before building.
Applies to every phase: design direction → structure → build → motion → review → audit.

---

## 1. Anthropic Frontend Design (primary design-thinking guide)

Act as the design lead of a small studio known for unmistakable visual identities.

- **Ground the design in the subject.** Before designing, pin down: the concrete subject, its audience, and the page's single job. Distinctive choices come from the subject's own world — its materials, instruments, artifacts, vernacular.
- **The hero is a thesis.** Open with the most characteristic thing in the subject's world (headline, image, animation, live demo, interactive moment). A big number + small label + stats + gradient accent is the *template answer*.
- **Typography carries the personality.** Pair display and body faces deliberately — not the same families used on every project. The type treatment itself should be memorable.
- **Structure is information.** Numbering (01/02/03), eyebrows, dividers must encode something true (a real sequence, process, or timeline) — never pure decoration.
- **Motion is deliberate.** One orchestrated moment lands harder than scattered effects. Sometimes less is more.
- **Match complexity to the vision.** Minimal directions need precision in spacing, type, detail. Elegance = executing the chosen vision well.
- **Writing is design material.** User-side vocabulary ("Manage notifications", not "Webhook config"). Active voice, specific over clever, same action name through the whole flow ("Publish" → toast "Published"). Errors explain what happened and how to fix it — no apologies, no vagueness. Empty states invite action.
- **Calibration — the three AI-default looks to avoid** (unless the brief demands one):
  1. Warm cream (#F4F1EA) + high-contrast serif + terracotta accent
  2. Near-black + single acid-green/vermilion accent
  3. Broadsheet layout: hairline rules, zero radius, dense newspaper columns
- **Process:** brainstorm a compact token plan (4–6 named hex colors; typefaces for 2+ roles; one-sentence layout concepts + ASCII wireframes; the ONE signature element) → critique it against "would I produce this for any similar brief?" → revise → build exactly to plan.
- **Restraint:** spend boldness in one place. Keep everything around the signature quiet. Quality floor without announcing it: responsive to mobile, visible keyboard focus, reduced motion respected. "Before leaving the house, remove one accessory."
- **Code care:** watch CSS selector specificity (section vs. element selectors cancelling each other's padding/margin).

## 2. UI/UX Pro Max (design-system decisions, patterns, typography, color)

- **Three-layer token system:**
  - *Primitive* — raw values (`--color-blue-600`, `--space-4`, 4px spacing base)
  - *Semantic* — purpose aliases (`--color-primary`, `--color-muted-foreground`, `--spacing-section`); theme switching happens here
  - *Component* — per-component overrides referencing semantic layer (`--button-bg`, `--card-padding`)
  - Naming: `--{category}-{item}-{variant}-{state}`. Dark mode = override semantic tokens only.
- **States & variants:** every component designed for hover, active, focus-visible, disabled, loading, empty/error where applicable.
- **Banner/general rules worth keeping:** max 2 font families, body ≥16px, one primary CTA, safe zones for critical content.
- Brand discipline: color palette management, typography specifications, voice framework, consistency checklists — the identity must be specified, not improvised per page.

## 3. Vercel Web Interface Guidelines (final QA audit)

**Interactions:** keyboard works everywhere (WAI-ARIA patterns) · visible `:focus-visible` rings · hit targets ≥24px (44px mobile) · inputs ≥16px on mobile (no iOS zoom) · never disable paste/zoom · loading buttons keep label + spinner, min visible ~300–500ms with ~150–300ms show-delay · URL as state · optimistic updates · ellipsis for follow-ups ("Rename…") · confirm destructive actions · `touch-action: manipulation` · `overscroll-behavior: contain` in modals · links are real `<a>` (middle-click, cmd-click) · aria-live for async updates.

**Animations:** honor `prefers-reduced-motion` · prefer CSS > WAAPI > JS libraries · animate only `transform`/`opacity` · never `transition: all` · easing fits the subject · interruptible · input-driven, not autoplay · correct transform-origin.

**Layout:** optical alignment ±1px · every element aligns to something intentionally · balance icon/text weight lockups · verify mobile + laptop + ultra-wide · respect safe-area insets · no accidental scrollbars · let flex/grid size things.

**Content:** inline help first, tooltips last resort · skeletons mirror final layout · accurate `<title>` · no dead ends · all states designed (empty/sparse/dense/error) · curly quotes, real ellipsis `…` · tabular-nums for data · never color alone for status · icons have text labels · semantic HTML before ARIA · hierarchical headings + skip link · `scroll-margin-top` on anchored headings · `translate="no"` on brand names · `&nbsp;` for glued units (10&nbsp;MB).

**Forms:** Enter submits · every control has a `<label>` · keep submit enabled until in-flight · don't block typing — validate instead · errors next to fields, focus first error on submit · `autocomplete` + meaningful `name` · right `type`/`inputmode` · placeholders are examples ending with `…` · warn on unsaved changes · style native `<select>` bg/color for Windows dark mode.

**Performance:** preload only above-the-fold images, lazy-load rest · explicit image dimensions (no CLS) · `<link rel="preconnect">` for asset origins · preload + subset fonts (unicode-range, limit axes) · long tasks off the main thread.

**Design:** layered shadows (ambient + direct) · borders + shadows combined, semi-transparent borders for edge clarity · nested radii concentric, child ≤ parent · tint borders/shadows toward the same hue on non-neutral backgrounds · APCA contrast · interaction states have MORE contrast than rest · `theme-color` meta matches page bg · `color-scheme` on `<html>` · animate wrappers, not text nodes.

**Copy:** active voice · sentence case on marketing pages · fewest words · second person · numerals for counts · positive framing · errors guide the exit ("Your API key is incorrect or expired. Generate a new key in settings.") · labels specific ("Save API Key", not "Continue").

## 4. shadcn/ui (component foundation)

- Not an npm dependency — components are copied into the project as open code, then customized. Radix primitives + Tailwind + CSS-variable theming.
- Use as the base for accessible primitives (dialog, dropdown, tabs, tooltip, form controls) — then restyle heavily so nothing reads as "default shadcn".

## 5. 21st.dev (selective component sourcing)

- CLI: `npx @21st-dev/cli search <query>` / `add <component>`. Use only when an existing high-quality component beats building from scratch — not as a default.

## 6. Motion (`motion` / `motion/react`)

- Successor to Framer Motion. Springs by default, WAAPI-accelerated transforms, gestures, scroll-linked and layout animations, `AnimatePresence` for exits.
- Use for: orchestrated page-load sequence, one scroll reveal system, hover micro-interactions, shared-layout transitions. Keep total animation budget low.

## 7. React Three Fiber

- React renderer for three.js; v9 pairs with React 19. Zero-overhead declarative 3D.
- Rule: only when 3D genuinely serves the subject. No 3D for decoration. If used: lazy-load, respect reduced motion, degrade gracefully.

---

## Anti-generic checklist (from the brief itself)

No purple/blue gradient defaults · no glassmorphism abuse · no glowing blobs · no over-rounded cards · no floating shapes · no Inter+gradient default · no badge spam · no shadow stacking · no repetitive card grids · no random animations · no decorative 3D.

## Build sequence (agreed with client)

1. **Design** — visual direction first (answer the 10 design questions, token plan, signature element)
2. **Structure** — page architecture + responsive layout
3. **Build** — stack + components
4. **Motion** — only where it aids comprehension/hierarchy/delight/storytelling
5. **Review** — screenshots at desktop/tablet/mobile, critical self-critique, iterate
6. **Audit** — Vercel guidelines pass: a11y, keyboard, focus, forms, contrast, semantics, performance
