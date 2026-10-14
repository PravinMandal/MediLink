/**
 * Out-of-band notification channel (email via Resend, free tier).
 * Activated only when RESEND_API_KEY is set; otherwise a no-op — in-app
 * notifications remain the baseline. Delivery failures are logged, never
 * thrown: the in-app record is the source of truth.
 *
 * Also owns the Better Auth email templates (verification + password reset)
 * so auth mail and product mail share one sender, one style, one failure
 * mode. No `resend` npm dependency — raw fetch keeps the serverless bundle
 * small and works on Vercel Hobby with zero extra config.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type OutOfBandNotification = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  ctaUrl?: string;
};

function sender(): string {
  return (
    process.env.NOTIFY_FROM_EMAIL ??
    process.env.EMAIL_FROM ??
    "MediLink <onboarding@resend.dev>"
  );
}

function wrapHtml(opts: { title: string; body: string; ctaLabel?: string; ctaUrl?: string }): string {
  const { title, body, ctaLabel, ctaUrl } = opts;
  return `<!doctype html><html><body style="margin:0;background:#0B1220;padding:32px 16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<div style="max-width:480px;margin:0 auto;background:#111A2E;border:1px solid #22314F;border-radius:20px;padding:32px 28px;color:#EDF1F7;">
<div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(180deg,#2E6FE8,#12429E);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:20px;color:#fff;">M</div>
<h1 style="font-size:20px;margin:20px 0 8px;">${title}</h1>
<p style="font-size:14px;line-height:1.6;color:#B6C0CD;">${body}</p>
${ctaUrl ? `<a href="${ctaUrl}" style="display:inline-block;margin-top:16px;background:#2E6FE8;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:12px;">${ctaLabel ?? "Continue"}</a>` : ""}
<p style="margin-top:20px;font-size:12px;color:#8F99A6;">If the button doesn't work, paste this link:<br/><span style="word-break:break-all;">${ctaUrl ?? ""}</span></p>
<p style="margin-top:16px;font-size:12px;color:#8F99A6;">MediLink · consented health records · this link expires in 24 hours.</p>
</div></body></html>`;
}

export const outOfBand = {
  enabled(): boolean {
    return !!process.env.RESEND_API_KEY;
  },

  async send(n: OutOfBandNotification): Promise<boolean> {
    const key = process.env.RESEND_API_KEY;
    if (!key) return false;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const text = n.ctaUrl ? `${n.text}\n\n${n.ctaUrl}` : n.text;
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: sender(),
          to: n.to,
          subject: n.subject,
          text,
          ...(n.html ? { html: n.html } : {}),
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        console.error("[notify:email] resend rejected", res.status, await res.text().catch(() => ""));
        return false;
      }
      return true;
    } catch (err) {
      console.error("[notify:email] send failed", err);
      return false;
    }
  },

  /** Industry-standard verification mail: proves the address belongs to the user. */
  async sendVerification(to: string, url: string): Promise<boolean> {
    return this.send({
      to,
      subject: "Verify your MediLink email",
      text: "Confirm your email to activate your MediLink account.",
      html: wrapHtml({
        title: "Verify your email",
        body: "You're one click away from your lifetime health record. Confirm this address belongs to you — it keeps password resets and emergency alerts safe.",
        ctaLabel: "Verify email",
        ctaUrl: url,
      }),
      ctaUrl: url,
    });
  },

  /** Password-reset mail: short-lived, single-use link. */
  async sendPasswordReset(to: string, url: string): Promise<boolean> {
    return this.send({
      to,
      subject: "Reset your MediLink password",
      text: "Someone requested a password reset. If that was you, use the link within 1 hour.",
      html: wrapHtml({
        title: "Reset your password",
        body: "Someone requested a password reset for this address. If that was you, continue within 1 hour. If not, ignore this — your password stays unchanged.",
        ctaLabel: "Reset password",
        ctaUrl: url,
      }),
      ctaUrl: url,
    });
  },
};
