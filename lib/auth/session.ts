import {
  getAuthSecret,
  getConfiguredEmail,
  normalizeEmail,
} from "@/lib/auth/credentials";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const encoder = new TextEncoder();

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacSha256(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message),
  );
  return bufferToBase64Url(signature);
}

export async function createSessionToken(email: string): Promise<string> {
  const normalized = normalizeEmail(email);
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = `${normalized}:${exp}`;
  const signature = await hmacSha256(getAuthSecret(), payload);
  return `${payload}.${signature}`;
}

export async function verifySessionToken(
  token: string | undefined,
): Promise<boolean> {
  if (!token) return false;

  const lastDot = token.lastIndexOf(".");
  if (lastDot <= 0) return false;

  const payload = token.slice(0, lastDot);
  const signature = token.slice(lastDot + 1);
  const expectedSig = await hmacSha256(getAuthSecret(), payload);

  if (signature.length !== expectedSig.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  }
  if (mismatch !== 0) return false;

  const colon = payload.indexOf(":");
  if (colon <= 0) return false;

  const email = payload.slice(0, colon);
  const exp = Number(payload.slice(colon + 1));
  if (!Number.isFinite(exp) || Date.now() > exp) {
    return false;
  }

  return email === getConfiguredEmail();
}
