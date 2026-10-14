import { useId, type ComponentProps } from "react";

/**
 * MediLink brand mark — hexagonal "linked record" seal.
 * Pure SVG so it inherits currentColor-free gradients and scales crisply;
 * decorative uses pass aria-hidden (the wordmark carries the name).
 */
export function LogoMark({
  size = 32,
  className,
  ...rest
}: { size?: number; className?: string } & ComponentProps<"svg">) {
  // Gradient/clip ids must be unique per instance: the marketing layout
  // renders three LogoMarks on one page, and duplicate ids make every
  // instance resolve url(#…) to the FIRST node in the document.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const g = `mlg-${uid}`;
  const s = `mls-${uid}`;
  const c = `mlc-${uid}`;
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      {...rest}
    >
      <defs>
        <linearGradient id={g} x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6FA8FF" />
          <stop offset="0.55" stopColor="#2E6FE8" />
          <stop offset="1" stopColor="#12429E" />
        </linearGradient>
        <linearGradient id={s} x1="12" y1="8" x2="40" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.08" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <clipPath id={c}>
          <path d="M32 4 55 17v26L32 60 9 43V17Z" />
        </clipPath>
      </defs>
      <path d="M32 4 55 17v26L32 60 9 43V17Z" fill={`url(#${g})`} />
      <g clipPath={`url(#${c})`}>
        <path d="M32 4 55 17v14L32 44 9 31V17Z" fill={`url(#${s})`} />
      </g>
      <g stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M19 42V23l13 13" />
        <path d="M45 42V23L32 36" />
      </g>
      <circle cx="32" cy="36" r="4.5" fill="#FFFFFF" />
      <circle cx="32" cy="36" r="7.75" stroke="#FFFFFF" strokeWidth="2.5" fill="none" opacity="0.45" />
    </svg>
  );
}
