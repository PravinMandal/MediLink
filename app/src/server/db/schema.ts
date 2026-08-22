/**
 * MediLink database schema.
 *
 * Principles encoded here:
 * - Every clinical row carries provenance (author, organization, source document,
 *   content hash, verification status) — "data exists" is never confused with
 *   "data is trustworthy".
 * - Clinical tables are FHIR-R4-inspired; a `resource` JSONB column holds the
 *   FHIR-shaped payload for future ABDM/NRCES interoperability.
 * - Records are append-oriented: corrections create new rows that point back via
 *   `supersededById`; originals are never overwritten.
 * - Audit events are hash-chained for tamper evidence.
 */
import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  integer,
  bigint,
  boolean,
  jsonb,
  numeric,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const userRoleEnum = pgEnum("user_role", [
  "patient",
  "doctor",
  "lab_staff",
  "org_admin",
  "platform_admin",
]);

export const verificationStatusEnum = pgEnum("verification_status", [
  "unverified",
  "pending",
  "verified",
  "rejected",
]);

export const orgTypeEnum = pgEnum("org_type", [
  "hospital",
  "clinic",
  "lab",
  "diagnostic_center",
  "pharmacy",
]);

export const recordTrustEnum = pgEnum("record_trust", [
  "verified", // authored by a verified professional/org
  "extracted", // machine-extracted from an uploaded source document
  "self_reported", // patient-entered
  "amended", // correction superseding an earlier record
]);

export const documentKindEnum = pgEnum("document_kind", [
  "lab_report",
  "prescription",
  "discharge_summary",
  "imaging_report",
  "consultation_note",
  "other",
]);

export const extractionStatusEnum = pgEnum("extraction_status", [
  "pending",
  "processing",
  "done",
  "failed",
]);

export const consentScopeEnum = pgEnum("consent_scope", [
  "demographics",
  "conditions",
  "allergies",
  "medications",
  "lab_results",
  "imaging",
  "procedures",
  "documents",
  "sensitive",
]);

export const consentStatusEnum = pgEnum("consent_status", [
  "active",
  "revoked",
  "expired",
]);

export const consentPurposeEnum = pgEnum("consent_purpose", [
  "treatment",
  "consultation",
  "emergency",
  "record_review",
]);

export const encounterTypeEnum = pgEnum("encounter_type", [
  "opd",
  "ipd",
  "emergency",
  "teleconsult",
]);

export const observationFlagEnum = pgEnum("observation_flag", [
  "normal",
  "high",
  "low",
  "critical",
  "unknown",
]);

export const medicationStatusEnum = pgEnum("medication_status", [
  "active",
  "stopped",
  "completed",
]);

export const conditionStatusEnum = pgEnum("condition_status", [
  "active",
  "resolved",
  "chronic",
]);

/* ------------------------------------------------------------------ */
/* Better Auth tables                                                  */
/* ------------------------------------------------------------------ */

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    // MediLink fields
    role: userRoleEnum("role").notNull().default("patient"),
    phone: text("phone"),
    organizationId: text("organization_id"),
    verificationStatus: verificationStatusEnum("verification_status")
      .notNull()
      .default("unverified"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("user_role_idx").on(t.role)],
);

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Organizations & practitioners                                       */
/* ------------------------------------------------------------------ */

