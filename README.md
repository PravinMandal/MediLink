# MediLink

Provenance-aware, consent-driven longitudinal health-record platform for India.

**Live demo:** https://medilink-health.vercel.app — demo accounts on the
sign-in page (password `Password123!`).

- Verified doctors/labs contribute authenticated records; patients control
  access via DPDP-aligned scoped consents with expiry and instant revocation
- Consent-request inbox: a doctor's access request arrives as a one-tap
  pre-filled grant card
- Emergency break-glass is time-boxed, notified (in-app + optional email),
  and audited; admins review every event with reviewer notes
- AI summaries cite every claim to its source record — patients see their own
  cited SBAR summary too
- Emergency Card: printable wallet card with a QR that routes a treating
  doctor through the audited emergency path
- Full-text record search for doctors (consent-scope-filtered) and patients
  (timeline search + kind filters)
- Append-only hash-chained audit log with tamper detection and a readable
  actor/patient-labeled stream
- Optional ABHA number (India's national health ID) on the patient record

## Stack

Next.js 16 (App Router) · Better Auth · Drizzle ORM · Postgres (Supabase,
Mumbai) · Supabase Storage · Tailwind v4 · Gemini Flash (deterministic
fallback without a key) · Vitest · Playwright.

## Structure

```
app/        Next.js application (src/ app code, drizzle/ migrations, scripts/)
docs/       Architecture, decisions, deploy runbook, overhaul docs
```

## Local development

```bash
cd app
npm install
cp .env.example .env        # optional — defaults to embedded PGlite with no config
npm run db:migrate && npm run db:seed
npm run dev                 # http://localhost:3000
```

Note: `db:migrate`/`db:seed` load `.env` — with `DATABASE_URL` set they
target that Postgres (storage stays local unless SUPABASE_* vars are present).

Gates: `npm test` · `npx tsc --noEmit` · `npm run lint` · `npm run build` ·
`node scripts/verify.mjs [baseUrl]` (behavioral suite, default localhost:3000).

## Deployment

See `docs/overhaul/DEPLOY.md` (Vercel Hobby bom1 + Supabase Free ap-south-1,
all $0). Redeploy: `cd app && npx vercel --prod`.
