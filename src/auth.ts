import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { attachRole, type AppRole } from "@/lib/auth-helpers";
import { authenticateWithPassword, AuthError } from "@/services/password-auth";

// Email/password sign-in (scope §2): the only method for Agency/Individual
// Location accounts, one of two for End Users. OAuth (Google/Apple/
// Facebook, End Users only) needs real provider credentials and is a
// deferred follow-up — same external-dependency shape as the SMS OTP
// provider. MFA is enforced inside authenticateWithPassword, not here.
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, mfaCode: {} },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") return null;
        try {
          const user = await authenticateWithPassword({
            email,
            password,
            mfaCode: typeof credentials.mfaCode === "string" ? credentials.mfaCode : undefined,
          });
          return { id: user.id, email: user.email, name: user.displayName, role: user.role };
        } catch (err) {
          if (err instanceof AuthError) return null;
          throw err;
        }
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) token.role = (user as { role?: AppRole }).role;
      return token;
    },
    session: ({ session, token }) => attachRole(session, token),
  },
});
