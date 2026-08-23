"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { markAllReadAction, markReadAction } from "@/server/actions/notification-actions";
import { cn } from "@/lib/utils";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  createdAt: string; // preformatted relative time
  timeISO: string;
  readAt: string | null;
};

/**
 * Header bell. Data arrives from the server layout; opening the panel
 * triggers a router.refresh() so cross-tab events (e.g. break-glass) surface
 * without a manual reload. Per-item mark-read on click.
 */
export function NotificationBell({
  items,
  unread,
}: {
  items: NotificationItem[];
  unread: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ items, unread });
  const [pending, startTransition] = useTransition();

  const openPanel = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      startTransition(() => router.refresh());
    }
  };

  const markAll = () => {
    setState((s) => ({
      items: s.items.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })),
      unread: 0,
    }));
    startTransition(async () => {
      await markAllReadAction();
      router.refresh();
    });
  };

  const markOne = (id: string) => {
    setState((s) => {
      const item = s.items.find((i) => i.id === id);
      if (!item || item.readAt) return s;
      return {
        items: s.items.map((i) =>
          i.id === id ? { ...i, readAt: new Date().toISOString() } : i,
        ),
        unread: Math.max(0, s.unread - 1),
      };
    });
    startTransition(async () => {
      await markReadAction(id);
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Notifications${state.unread ? `, ${state.unread} unread` : ""}`}
        onClick={openPanel}
        className="relative cursor-pointer rounded-md border border-line-strong bg-paper-raised p-1.5 text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
      >
        {/* Bell icon (lucide path, inlined to keep this leaf small) */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {state.unread > 0 ? (
          <span
            aria-hidden
            className="num absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-pine px-1 text-[9px] font-bold text-white"
          >
            {state.unread > 9 ? "9+" : state.unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="dialog"
            aria-label="Notifications"
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
            className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 overflow-hidden rounded-lg border border-line bg-paper-raised shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <p className="text-[13px] font-semibold text-ink">Notifications</p>
              {state.unread > 0 ? (
                <button
                  type="button"
                  onClick={markAll}
                  disabled={pending}
                  className="cursor-pointer text-[11px] font-medium text-pine hover:underline disabled:opacity-50"
                >
                  Mark all read
                </button>
              ) : null}
            </div>
            {state.items.length ? (
              <ul className="max-h-80 divide-y divide-line overflow-y-auto">
                {state.items.slice(0, 8).map((n) => {
                  const inner = (
                    <>
                      <p className="text-[12.5px] font-medium text-ink">{n.title}</p>
                      {n.body ? <p className="mt-0.5 text-[11.5px] text-ink-soft">{n.body}</p> : null}
                      <p className="mt-0.5 text-[10px] text-ink-faint">
                        <span title={n.timeISO}>{n.createdAt}</span>
                      </p>
                    </>
                  );
                  return (
                    <li key={n.id} className={cn(!n.readAt && "bg-pine-tint/40")}>
                      {n.link ? (
                        <Link
                          href={n.link}
                          onClick={() => markOne(n.id)}
                          className="block px-3 py-2.5 hover:bg-paper-sunk"
                        >
                          {inner}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => markOne(n.id)}
                          className="block w-full cursor-pointer px-3 py-2.5 text-left hover:bg-paper-sunk"
                        >
                          {inner}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-3 py-5 text-center text-xs text-ink-faint">Nothing yet</p>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
