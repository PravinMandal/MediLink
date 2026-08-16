CREATE TYPE "public"."condition_status" AS ENUM('active', 'resolved', 'chronic');--> statement-breakpoint
CREATE TYPE "public"."consent_purpose" AS ENUM('treatment', 'consultation', 'emergency', 'record_review');--> statement-breakpoint
CREATE TYPE "public"."consent_scope" AS ENUM('demographics', 'conditions', 'allergies', 'medications', 'lab_results', 'imaging', 'procedures', 'documents', 'sensitive');--> statement-breakpoint
CREATE TYPE "public"."consent_status" AS ENUM('active', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('lab_report', 'prescription', 'discharge_summary', 'imaging_report', 'consultation_note', 'other');--> statement-breakpoint
CREATE TYPE "public"."encounter_type" AS ENUM('opd', 'ipd', 'emergency', 'teleconsult');--> statement-breakpoint
CREATE TYPE "public"."extraction_status" AS ENUM('pending', 'processing', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."medication_status" AS ENUM('active', 'stopped', 'completed');--> statement-breakpoint
CREATE TYPE "public"."observation_flag" AS ENUM('normal', 'high', 'low', 'critical', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."org_type" AS ENUM('hospital', 'clinic', 'lab', 'diagnostic_center', 'pharmacy');--> statement-breakpoint
CREATE TYPE "public"."record_trust" AS ENUM('verified', 'extracted', 'self_reported', 'amended');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('patient', 'doctor', 'lab_staff', 'org_admin', 'platform_admin');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('unverified', 'pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_summaries" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"requested_by_id" text,
	"question" text,
	"mode" text NOT NULL,
	"model" text,
	"sbar" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_summary_claims" (
	"id" text PRIMARY KEY NOT NULL,
	"summary_id" text NOT NULL,
	"section" text NOT NULL,
	"ordinal" integer NOT NULL,
	"text" text NOT NULL,
	"sources" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "allergies" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"substance" text NOT NULL,
	"category" text,
	"criticality" text,
	"reaction" text,
	"onset_date" text,
	"authored_by_id" text,
	"organization_id" text,
	"source_document_id" text,
	"trust" "record_trust" DEFAULT 'self_reported' NOT NULL,
	"recorded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_by_id" text,
	"resource" jsonb
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"seq" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_events_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_id" text,
	"actor_role" text,
	"patient_id" text,
	"organization_id" text,
	"action" text NOT NULL,
	"resource_type" text,
	"resource_id" text,
	"reason" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"prev_hash" text NOT NULL,
	"hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conditions" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"code_system" text,
	"status" "condition_status" DEFAULT 'active' NOT NULL,
	"onset_date" text,
	"resolved_date" text,
	"notes" text,
	"authored_by_id" text,
	"organization_id" text,
	"source_document_id" text,
	"trust" "record_trust" DEFAULT 'self_reported' NOT NULL,
	"recorded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_by_id" text,
	"resource" jsonb
);
--> statement-breakpoint
CREATE TABLE "conflicts" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"kind" text NOT NULL,
	"severity" text DEFAULT 'warning' NOT NULL,
	"details" jsonb,
	"status" text DEFAULT 'open' NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"grantee_type" text NOT NULL,
	"grantee_practitioner_id" text,
	"grantee_organization_id" text,
	"scopes" jsonb NOT NULL,
	"purpose" "consent_purpose" DEFAULT 'treatment' NOT NULL,
	"status" "consent_status" DEFAULT 'active' NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diagnostic_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"title" text NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"conclusion" text,
	"effective_date" text,
	"authored_by_id" text,
	"organization_id" text,
	"source_document_id" text,
	"trust" "record_trust" DEFAULT 'self_reported' NOT NULL,
	"recorded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_by_id" text,
	"resource" jsonb
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"kind" "document_kind" DEFAULT 'other' NOT NULL,
	"title" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"content_hash" text NOT NULL,
	"page_count" integer,
	"text_extract" text,
	"extraction_status" "extraction_status" DEFAULT 'pending' NOT NULL,
	"extraction_error" text,
	"encounter_id" text,
	"recorded_date" text,
	"uploaded_by_id" text NOT NULL,
	"organization_id" text,
	"superseded_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emergency_access_events" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"practitioner_id" text NOT NULL,
	"organization_id" text,
	"reason" text NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"patient_notified_at" timestamp with time zone,
	"review_status" text DEFAULT 'pending' NOT NULL,
	"review_notes" text,
	"reviewed_by" text
);
--> statement-breakpoint
CREATE TABLE "encounters" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"practitioner_id" text,
	"type" "encounter_type" NOT NULL,
	"reason" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"notes" text,
	"authored_by_id" text,
	"organization_id" text,
	"source_document_id" text,
	"trust" "record_trust" DEFAULT 'self_reported' NOT NULL,
	"recorded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_by_id" text,
	"resource" jsonb
);
--> statement-breakpoint
CREATE TABLE "immunizations" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"vaccine" text NOT NULL,
	"date" text,
	"dose_number" integer,
	"authored_by_id" text,
	"organization_id" text,
	"source_document_id" text,
	"trust" "record_trust" DEFAULT 'self_reported' NOT NULL,
	"recorded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_by_id" text,
	"resource" jsonb
);
--> statement-breakpoint
CREATE TABLE "medication_statements" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"medication" text NOT NULL,
	"dose" text,
	"route" text,
	"frequency" text,
	"start_date" text,
	"end_date" text,
	"status" "medication_status" DEFAULT 'active' NOT NULL,
	"prescriber_id" text,
	"notes" text,
	"authored_by_id" text,
	"organization_id" text,
	"source_document_id" text,
	"trust" "record_trust" DEFAULT 'self_reported' NOT NULL,
	"recorded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_by_id" text,
	"resource" jsonb
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "observations" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"panel" text,
	"name" text NOT NULL,
	"loinc_code" text,
	"value" numeric,
	"value_string" text,
	"unit" text,
	"reference_range_low" numeric,
	"reference_range_high" numeric,
	"flag" "observation_flag" DEFAULT 'unknown' NOT NULL,
	"effective_date" text,
	"authored_by_id" text,
	"organization_id" text,
	"source_document_id" text,
	"trust" "record_trust" DEFAULT 'self_reported' NOT NULL,
	"recorded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_by_id" text,
	"resource" jsonb
);
--> statement-breakpoint
CREATE TABLE "organization_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"submitted_by" text,
	"status" "verification_status" DEFAULT 'pending' NOT NULL,
	"evidence" jsonb,
	"notes" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" "org_type" NOT NULL,
	"registration_number" text,
	"address_line" text,
	"city" text,
	"state" text,
	"pincode" text,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"verified_at" timestamp with time zone,
	"verified_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_identifiers" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"type" text NOT NULL,
	"value" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"source_organization_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"mrn" text,
	"full_name" text NOT NULL,
	"dob" text,
	"sex" text,
	"blood_group_self_reported" text,
	"phone" text,
	"address_city" text,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"created_by_id" text,
	"organization_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practitioner_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"practitioner_id" text NOT NULL,
	"status" "verification_status" DEFAULT 'pending' NOT NULL,
	"evidence" jsonb,
	"notes" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practitioners" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"full_name" text NOT NULL,
	"registration_number" text NOT NULL,
	"council" text,
	"qualification" text,
	"specialty" text,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"verified_at" timestamp with time zone,
	"verified_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "procedures" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"name" text NOT NULL,
	"performed_date" text,
	"outcome" text,
	"notes" text,
	"authored_by_id" text,
	"organization_id" text,
	"source_document_id" text,
	"trust" "record_trust" DEFAULT 'self_reported' NOT NULL,
	"recorded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_by_id" text,
	"resource" jsonb
);
--> statement-breakpoint
CREATE TABLE "search_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"document_id" text,
	"record_type" text NOT NULL,
	"record_id" text NOT NULL,
	"label" text NOT NULL,
	"date" text,
	"trust" text,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "user_role" DEFAULT 'patient' NOT NULL,
	"phone" text,
	"organization_id" text,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_summaries" ADD CONSTRAINT "ai_summaries_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_summaries" ADD CONSTRAINT "ai_summaries_requested_by_id_user_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_summary_claims" ADD CONSTRAINT "ai_summary_claims_summary_id_ai_summaries_id_fk" FOREIGN KEY ("summary_id") REFERENCES "public"."ai_summaries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allergies" ADD CONSTRAINT "allergies_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allergies" ADD CONSTRAINT "allergies_authored_by_id_user_id_fk" FOREIGN KEY ("authored_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allergies" ADD CONSTRAINT "allergies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_authored_by_id_user_id_fk" FOREIGN KEY ("authored_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflicts" ADD CONSTRAINT "conflicts_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflicts" ADD CONSTRAINT "conflicts_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_grantee_practitioner_id_practitioners_id_fk" FOREIGN KEY ("grantee_practitioner_id") REFERENCES "public"."practitioners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_grantee_organization_id_organizations_id_fk" FOREIGN KEY ("grantee_organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_reports" ADD CONSTRAINT "diagnostic_reports_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_reports" ADD CONSTRAINT "diagnostic_reports_authored_by_id_user_id_fk" FOREIGN KEY ("authored_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_reports" ADD CONSTRAINT "diagnostic_reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_encounter_id_encounters_id_fk" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_id_user_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_access_events" ADD CONSTRAINT "emergency_access_events_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_access_events" ADD CONSTRAINT "emergency_access_events_practitioner_id_practitioners_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."practitioners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_access_events" ADD CONSTRAINT "emergency_access_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_access_events" ADD CONSTRAINT "emergency_access_events_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_practitioner_id_practitioners_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."practitioners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_authored_by_id_user_id_fk" FOREIGN KEY ("authored_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "immunizations" ADD CONSTRAINT "immunizations_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "immunizations" ADD CONSTRAINT "immunizations_authored_by_id_user_id_fk" FOREIGN KEY ("authored_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "immunizations" ADD CONSTRAINT "immunizations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication_statements" ADD CONSTRAINT "medication_statements_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication_statements" ADD CONSTRAINT "medication_statements_prescriber_id_practitioners_id_fk" FOREIGN KEY ("prescriber_id") REFERENCES "public"."practitioners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication_statements" ADD CONSTRAINT "medication_statements_authored_by_id_user_id_fk" FOREIGN KEY ("authored_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication_statements" ADD CONSTRAINT "medication_statements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_authored_by_id_user_id_fk" FOREIGN KEY ("authored_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_verifications" ADD CONSTRAINT "organization_verifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_verifications" ADD CONSTRAINT "organization_verifications_submitted_by_user_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_verifications" ADD CONSTRAINT "organization_verifications_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_identifiers" ADD CONSTRAINT "patient_identifiers_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_identifiers" ADD CONSTRAINT "patient_identifiers_source_organization_id_organizations_id_fk" FOREIGN KEY ("source_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practitioner_verifications" ADD CONSTRAINT "practitioner_verifications_practitioner_id_practitioners_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."practitioners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practitioner_verifications" ADD CONSTRAINT "practitioner_verifications_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practitioners" ADD CONSTRAINT "practitioners_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practitioners" ADD CONSTRAINT "practitioners_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_authored_by_id_user_id_fk" FOREIGN KEY ("authored_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_chunks" ADD CONSTRAINT "search_chunks_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_chunks" ADD CONSTRAINT "search_chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aisummary_patient_idx" ON "ai_summaries" USING btree ("patient_id","created_at");--> statement-breakpoint
CREATE INDEX "aiclaim_summary_idx" ON "ai_summary_claims" USING btree ("summary_id");--> statement-breakpoint
CREATE INDEX "allergy_patient_idx" ON "allergies" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "audit_patient_idx" ON "audit_events" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_events" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "audit_events" USING btree ("action");--> statement-breakpoint
CREATE INDEX "condition_patient_idx" ON "conditions" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "conflict_patient_idx" ON "conflicts" USING btree ("patient_id","status");--> statement-breakpoint
CREATE INDEX "consent_patient_idx" ON "consents" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "consent_grantee_idx" ON "consents" USING btree ("grantee_practitioner_id");--> statement-breakpoint
CREATE INDEX "diagreport_patient_idx" ON "diagnostic_reports" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "document_patient_idx" ON "documents" USING btree ("patient_id","created_at");--> statement-breakpoint
CREATE INDEX "document_extraction_idx" ON "documents" USING btree ("extraction_status");--> statement-breakpoint
CREATE INDEX "emergency_patient_idx" ON "emergency_access_events" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "encounter_patient_idx" ON "encounters" USING btree ("patient_id","occurred_at");--> statement-breakpoint
CREATE INDEX "immunization_patient_idx" ON "immunizations" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "medstat_patient_idx" ON "medication_statements" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "notification_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "observation_patient_idx" ON "observations" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "observation_name_idx" ON "observations" USING btree ("name");--> statement-breakpoint
CREATE INDEX "orgver_org_idx" ON "organization_verifications" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "org_status_idx" ON "organizations" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "patident_patient_idx" ON "patient_identifiers" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "patient_user_idx" ON "patients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "patient_name_idx" ON "patients" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX "praver_practitioner_idx" ON "practitioner_verifications" USING btree ("practitioner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "practitioner_user_unique" ON "practitioners" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "practitioner_status_idx" ON "practitioners" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "procedure_patient_idx" ON "procedures" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "chunk_patient_idx" ON "search_chunks" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "chunk_document_idx" ON "search_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "user_role_idx" ON "user" USING btree ("role");