export const organizations = pgTable(
  "organizations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    type: orgTypeEnum("type").notNull(),
    registrationNumber: text("registration_number"),
    addressLine: text("address_line"),
    city: text("city"),
    state: text("state"),
    pincode: text("pincode"),
    verificationStatus: verificationStatusEnum("verification_status")
      .notNull()
      .default("unverified"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verifiedBy: text("verified_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("org_status_idx").on(t.verificationStatus)],
);

export const organizationVerifications = pgTable(
  "organization_verifications",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    submittedBy: text("submitted_by").references(() => user.id),
    status: verificationStatusEnum("status").notNull().default("pending"),
    evidence: jsonb("evidence"),
    notes: text("notes"),
    reviewedBy: text("reviewed_by").references(() => user.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("orgver_org_idx").on(t.organizationId)],
);

export const practitioners = pgTable(
  "practitioners",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(
      () => organizations.id,
    ),
    fullName: text("full_name").notNull(),
    registrationNumber: text("registration_number").notNull(),
    council: text("council"),
    qualification: text("qualification"),
    specialty: text("specialty"),
    verificationStatus: verificationStatusEnum("verification_status")
      .notNull()
      .default("unverified"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verifiedBy: text("verified_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("practitioner_user_unique").on(t.userId),
    index("practitioner_status_idx").on(t.verificationStatus),
  ],
);

export const practitionerVerifications = pgTable(
  "practitioner_verifications",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    practitionerId: text("practitioner_id")
      .notNull()
      .references(() => practitioners.id, { onDelete: "cascade" }),
    status: verificationStatusEnum("status").notNull().default("pending"),
    evidence: jsonb("evidence"),
    notes: text("notes"),
    reviewedBy: text("reviewed_by").references(() => user.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("praver_practitioner_idx").on(t.practitionerId)],
);

/* ------------------------------------------------------------------ */
/* Patients                                                            */
/* ------------------------------------------------------------------ */

export const patients = pgTable(
  "patients",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // App account link — nullable because records can exist for humans who
    // have not signed up yet (created by organizations during care).
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    mrn: text("mrn"),
    fullName: text("full_name").notNull(),
    dob: text("dob"), // ISO date string
    sex: text("sex"),
    // Self-reported; verified values live in observations (blood group panel)
    bloodGroupSelfReported: text("blood_group_self_reported"),
    phone: text("phone"),
    addressCity: text("address_city"),
    emergencyContactName: text("emergency_contact_name"),
    emergencyContactPhone: text("emergency_contact_phone"),
    createdById: text("created_by_id").references(() => user.id),
    organizationId: text("organization_id").references(() => organizations.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("patient_user_idx").on(t.userId),
    index("patient_name_idx").on(t.fullName),
  ],
);

export const patientIdentifiers = pgTable(
  "patient_identifiers",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    // ABHA linkage lands here via the AbdmAdapter — never as a foreign key.
    type: text("type").notNull(), // abha_number | abha_address | mrn | org_mrn
    value: text("value").notNull(),
    verified: boolean("verified").notNull().default(false),
    sourceOrganizationId: text("source_organization_id").references(
      () => organizations.id,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("patident_patient_idx").on(t.patientId)],
);

/* ------------------------------------------------------------------ */
/* Provenance helper — spread into every clinical table                */
/* ------------------------------------------------------------------ */

const provenance = {
  authoredById: text("authored_by_id").references(() => user.id),
  organizationId: text("organization_id").references(() => organizations.id),
  sourceDocumentId: text("source_document_id"),
  trust: recordTrustEnum("trust").notNull().default("self_reported"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  supersededById: text("superseded_by_id"),
  resource: jsonb("resource"),
};

/* ------------------------------------------------------------------ */
/* Clinical resources                                                  */
/* ------------------------------------------------------------------ */

export const encounters = pgTable(
  "encounters",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    practitionerId: text("practitioner_id").references(() => practitioners.id),
    type: encounterTypeEnum("type").notNull(),
    reason: text("reason"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    notes: text("notes"),
    ...provenance,
  },
  (t) => [index("encounter_patient_idx").on(t.patientId, t.occurredAt)],
);

export const conditions = pgTable(
  "conditions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code"),
    codeSystem: text("code_system"),
    status: conditionStatusEnum("status").notNull().default("active"),
    onsetDate: text("onset_date"),
    resolvedDate: text("resolved_date"),
    notes: text("notes"),
    ...provenance,
  },
  (t) => [index("condition_patient_idx").on(t.patientId)],
);

export const allergies = pgTable(
  "allergies",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    substance: text("substance").notNull(),
    category: text("category"),
    criticality: text("criticality"),
    reaction: text("reaction"),
    onsetDate: text("onset_date"),
    ...provenance,
  },
  (t) => [index("allergy_patient_idx").on(t.patientId)],
);

export const medicationStatements = pgTable(
  "medication_statements",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    medication: text("medication").notNull(),
    dose: text("dose"),
    route: text("route"),
    frequency: text("frequency"),
    startDate: text("start_date"),
    endDate: text("end_date"),
    status: medicationStatusEnum("status").notNull().default("active"),
    prescriberId: text("prescriber_id").references(() => practitioners.id),
    notes: text("notes"),
    ...provenance,
  },
  (t) => [index("medstat_patient_idx").on(t.patientId)],
);

