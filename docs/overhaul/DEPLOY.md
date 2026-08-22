# MediLink — Free-tier deployment runbook

**LIVE: https://app-umber-seven-70.vercel.app** (deployed 2026-08-23 — Vercel project `pravin-7393/app`, Supabase `datosorvtxtxtcvqboxv` Mumbai, Gemini enabled: `gemini-3.6-flash`, verification in manual_review mode)

Redeploy: `cd app; vercel --prod --yes` (~40s).

Post-deploy gotchas already fixed (do not reintroduce):
- `vercel.json` must be pure JSON (no comments).
- Set env vars via file redirection (`cmd /c "vercel env add NAME production < file.txt"` with `-NoNewline`) — piping via `echo` adds whitespace/can send the wrong value.
- The proxy (middleware) must accept the `__Secure-` prefixed session cookie name that Better Auth sets when `secureCookies` is on in production.

Target: every feature works at $0 on free tiers. Stack per decision D1
(docs/decisions.md): Vercel Hobby (bom1) + Supabase Free (ap-south-1) +
optional Gemini free key.

## 1. Supabase (database + document storage)

1. Create a free project at supabase.com (region: Mumbai / ap-south-1).
2. **Database → Connection string → Transaction pooler** (`...pooler.supabase.com:6543`, mode "Transaction"). This is `DATABASE_URL` for the app runtime (serverless-safe). Note: transactions/pooled sessions — the app's db layer already sets `max: 3` for pooler URLs.
3. Create a **private** Storage bucket, e.g. `documents`.
4. Project Settings → API: copy the project URL, `anon`/`service_role` keys.

Env vars for Vercel (Project → Settings → Environment Variables):

| Variable | Value |
|---|---|
| `DATABASE_URL` | transaction-pooler connection string (port 6543) |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (server-only) |
| `SUPABASE_STORAGE_BUCKET` | `documents` |
| `NEXT_PUBLIC_APP_URL` | `https://<app>.vercel.app` (update after first deploy) |
| `GEMINI_API_KEY` | optional — deterministic AI fallback runs without it |
| `VERIFICATION_PROVIDER` | `manual_review` for real deployments (`mock` auto-approves demo data) |
| `NODE_ENV` | production (set automatically) |

## 2. Migrations

Run once from the repo (app dir), using the **direct** (non-pooled, port 5432)
connection string so DDL isn't killed by the transaction pooler:

```powershell
$env:DATABASE_URL = "<direct connection string port 5432>"
npm run db:migrate
```

## 3. Vercel

```powershell
npm i -g vercel
vercel link            # link to the MediLink project
vercel --prod          # deploys app/ (vercel.json pins region bom1)
```

- Framework preset: Next.js (auto-detected). Root directory: `app`.
- Set the env vars above for the Production environment, then redeploy.

## 4. Keep-alive (defeats Supabase's 7-day inactivity pause)

1. cron-job.org (free) → create a job hitting `https://<app>.vercel.app/api/health` every 3 days (e.g. `0 0 */3 * *`).
2. No auth header needed — the route only runs `SELECT 1`.

## 5. Post-deploy verification checklist

- `GET /api/health` → `{"ok":true,"db":"up"}`
- Sign in with a seeded demo account (requires seeding — run `db:seed` against the direct connection string if demo data is wanted in prod).
- Golden path: doctor search → patient record → summary generation → consent grant/revoke → upload a small PDF (≤4 MB) → emergency break-glass → admin console review.
- Confirm audit chain: verify via admin console (tamper check passes).
- Upload a document; confirm it appears in the patient's documents and the file route streams it (Supabase signed access).

## Free-tier ceilings (from D1)

| Resource | Free ceiling | Scale-up |
|---|---|---|
| Supabase DB | 500 MB, pauses after 7 idle days | Pro $25/mo |
| Supabase Storage | 1 GB | included in Pro |
| Vercel Hobby | 1M invocations, 100 GB-h bandwidth, non-commercial | Pro $20/mo |
| Vercel request body | 4.5 MB (app caps uploads at 4 MB) | Pro |
| Gemini free | ~250 req/day Flash | billing |
