"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // Same-origin by default. NEXT_PUBLIC_APP_URL is the canonical production
  // origin, but preview deployments have a different host — prefer the live
  // window origin at runtime so OAuth callbacks never mismatch BETTER_AUTH_URL.
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
});

export const { signIn, signUp, signOut, useSession } = authClient;

/** OAuth entry points — routed through Better Auth's callback URLs. */
export async function signInWithGoogle(callbackURL = "/portal") {
  return authClient.signIn.social({ provider: "google", callbackURL });
}

export async function signInWithApple(callbackURL = "/portal") {
  return authClient.signIn.social({ provider: "apple", callbackURL });
}
