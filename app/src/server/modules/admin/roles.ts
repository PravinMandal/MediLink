/**
 * Role grants (D2: professional roles granted only by a platform admin).
 *
 * This module has NO "use server" directive — `grantUserRole` takes an
 * explicit actorId and must only be called after the caller proved admin
 * (server action wrapper does requireAdmin; tests pass ids directly).
 * Never export this from a "use server" file: any exported async function
 * there becomes a callable endpoint, and an actorId parameter becomes a
 * privilege-grant gadget.
 */
import { audit } from "@/server/modules/audit/service";

const GRANTABLE_ROLES = new Set(["doctor", "lab_staff", "org_admin"]);

export async function grantUserRole(input: {
  actorId: string;
  targetUserId: string;
  role: string;
  reason: string;
}): Promise<void> {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("@/server/db");
  const { user: userTable } = await import("@/server/db/schema");
  const [actor] = await db
    .select({ id: userTable.id, role: userTable.role })
    .from(userTable)
    .where(eq(userTable.id, input.actorId))
    .limit(1);
  if (!actor || actor.role !== "platform_admin") {
    throw new Error("ACCESS_DENIED");
  }
  if (!GRANTABLE_ROLES.has(input.role)) {
    throw new Error("INVALID_ROLE");
  }
  const [target] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.id, input.targetUserId))
    .limit(1);
  if (!target) throw new Error("USER_NOT_FOUND");
  await db
    .update(userTable)
    .set({ role: input.role as "doctor" | "lab_staff" | "org_admin" })
    .where(eq(userTable.id, input.targetUserId));

  await audit.record({
    actorId: input.actorId,
    actorRole: "platform_admin",
    action: "user.role.granted",
    resourceType: "user",
    resourceId: input.targetUserId,
    reason: input.reason,
    metadata: { role: input.role },
  });
}
