// @vitest-environment node
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { POST as register } from "@/app/api/mobile/auth/register/route";
import { POST as login } from "@/app/api/mobile/auth/login/route";
import { registerWithPassword } from "@/services/password-auth";
import { verifyMobileToken } from "@/lib/mobile-auth";

const userIds: string[] = [];

function jsonRequest(body: unknown) {
  return new Request("https://e.com", { method: "POST", body: JSON.stringify(body) });
}

describe("mobile auth routes", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("registers a new end user and returns a usable bearer token", async () => {
    const email = `mobile-reg-${Date.now()}@e.com`;
    const res = await register(
      jsonRequest({ email, password: "Correct1!", displayName: "Mobile" }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    userIds.push(body.user.id);
    expect(body.user.role).toBe("USER");
    const session = await verifyMobileToken(body.token);
    expect(session?.userId).toBe(body.user.id);
  });

  it("rejects registration with missing fields", async () => {
    const res = await register(jsonRequest({ email: "x@e.com" }));
    expect(res.status).toBe(400);
  });

  it("logs in with correct credentials and returns a token", async () => {
    const email = `mobile-login-${Date.now()}@e.com`;
    const user = await registerWithPassword({ email, password: "Correct1!", displayName: "M2" });
    userIds.push(user.id);

    const res = await login(jsonRequest({ email, password: "Correct1!" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.id).toBe(user.id);
    expect(await verifyMobileToken(body.token)).toEqual({ userId: user.id, role: "USER" });
  });

  it("rejects login with the wrong password", async () => {
    const email = `mobile-badlogin-${Date.now()}@e.com`;
    const user = await registerWithPassword({ email, password: "Correct1!", displayName: "M3" });
    userIds.push(user.id);

    const res = await login(jsonRequest({ email, password: "Wrong1!" }));
    expect(res.status).toBe(401);
  });
});
