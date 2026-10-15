"use client";

/**
 * Barrel (overhaul round 6): auth-forms.tsx was a 586-line mixed file.
 * The pieces now live in domain files; this barrel preserves the existing
 * import paths so no page changes were needed.
 *
 * New code should import from the domain file directly.
 */
export { AuthShell, OrDivider } from "./auth-shell";
export { SocialButtons } from "./social-buttons";
export { PasswordInput } from "./password-input";
export { SignInForm } from "./sign-in-form";
export { SignUpForm } from "./sign-up-form";
export {
  ResendVerificationForm,
  ForgotPasswordForm,
  ResetPasswordForm,
} from "./verify-recovery-forms";