export const observations = pgTable(
  "observations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    panel: text("panel"), // e.g. "CBC", "Lipid Profile", "HbA1c"
    name: text("name").notNull(), // e.g. "Hemoglobin", "HbA1c"
    loincCode: text("loinc_code"),
    value: numeric("value"),
    valueString: text("value_string"),
    unit: text("unit"),
    referenceRangeLow: numeric("reference_range_low"),
    referenceRangeHigh: numeric("reference_range_high"),
    flag: observationFlagEnum("flag").notNull().default("unknown"),
    effectiveDate: text("effective_date"),
    ...provenance,
  },
  (t) => [
    index("observation_patient_idx").on(t.patientId),
    index("observation_name_idx").on(t.name),
  ],
);

export const procedures = pgTable(
  "procedures",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    performedDate: text("performed_date"),
    outcome: text("outcome"),
    notes: text("notes"),
    ...provenance,
  },
  (t) => [index("procedure_patient_idx").on(t.patientId)],
);

export const immunizations = pgTable(
  "immunizations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    vaccine: text("vaccine").notNull(),
    date: text("date"),
    doseNumber: integer("dose_number"),
    ...provenance,
  },
  (t) => [index("immunization_patient_idx").on(t.patientId)],
);

export const diagnosticReports = pgTable(
  "diagnostic_reports",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    category: text("category").notNull().default("other"),
    conclusion: text("conclusion"),
    effectiveDate: text("effective_date"),
    ...provenance,
  },
  (t) => [index("diagreport_patient_idx").on(t.patientId)],
);

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

export const documents = pgTable(
  "documents",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    kind: documentKindEnum("kind").notNull().default("other"),
    title: text("title").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: text("storage_key").notNull(),
    contentHash: text("content_hash").notNull(),
    pageCount: integer("page_count"),
    textExtract: text("text_extract"),
    extractionStatus: extractionStatusEnum("extraction_status")
      .notNull()
      .default("pending"),
    extractionError: text("extraction_error"),
    encounterId: text("encounter_id").references(() => encounters.id),
    recordedDate: text("recorded_date"), // clinical date on the document
    uploadedById: text("uploaded_by_id")
      .notNull()
      .references(() => user.id),
    organizationId: text("organization_id").references(() => organizations.id),
    supersededById: text("superseded_by_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("document_patient_idx").on(t.patientId, t.createdAt),
    index("document_extraction_idx").on(t.extractionStatus),
  ],
);

/* ------------------------------------------------------------------ */
/* Consent                                                             */
/* ------------------------------------------------------------------ */

export const consents = pgTable(
  "consents",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    granteeType: text("grantee_type").notNull(), // practitioner | organization
    granteePractitionerId: text("grantee_practitioner_id").references(
      () => practitioners.id,
      { onDelete: "cascade" },
    ),
    granteeOrganizationId: text("grantee_organization_id").references(
      () => organizations.id,
      { onDelete: "cascade" },
    ),
    scopes: jsonb("scopes").$type<string[]>().notNull(),
    purpose: consentPurposeEnum("purpose").notNull().default("treatment"),
    status: consentStatusEnum("status").notNull().default("active"),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("consent_patient_idx").on(t.patientId),
    index("consent_grantee_idx").on(t.granteePractitionerId),
  ],
);

/* ------------------------------------------------------------------ */
/* Audit — append-only, hash-chained                                   */
/* ------------------------------------------------------------------ */

