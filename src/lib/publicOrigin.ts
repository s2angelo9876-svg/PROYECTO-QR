/** Explicit external origin for deployments behind a TLS reverse proxy. */
export function configuredPublicOrigin(): string | null {
  const value = process.env.SCA_PUBLIC_ORIGIN;
  if (!value) return null;
  const url = new URL(value);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    (value !== url.origin && value !== `${url.origin}/`) ||
    (process.env.NODE_ENV === "production" &&
      url.protocol !== "https:" &&
      !loopback)
  )
    throw new Error("PUBLIC_ORIGIN_INVALID");
  return url.origin;
}

export function publicOrigin(request: Pick<Request, "url">): string {
  return configuredPublicOrigin() || new URL(request.url).origin;
}

export function publicUrl(path: string, request: Pick<Request, "url">): URL {
  return new URL(path, publicOrigin(request));
}
