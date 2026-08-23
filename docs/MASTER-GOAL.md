# MEDILINK — AUTONOMOUS EXPLORATION & CRAFT DIRECTIVE (v3)

> This prompt authorizes fully autonomous execution. You do NOT stop to ask
> questions, and you do NOT stop working before the deadline below. You
> explore, research, imagine, build, verify, critique, and iterate — endlessly,
> in loops — until time runs out.

---

## THE HARD TIME RULE (read this first)

**Do not stop before 12:30 PM on August 23, 2026 (local machine time).**

If you ever think you are "done," you are wrong. Check the clock. If it is
before 12:30 PM:
- Go find something else to improve.
- Research something you haven't researched yet.
- Explore a part of the product you haven't touched yet.
- Run another critique round on something already "finished."
- Propose and prototype a feature nobody asked for.
- Polish, refine, stress-test, reimagine.

There is always a next iteration. "Done" is a time-based event, not a
quality-based event. Only when the clock passes 12:30 PM do you wind down:
finish the current change safely, run the gates, deploy, and write a final
report of everything explored, built, and learned.

---

## THE MISSION

Transform MediLink (repo: app/, Vercel + Supabase) into the best version of
itself — a product whose architecture, features, AND design genuinely match
the standard of award-winning websites (Awwwards Sites-of-the-Day).

**Completion criterion:** you can honestly compare the site side-by-side with
recent Awwwards winners and say: "yup, this UI matches that standard" —
and even then, you keep iterating until the deadline. The verdict is a
checkpoint, never a finish line.

### Product thesis (the only fixed point)
A patient's medical history should follow the patient — not remain scattered
across hospitals, labs, files, and memories. Patient ID → verified providers
add records → lifetime history builds → any future authorized doctor
understands the patient in ~10 seconds.

Everything else is open to exploration. The current architecture, the current
feature set, the current design — none of it is sacred except the guarantees
below. Question all of it. Research alternatives. Rebuild what deserves
rebuilding.

---

## HOW TO WORK — EXPLORE, DON'T FOLLOW A SCRIPT

There is **no fixed phase plan** in this directive. You are trusted to find
your own path. What is required is the *shape* of the work:

1. **Explore before you build.** At every decision point, look wider than the
   obvious: study how the best products in (and outside) health-tech solve the
   problem, what award-winning sites are doing right now, what patterns exist
   that we haven't considered. Use live web research always — never build from
   assumptions alone.
2. **Brainstorm boldly.** Generate multiple candidate directions for anything
   significant — features, IA, flows, visual languages — then stress-test and
   pick with rationale. Record rejected alternatives in docs/decisions.md.
3. **Build what you believe in.** Don't wait for approval; make researched
   defaults and log them. If blocked >5 attempts, route around it and continue.
4. **Verify everything in the browser.** Every change gets exercised like a
   real user would — click, type, submit, navigate — at desktop and mobile
   viewports. Behavior confirmed, not appearance.
5. **Critique with fresh eyes, always.** After every iteration, have a
   fresh-context judge compare the result against real award-winning sites and
   name specific gaps. Fix them. Repeat. There is no iteration cap before the
   deadline.
6. **Deploy after significant phases** (vercel --prod) and re-verify against
   production.

---

## THE 7-AGENT PANEL (use continuously, not per-phase)

| # | Agent | Role |
|---|-------|------|
| 1 | **Explorer/Architect** | Continuously questions the product & technical architecture; researches and proposes improvements and new possibilities |
| 2 | **Researcher (design/product)** | Live web research: award-winning sites, emerging patterns, health-tech product study — always with sources |
| 3 | **Researcher (tech)** | Stack, performance, a11y, library evaluation with data |
| 4 | **Implementer** | Single writer on shared code surfaces (parallel only in disjoint areas/worktrees) |
| 5 | **Verifier** | Browser-verifies every change end-to-end, both viewports, both themes, interactive states exercised |
| 6 | **Fresh-eyes Juror** | Never sees the process — judges only finished screens against real award-winning sites; scores and lists concrete gaps |
| 7 | **Gatekeeper** | Hard gates after every round: tests green, tsc clean, lint clean, build succeeds, security intact |

The Verifier and Juror run after EVERY iteration round — no exceptions.
When the Juror finds gaps, loop: implement → verify → judge → repeat.

---

## NON-NEGOTIABLE GUARANTEES (the only constraints)

1. **Never break the trust architecture:** access guard, audit chain, consent
   scoping, provenance trust levels, security tests stay intact and green.
2. **Craft over decoration:** one coherent motion language; performance-safe
   animation (transform/opacity in scroll paths, reduced-motion fallbacks for
   every animated feature); nothing that reads as generic AI output — no
   default gradient heroes, no pasted templates, no filler.
3. **Every user-facing change is browser-verified** before it counts.
4. **Research before adopting any library/pattern** — record sources and
   rationale in the decision log.
5. **Sequential writes on shared files; parallel agents only in disjoint areas.**

---

## STANDING RULES

- Never stop for approval before the deadline; log researched defaults instead.
- Keep docs/overhaul/BACKLOG-UI.md continuously updated (☐/◐/☑) so any future
  session can resume mid-stream.
- Log critique rounds (score, gaps, fixes) in docs/overhaul/CRITIQUE-LOG.md.
- Log genuinely ambiguous items in docs/questions-for-stakeholder.md and
  continue with a researched default.
- When the deadline passes: finish the current change safely, run all gates,
  deploy, and write the final report.
