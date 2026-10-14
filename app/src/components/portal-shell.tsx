"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  Bell,
  FileClock,
  FileText,
  Files,
  LayoutDashboard,
  type LucideIcon,
  ScrollText,
  Settings,
  ShieldAlert,
  Siren,
  Stethoscope,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";
import { LogoMark } from "./logo-mark";
import { signOutAction } from "@/server/actions/auth-actions";

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavGroup = { label: string; items: NavItem[] };

const NAV: Record<string, NavGroup[]> = {
  patient: [
    {
      label: "Record",
      items: [
        { href: "/portal/patient", label: "Dashboard", icon: LayoutDashboard },
        { href: "/portal/patient/record", label: "Health record", icon: FileText },
        { href: "/portal/patient/documents", label: "Documents", icon: Files },
      ],
    },
    {
      label: "Sharing",
      items: [
        { href: "/portal/patient/consents", label: "Access centre", icon: ShieldAlert },
        { href: "/portal/patient/access-history", label: "Access history", icon: FileClock },
      ],
    },
    {
      label: "Safety",
      items: [
        { href: "/portal/patient/emergency", label: "Emergency profile", icon: Siren },
        { href: "/portal/patient/profile", label: "Profile & themes", icon: Settings },
      ],
    },
  ],
  doctor: [
    {
      label: "Practice",
      items: [
        { href: "/portal/doctor", label: "Find patient", icon: Stethoscope },
        { href: "/portal/doctor/patients", label: "My patients", icon: Users },
      ],
    },
    {
      label: "Urgent",
      items: [
        { href: "/portal/doctor/emergency", label: "Emergency access", icon: Siren },
      ],
    },
    {
      label: "Account",
      items: [
        { href: "/portal/doctor/inbox", label: "Inbox", icon: Bell },
        { href: "/portal/doctor/verification", label: "Verification", icon: BadgeCheck },
        { href: "/portal/doctor/profile", label: "Profile & themes", icon: Settings },
      ],
    },
  ],
  lab_staff: [
    {
      label: "Facility",
      items: [
        { href: "/portal/org", label: "Work queue", icon: LayoutDashboard },
        { href: "/portal/org#upload", label: "Upload", icon: Files },
      ],
    },
    { label: "Account", items: [{ href: "/portal/org/profile", label: "Profile & themes", icon: Settings }] },
  ],
  org_admin: [
    {
      label: "Facility",
      items: [
        { href: "/portal/org", label: "Work queue", icon: LayoutDashboard },
        { href: "/portal/org#upload", label: "Upload", icon: Files },
      ],
    },
    { label: "Account", items: [{ href: "/portal/org/profile", label: "Profile & themes", icon: Settings }] },
  ],
  platform_admin: [
    {
      label: "Trust & safety",
      items: [
        { href: "/portal/admin", label: "Overview", icon: LayoutDashboard },
        { href: "/portal/admin/verification", label: "Verification", icon: BadgeCheck },
        { href: "/portal/admin/emergency", label: "Emergency review", icon: Siren },
      ],
    },
    {
      label: "Governance",
      items: [
        { href: "/portal/admin/audit", label: "Audit trail", icon: ScrollText },
        { href: "/portal/admin/roles", label: "Role grants", icon: ShieldAlert },
      ],
    },
  ],
};

const ROLE_LABEL: Record<string, string> = {
  patient: "Patient",
  doctor: "Doctor",
  lab_staff: "Lab staff",
  org_admin: "Facility admin",
  platform_admin: "Platform admin",
};

function isActive(pathname: string, href: string) {
  if (href === "/portal/patient" || href === "/portal/doctor" || href === "/portal/org" || href === "/portal/admin")
    return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

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
  const groups = NAV[role] ?? NAV.patient;

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
          {groups.map((group) => (
            <div key={group.label}>
              <p className="eyebrow mb-2.5 px-2.5 text-[10px]">{group.label}</p>
              <ul className="space-y-1.5">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href + item.label}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "glass-hover group flex min-h-11 items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium",
                          active
                            ? "border-pine/25 bg-pine-tint text-pine-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
                            : "text-ink-soft hover:text-ink",
                        )}
                      >
                        <Icon
                          size={17}
                          strokeWidth={2}
                          aria-hidden
                          className={cn(
                            "shrink-0 transition-colors",
                            active ? "text-pine" : "text-ink-faint group-hover:text-pine",
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                        {active ? (
                          <span
                            aria-hidden
                            className="ml-auto h-1.5 w-1.5 rounded-full bg-pine shadow-[0_0_8px_2px_color-mix(in_srgb,var(--prim-pine-300)_60%,transparent)]"
                          />
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
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
                {ROLE_LABEL[role] ?? role}
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
          {groups.flatMap((g) => g.items).map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[44px] min-w-[44px] shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold tracking-tight transition-all",
                  active ? "bg-pine text-on-pine shadow-sm" : "text-ink-soft hover:bg-line/30 hover:text-ink",
                )}
              >
                <Icon size={15} aria-hidden />
                {item.label}
              </Link>
            );
          })}
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

