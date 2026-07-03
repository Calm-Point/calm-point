import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

const ROLE_PREFIX: Record<string, string> = {
  "/app": "PATIENT",
  "/provider": "PROVIDER",
  "/admin": "ADMIN",
};

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

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
  matcher: ["/app/:path*", "/provider/:path*", "/admin/:path*", "/mfa/:path*"],
};
