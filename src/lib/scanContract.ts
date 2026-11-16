import { z } from 'zod';
import type { ApiScanRequest } from '@/types/attendance';

export const ScanCommandSchema = z.object({
  qr_code: z.string().min(1).max(200),
  qr_signature: z.string().min(1).max(500),
  is_burst: z.boolean(),
  client_scan_id: z.uuid(),
  terminal_id: z.string().min(1).max(100).optional(),
  scanner_id: z.string().min(1).max(100).optional(),
  entrance_id: z.string().min(1).max(100).optional(),
  offline_timestamp: z.iso.datetime().optional(),
});

export const StudentSchema = z.object({
  id: z.string(), dni: z.string(), firstName: z.string(), lastName: z.string(),
  fullName: z.string(), grade: z.string(), section: z.string(),
  shift: z.enum(['MORNING', 'AFTERNOON', 'EVENING']),
  photoUrl: z.string(), status: z.enum(['ACTIVE', 'SUSPENDED', 'GRADUATED']),
  guardianName: z.string().optional(), guardianPhone: z.string().optional(),
});

export const ScanAckSchema = z.object({
  ok: z.literal(true), scan_id: z.uuid(), client_scan_id: z.uuid(),
  payload_hash: z.string().regex(/^[a-f0-9]{64}$/),
  persistence: z.enum(['memory-demo', 'durable']),
  attendance_status: z.enum(['ON_TIME', 'LATE', 'EARLY_LEAVE', 'EXIT']),
  is_burst: z.boolean(), student: StudentSchema, message: z.string(),
  server_timestamp: z.iso.datetime(), idempotent: z.boolean().optional(),
});

export async function hashScanCommand(command: ApiScanRequest): Promise<string> {
  // Ordered tuple is the version-1 canonical representation. Optional fields are explicit nulls.
  const bytes = new TextEncoder().encode(JSON.stringify([
    1, command.client_scan_id, command.terminal_id ?? null,
    command.scanner_id ?? null, command.entrance_id ?? null,
    command.qr_code, command.qr_signature, command.is_burst, command.offline_timestamp ?? null,
  ]));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
