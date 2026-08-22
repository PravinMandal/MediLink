# Questions for stakeholder (parked — work continued with defaults)

None blocking. Decisions were made autonomously in `docs/decisions.md`; revisit if you disagree:

1. **D1 Vercel Hobby non-commercial clause** — the demo runs free; charging users would require Vercel Pro ($20/mo). Also Supabase Free has no automated backups — unacceptable for real patient data, fine for the synthetic demo.
2. **D2 Role lockdown** — professional accounts can now only be granted by a platform admin (self-signup = patient only). If you want open practitioner signup with a manual review queue instead, that's a small change.
3. **D9 3D landing** — built as a scroll-driven "record journey" (lab → hash → consent → citation). If you'd rather have zero 3D, the deps can be dropped instead.
4. **D11 Doctor self-signup** — public signup still offers a "doctor" choice, but the account is unverified and cannot write clinical data until a platform admin verifies the registration. If you want fully closed practitioner signup (admin-invite only), it's a one-line change in auth-actions.ts.
5. **Patient directory visibility (audit F2)** — any *verified* practitioner can search and see every patient's name/DOB/phone/city with zero consent relationship, and consent-denied patient pages reveal name/DOB/sex. This is a deliberate clinical-workflow tradeoff (doctors must find patients to request consent), but for a DPDP-positioned product you may want consent-gated search, minimum query length, or rate limiting. Say the word and I'll tighten it.
6. **Break-glass is preventive-light (audit F3)** — any verified doctor can open a 60-min emergency window on any patient with a stated reason; only *flagged* events block renewal. Capping windows per patient/day or requiring org co-signoff is stricter; current design trusts the audit + notification + review loop.
7. **Demo credentials on the sign-in page (audit M1)** — fine for a demo, must be removed before any real deployment (block in auth-forms.tsx SignInForm).
