"use client";

/**
 * Barrel (overhaul round 5): doctor-forms.tsx was a 635-line, 5-domain
 * mega-file. The forms now live in domain files; this barrel preserves the
 * existing import paths so no page changes were needed.
 *
 * New code should import from the domain file directly.
 */
export { VerificationForm } from "./verification-form";
export { RequestAccessForm } from "./access-request-form";
export { BreakGlassForm } from "./break-glass-form";
export { AddRecordForm } from "./add-record-form";
export { UploadDocumentForm } from "./upload-document-form";
export { GenerateSummaryForm, ResolveDisputeForm } from "./summary-dispute-forms";
