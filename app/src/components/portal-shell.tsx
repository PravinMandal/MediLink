"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, initials } from "@/lib/utils";
import { signOutAction } from "@/server/actions/auth-actions";

export type NavItem = { href: string; label: string };

const NAV: Record<string, NavItem[]> = {
  patient: [
    { href: "/portal/patient", label: "Dashboard" },
    { href: "/portal/patient/timeline", label: "Timeline" },
    { href: "/portal/patient/documents", label: "Documents" },
    { href: "/portal/patient/consents", label: "Consents" },
    { href: "/portal/patient/access-history", label: "Access history" },
    { href: "/portal/patient/emergency", label: "Emergency profile" },
    { href: "/portal/patient/profile", label: "Profile" },
  ],
  doctor: [
    { href: "/portal/doctor", label: "Patients" },
    { href: "/portal/doctor/verification", label: "Verification" },
  ],
  lab_staff: [{ href: "/portal/org", label: "Facility console" }],
  org_admin: [{ href: "/portal/org", label: "Facility console" }],
  platform_admin: [{ href: "/portal/admin", label: "Review queue" }],
};

const ROLE_LABEL: Record<string, string> = {
  patient: "Patient",
  doctor: "Doctor",
  lab_staff: "Lab staff",
  org_admin: "Facility admin",
  platform_admin: "Platform admin",
};

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
  const pathname = usePathname();
  const items = NAV[role] ?? NAV.patient;

  const isActive = (href: string) =>
    href === "/portal/patient" || href === "/portal/doctor"
      ? pathname === href
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:border focus:border-pine focus:bg-paper-raised focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-pine"
      >
        Skip to main content
      </a>
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-paper-raised/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/portal" className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="flex h-7 w-7 items-center justify-center rounded-md bg-pine font-display text-[13px] font-bold text-on-pine"
            >
              M
            </span>
            <span className="font-display text-[17px] font-semibold tracking-tight text-ink">
              MediLink
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {notificationBell}
            <span className="hidden items-center gap-2 text-xs text-ink-soft sm:flex">
              <span
                aria-hidden
                className="num flex h-7 w-7 items-center justify-center rounded-full border border-line-strong bg-paper-sunk text-[10px] font-semibold text-ink"
              >
                {initials(name)}
              </span>
              <span className="max-w-40 truncate font-medium text-ink">{name}</span>
              <span className="rounded-full border border-line bg-paper-sunk px-1.5 py-0.5 text-[10px] font-medium text-ink-soft">
                {ROLE_LABEL[role] ?? role}
              </span>
              {role === "doctor" && verificationStatus === "verified" ? (
                <span className="seal">✓ Verified</span>
              ) : null}
            </span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="cursor-pointer rounded-md border border-line-strong bg-paper-raised px-2.5 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
        {/* Mobile nav strip — scrollable; the only nav landmark (desktop uses plain list) */}
        <nav
          aria-label="Primary"
          className="flex gap-1 overflow-x-auto border-t border-line px-2 py-1.5 [scrollbar-width:none] lg:hidden"
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                isActive(item.href)
                  ? "bg-pine-tint text-pine-ink"
                  : "text-ink-soft hover:bg-paper-sunk",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="mx-auto flex max-w-6xl gap-8 px-4 py-8 sm:px-6">
        {/* Desktop sidebar — same nav as above, presented as a plain list so
            the page keeps a single nav landmark */}
        <aside className="hidden w-48 shrink-0 lg:block">
          <ul className="sticky top-20 space-y-0.5">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "block rounded-md px-3 py-2 text-[13.5px] font-medium transition-colors",
                    isActive(item.href)
                      ? "bg-pine-tint text-pine-ink"
                      : "text-ink-soft hover:bg-paper-sunk hover:text-ink",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        <main id="main" className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
