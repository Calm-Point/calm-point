import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { loginSchema } from "@calm-point/shared";
import { prisma, audit } from "@calm-point/db";
import { verifyPassword } from "@/server/auth/password";
import { verifyTotp } from "@/server/auth/mfa";
import { authConfig } from "./auth.config";

// Node-runtime auth entrypoint: route handlers + server components/actions.
// Middleware must import auth.config.ts instead (edge-safe).
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
        totpCode: {},
      },
      async authorize(raw) {
        // Credentials arrive URL-encoded; absent fields can surface as the
        // literal string "undefined" — normalize before validating.
        const rawTotp = typeof raw?.totpCode === "string" ? raw.totpCode.trim() : "";
        const parsed = loginSchema.safeParse({
          email: raw?.email,
          password: raw?.password,
          totpCode: /^\d{6}$/.test(rawTotp) ? rawTotp : undefined,
        });
        if (!parsed.success) return null;
        const { email, password, totpCode } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        if (!user?.passwordHash || user.status !== "ACTIVE") {
          await audit({ action: "auth.login.failed", resourceType: "User", metadata: { reason: "unknown-or-inactive" } });
          return null;
        }

        const ok = await verifyPassword(user.passwordHash, password);
        if (!ok) {
          await audit({ actorId: user.id, action: "auth.login.failed", resourceType: "User", resourceId: user.id, metadata: { reason: "bad-password" } });
          return null;
        }

        // MFA: enforced whenever the account has it enabled. Providers/admins
        // without MFA yet are allowed in but hard-redirected to /mfa/setup by
        // the middleware before reaching any portal surface.
        if (user.mfaEnabled) {
          if (!totpCode || !user.mfaSecret || !(await verifyTotp(user.mfaSecret, totpCode))) {
            await audit({ actorId: user.id, action: "auth.login.failed", resourceType: "User", resourceId: user.id, metadata: { reason: "mfa" } });
            return null;
          }
        }

        await audit({ actorId: user.id, action: "auth.login", resourceType: "User", resourceId: user.id });
        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
          mfaEnabled: user.mfaEnabled,
        };
      },
    }),
  ],
});
