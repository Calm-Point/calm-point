import type { NextAuthConfig } from "next-auth";
import type { Role } from "@calm-point/db";

// Edge-safe Auth.js config — used by middleware. No Prisma, no node-only deps.
// The Credentials provider (argon2, DB) lives in auth.ts (node runtime only).
export const authConfig = {
  trustHost: true, // deployment platform terminates TLS; host comes from the proxy
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 }, // 8h absolute
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = (user as { role?: Role }).role;
        token.mfaEnabled = (user as { mfaEnabled?: boolean }).mfaEnabled ?? false;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as Role;
        session.user.mfaEnabled = token.mfaEnabled as boolean;
      }
      return session;
    },
  },
  providers: [], // filled in auth.ts
} satisfies NextAuthConfig;

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      mfaEnabled: boolean;
      email?: string | null;
      name?: string | null;
    };
  }
}
