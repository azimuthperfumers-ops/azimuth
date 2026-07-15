// Maps better-auth error codes to clear, customer-friendly messages. Login uses a
// single message for bad-email vs bad-password so we never reveal whether an account
// exists (account-enumeration safe) while still telling the user what to fix.
type AuthError = { code?: string; message?: string; status?: number } | null | undefined;

const MAP: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "The email or password you entered is incorrect.",
  USER_NOT_FOUND: "The email or password you entered is incorrect.",
  INVALID_PASSWORD: "The email or password you entered is incorrect.",
  USER_ALREADY_EXISTS: "An account with this email already exists — try signing in instead.",
  EMAIL_NOT_VERIFIED: "Please verify your email first — check your inbox for the link.",
  INVALID_TOKEN: "This link is invalid or has expired. Please request a new one.",
  TOKEN_EXPIRED: "This link has expired. Please request a new one.",
  INVALID_OTP: "That code is incorrect. Please check and try again.",
  OTP_EXPIRED: "That code has expired. Please request a new one.",
  PASSWORD_TOO_SHORT: "Password must be at least 8 characters.",
  TOO_MANY_REQUESTS: "Too many attempts — please wait a minute and try again.",
};

export function authErrorMessage(err: AuthError, fallback = "Something went wrong. Please try again."): string {
  if (!err) return fallback;
  if (err.code && MAP[err.code]) return MAP[err.code];
  if (err.status === 429) return MAP.TOO_MANY_REQUESTS!;
  return fallback;
}
