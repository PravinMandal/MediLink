import { cn } from "@/lib/utils";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

const buttonVariants = {
  primary:
    "bg-pine text-on-pine border border-pine hover:bg-pine-deep hover:border-pine-deep disabled:opacity-50",
  secondary:
    "bg-paper-raised text-ink border border-line-strong hover:border-ink-faint hover:bg-paper-sunk disabled:opacity-50",
  ghost:
    "bg-transparent text-ink-soft border border-transparent hover:text-ink hover:bg-paper-sunk disabled:opacity-50",
  danger:
    "bg-alert text-on-alert border border-alert hover:bg-alert-deep hover:border-alert-deep disabled:opacity-50",
};

const buttonSizes = {
  sm: "text-[13px] px-2.5 h-8 gap-1.5",
  md: "text-sm px-4 h-10 gap-2",
  lg: "text-[15px] px-5 h-11 gap-2",
};

export function buttonClass(
  variant: keyof typeof buttonVariants = "primary",
  size: keyof typeof buttonSizes = "md",
  className?: string,
) {
  return cn(
    "inline-flex items-center justify-center rounded-md font-medium transition-colors duration-150 cursor-pointer select-none disabled:cursor-not-allowed",
    buttonVariants[variant],
    buttonSizes[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
}) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
}) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

/* ------------------------------------------------------------------ */
/* Form fields                                                         */
/* ------------------------------------------------------------------ */

const errorControlClass =
  "border-alert focus:border-alert focus-visible:outline-alert";

export function Input({
  className,
  ...props
}: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "w-full h-10 rounded-md border border-line-strong bg-paper-raised px-3 text-sm text-ink placeholder:text-ink-faint",
        "focus:border-pine focus:outline-none focus-visible:outline-2 focus-visible:outline-pine",
        props["aria-invalid"] === true && errorControlClass,
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "w-full rounded-md border border-line-strong bg-paper-raised px-3 py-2 text-sm text-ink placeholder:text-ink-faint",
        "focus:border-pine focus:outline-none focus-visible:outline-2 focus-visible:outline-pine",
        props["aria-invalid"] === true && errorControlClass,
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "w-full h-10 rounded-md border border-line-strong bg-paper-raised px-2.5 text-sm text-ink",
        "focus:border-pine focus:outline-none focus-visible:outline-2 focus-visible:outline-pine",
        props["aria-invalid"] === true && errorControlClass,
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-[13px] font-medium text-ink"
      >
        {label}
      </label>
      {error ? (
        <p id={`${htmlFor ?? "field"}-error`} className="text-xs font-medium text-alert">
          {error}
        </p>
      ) : null}
      {children}
      {hint ? <p className="text-xs text-ink-faint">{hint}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form error affordances                                              */
/* ------------------------------------------------------------------ */

/** Error summary for a form — focusable so it is announced when errors land. */
export function FormErrorSummary({
  title = "Please fix the following:",
  errors,
}: {
  title?: string;
  errors: Array<string | undefined>;
}) {
  const items = errors.filter((e): e is string => !!e);
  if (!items.length) return null;
  return (
    <div
      role="alert"
      tabIndex={-1}
      data-error-summary
      className="rounded-lg border border-alert/40 bg-alert-tint px-4 py-3"
    >
      <p className="text-[13px] font-semibold text-alert">{title}</p>
      <ul className="mt-1 list-inside list-disc text-xs text-alert">
        {items.map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Surfaces                                                            */
/* ------------------------------------------------------------------ */

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("card", className)}>{children}</div>;
}

export function CardHeader({
  title,
  eyebrow,
  action,
}: {
  title: ReactNode;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
      <div>
        {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
        <h2 className="font-display text-[17px] font-semibold leading-tight text-ink">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: "neutral" | "pine" | "amber" | "alert" | "info";
  className?: string;
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-paper-sunk text-ink-soft border-line",
    pine: "bg-pine-tint text-pine-ink border-pine/30",
    amber: "bg-amber-tint text-amber border-amber/30",
    alert: "bg-alert-tint text-alert border-alert/30",
    info: "bg-info-tint text-info border-info/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong px-6 py-10 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {body ? <p className="max-w-sm text-[13px] text-ink-soft">{body}</p> : null}
      {action}
    </div>
  );
}

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "amber" | "alert" | "pine";
  title?: string;
  children: ReactNode;
}) {
  const tones = {
    info: "border-info/30 bg-info-tint text-info",
    amber: "border-amber/30 bg-amber-tint text-amber",
    alert: "border-alert/30 bg-alert-tint text-alert",
    pine: "border-pine/30 bg-pine-tint text-pine-ink",
  };
  return (
    <div className={cn("rounded-lg border px-4 py-3 text-[13px]", tones[tone])}>
      {title ? <p className="mb-0.5 font-semibold">{title}</p> : null}
      <div>{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page header                                                         */
/* ------------------------------------------------------------------ */

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
        <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.01em] text-ink">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">{description}</p>
        ) : null}
      </div>
      {action}
    </header>
  );
}
