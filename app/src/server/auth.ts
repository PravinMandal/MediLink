/**
 * Better Auth server configuration.
 *
 * Self-hosted on our Postgres via the Drizzle adapter. Roles are MediLink
 * domain roles (patient | doctor | lab_staff | org_admin | platform_admin);
 * professional verification state lives on the user row and is managed by the
 * identity module, not by auth itself.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

export const auth = betterAuth({
  appName: "MediLink",
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
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "patient",
        input: true, // chosen at sign-up
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
  advanced: {
    // IP/User-Agent are captured on the session row for audit context
    ipAddress: { ipAddressHeaders: ["x-forwarded-for"], disableIpTracking: false },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
