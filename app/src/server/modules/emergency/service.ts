/**
 * Emergency (break-glass) module.
 *
 * Unconscious-patient workflow: strong authentication + mandatory reason →
 * time-boxed access to the critical emergency profile → patient notified →
 * event lands in the review queue. Every access is audited.
 */
import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/server/db";
import {
  emergencyAccessEvents,
  patients,
} from "@/server/db/schema";
import { audit } from "@/server/modules/audit/service";
import { access, EMERGENCY_SCOPES } from "@/server/modules/access/guard";
import { notify } from "@/server/modules/notifications/service";
import { records } from "@/server/modules/records/service";

const BREAK_GLASS_WINDOW_MINUTES = 60;

export const emergency = {
  async breakGlass(input: {
    practitionerId: string;
    practitionerUserId: string;
    organizationId?: string | null;
    patientId: string;
    reason: string;
  }) {
    if (!input.reason.trim() || input.reason.trim().length < 10) {
      throw new Error("A clinical reason of at least 10 characters is required.");
    }
    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.id, input.patientId));
    if (!patient) throw new Error("Patient not found");

    // A flagged (investigated as improper) break-glass on this patient by
    // this practitioner blocks arming a new one — no indefinite renewal.
    const [flagged] = await db
      .select({ id: emergencyAccessEvents.id })
      .from(emergencyAccessEvents)
      .where(
        and(
          eq(emergencyAccessEvents.practitionerId, input.practitionerId),
          eq(emergencyAccessEvents.patientId, input.patientId),
          eq(emergencyAccessEvents.reviewStatus, "flagged"),
        ),
      );
    if (flagged) {
      throw new Error(
        "A previous emergency access on this patient was flagged for review. Contact the platform administrator.",
      );
    }

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + BREAK_GLASS_WINDOW_MINUTES * 60 * 1000,
    );

    const [event] = await db
      .insert(emergencyAccessEvents)
      .values({
        patientId: input.patientId,
        practitionerId: input.practitionerId,
        organizationId: input.organizationId ?? null,
        reason: input.reason.trim(),
        accessedAt: now,
        expiresAt,
      })
      .returning();

    // H3 tradeoff: the break-glass row is committed; an audit-append failure
    // must not undo/contradict that (the doctor has access, the patient
    // notification still goes out). Log loudly; record() already retries
    // transient fork races internally.
    try {
      await audit.record({
        actorId: input.practitionerUserId,
        actorRole: "doctor",
        patientId: input.patientId,
        organizationId: input.organizationId ?? null,
        action: "emergency.break_glass",
        resourceType: "emergency_access",
        resourceId: event.id,
        reason: input.reason.trim(),
        metadata: { expiresAt: expiresAt.toISOString() },
      });
    } catch (err) {
      console.error("[audit] write failed (emergency.break_glass)", err);
    }

    // Notify the patient (in-app; email/SMS adapters can subscribe later).
    if (patient.userId) {
      await notify.push({
        userId: patient.userId,
        type: "emergency.access_used",
        title: "Emergency access was used on your record",
        body: `A verified doctor accessed your emergency profile. Reason: ${input.reason.trim()}`,
        link: "/portal/patient/access-history",
      });
      await db
        .update(emergencyAccessEvents)
        .set({ patientNotifiedAt: new Date() })
        .where(eq(emergencyAccessEvents.id, event.id));
    }

    return event;
  },

  /**
   * The compact critical-information profile for emergency clinicians.
   * Requires an authenticated caller with an active break-glass window (or
   * patient self-access); every read is audited. Never callable bare.
   */
  async profile(
    user: { id: string; role: "patient" | "doctor" | "lab_staff" | "org_admin" | "platform_admin"; organizationId?: string | null },
    patientId: string,
  ) {
    const decision = await access.assert(user, patientId, EMERGENCY_SCOPES);
    await audit.record({
      actorId: user.id,
      actorRole: user.role,
      patientId,
      action: "emergency.profile.viewed",
      resourceType: "emergency_profile",
      resourceId: patientId,
      metadata: { via: decision.via },
    });

    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.id, patientId));
    if (!patient) throw new Error("Patient not found");

    const [bloodGroup, allergies, meds, conds, procs, obs] = await Promise.all([
      records.bloodGroup(patientId),
      records.currentAllergies(patientId),
      records.currentMedications(patientId),
      records.currentConditions(patientId),
      records.proceduresFor(patientId),
      records.observationsFor(patientId, 60),
    ]);

    // Most recent creatinine / HbA1c / glucose if present
    const pickLatest = (pattern: RegExp) =>
      obs.find((o) => pattern.test(o.name.toLowerCase()) && o.value);

    return {
      patient: {
        fullName: patient.fullName,
        dob: patient.dob,
        sex: patient.sex,
        bloodGroup:
          bloodGroup.verified?.value ?? bloodGroup.selfReported ?? "Unknown",
        bloodGroupConflict: bloodGroup.conflict,
      },
      allergies: allergies.map((a) => ({
        substance: a.substance,
        criticality: a.criticality,
        reaction: a.reaction,
        trust: a.trust,
      })),
      activeMedications: meds.map((m) => ({
        medication: m.medication,
        dose: m.dose,
        frequency: m.frequency,
      })),
      conditions: conds
        .filter((c) => c.status !== "resolved")
        .map((c) => ({ name: c.name, status: c.status, since: c.onsetDate })),
      majorProcedures: procs.map((p) => ({
        name: p.name,
        date: p.performedDate,
      })),
      keyLabs: [
        pickLatest(/creatinine/),
        pickLatest(/hba1c/),
        pickLatest(/glucose|sugar/),
        pickLatest(/hemoglobin|haemoglobin|hb\b/),
        pickLatest(/potassium/),
      ]
        .filter(Boolean)
        .map((o) => ({
          name: o!.name,
          value: o!.value,
          unit: o!.unit,
          flag: o!.flag,
          date: o!.effectiveDate,
        })),
      emergencyContact: patient.emergencyContactName
        ? {
            name: patient.emergencyContactName,
            phone: patient.emergencyContactPhone,
          }
        : null,
    };
  },

  async activeForPractitioner(practitionerId: string, patientId: string) {
    const [row] = await db
      .select()
      .from(emergencyAccessEvents)
      .where(
        and(
          eq(emergencyAccessEvents.practitionerId, practitionerId),
          eq(emergencyAccessEvents.patientId, patientId),
          gt(emergencyAccessEvents.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(emergencyAccessEvents.accessedAt));
    return row ?? null;
  },

  async pendingReview(limit = 100) {
    return db
      .select()
      .from(emergencyAccessEvents)
      .where(eq(emergencyAccessEvents.reviewStatus, "pending"))
      .orderBy(desc(emergencyAccessEvents.accessedAt))
      .limit(limit);
  },

  async review(input: {
    reviewerId: string;
    eventId: string;
    status: "reviewed" | "flagged";
    notes?: string;
  }) {
    await db
      .update(emergencyAccessEvents)
      .set({
        reviewStatus: input.status,
        reviewNotes: input.notes ?? null,
        reviewedBy: input.reviewerId,
      })
      .where(eq(emergencyAccessEvents.id, input.eventId));
    await audit.record({
      actorId: input.reviewerId,
      actorRole: "platform_admin",
      action: `emergency.review.${input.status}`,
      resourceType: "emergency_access",
      resourceId: input.eventId,
      reason: input.notes,
    });
  },
};
