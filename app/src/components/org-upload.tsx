"use client";

import { useState } from "react";
import { Card, CardHeader, Badge } from "./ui";
import { UploadDocumentForm } from "./doctor-forms";

/** Facility console upload: pick a consented patient, then upload. */
export function OrgUploadSection({
  patients,
}: {
  patients: Array<{ id: string; fullName: string }>;
}) {
  const [patientId, setPatientId] = useState(patients[0]?.id ?? "");

  if (!patients.length) {
    return (
      <Card>
        <CardHeader
          eyebrow="Upload"
          title="Upload a source document"
        />
        <p className="px-4 py-4 text-sm text-ink-soft sm:px-5">
          No consented patients yet. A patient must grant your facility document access before
          you can upload to their record.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        eyebrow="Upload"
        title="Upload a source document"
        action={<Badge tone="pine">{patients.length} consented</Badge>}
      />
      <div className="space-y-1.5 border-b border-line px-4 pt-4 sm:px-5">
        <label
          htmlFor="org-upload-patient"
          className="block text-[13px] font-medium text-ink"
        >
          Patient
        </label>
        <select
          id="org-upload-patient"
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          className="mb-4 h-10 w-full rounded-md border border-line-strong bg-paper-raised px-2.5 text-sm text-ink focus:border-pine focus:outline-none"
        >
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName}
            </option>
          ))}
        </select>
      </div>
      {patientId ? <UploadDocumentForm key={patientId} patientId={patientId} /> : null}
    </Card>
  );
}
