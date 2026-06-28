export const SESSION_COOKIE_NAME = "acme_session";

/** Legacy cookie from password-only auth — cleared on next login. */
export const LEGACY_COOKIE_NAME = "acme_auth";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getConfiguredEmail(): string {
  return normalizeEmail(process.env.APP_EMAIL ?? "reviewer@acme.com");
}

export function getAuthSecret(): string {
  return (
    process.env.APP_AUTH_SECRET?.trim() ||
    process.env.APP_PASSWORD?.trim() ||
    "acme2024"
  );
}

export function getConfiguredPassword(): string {
  return process.env.APP_PASSWORD?.trim() ?? "acme2024";
}

export function validateCredentials(
  email: string,
  password: string,
): boolean {
  const normalized = normalizeEmail(email);
  const expectedEmail = getConfiguredEmail();
  const expectedPassword = getConfiguredPassword();

  if (normalized !== expectedEmail) {
    return false;
  }

  if (password.length !== expectedPassword.length) {
    return false;
  }

  // Constant-time compare for password
  let mismatch = 0;
  for (let i = 0; i < password.length; i++) {
    mismatch |= password.charCodeAt(i) ^ expectedPassword.charCodeAt(i);
  }
  return mismatch === 0;
}
