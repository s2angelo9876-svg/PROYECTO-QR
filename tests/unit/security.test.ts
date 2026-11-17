import { afterEach, describe, it, expect, vi } from "vitest";
import { safeLoginRedirect } from "@/lib/safeRedirect";
import { signToken, verifyToken } from "@/lib/authToken";
import { SignJWT } from "jose";
import { originGuard } from "@/lib/demoMode";
import { configuredPublicOrigin, publicUrl } from "@/lib/publicOrigin";

afterEach(() => vi.unstubAllEnvs());
describe("login boundary", () => {
  it.each([
    "javascript:alert(1)",
    "data:text/html,test",
    "//example.com",
    "https://example.com",
    "/admin/dashboard?next=javascript:alert(1)",
    "/\\example.com",
    "/admin/login",
    null,
  ])("rejects unsafe destination %s", (value) => {
    expect(safeLoginRedirect(value)).toBe("/admin/dashboard");
  });
  it.each(["/admin/dashboard", "/admin/scans", "/admin/reports", "/ingreso"])(
    "accepts known destination %s",
    (path) => {
      expect(safeLoginRedirect(path)).toBe(path);
    },
  );
  it("does not create sessions without an independently configured secret", async () => {
    vi.stubEnv("JWT_SECRET", "");
    await expect(
      signToken({
        id: "1",
        username: "admin",
        fullName: "Demo",
        role: "admin",
      }),
    ).rejects.toThrow();
    expect(await verifyToken("bad")).toBeNull();
  });
  it("verifies audience, issuer, expiration and user role", async () => {
    const user = {
      id: "1",
      username: "admin",
      fullName: "Demo",
      role: "admin" as const,
    };
    expect((await verifyToken(await signToken(user)))?.user).toEqual(user);
    const token = await new SignJWT({ user })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .setIssuer("other-system")
      .setAudience("sca-qr-admin")
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));
    expect(await verifyToken(token)).toBeNull();
  });
});

describe("public HTTPS proxy boundary", () => {
  it("accepts only the configured browser origin when the upstream URL is internal", () => {
    vi.stubEnv("SCA_PUBLIC_ORIGIN", "https://school.example");
    const request = (origin: string) =>
      new Request("http://0.0.0.0:8080/api/admin/login", {
        method: "POST",
        headers: {
          origin,
          host: "attacker.example",
          "x-forwarded-host": "attacker.example",
        },
      });
    expect(originGuard(request("https://school.example"))).toBeNull();
    expect(originGuard(request("https://attacker.example"))?.status).toBe(403);
    expect(originGuard(request("http://0.0.0.0:8080"))?.status).toBe(403);
  });
  it("sends redirects to the configured public origin instead of the container", () => {
    vi.stubEnv("SCA_PUBLIC_ORIGIN", "https://school.example");
    expect(
      publicUrl("/admin/login", { url: "http://0.0.0.0:8080/admin/dashboard" })
        .href,
    ).toBe("https://school.example/admin/login");
  });
  it.each([
    "https://user:secret@school.example",
    "https://school.example/path",
    "https://school.example?next=1",
    "javascript:alert(1)",
    "http://school.example",
  ])("fails closed for invalid public origin %s", (origin) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SCA_PUBLIC_ORIGIN", origin);
    expect(() => configuredPublicOrigin()).toThrow();
    expect(
      originGuard(
        new Request("http://localhost/api/admin/login", { method: "POST" }),
      )?.status,
    ).toBe(503);
  });
  it("retains the original local behavior when no public origin is configured", () => {
    vi.stubEnv("SCA_PUBLIC_ORIGIN", "");
    expect(
      originGuard(
        new Request("http://localhost:3000/api/admin/login", {
          method: "POST",
          headers: { origin: "http://localhost:3000" },
        }),
      ),
    ).toBeNull();
    expect(
      originGuard(
        new Request("http://localhost:3000/api/admin/login", {
          method: "POST",
          headers: { origin: "https://other.example" },
        }),
      )?.status,
    ).toBe(403);
  });
});
