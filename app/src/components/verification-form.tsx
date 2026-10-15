"use client";

import { useActionState } from "react";
import { submitVerificationAction } from "@/server/actions/doctor-actions";
import { Field, Input, FormErrorSummary } from "./ui";
import { SubmitButton, useFocusFirstError } from "./interactive";

/* ------------------------------------------------------------------ */

export function VerificationForm() {
  const [state, action] = useActionState(submitVerificationAction, {});
  const formRef = useFocusFirstError(state.error);
  const fieldErrors = {
    fullName:
      state.error === "Could not submit verification. Check the fields and try again."
        ? "Enter your full registered name."
        : undefined,
    registrationNumber:
      state.error === "Could not submit verification. Check the fields and try again."
        ? "Enter your council registration number."
        : undefined,
  };
  return (
    <form ref={formRef} action={action} className="space-y-4 px-4 py-4 sm:px-5">
      <Field label="Full name as registered" htmlFor="v-name" error={fieldErrors.fullName}>
        <Input
          id="v-name"
          name="fullName"
          required
          aria-invalid={fieldErrors.fullName ? true : undefined}
          aria-describedby={fieldErrors.fullName ? "v-name-error" : undefined}
          placeholder="Dr. Meera Iyer"
        />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label="Council registration number"
          htmlFor="v-reg"
          hint="e.g. MMC/2010/45231"
          error={fieldErrors.registrationNumber}
        >
          <Input
            id="v-reg"
            name="registrationNumber"
            required
            aria-invalid={fieldErrors.registrationNumber ? true : undefined}
            aria-describedby={fieldErrors.registrationNumber ? "v-reg-error" : undefined}
            placeholder="MMC/YYYY/NNNNN"
          />
        </Field>
        <Field label="State medical council" htmlFor="v-council">
          <Input id="v-council" name="council" placeholder="Maharashtra Medical Council" />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Qualification" htmlFor="v-qual">
          <Input id="v-qual" name="qualification" placeholder="MBBS, MD (Internal Medicine)" />
        </Field>
        <Field label="Specialty" htmlFor="v-spec">
          <Input id="v-spec" name="specialty" placeholder="Cardiology" />
        </Field>
      </div>
      <FormErrorSummary errors={[state.error]} />
      <SubmitButton pendingLabel="Submitting…">Submit for verification</SubmitButton>
    </form>
  );
}
