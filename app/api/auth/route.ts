import { NextResponse } from "next/server";
import {
  validateCredentials,
  LEGACY_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/credentials";
import { createSessionToken } from "@/lib/auth/session";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 7,
  path: "/",
};

export async function POST(request: Request) {
  const body = await request.json();
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email.trim() || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  if (!validateCredentials(email, password)) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 },
    );
  }

  const token = await createSessionToken(email);
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, token, cookieOptions);
  response.cookies.delete(LEGACY_COOKIE_NAME);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  response.cookies.delete(LEGACY_COOKIE_NAME);
  return response;
}
