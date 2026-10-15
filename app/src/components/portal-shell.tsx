/**
 * Barrel (overhaul round 7): the old 304-line "use client" PortalShell is
 * now a server component (portal-shell-server.tsx) + the ActiveNavLinks
 * client island (portal-nav.tsx). This path re-exports the server shell so
 * the portal layout import is unchanged.
 */
export { PortalShell } from "./portal-shell-server";
export type { NavGroup, NavItem, PortalRole } from "./portal-nav";
export { PORTAL_NAV as NAV, ROLE_LABEL } from "./portal-nav";
