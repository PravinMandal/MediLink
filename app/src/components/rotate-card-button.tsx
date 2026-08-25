"use client";

import { useActionState } from "react";
import { rotateEmergencyCardAction } from "@/server/actions/patient-actions";
import { buttonClass } from "./ui";

/**
 * Lost-card control (§7.12): replaces the emergency-card QR token. The old
 * printed card stops resolving immediately; the page re-renders with the
 * new code. Client-side confirmation prevents accidental rotation.
 */
export function RotateCardButton() {
  const [state, action] = useActionState(rotateEmergencyCardAction, {});
  return (
    <form action={action} className="inline">
      <button
        type="submit"
        className={buttonClass("secondary", "sm")}
        onClick={(e) => {
          if (
            !confirm(
              "Replace this card's code? Any previously printed card will stop working.",
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        Replace code
      </button>
      {state.ok ? (
        <p role="status" className="mt-1 text-[11px] font-medium text-pine">
          {state.ok}
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="mt-1 text-[11px] text-alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
