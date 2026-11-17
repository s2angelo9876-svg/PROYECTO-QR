import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { verifyToken } from "@/lib/authToken";
import { databaseConfigured } from "@/lib/db";
import { resolveSession } from "@/lib/institutionAuth";
import { contentSecurityPolicy } from "@/lib/contentSecurity";
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl,
    nonce = randomBytes(18).toString("base64"),
    policy = contentSecurityPolicy(pathname, nonce),
    headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  const next = () => {
    const response = NextResponse.next({ request: { headers } });
    response.headers.set("Content-Security-Policy", policy);
    response.headers.set(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    return response;
  };
  if (!pathname.startsWith("/admin") || pathname === "/admin/login")
    return next();
  const token = request.cookies.get("sca_admin_token")?.value;
  let user = null;
  try {
    const payload = token ? await verifyToken(token) : null;
    user = payload?.user
      ? databaseConfigured()
        ? await resolveSession(payload.user)
        : payload.user
      : null;
  } catch {
    user = null;
  }
  if (!user) {
    const target = new URL("/admin/login", request.url);
    target.searchParams.set("redirect", pathname);
    const response = NextResponse.redirect(target);
    response.cookies.set("sca_admin_token", "", { maxAge: 0, path: "/" });
    return response;
  }
  if (
    databaseConfigured() &&
    user.mustChangePassword &&
    pathname !== "/admin/settings"
  )
    return NextResponse.redirect(new URL("/admin/settings", request.url));
  if (user.role === "porter" && pathname !== "/admin/settings")
    return NextResponse.redirect(new URL("/ingreso", request.url));
  return next();
}
export const config = { matcher: ["/", "/ingreso", "/admin/:path*"] };
