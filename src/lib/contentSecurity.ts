import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const hashes = new Map<string, string>();
export function publicScriptHashes(pathname: string) {
  const artifact =
    pathname === "/ingreso"
      ? "ingreso.html"
      : pathname === "/"
        ? "index.html"
        : null;
  if (!artifact) return "";
  const cached = hashes.get(artifact);
  if (cached) return cached;
  try {
    const html = readFileSync(
        join(process.cwd(), ".next/server/app", artifact),
        "utf8",
      ),
      result = Array.from(
        html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi),
      )
        .filter((m) => m[1])
        .map(
          (m) =>
            `'sha256-${createHash("sha256").update(m[1]).digest("base64")}'`,
        )
        .join(" ");
    hashes.set(artifact, result);
    return result;
  } catch {
    return "";
  }
}
export function contentSecurityPolicy(pathname: string, nonce: string) {
  const development = process.env.NODE_ENV === "development";
  const scripts = development
    ? "'self' 'unsafe-inline' 'unsafe-eval'"
    : pathname.startsWith("/admin")
      ? `'self' 'nonce-${nonce}'`
      : `'self' ${publicScriptHashes(pathname)}`;
  return `default-src 'self'; script-src ${scripts}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'${development ? " ws:" : ""}; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`;
}
