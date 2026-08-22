# MEDILINK — MASTER UI/UX TRANSFORMATION GOAL

> Paste this prompt to the agent as the goal. It authorizes autonomous, multi-day
> execution: research → design → build → verify → deploy, in loops, without
> stopping to ask questions. Decisions get recorded in docs/decisions.md;
> anything genuinely ambiguous gets a researched default + a note in
> docs/questions-for-stakeholder.md, and work continues.

---

## THE MISSION

Transform MediLink (repo: `E:\A dream path\Projects\MediLink\app`, live URL in
`docs/overhaul/DEPLOY.md`'s header note / Vercel dashboard, Vercel + Supabase
functionally-complete but visually plain app into a **visually spectacular,
heavily animated, Awwwards-caliber product** — while keeping every existing
security, consent, provenance, and audit guarantee intact (24+ tests must stay
green at every milestone).

The product thesis (never violate it in design decisions): **a patient's medical
history should follow the patient, not remain scattered across hospitals, labs,
files, and memories.** Patient ID → verified providers add records → lifetime
history builds → future authorized doctors understand the patient in ~10 seconds.

Priorities in order: (1) animation-rich, premium visuals everywhere possible;
(2) smooth, choreographed motion (never janky); (3) dark mode as a first-class
identity; (4) sidebar-based portal IA; (5) a 3D cinematic landing page selling a
breakthrough product; (6) accessible + performant underneath it all.

---

## NON-NEGOTIABLE CONSTRAINTS (read before every phase)

1. **Never break the trust architecture.** The access guard, audit chain,
   consent scoping, provenance trust levels, and all security tests are sacred.
   `npm test` green, `npx tsc --noEmit` clean, `npm run lint` 0 errors,
   `npm run build` succeeds — after EVERY phase, no exceptions.
2. **Motion discipline** (Awwwards-verified rules): one motion language — a
   single ease family (e.g. `expo.out`) and one timing scale across the entire
   app; animate ONLY `transform`/`opacity` (never width/top/box-shadow in scroll
   paths); one rAF clock (Lenis driven by GSAP's ticker; WebGL uniforms updated
   on the same tick); DPR capped at [1,2]; WebGL lazy-mounted near-viewport and
   paused offscreen; `prefers-reduced-motion` gets a full static fallback path
   for EVERY animated feature; mobile gets lighter variants (matchMedia).
3. **No AI-slop look**: no purple-blue gradient heroes, no glassmorphism abuse,
   no decorative blobs, no identical card grids, no emoji icons, no default
   shadcn/Aceternity styling pasted unmodified. Techniques from those libraries:
   yes. Templates: no. Everything restyled on our tokens.
4. **Every visual change is browser-verified** before it counts: Playwright
   (`scripts/verify.mjs` pattern) at 1280px and 375px, console-error free,
   no horizontal overflow, interactive states exercised by click/keyboard.
   Screenshot every key screen into `app/shots/` as evidence.
5. **Deploy after every major phase**: `vercel --prod --yes` from `app/`, then
   re-run the verification suite against production.
6. **Sequential writes on shared files; parallel agents only in disjoint areas
   or worktrees.** Multi-agent panels for research/audit/critique; single-writer
   for implementation on shared surfaces.

---

## PHASE 0 — RESEARCH SPRINT (before any code)

Run a parallel research panel (5+ agents, read-only, web-enabled) and distill
into `docs/overhaul/DESIGN-RESEARCH.md` with concrete, decision-ready findings:

1. **Awwwards dissection** — study 8-10 recent SOTD winners (sanrita.ca,
   minhpham.design, iventions, plus current health/tech winners found via
   awwwards.com). Extract: hero patterns, scroll-choreography structures,
   cursor/magnetic interactions, text-reveal techniques, loading/preloader
   patterns, nav transitions, footer spectacles, and their performance
   techniques. Output: pattern catalog with "what we steal, what we skip".
2. **Animation technique catalog** — for EVERY UI surface in MediLink, list the
   candidate animation (running-light borders, aurora/spotlight backgrounds,
   shimmer/beam connectors, number tickers, staggered text reveals, layout
   springs, page transitions, parallax, magnetic buttons, 3D card tilt,
   animated beams on architecture diagrams, particle fields, gradient mesh,
   marquee, flip numbers, circular progress arcs, typing effects, confetti on
   success, scanline effects). For each: implementation route (CSS / Motion /
   GSAP / R3F), perf cost, reduced-motion fallback.
3. **Health-tech dark-mode systems** — Tempus, Impilo, Ora, Forward, Ro, plus
   general dark-mode token best practice. Define our "clinical night" palette.
4. **Stack verification** — Lenis + GSAP ScrollTrigger + Motion + R3F on
   Next.js 16 App Router: exact wiring patterns, hydration safety, cleanup with
   `useGSAP`, Lenis-in-App-Router gotchas (scroll restoration, route change
   cleanup), one-clock pattern code. Verify versions on npm, record to lockfile.
5. **Design tokens survey** — type pairing options beyond Fraunces/Instrument
   (evaluate: Space Grotesk, Sora, General Sans, Clash Display via fontshare;
   keep Plex Mono for data), spacing/radii/elevation scales, dark+light semantic
   token structure for Tailwind v4 `@theme`.

Deliverable: DECISION — the full design language spec written to
`docs/overhaul/DESIGN-SYSTEM.md`: tokens (light+dark), type scale, motion
language (named easings, duration scale, stagger rules), the logo spec, the
animation inventory mapped screen-by-screen.

---

## PHASE 1 — FOUNDATION: IDENTITY, TOKENS, SHELL

### 1.1 Logo & identity (hand-crafted SVG, no image gen)
- Design the **MediLink seal**: an ECG pulse line resolving into interlocked
  chain-links (record ↔ identity) in a soft hexagon. Variants: full lockup
  (seal + wordmark), mark-only (favicon/app icon), mono, animated (the pulse
  draws itself via stroke-dashoffset — used in loader, hero, auth pages).
- Replace everywhere: navbar, sidebar, favicon.ico + SVG favicon, auth pages,
  marketing footer, OG image (generate a static og.png via a Playwright
  screenshot of an HTML page at 1200×630).
- Wordmark in the display font; tune kerning by hand.

### 1.2 Dark mode first-class
- Restructure `globals.css` to semantic tokens with light+dark values
  ("clinical day": paper/pine — "clinical night": green-black canvas
  `~#0a0f0d`, mint `#34d399`/cyan data accents, amber warnings, alert red
  preserved; surfaces layered tonally, never neutral gray).
- `.dark` class strategy + `localStorage` + no-flash inline script in root
  layout + `prefers-color-scheme` default + `color-scheme` meta both modes.
- Theme toggle in the sidebar with an animated sun/moon morph.
- Re-skin EVERY portal page + marketing + auth for both modes; verify contrast
  AA in both.

### 1.3 Portal shell → persistent sidebar (role-aware)
- Patient: Dashboard · Patient ID · Timeline · Documents · Consents · Access
  history · Emergency · Profile. Doctor: Dashboard · Find patient · My
  patients · Emergency · Verification. Admin/Org equivalents. Deep anchors for
  the doctor patient-page tabs.
- Collapsible (icon-rail ≥lg with animated expansion), mobile drawer with
  spring + focus trap, animated active-item indicator (layout spring that
  slides between items), hover micro-interactions, user card bottom, logo top,
  theme toggle, ⌘K command palette (shadcn Command) with fuzzy search over
  nav + (doctor) patients.
- Page transitions: template.tsx or Motion presence — content rise-in with
  consistent stagger on every route change.

### 1.4 Primitives upgrade
- Add shadcn (Radix) primitives, restyled to our tokens: Toast (wire EVERY
  server action to success/error toasts), Skeleton (every loading state),
  Switch (consent toggles), Tooltip, DropdownMenu, Dialog (replace SourceDrawer
  internals, keep the focus-trap behavior), Progress, Command palette.
- `npm i gsap @gsap/react lenis motion` (+ re-add), register plugins, build
  the one-clock Lenis↔GSAP provider (marketing only; portal keeps native
  scroll for a11y unless perf proves fine).

**Gate:** gates green; screenshots of every portal page in BOTH themes at both
viewports; deploy.

---

## PHASE 2 — ANIMATION EVERYWHERE (the "running light" pass)

Systematically animate every surface, using Phase 0's inventory. Minimum
coverage (each with reduced-motion fallback):

- **Cards & containers**: running-light/animated gradient borders on hover and
  on primary cards (conic-gradient border keyframes; dot-pattern march);
  shimmer sweep on hover; 3D tilt on pointer for feature cards; entrance
  stagger with spring.
- **Buttons & controls**: magnetic primary buttons (pointer-follow with
  spring); shimmer CTA on the landing; ripple on click; animated focus rings;
  toggles with satisfying spring + glow.
- **Data**: number tickers (count-up on view) for record counts, years of
  history, audit events; sparklines draw-in on view (stroke-dashoffset);
  trend arrows pop; circular progress arcs animate on consent scope
  coverage; hash strings get a one-time scramble/decode effect.
- **Text**: headline word-stagger reveals (clip-path rise) on every page
  header; eyebrow labels type-in; citation chips pop sequentially when the AI
  summary appears; the AI summary itself streams in token-by-token with a
  cursor (from the server action's chunks or a typewriter on final text).
- **Feedback**: toast slide+spring; success moments get a restrained particle
  burst or seal-stamp animation; error states shake; loading buttons morph
  label→spinner with width animation; skeletons shimmer with layout-matched
  shapes everywhere.
- **Lists & tables**: row entrance stagger; row hover spotlight; pagination
  transitions; empty states animate their illustration + CTA pulse.
- **Navigation**: sidebar indicator springs; breadcrumb letter-cascade;
  command palette scale+blur-in; mobile drawer spring.
- **Marketing**: marquee of trust stats; animated beam connectors on the
  "how it works" architecture diagram (SVG paths with traveling light dots);
  parallax layer depths on section art; magnetic social/footer links;
  scroll-progress indicator; custom cursor with blend-mode on desktop
  landing only.

**Gate:** full browser pass both viewports both themes; perf check (transform/
opacity only in scroll paths; no long tasks >200ms on interaction); gates
green; deploy; screenshots.

---

## PHASE 3 — THE CINEMATIC 3D LANDING PAGE (flagship)

Rebuild the marketing page as a dark, flashy, breakthrough-product launch page
telling the accident story as one continuous scroll experience:

1. **Preloader** (≤1.2s, skippable, once per session): the seal draws itself,
   percentage counter, curtain lift.
2. **Hero**: full-bleed dark canvas; particle/starfield or aurora shader
   background reacting to pointer; kinetic display type with word-stagger;
   the animated seal; magnetic dual CTA; scroll cue.
3. **The narrative scroll (R3F + GSAP scrub, sticky stage, chapter overlays)**:
   Ch1 "A patient gets an ID" (a glowing ID card materializes, QR pulses) →
   Ch2 "Records accrete" (documents fly in and lock onto a growing 3D timeline
   ring, years tick by) → Ch3 "The accident" (scene darkens, time slows,
   a heartbeat ECG line runs across the 3D space) → Ch4 "The doctor scans"
   (camera dives to the QR, a consent gate opens with running-light borders) →
   Ch5 "10 seconds" (an SBAR brief assembles in 3D with citation chips popping;
   count-up "understanding in 10s"). Camera path on a curve; chapters as DOM
   overlays synced via ScrollTrigger; background color lerps per chapter.
4. **Feature sections**: bento grid with 3D tilt cards + animated beams;
   stats band with count-up; testimonial/quote moment; final CTA with
   aurora + the seal.
5. Keep/re-skin existing strong copy (problem beats, evidence chain, trust
   architecture) into the new visual language; keep the DOM content for SEO
   (canvas aria-hidden, real text present); OG image updated.
6. Perf: LCP < 2.5s (hero text is DOM, not canvas), 3D lazy-mounts after LCP
   paint, DPR [1,2] ([1,1.5] mobile), pause offscreen, reduced-motion gets a
   static illustrated chapter list, no horizontal overflow at 375px, test on
   throttled CPU.

**Gate:** Lighthouse mobile ≥85 perf / ≥95 a11y on landing; full visual pass;
critique panel (below); deploy.

---

## PHASE 4 — PRODUCT FEATURES THAT SHOWCASE THE ANIMATION (from the architecture doc)

Build the features that the new UI is dressing (each with its full animation
treatment + tests where logic is involved):

1. **Patient ID card + QR** — hero card (flippable 3D card animation: front =
   ID + QR, back = emergency essentials), printable wallet card (print CSS),
   copy-ID button with scramble animation.
2. **Doctor: Find-by-ID** — scan/type Patient ID → animated lookup → request
   consent flow with scope picker (animated scope chips).
3. **10-second brief** — doctor patient page gets a sticky identity header
   (photoless avatar, name, age/sex, blood group with trust seal, allergy
   strip with pulse-alert styling) + the SBAR brief as the animated centerpiece.
4. **Timeline v2** — encounter-grouped vertical timeline with scroll-triggered
   node pop-ins, year markers, trust badges, conflict flags; filters with
   animated chips; (data model: add `encounters` grouping where missing).
5. **Access passport** — patient-side animated history of who-saw-what with
   scanline reveal.
6. **Share links** — time-boxed scoped view links with animated expiry
   countdown.
7. **Notifications v2** — in-app notification center with slide-in stack +
   badge count animation (wire consent/break-glass/upload events).

**Gate:** end-to-end Playwright flows for each feature (grant→see→revoke
loops, ID lookup, share link lifecycle); gates green; deploy.

---

## PHASE 5 — CRITIQUE LOOPS (run after EVERY major phase, mandatory)

Spawn a fresh-context critique panel (no shared session state):
- **Awwwards juror**: judges the landing (design 40 / usability 30 /
  creativity 20 / content 10) — iterate until ≥7/10 simulated SOTD quality.
- **Design judge**: portal visual system coherence, spacing, type rhythm.
- **Blind keyboard user**: tab through every flow; focus order/traps/returns.
- **Performance engineer**: traces, long tasks, CLS, bundle analysis;
  three.js must stay out of portal chunks.
- **Skeptical doctor + skeptical patient personas**: complete their #1 task;
  report friction.
Fix every critical/major finding; re-verify; repeat until zero critical/major.

---

## PHASE 6 — FINAL HARDENING & SHIP

- Full `scripts/verify.mjs` run local + production (all 21+ checks).
- Lighthouse all key routes, both themes; axe clean of serious.
- Fresh DB reset + seed + full-flow regression; confirm audit chain verify
  passes in the admin UI.
- Update docs: DECISIONS (D16+ series: design system, motion language, stack
  choices), FINAL-REPORT rewrite with before/after screenshots, DEPLOY.md.
- Production deploy + post-deploy verification; confirm cron keep-alive still
  hitting /api/health.

---

## STANDING RULES FOR THE WHOLE ENDEAVOR

- Research before adopting ANY library/pattern (versions, bundle cost,
  a11y, Tailwind v4 compatibility); record sources in the decision log.
- Never stop for approval; make researched defaults; log to
  questions-for-stakeholder.md and continue.
- If blocked >5 attempts, route around, log the limitation, continue.
- Update docs/overhaul/BACKLOG-UI.md continuously as the living task list;
  mark ☐/◐/☑ so any future session can resume mid-stream.
- Budget is unlimited: use parallel agents liberally for research, audits,
  critiques, and isolated implementation; serialize shared-file work.