export const auditEvents = pgTable(
  "audit_events",
  {
    // bigint identity gives a strict monotonic sequence for the hash chain
    seq: bigint("seq", { mode: "number" })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    actorId: text("actor_id").references(() => user.id),
    actorRole: text("actor_role"),
    patientId: text("patient_id"),
    organizationId: text("organization_id"),
    action: text("action").notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    reason: text("reason"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    prevHash: text("prev_hash").notNull(),
    hash: text("hash").notNull(),
  },
  (t) => [
    index("audit_patient_idx").on(t.patientId),
    index("audit_actor_idx").on(t.actorId),
    index("audit_action_idx").on(t.action),
  ],
);

/* ------------------------------------------------------------------ */
/* Emergency (break-glass)                                             */
/* ------------------------------------------------------------------ */

export const emergencyAccessEvents = pgTable(
  "emergency_access_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    practitionerId: text("practitioner_id")
      .notNull()
      .references(() => practitioners.id),
    organizationId: text("organization_id").references(() => organizations.id),
    reason: text("reason").notNull(),
    accessedAt: timestamp("accessed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    patientNotifiedAt: timestamp("patient_notified_at", { withTimezone: true }),
    reviewStatus: text("review_status").notNull().default("pending"),
    reviewNotes: text("review_notes"),
    reviewedBy: text("reviewed_by").references(() => user.id),
  },
  (t) => [index("emergency_patient_idx").on(t.patientId)],
);

/* ------------------------------------------------------------------ */
/* AI summaries & claims                                               */
/* ------------------------------------------------------------------ */

export const aiSummaries = pgTable(
  "ai_summaries",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    requestedById: text("requested_by_id").references(() => user.id),
    question: text("question"),
    mode: text("mode").notNull(), // deterministic | llm
    model: text("model"),
    sbar: jsonb("sbar").$type<{
      situation: string;
      background: string[];
      assessment: string[];
      plan: string[];
    }>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("aisummary_patient_idx").on(t.patientId, t.createdAt)],
);

export const aiSummaryClaims = pgTable(
  "ai_summary_claims",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    summaryId: text("summary_id")
      .notNull()
      .references(() => aiSummaries.id, { onDelete: "cascade" }),
    section: text("section").notNull(), // situation | background | assessment | plan
    ordinal: integer("ordinal").notNull(),
    text: text("text").notNull(),
    sources: jsonb("sources")
      .$type<
        Array<{
          recordType: string;
          recordId: string;
          documentId?: string;
          label: string;
          date?: string;
          trust: string;
        }>
      >()
      .notNull(),
  },
  (t) => [index("aiclaim_summary_idx").on(t.summaryId)],
);

/* ------------------------------------------------------------------ */
/* Conflicts (contradiction engine)                                    */
/* ------------------------------------------------------------------ */

export const conflicts = pgTable(
  "conflicts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // blood_group | allergy | medication | duplicate | dob
    severity: text("severity").notNull().default("warning"),
    details: jsonb("details"),
    status: text("status").notNull().default("open"),
    detectedAt: timestamp("detected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedBy: text("resolved_by").references(() => user.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [index("conflict_patient_idx").on(t.patientId, t.status)],
);

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export const notifications = pgTable(
  "notifications",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("notification_user_idx").on(t.userId, t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Search — text vectors for patient-scoped full-text search           */
/* ------------------------------------------------------------------ */

export const searchChunks = pgTable(
  "search_chunks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    documentId: text("document_id").references(() => documents.id, {
      onDelete: "cascade",
    }),
    recordType: text("record_type").notNull(),
    recordId: text("record_id").notNull(),
    label: text("label").notNull(),
    date: text("date"),
    trust: text("trust"),
    content: text("content").notNull(),
    // Note: the GIN full-text index over to_tsvector('english', content) is
    // created by the migrate script as an expression index (drizzle-kit cannot
    // serialize a self-referencing generated column).
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("chunk_patient_idx").on(t.patientId),
    index("chunk_document_idx").on(t.documentId),
  ],
);

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type User = typeof user.$inferSelect;
export type Patient = typeof patients.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type Practitioner = typeof practitioners.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type ConsentRow = typeof consents.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type AiSummary = typeof aiSummaries.$inferSelect;
export type AiSummaryClaim = typeof aiSummaryClaims.$inferSelect;
export type ConflictRow = typeof conflicts.$inferSelect;
export type EmergencyAccessEvent = typeof emergencyAccessEvents.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type SearchChunk = typeof searchChunks.$inferSelect;
