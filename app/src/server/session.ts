import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import type { User } from "./db/schema";

export type SessionUser = User & {
  email: string;
};

/** Returns the signed-in user (with MediLink fields) or null. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  // Re-read the user row: role/org/verification may have been revoked or
  // granted mid-session; the session cookie alone must never authorize.
  const { db } = await import("./db");
  const { user: userTable } = await import("./db/schema");
  const { eq } = await import("drizzle-orm");
  const [row] = await db
    .select()
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);
  if (!row) return null;
  return { ...row, email: row.email } as SessionUser;
});

/** Throws to the sign-in page if unauthenticated. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  return user;
}

/* ------------------------------------------------------------------ */
/* Step-up authentication (BuildPlan §10.1, §7.12)                     */
/* ------------------------------------------------------------------ */

/**
 * A recent re-authentication marker for high-risk actions (break-glass,
 * exports). Step-up is satisfied by a password re-check within the last 15
 * minutes, recorded via `confirmStepUp`. Sessions older than that require a
 * fresh confirmation for privileged/emergency actions.
 *
 * Stateless by design: the marker is an HMAC-signed, httpOnly, 15-minute
 * cookie — never an in-process Map. Serverless lambdas never share memory,
 * so any in-memory marker would silently vanish (fail-closed friction) on
 * one instance and leak across devices on another. The cookie survives cold
 * starts, stays per-device, and is unforgeable without BETTER_AUTH_SECRET.
 */
const STEP_UP_TTL_MS = 15 * 60 * 1000;
const STEP_UP_COOKIE = "medilink-stepup";

async function stepUpSecret(): Promise<string> {
  const s = process.env.BETTER_AUTH_SECRET?.trim();
  if (s) return s;
  // Production must never sign step-up cookies with a baked-in fallback —
  // they would be forgeable by anyone reading this source. Fail closed.
  if (process.env.NODE_ENV === "production") {
    throw new Error("[auth] BETTER_AUTH_SECRET is required in production");
  }
  return "medilink-dev-stepup-secret";
}

async function signStepUp(userId: string, at: number): Promise<string> {
  const { createHmac } = await import("node:crypto");
  const mac = createHmac("sha256", await stepUpSecret())
    .update(`${userId}.${at}`)
    .digest("hex");
  return `${at}.${mac}`;
}

async function verifyStepUpCookie(
  userId: string,
  raw: string | undefined,
): Promise<boolean> {
  if (!raw) return false;
  const dot = raw.indexOf(".");
  if (dot <= 0) return false;
  const at = Number(raw.slice(0, dot));
  if (!Number.isFinite(at) || Date.now() - at > STEP_UP_TTL_MS || at > Date.now() + 60_000)
    return false;
  const expected = await signStepUp(userId, at);
  const { timingSafeEqual } = await import("node:crypto");
  const a = Buffer.from(raw);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Verify credentials and record a step-up confirmation for the user. */
export async function confirmStepUp(
  userId: string,
  password: string,
): Promise<boolean> {
  // P0: this endpoint verifies a password guess — bound attempts per user
  // and audit both throttling and failures (online-guessing resistance).
  const { rateLimit, LIMITS } = await import("./modules/security/rate-limit");
  if (!rateLimit(`stepup:${userId}`, LIMITS.stepUp)) {
    try {
      const { audit } = await import("./modules/audit/service");
      await audit.record({
        actorId: userId,
        action: "auth.step_up_rate_limited",
        resourceType: "user",
        resourceId: userId,
      });
    } catch {
      // Best-effort: throttling must hold even if the audit trail is down.
    }
    return false;
  }
  const { auth } = await import("./auth");
  const { db } = await import("./db");
  const { user: userTable, session: sessionTable } = await import("./db/schema");
  const { eq } = await import("drizzle-orm");
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  // Snapshot the caller's session cookie BEFORE verifying: signInEmail runs
  // inside this server action, so Better Auth's nextCookies plugin overwrites
  // the cookie with the just-minted session — which we delete below as an
  // orphan. Without a restore, the browser keeps a cookie for a deleted
  // session and the doctor is signed out right after arming break-glass.
  let prevCookieName: string | undefined;
  let prevCookieValue: string | undefined;
  for (const n of [
    "better-auth.session_token",
    "__Secure-better-auth.session_token",
    "__Host-better-auth.session_token",
  ]) {
    const v = jar.get(n)?.value;
    if (v) {
      prevCookieName = n;
      prevCookieValue = v;
      break;
    }
  }
  const [row] = await db
    .select({ email: userTable.email, role: userTable.role })
    .from(userTable)
    .where(eq(userTable.id, userId));
  if (!row) return false;
  let sessionToken: string | undefined;
  try {
    const res = (await auth.api.signInEmail({
      body: { email: row.email, password },
    } as never)) as { token?: string; session?: { token?: string } };
    sessionToken = res?.session?.token ?? res?.token;
  } catch {
    try {
      const { audit } = await import("./modules/audit/service");
      await audit.record({
        actorId: userId,
        actorRole: row.role,
        action: "auth.step_up_failed",
        resourceType: "user",
        resourceId: userId,
      });
    } catch {
      // Best-effort: the failure stands even if the audit write fails.
    }
    return false;
  }
  // P2: signInEmail mints a real session row — delete the just-created one
  // so password checks never accumulate orphan sessions. Best-effort: the
  // 7-day session expiry bounds any residue if the response shape changes.
  if (sessionToken) {
    try {
      await db.delete(sessionTable).where(eq(sessionTable.token, sessionToken));
    } catch {
      // Best-effort: expiry bounds the residue.
    }
  }
  // Restore the caller's original session cookie (attributes mirror the
  // Better Auth session cookie; maxAge matches session.expiresIn in auth.ts).
  if (prevCookieName && prevCookieValue) {
    jar.set(prevCookieName, prevCookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  }
  const at = Date.now();
  jar.set(STEP_UP_COOKIE, await signStepUp(userId, at), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(STEP_UP_TTL_MS / 1000),
  });
  return true;
}

/** Whether the user has a fresh step-up confirmation. */
export async function hasFreshStepUp(userId: string): Promise<boolean> {
  const { cookies } = await import("next/headers");
  return verifyStepUpCookie(userId, (await cookies()).get(STEP_UP_COOKIE)?.value);
}

/** AccessContext session assurance derived from the step-up state. */
export async function sessionAssuranceFor(
  userId: string,
): Promise<"standard" | "step_up"> {
  return (await hasFreshStepUp(userId)) ? "step_up" : "standard";
}

export function portalHomeForRole(role: User["role"]): string {
  switch (role) {
    case "doctor":
      return "/portal/doctor";
    case "lab_staff":
    case "org_admin":
      return "/portal/org";
    case "platform_admin":
      return "/portal/admin";
    default:
      return "/portal/patient";
  }
}

/**
 * Page-level role gate: every portal page already requires authentication
 * via requireUser(), but clinician/facility tooling must not render for the
 * wrong role even when the underlying actions would refuse (defense in
 * depth + no confusing chrome). Non-matching roles are sent to their own
 * home — the same pattern doctor/patients/[id] already used inline.
 */
export async function requireRole(
  ...roles: Array<User["role"]>
): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(portalHomeForRole(user.role));
  return user;
}
