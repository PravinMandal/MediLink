/**
 * Better Auth server configuration.
 *
 * Self-hosted on our Postgres via the Drizzle adapter. Roles are MediLink
 * domain roles (patient | doctor | lab_staff | org_admin | platform_admin);
 * professional verification state lives on the user row and is managed by the
 * identity module, not by auth itself.
 *
 * Auth methods (free-tier, industry standard):
 * - Email + password with verification mail via Resend (sendOnSignUp).
 *   `requireEmailVerification` turns on automatically once RESEND_API_KEY is
 *   set — so local/demo without mail keeps working, production enforces it.
 * - Google OAuth (needs GOOGLE_CLIENT_ID/SECRET). Apple OAuth (needs
 *   APPLE_CLIENT_ID/SECRET + key config) — button renders only when enabled.
 * - Password reset via Resend.
 *
 * Social signups always land as `patient`; claiming a doctor role still goes
 * through the verification pipeline — OAuth never grants privilege.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

const googleEnabled = !!process.env.GOOGLE_CLIENT_ID?.trim() && !!process.env.GOOGLE_CLIENT_SECRET?.trim();
const appleEnabled = !!process.env.APPLE_CLIENT_ID?.trim() && !!process.env.APPLE_CLIENT_SECRET?.trim();
const emailSending = !!process.env.RESEND_API_KEY?.trim();

export const auth = betterAuth({
  appName: "MediLink",
  // OAuth failures land on /sign-in?error=… (rendered as a banner there)
  // instead of the default JSON error page.
  onAPIError: { errorURL: "/sign-in" },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Enforce verified email exactly when we can actually send the mail.
    // Without RESEND_API_KEY (local/demo) this stays off so seeds keep working.
    requireEmailVerification: emailSending,
    sendResetPassword: async ({ user, url }) => {
      const { outOfBand } = await import("@/server/modules/notifications/email");
      await outOfBand.sendPasswordReset(user.email, url);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24, // 24h — industry standard window
    sendVerificationEmail: async ({ user, url }) => {
      const { outOfBand } = await import("@/server/modules/notifications/email");
      // No mail provider (local/demo): log the link so devs can still verify.
      if (!outOfBand.enabled()) {
        console.log(`[auth] verification link for ${user.email}: ${url}`);
        return;
      }
      await outOfBand.sendVerification(user.email, url);
    },
  },
  ...(googleEnabled || appleEnabled
    ? {
        socialProviders: {
          ...(googleEnabled
            ? {
                google: {
                  clientId: process.env.GOOGLE_CLIENT_ID!.trim(),
                  clientSecret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
                  // Minimal scopes: identity only, never contacts/drive.
                  scope: ["openid", "email", "profile"],
                },
              }
            : {}),
          ...(appleEnabled
            ? {
                apple: {
                  clientId: process.env.APPLE_CLIENT_ID!.trim(),
                  clientSecret: process.env.APPLE_CLIENT_SECRET!.trim(),
                  scope: ["name", "email"],
                },
              }
            : {}),
        },
      }
    : {}),
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "patient",
        // Self-signup always creates a patient; professional roles are set
        // only through signUpAction's post-creation update (patient|doctor)
        // or by a platform admin. input:false blocks direct API injection.
        input: false,
      },
      phone: {
        type: "string",
        required: false,
        input: true,
      },
      organizationId: {
        type: "string",
        required: false,
        input: false, // set through org flows only
      },
      verificationStatus: {
        type: "string",
        required: true,
        defaultValue: "unverified",
        input: false, // managed by the verification pipeline
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh daily
  },
  account: {
    accountLinking: {
      // Google is a trusted IdP: a Google sign-in with a verified email
      // auto-links to the existing password account on that email instead
      // of failing (the hand-rolled equivalent was linkGoogleUser with a
      // P2002 fallback in the ReachInbox project). allowDifferentEmails
      // stays false (default) and requireLocalEmailVerified stays true
      // (default): an attacker who pre-registers an unverified row at a
      // victim's email can never absorb the victim's Google identity.
      // Apple is deliberately NOT trusted — private-relay addresses make
      // its email claim unreliable as an ownership proof.
      trustedProviders: ["google"],
      updateUserInfoOnLink: true,
    },
  },
  advanced: {
    // Session cookies are HTTPS-only in production (Vercel always serves TLS).
    secureCookies: process.env.NODE_ENV === "production",
    // IP/User-Agent are captured on the session row for audit context
    ipAddress: { ipAddressHeaders: ["x-forwarded-for"], disableIpTracking: false },
  },
  databaseHooks: {
    user: {
      create: {
        // OAuth + email signups alike: force patient. Doctors upgrade only
        // via the verification pipeline after council-registration review.
        before: async (user) => ({
          data: { ...user, role: "patient", verificationStatus: "unverified" } as never,
        }),
      },
    },
  },
  plugins: [nextCookies()],
});

/** Which social buttons the UI should render (no secrets leak — booleans only). */
export const authProviders = {
  google: googleEnabled,
  apple: appleEnabled,
  emailVerification: emailSending,
} as const;

export type Session = typeof auth.$Infer.Session;
