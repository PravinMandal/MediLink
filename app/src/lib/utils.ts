import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(
  date: string | Date | null | undefined,
  style: "short" | "medium" = "medium",
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString(
    "en-IN",
    style === "short"
      ? { day: "numeric", month: "short", year: "2-digit" }
      : { day: "numeric", month: "short", year: "numeric" },
  );
}

export function formatTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function timeAgo(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days} day${days > 1 ? "s" : ""} ago`;
  return formatDate(d);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export const TRUST_LABEL: Record<string, string> = {
  verified: "Verified",
  extracted: "Extracted from source",
  self_reported: "Self-reported",
  amended: "Amended",
};

/** Human label for every audit action the platform writes — the patient's
 *  access log must read as prose, never raw snake_case codes. */
export const AUDIT_ACTION_LABEL: Record<string, string> = {
  "document.viewed": "Viewed a source document",
  "document.uploaded": "Uploaded a document",
  "document.extraction.retried": "Retried document extraction",
  "ai.summary.generated": "Generated an AI summary",
  "consent.granted": "You granted access",
  "consent.revoked": "You revoked access",
  "consent.requested": "Requested access to your records",
  "consent.expired": "A consent expired",
  "emergency.break_glass": "EMERGENCY ACCESS USED",
  "emergency.profile.viewed": "Viewed the emergency profile",
  "emergency.review.approved": "Break-glass reviewed: approved",
  "emergency.review.flagged": "Break-glass reviewed: FLAGGED",
  "record.condition.created": "Added a condition",
  "record.allergy.created": "Added an allergy",
  "record.medication.created": "Added a medication",
  "record.procedure.created": "Added a procedure",
  "record.encounter.created": "Recorded an encounter",
  "record.immunization.created": "Administered an immunization",
  "record.observations.batch_created": "Added lab results",
  "record.superseded": "Updated a record (old version kept)",
  "patient.created": "Record created",
  "patient.profile.updated": "You updated your profile",
  "patient.viewed": "Opened your record",
  "patient.account.linked": "Account linked to record",
  "practitioner.verification.submitted": "Submitted verification",
  "user.role.granted": "Role granted by an administrator",
  "organization.created": "Facility registered",
};

export function formatAuditAction(action: string): string {
  return AUDIT_ACTION_LABEL[action] ?? action.replace(/[._]/g, " ");
}

export const KIND_LABEL: Record<string, string> = {
  condition: "Condition",
  allergy: "Allergy",
  medication: "Medication",
  observation: "Lab / observation",
  procedure: "Procedure",
  immunization: "Immunization",
  report: "Report",
  document: "Document",
  encounter: "Encounter",
};

export function ageFrom(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const years = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
  // Future DOBs are data errors, not negative ages.
  return years >= 0 ? years : null;
}
