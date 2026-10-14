"use client";

import dynamic from "next/dynamic";

/**
 * Client-only loader for the vault act: three.js + fiber + drei must
 * never enter the server bundle. next/dynamic with ssr:false is only
 * legal inside a Client Component, hence this thin wrapper.
 */
export const VaultActDynamic = dynamic(
  () => import("@/components/marketing/vault-act").then((m) => m.VaultAct),
  {
    ssr: false,
    loading: () => (
      <section aria-label="How a record travels" className="landing-dark relative py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#6fa8ff]">The chain</p>
          <h2 className="mt-3 max-w-2xl font-display text-[clamp(1.9rem,4vw,2.7rem)] font-bold tracking-tight text-white">
            One lab report, followed through the chain.
          </h2>
        </div>
      </section>
    ),
  },
);
