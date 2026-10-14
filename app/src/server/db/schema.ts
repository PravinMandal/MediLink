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
    // Public MediLink Patient ID (random base32 + check char; see
    // identity/patient-code.ts). Never derived from PII or key order.
    patientCode: text("patient_code"),
    // India's national health ID (ABHA). Optional; displayed on the record
    // header when present. Linking/verification via ABDM is a future adapter.
    abhaNumber: text("abha_number"),
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
    accessRequestId: text("access_request_id"),
    policyVersion: text("policy_version").notNull().default("v1"),
    receiptCode: text("receipt_code"),
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
/* BuildPlan P0: access requests, consent artifacts, identity,          */
/* versions, outbox, jobs, policy evaluations, checkpoints             */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* BuildPlan P0 foundation tables                                     */
/* ------------------------------------------------------------------ */

export const accessRequestStatusEnum = pgEnum("access_request_status", [
  "draft",
  "submitted",
  "patient_viewed",
  "approved",
  "declined",
  "expired",
  "cancelled",
]);

export const accessRequests = pgTable(
  "access_requests",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    requesterUserId: text("requester_user_id")
      .notNull()
      .references(() => user.id),
    requesterPractitionerId: text("requester_practitioner_id").references(
      () => practitioners.id,
    ),
    requesterOrganizationId: text("requester_organization_id").references(
      () => organizations.id,
    ),
    /** Snapshot of requester name/credential/org at submission time. */
    requesterSnapshot: jsonb("requester_snapshot").$type<{
      name: string;
      credentialStatus: string;
      organization?: string | null;
      specialty?: string | null;
    }>().notNull(),
    purpose: text("purpose").notNull(),
    purposeDetail: text("purpose_detail"),
    visitReference: text("visit_reference"),
    /** Requester-suggested minimum set — patient must still select scopes. */
    suggestedScopes: jsonb("suggested_scopes").$type<string[]>().notNull().default([]),
    dateWindowStart: text("date_window_start"),
    dateWindowEnd: text("date_window_end"),
    requestedDays: integer("requested_days").notNull(),
    status: accessRequestStatusEnum("status").notNull().default("draft"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    patientViewedAt: timestamp("patient_viewed_at", { withTimezone: true }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    patientResponseReason: text("patient_response_reason"),
    policyVersion: text("policy_version").notNull().default("v1"),
    displayCopyVersion: text("display_copy_version").notNull().default("v1"),
    correlationId: text("correlation_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("access_request_patient_idx").on(t.patientId, t.status),
    index("access_request_requester_idx").on(t.requesterUserId, t.status),
  ],
);

export const consentArtifacts = pgTable(
  "consent_artifacts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    consentId: text("consent_id")
      .notNull()
      .references(() => consents.id, { onDelete: "cascade" }),
    accessRequestId: text("access_request_id").references(
      () => accessRequests.id,
    ),
    artifact: jsonb("artifact").notNull(),
    artifactSha256: text("artifact_sha256").notNull(),
    policyVersion: text("policy_version").notNull().default("v1"),
    receiptCode: text("receipt_code").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("consent_artifact_consent_idx").on(t.consentId)],
);

export const patientIdentityState = pgTable("patient_identity_state", {
  patientId: text("patient_id")
    .primaryKey()
    .references(() => patients.id, { onDelete: "cascade" }),
  state: text("state").notNull().default("provisional"),
  cautionReason: text("caution_reason"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const identityClaims = pgTable(
  "identity_claims",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    method: text("method").notNull(),
    status: text("status").notNull().default("pending"),
    reviewedBy: text("reviewed_by").references(() => user.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("identity_claim_patient_idx").on(t.patientId, t.status)],
);

/**
 * Forward schema (deduplication roadmap): candidate duplicate-patient pairs
 * awaiting human review, plus merge cases and post-merge aliases. No writers
 * yet — the matching engine is unbuilt. Kept deliberately (migrations are
 * append-only; dropping + re-adding later would strand prod data), NOT dead
 * code. Wire writers before building any UI on top.
 */
export const identityMatches = pgTable("identity_matches", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  patientIdA: text("patient_id_a")
    .notNull()
    .references(() => patients.id, { onDelete: "cascade" }),
  patientIdB: text("patient_id_b")
    .notNull()
    .references(() => patients.id, { onDelete: "cascade" }),
  score: numeric("score").notNull(),
  status: text("status").notNull().default("candidate"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const patientMergeCases = pgTable("patient_merge_cases", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  survivorPatientId: text("survivor_patient_id")
    .notNull()
    .references(() => patients.id),
  mergedPatientId: text("merged_patient_id")
    .notNull()
    .references(() => patients.id),
  identityMatchId: text("identity_match_id").references(
    () => identityMatches.id,
  ),
  status: text("status").notNull().default("open"),
  decidedBy: text("decided_by").references(() => user.id),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const patientAliases = pgTable(
  "patient_aliases",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    aliasPatientId: text("alias_patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    canonicalPatientId: text("canonical_patient_id")
      .notNull()
      .references(() => patients.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("patient_alias_alias_idx").on(t.aliasPatientId)],
);

/** Opaque, single-use, short-lived patient-present handoff tokens. */
export const patientHandoffTokens = pgTable(
  "patient_handoff_tokens",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tokenHash: text("token_hash").notNull().unique(),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    code: text("code"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    usedByUserId: text("used_by_user_id").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("handoff_expiry_idx").on(t.expiresAt)],
);

/**
 * Opaque emergency-card tokens (BuildPlan §7.12): a printed card's QR must
 * never encode a raw patient URL or reusable patient identifier — only this
 * opaque token, which resolves server-side after clinician authentication.
 * Tokens are rotatable (revoke + reissue) and never expire silently: they
 * carry NO data and grant NO access by themselves; scanning only routes an
 * authenticated doctor to the audited emergency path for that one patient.
 */
export const emergencyCardTokens = pgTable(
  "emergency_card_tokens",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    /** Raw token: it carries no data and grants no access — it only routes
     *  an authenticated clinician to the audited emergency path. Stored so
     *  the card can be re-rendered without rotating the printed URL. */
    token: text("token").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    useCount: integer("use_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("emergency_card_patient_idx").on(t.patientId)],
);


export const clinicalResourceVersions = pgTable(
  "clinical_resource_versions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    resourceId: text("resource_id").notNull(),
    resourceType: text("resource_type").notNull(),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    payload: jsonb("payload").notNull(),
    payloadSha256: text("payload_sha256").notNull(),
    lifecycleStatus: text("lifecycle_status").notNull().default("active"),
    replacesVersionId: text("replaces_version_id"),
    correctionReason: text("correction_reason"),
    authoredById: text("authored_by_id").references(() => user.id),
    organizationId: text("organization_id").references(() => organizations.id),
    credentialSnapshot: jsonb("credential_snapshot"),
    sourceDocumentId: text("source_document_id"),
    pageRefs: jsonb("page_refs").$type<Array<{ page: number; region?: string }>>(),
    reviewState: text("review_state").notNull().default("not_required"),
    reviewedBy: text("reviewed_by").references(() => user.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    sealedAt: timestamp("sealed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("crv_resource_version_idx").on(t.resourceId, t.version),
    index("crv_patient_idx").on(t.patientId, t.resourceType),
  ],
);

export const attestations = pgTable("attestations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  versionId: text("version_id")
    .notNull()
    .references(() => clinicalResourceVersions.id, { onDelete: "cascade" }),
  attestedBy: text("attested_by")
    .notNull()
    .references(() => user.id),
  attestationText: text("attestation_text").notNull(),
  signatureType: text("signature_type").notNull().default("session_bound"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const dataDisputes = pgTable(
  "data_disputes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    raisedBy: text("raised_by")
      .notNull()
      .references(() => user.id),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("open"),
    resolutionNotes: text("resolution_notes"),
    resolvedBy: text("resolved_by").references(() => user.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("dispute_patient_idx").on(t.patientId, t.status)],
);

export const outboxEvents = pgTable(
  "outbox_events",
  {
    seq: bigint("seq", { mode: "number" })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
  },
  (t) => [
    index("outbox_unprocessed_idx").on(t.processedAt),
  ],
);

export const jobRuns = pgTable(
  "job_runs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    jobType: text("job_type").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull().default("pending"),
    idempotencyKey: text("idempotency_key").unique(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    result: jsonb("result"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("job_run_status_idx").on(t.status, t.jobType)],
);

/**
 * Forward schema: generic idempotency ledger for endpoints that need
 * exactly-once beyond job_runs.idempotency_key. No writers yet — kept for the
 * same append-only-migration reason as the dedup tables above.
 */
export const idempotencyKeys = pgTable("idempotency_keys", {
  key: text("key").primaryKey(),
  scope: text("scope").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const extractionJobs = pgTable(
  "extraction_jobs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    index("extraction_job_status_idx").on(t.status),
    index("extraction_job_document_idx").on(t.documentId),
  ],
);

export const documentScanState = pgTable("document_scan_state", {
  documentId: text("document_id")
    .primaryKey()
    .references(() => documents.id, { onDelete: "cascade" }),
  scanStatus: text("scan_status").notNull().default("pending"),
  scanner: text("scanner"),
  scannedAt: timestamp("scanned_at", { withTimezone: true }),
  detail: text("detail"),
});

export const accessPolicyEvaluations = pgTable(
  "access_policy_evaluations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    actorId: text("actor_id").references(() => user.id),
    patientId: text("patient_id"),
    action: text("action").notNull(),
    scope: text("scope"),
    decision: text("decision").notNull(),
    accessBasisType: text("access_basis_type"),
    accessBasisId: text("access_basis_id"),
    allowedScopes: jsonb("allowed_scopes"),
    reasonCode: text("reason_code").notNull(),
    explanation: text("explanation"),
    correlationId: text("correlation_id"),
    policyVersion: text("policy_version").notNull().default("v1"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("policy_eval_actor_idx").on(t.actorId, t.createdAt)],
);

export const integrityCheckpoints = pgTable("integrity_checkpoints", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  lastSeq: bigint("last_seq", { mode: "number" }).notNull(),
  eventCount: bigint("event_count", { mode: "number" }).notNull(),
  manifestSha256: text("manifest_sha256").notNull(),
  anchoredExternally: boolean("anchored_externally").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const emergencyReadEvents = pgTable(
  "emergency_read_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    emergencyEventId: text("emergency_event_id")
      .notNull()
      .references(() => emergencyAccessEvents.id, { onDelete: "cascade" }),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id),
    action: text("action").notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("emergency_read_event_idx").on(t.emergencyEventId)],
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
export type AccessRequest = typeof accessRequests.$inferSelect;
export type ConsentArtifact = typeof consentArtifacts.$inferSelect;
export type ClinicalResourceVersion = typeof clinicalResourceVersions.$inferSelect;
export type Attestation = typeof attestations.$inferSelect;
export type DataDispute = typeof dataDisputes.$inferSelect;
export type OutboxEvent = typeof outboxEvents.$inferSelect;
export type JobRun = typeof jobRuns.$inferSelect;
export type ExtractionJob = typeof extractionJobs.$inferSelect;
export type AccessPolicyEvaluation = typeof accessPolicyEvaluations.$inferSelect;
export type IntegrityCheckpoint = typeof integrityCheckpoints.$inferSelect;
export type EmergencyReadEvent = typeof emergencyReadEvents.$inferSelect;
export type IdentityClaim = typeof identityClaims.$inferSelect;
export type PatientMergeCase = typeof patientMergeCases.$inferSelect;
export type PatientHandoffToken = typeof patientHandoffTokens.$inferSelect;
export type PatientIdentityState = typeof patientIdentityState.$inferSelect;
