const DESTINATIONS = new Set([
  "/admin/dashboard",
  "/admin/scans",
  "/admin/reports",
  "/ingreso",
  "/admin/students",
  "/admin/review",
  "/admin/settings",
  "/admin/notifications",
  "/admin/audit",
]);

// Accept exact application destinations, never an arbitrary URL or scheme.
export function safeLoginRedirect(value: string | null): string {
  return value !== null && DESTINATIONS.has(value) ? value : "/admin/dashboard";
}
