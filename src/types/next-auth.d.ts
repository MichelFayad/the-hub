import type { AppRole } from "@/lib/auth-helpers";

declare module "next-auth" {
  interface Session {
    user: {
      role: AppRole;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: AppRole;
  }
}
