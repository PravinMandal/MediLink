"use client";

import { useState } from "react";
import { CitationChips, SourceDrawer, type ClaimSourceView } from "./interactive";

/**
 * Client wrapper that owns drawer state for one EvidenceClaim's citations.
 * Server components render <CitationChipsInline sources={...}/> inside the
 * evidence rail; interactivity stays in client leaves.
 */
export function CitationChipsInline({ sources }: { sources: ClaimSourceView[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <CitationChips sources={sources} onOpen={(n) => setOpen(n)} />
      <SourceDrawer
        sources={sources}
        openIndex={open}
        onClose={() => setOpen(null)}
        extra="Every statement resolves to records it was generated from. AI-generated — verify against sources."
      />
    </>
  );
}
