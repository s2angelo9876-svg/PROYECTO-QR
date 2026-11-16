const DESTINATIONS = new Set([
  '/admin/dashboard', '/admin/scans', '/admin/reports', '/ingreso',
]);

// Accept exact application destinations, never an arbitrary URL or scheme.
export function safeLoginRedirect(value: string | null): string {
  return value !== null && DESTINATIONS.has(value) ? value : '/admin/dashboard';
}
