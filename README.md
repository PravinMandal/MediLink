# MediLink

Provenance-aware, consent-driven longitudinal health-record platform for India.

**Live demo:** https://app-umber-seven-70.vercel.app — demo accounts on the
sign-in page (password `Password123!`).

- Verified doctors/labs contribute authenticated records; patients control
  access via DPDP-aligned scoped consents with expiry and instant revocation
- Emergency break-glass is time-boxed, notified, and audited
- AI summaries cite every claim to its source record
- Append-only hash-chained audit log with tamper detection

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

Gates: `npm test` · `npx tsc --noEmit` · `npm run lint` · `npm run build`

## Deployment

See `docs/overhaul/DEPLOY.md` (Vercel Hobby bom1 + Supabase Free ap-south-1,
all $0). Redeploy: `cd app && vercel --prod --yes`.
