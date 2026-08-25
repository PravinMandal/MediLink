import { redirect } from "next/navigation";

/** The timeline lives in the Health record hub now; keep deep links working. */
export default async function PatientTimelineRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.kind) qs.set("kind", params.kind);
  if (params.corrected) qs.set("corrected", params.corrected);
  const suffix = qs.size ? `?${qs.toString()}` : "";
  redirect(`/portal/patient/record${suffix}`);
}
