"use server";

import { requireUser } from "@/server/session";
import { notify } from "@/server/modules/notifications/service";

export async function markAllReadAction() {
  const user = await requireUser();
  await notify.markAllRead(user.id);
}

export async function markReadAction(id: string) {
  const user = await requireUser();
  await notify.markRead(user.id, id);
}
