/**
 * Client-safe consent scope catalog (overhaul round 4).
 *
 * The consent service module pulls in the DB and cannot be imported from a
 * client component, so the scope list was duplicated verbatim in
 * consent-forms.tsx (SCOPES) and patient-search.tsx (SUGGESTABLE_SCOPES).
 * Single source of truth now.
 */
export type ConsentScopeOption = {
  value: string;
  label: string;
  /** pre-checked in the grant form */
  default?: boolean;
};

export const CONSENT_SCOPES: ConsentScopeOption[] = [
  { value: "demographics", label: "Demographics & identity", default: true },
  { value: "conditions", label: "Conditions & diagnoses", default: true },
  { value: "allergies", label: "Allergies", default: true },
  { value: "medications", label: "Medications & prescriptions", default: true },
  { value: "lab_results", label: "Lab results", default: true },
  { value: "imaging", label: "Imaging & radiology" },
  { value: "procedures", label: "Procedures & surgeries", default: true },
  { value: "documents", label: "Source documents" },
];
