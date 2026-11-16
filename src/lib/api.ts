import type { ApiScanRequest, ApiScanResponse } from '@/types/attendance';

export async function postScan(payload: ApiScanRequest): Promise<ApiScanResponse> {
  const res = await fetch('/api/attendances/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as ApiScanResponse;

  if (!res.ok && !data.ok && (res.status === 401 || res.status === 403)) {
    throw new Error('UNAUTHORIZED');
  }

  return data;
}
