"use client";

import { useActionState, useState } from "react";
import { uploadDocumentAction } from "@/server/actions/doctor-actions";
import { Field, Input, Select, FormErrorSummary } from "./ui";
import { SubmitButton, useFocusFirstError } from "./interactive";

/* ------------------------------------------------------------------ */

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const OVERSIZE_FILE_ERROR =
  "File is larger than 4 MB — compress or split the PDF.";

export function UploadDocumentForm({ patientId }: { patientId: string }) {
  const [state, action] = useActionState(uploadDocumentAction, {});
  const formRef = useFocusFirstError(state.error);
  const [fileError, setFileError] = useState<string | undefined>(undefined);
  const fileErrorId = "u-file-oversize";
  const fieldErrors = {
    title: state.error === "Give the document a title." ? state.error : undefined,
    file:
      fileError ??
      (state.error === "Choose a file to upload." ? state.error : undefined),
  };
  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={(e) => {
        const file = (e.currentTarget.elements.namedItem("file") as HTMLInputElement)
          ?.files?.[0];
        if (file && file.size > MAX_UPLOAD_BYTES) {
          e.preventDefault();
          setFileError(OVERSIZE_FILE_ERROR);
        }
      }}
      className="space-y-4 px-4 py-4 sm:px-5"
    >
      <input type="hidden" name="patientId" value={patientId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Title" htmlFor="u-title" error={fieldErrors.title}>
          <Input
            id="u-title"
            name="title"
            required
            aria-invalid={fieldErrors.title ? true : undefined}
            aria-describedby={fieldErrors.title ? "u-title-error" : undefined}
            placeholder="e.g. HbA1c — Apr 2026"
          />
        </Field>
        <Field label="Type" htmlFor="u-kind">
          <Select id="u-kind" name="kind" defaultValue="lab_report">
            <option value="lab_report">Lab report</option>
            <option value="prescription">Prescription</option>
            <option value="discharge_summary">Discharge summary</option>
            <option value="imaging_report">Imaging report</option>
            <option value="consultation_note">Consultation note</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Report date" htmlFor="u-date">
          <Input id="u-date" name="recordedDate" type="date" />
        </Field>
        <Field
          label="File (PDF, image or text · ≤ 4 MB)"
          htmlFor="u-file"
          error={fieldErrors.file}
        >
          <input
            id="u-file"
            name="file"
            type="file"
            required
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              setFileError(
                file && file.size > MAX_UPLOAD_BYTES ? OVERSIZE_FILE_ERROR : undefined,
              );
            }}
            aria-invalid={fieldErrors.file ? true : undefined}
            aria-describedby={
              [fieldErrors.file ? "u-file-error" : null, fileError ? fileErrorId : null]
                .filter(Boolean)
                .join(" ") || undefined
            }
            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,application/pdf,image/*,text/plain"
            className="w-full cursor-pointer rounded-lg border border-line-strong bg-paper-raised px-3 py-2 text-sm file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-pine-tint file:px-2.5 file:py-1 file:text-[12px] file:font-medium file:text-pine-ink"
          />
        </Field>
      </div>
      <p className="text-xs text-ink-faint">
        The original is preserved byte-for-byte (SHA-256 hashed); lab values are extracted into
        structured, trend-able data.
      </p>
      <FormErrorSummary errors={[state.error]} />
      {state.ok ? (
        <p role="status" className="text-[13px] font-medium text-pine">{state.ok}</p>
      ) : null}
      <SubmitButton pendingLabel="Uploading & extracting…">Upload</SubmitButton>
    </form>
  );
}
