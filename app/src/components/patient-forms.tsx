"use client";

import { useActionState } from "react";
import { updatePatientProfileAction } from "@/server/actions/patient-actions";
import { Field, Input, Select, Alert, FormErrorSummary } from "./ui";
import { SubmitButton, useFocusFirstError } from "./interactive";

export function EmergencyProfileForm({
  initial,
}: {
  initial: {
    bloodGroup: string | null;
    ecName: string | null;
    ecPhone: string | null;
  };
}) {
  const [state, action] = useActionState(updatePatientProfileAction, {});
  const formRef = useFocusFirstError(state.error);
  return (
    <form ref={formRef} action={action} className="space-y-4 px-4 py-4 sm:px-5">
      <Alert tone="info">
        This profile is what an emergency doctor sees first — keep the contact current.
        Your blood group shown to doctors is the verified lab value when one exists.
      </Alert>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label="Blood group (self-reported)"
          htmlFor="ep-blood"
          hint="Never overrides a verified lab report."
        >
          <Select id="ep-blood" name="bloodGroup" defaultValue={initial.bloodGroup ?? ""}>
            <option value="">Unknown</option>
            {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
              <option key={bg} value={bg}>{bg}</option>
            ))}
          </Select>
        </Field>
        <Field label="Emergency contact" htmlFor="ep-name">
          <Input
            id="ep-name"
            name="ecName"
            defaultValue={initial.ecName ?? ""}
            placeholder="e.g. Kavita Sharma (wife)"
            autoComplete="off"
          />
        </Field>
        <Field label="Emergency contact phone" htmlFor="ep-phone">
          <Input
            id="ep-phone"
            name="ecPhone"
            type="tel"
            defaultValue={initial.ecPhone ?? ""}
            placeholder="+91 …"
            autoComplete="off"
          />
        </Field>
      </div>
      <FormErrorSummary errors={[state.error]} />
      {state.ok ? (
        <p role="status" className="text-[13px] font-medium text-pine">{state.ok}</p>
      ) : null}
      <SubmitButton pendingLabel="Saving…">Save emergency profile</SubmitButton>
    </form>
  );
}

export function ProfileForm({
  initial,
}: {
  initial: {
    name: string;
    phone: string | null;
    city: string | null;
    patientPhone: string | null;
  };
}) {
  const [state, action] = useActionState(updatePatientProfileAction, {});
  const formRef = useFocusFirstError(state.error);
  return (
    <form ref={formRef} action={action} className="space-y-4 px-4 py-4 sm:px-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Phone" htmlFor="p-phone">
          <Input id="p-phone" name="phone" type="tel" defaultValue={initial.patientPhone ?? ""} placeholder="+91 …" />
        </Field>
        <Field label="City" htmlFor="p-city">
          <Input id="p-city" name="city" defaultValue={initial.city ?? ""} placeholder="e.g. Pune" />
        </Field>
      </div>
      <FormErrorSummary errors={[state.error]} />
      {state.ok ? (
        <p role="status" className="text-[13px] font-medium text-pine">{state.ok}</p>
      ) : null}
      <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
    </form>
  );
}
