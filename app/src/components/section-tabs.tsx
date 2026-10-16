"use client";

import Link from "next/link";
import { useRef } from "react";
import { cn } from "@/lib/utils";

export type SectionTab = {
  key: string;
  label: string;
  href: string;
  allowed: boolean;
  active: boolean;
};

/**
 * URL-driven tabs with proper tab semantics. Selection follows navigation;
 * arrow keys move focus, Enter/Space activates (native link behavior).
 * Disallowed tabs stay focusable but marked aria-disabled.
 */
export function SectionTabs({ tabs }: { tabs: SectionTab[] }) {
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const links = Array.from(
      listRef.current?.querySelectorAll<HTMLAnchorElement>("[role='tab']") ?? [],
    );
    if (!links.length) return;
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (index === -1) return;
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const next = links[(index + dir + links.length) % links.length]!;
    next.focus();
  };

  // tabIndex={0} on the tablist: roving-tabindex arrow-key handling lives
  // here, so the container itself must be in the tab order (otherwise the
  // key handler is unreachable until a tab already has focus).
  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Sections"
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="mb-4 flex gap-1 overflow-x-auto border-b border-line"
    >
      {tabs.map((t) =>
        !t.allowed ? (
          <span
            key={t.key}
            role="tab"
            aria-selected={t.active}
            aria-disabled="true"
            tabIndex={t.active ? 0 : -1}
            className={cn(
              "-mb-px shrink-0 cursor-not-allowed border-b-2 px-3.5 py-2.5 text-[13.5px] font-medium transition-colors",
              t.active
                ? "border-pine text-pine-ink"
                : "border-transparent text-ink-soft hover:text-ink",
              "opacity-40",
            )}
          >
            {t.label}
          </span>
        ) : (
          <Link
            key={t.key}
            href={t.href}
            role="tab"
            aria-selected={t.active}
            tabIndex={t.active ? 0 : -1}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3.5 py-2.5 text-[13.5px] font-medium transition-colors",
              t.active
                ? "border-pine text-pine-ink"
                : "border-transparent text-ink-soft hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        ),
      )}
    </div>
  );
}
