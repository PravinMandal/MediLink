"use server";

import { requireUser } from "@/server/session";
import { notify } from "@/server/modules/notifications/service";
import { field, FIELD_LIMITS } from "@/server/modules/security/field";

export async function markAllReadAction() {
  const user = await requireUser();
  await notify.markAllRead(user.id);
}

export async function markReadAction(id: string) {
  const user = await requireUser();
  const idR = field(id, FIELD_LIMITS.short, { label: "Notification", required: true });
  if (!idR.ok) return;
  await notify.markRead(user.id, idR.value);
}
