import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

const ROLE_PREFIX: Record<string, string> = {
  "/app": "PATIENT",
  "/provider": "PROVIDER",
  "/admin": "ADMIN",
};

/**
 * Local mobile-dev CORS: set MOBILE_DEV_ORIGIN to the Expo web preview origin
 * (e.g. http://localhost:8082) to let the mobile app's `expo start --web`
 * build call this API cross-origin during local testing. Native iOS/Android
 * builds are never subject to browser CORS and don't need this. Deliberately
 * NOT gated on NODE_ENV — `next start` reports "production" even for local
 * testing, so the only real deployment safety is that this is opt-in
 * (MOBILE_DEV_ORIGIN unset by default) and matches exactly one literal origin;
 * never set this env var on a real deployment.
 */
function withMobileDevCors(req: Parameters<Parameters<typeof auth>[0]>[0]) {
  const devOrigin = process.env.MOBILE_DEV_ORIGIN;
  if (!devOrigin) return null;
  const origin = req.headers.get("origin");
  if (origin !== devOrigin) return null;

  const res = req.method === "OPTIONS" ? new NextResponse(null, { status: 204 }) : NextResponse.next();
  res.headers.set("Access-Control-Allow-Origin", devOrigin);
  res.headers.set("Access-Control-Allow-Credentials", "true");
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return res;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  if (pathname.startsWith("/api/")) {
    return withMobileDevCors(req) ?? NextResponse.next();
  }

  const requiredRole = Object.entries(ROLE_PREFIX).find(([prefix]) =>
    pathname.startsWith(prefix),
  )?.[1];
  if (!requiredRole) return NextResponse.next();

  if (!session?.user) {
    const login = new URL("/login", req.nextUrl);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (session.user.role !== requiredRole) {
    // Send users to their own home rather than a bare 403.
    const home =
      session.user.role === "PROVIDER"
        ? "/provider"
        : session.user.role === "ADMIN"
          ? "/admin"
          : "/app";
    return NextResponse.redirect(new URL(home, req.nextUrl));
  }

  // Providers/admins must finish MFA setup before any portal surface.
  if (
    (session.user.role === "PROVIDER" || session.user.role === "ADMIN") &&
    !session.user.mfaEnabled &&
    pathname !== "/mfa/setup"
  ) {
    return NextResponse.redirect(new URL("/mfa/setup", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/app/:path*", "/provider/:path*", "/admin/:path*", "/mfa/:path*", "/api/:path*"],
};
