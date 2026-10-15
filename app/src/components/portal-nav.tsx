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

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavGroup = { label: string; items: NavItem[] };
export type PortalRole =
  | "patient"
  | "doctor"
  | "lab_staff"
  | "org_admin"
  | "platform_admin";

export const PORTAL_NAV: Record<PortalRole, NavGroup[]> = {
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

export const ROLE_LABEL: Record<PortalRole, string> = {
  patient: "Patient",
  doctor: "Doctor",
  lab_staff: "Lab staff",
  org_admin: "Facility admin",
  platform_admin: "Platform admin",
};

/** Re-exported for tests/consumers that import nav data from the shell. */
export { BadgeCheck };

function isActive(pathname: string, href: string) {
  if (
    href === "/portal/patient" ||
    href === "/portal/doctor" ||
    href === "/portal/org" ||
    href === "/portal/admin"
  )
    return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Client nav island (overhaul round 7): the only part of the portal shell
 * that needs usePathname. Renders either the desktop rail groups or the
 * mobile strip.
 */
export function ActiveNavLinks({
  role,
  variant,
}: {
  role: string;
  variant: "rail" | "strip";
}) {
  const pathname = usePathname();
  const groups = (PORTAL_NAV as Record<string, NavGroup[]>)[role] ?? PORTAL_NAV.patient;
  if (variant === "strip") {
    return (
      <>
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
      </>
    );
  }
  return (
    <>
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
    </>
  );
}
