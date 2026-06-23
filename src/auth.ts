import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { attachRole } from "@/lib/auth-helpers";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    // Shell provider only; real OAuth/email providers land in Phase 2.
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async () => null,
    }),
  ],
  callbacks: {
    jwt: ({ token }) => token,
    session: ({ session, token }) => attachRole(session, token),
  },
});
