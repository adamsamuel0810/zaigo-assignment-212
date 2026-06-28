import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  LEGACY_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  getConfiguredPassword,
} from "@/lib/auth/credentials";
import { verifySessionToken } from "@/lib/auth/session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/parse") ||
    pathname.startsWith("/api/pptx_apply_fixes") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const legacyCookie = request.cookies.get(LEGACY_COOKIE_NAME)?.value;

  let authenticated = await verifySessionToken(sessionCookie);
  if (!authenticated && legacyCookie) {
    authenticated = legacyCookie === getConfiguredPassword();
  }

  if (!authenticated) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
