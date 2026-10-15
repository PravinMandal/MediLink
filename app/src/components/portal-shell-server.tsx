import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { initials } from "@/lib/utils";
import { LogoMark } from "./logo-mark";
import { signOutAction } from "@/server/actions/auth-actions";
import {
  ActiveNavLinks,
  PORTAL_NAV,
  ROLE_LABEL,
  type NavGroup,
  type NavItem,
  type PortalRole,
} from "./portal-nav";

// Re-export nav types/data for consumers that imported them from the shell.
export type { NavGroup, NavItem, PortalRole };
export { PORTAL_NAV as NAV, ROLE_LABEL };

function isKnownRole(role: string): role is PortalRole {
  return role in PORTAL_NAV;
}

/**
 * Server portal shell (overhaul round 7): the old PortalShell was
 * "use client" for 304 lines solely for usePathname + sign-out. The only
 * interactive part — nav active states — is now the ActiveNavLinks island;
 * everything else (brand, identity footer, headers, main) renders on the
 * server. The sign-out form is a server action and needs no JS.
 */
export function PortalShell({
  role,
  name,
  verificationStatus,
  notificationBell,
  children,
}: {
  role: string;
  name: string;
  verificationStatus?: string;
  notificationBell?: React.ReactNode;
  children: React.ReactNode;
}) {
  const roleLabel = isKnownRole(role) ? ROLE_LABEL[role] : role;

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:border focus:border-pine focus:bg-paper-raised focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-pine"
      >
        Skip to main content
      </a>

      {/* ---------------- Fixed left rail (desktop) ---------------- */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-line frost-strong lg:flex">
        {/* Brand */}
        <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-line px-5">
          <LogoMark size={30} aria-hidden />
          <span className="font-display text-[19px] font-bold tracking-tight text-ink">
            MediLink
          </span>
        </div>

        {/* Grouped nav */}
        <nav
          aria-label="Primary"
          className="flex-1 space-y-7 overflow-y-auto px-3 py-5"
        >
          <ActiveNavLinks role={role} variant="rail" />
        </nav>

        {/* Identity footer */}
        <div className="shrink-0 border-t border-line px-3 py-3">
          <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
            <span
              aria-hidden
              className="num flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pine to-pine-deep text-[11px] font-semibold text-on-pine shadow-sm"
            >
              {initials(name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold leading-tight text-ink">{name}</p>
              <p className="flex items-center gap-1 text-[11px] text-ink-faint">
                {roleLabel}
                {role === "doctor" && verificationStatus === "verified" ? (
                  <>
                    <BadgeCheck size={12} aria-hidden className="text-pine" />
                    verified
                  </>
                ) : null}
              </p>
            </div>
          </div>
          <form action={signOutAction} className="mt-1">
            <button
              type="submit"
              className="glass-hover w-full rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-ink-faint hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* ---------------- Mobile top bar ---------------- */}
      <header className="glass-shell sticky top-0 z-30 border-b lg:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <Link href="/portal" className="flex items-center gap-2">
            <LogoMark size={26} aria-hidden />
            <span className="font-display text-[17px] font-bold tracking-tight text-ink">MediLink</span>
          </Link>
          <div className="flex items-center gap-2">{notificationBell}</div>
        </div>
        {/* Mobile nav strip */}
        <nav
          aria-label="Primary"
          className="flex gap-1 overflow-x-auto border-t border-line px-2.5 pb-1.5 pt-1 [scrollbar-width:none]"
        >
          <div className="flex gap-1">
            <ActiveNavLinks role={role} variant="strip" />
          </div>
        </nav>
      </header>

      {/* Desktop header strip (bell only; nav lives in the rail). A real
          bar with reserved height — never a zero-height overlay — so page
          content (e.g. the consent banner) can't scroll underneath the
          controls. */}
      <div className="sticky top-0 z-20 hidden lg:block lg:pl-[248px]">
        {/* Solid surface (not frost): cross-origin document iframes scroll
            beneath this bar and backdrop-filter cannot sample them, so any
            translucency ghosts iframe text through over the controls. h-16
            matches the sidebar brand row so the two hairlines sit on one line. */}
        <div className="border-b border-line bg-paper-raised">
          <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-end gap-3 px-7">
            {notificationBell}
          </div>
        </div>
      </div>

      <main id="main" className="min-h-dvh lg:pl-[248px]">
        <div className="mx-auto max-w-[1180px] animate-[page-in_0.45s_cubic-bezier(0.22,1,0.36,1)_both] px-4 py-7 sm:px-7 lg:py-9">{children}</div>
      </main>
      <style>{`@keyframes page-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
