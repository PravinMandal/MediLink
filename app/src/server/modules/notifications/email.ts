/**
 * Out-of-band notification channel (email via Resend).
 * Activated only when RESEND_API_KEY is set; otherwise a no-op — in-app
 * notifications remain the baseline. Delivery failures are logged, never
 * thrown: the in-app record is the source of truth.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type OutOfBandNotification = {
  to: string;
  subject: string;
  text: string;
  ctaUrl?: string;
};

export const outOfBand = {
  enabled(): boolean {
    return !!process.env.RESEND_API_KEY;
  },

  async send(n: OutOfBandNotification): Promise<boolean> {
    const key = process.env.RESEND_API_KEY;
    if (!key) return false;
    const from = process.env.NOTIFY_FROM_EMAIL ?? "MediLink <onboarding@resend.dev>";
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: n.to,
          subject: n.subject,
          text: n.ctaUrl ? `${n.text}\n\n${n.ctaUrl}` : n.text,
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
};
