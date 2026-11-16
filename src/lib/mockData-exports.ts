// src/lib/mockData-exports.ts
// Re-exporta los datos mock + extiende con log de marcaciones compartido
// entre la API y el admin panel

import { MOCK_STUDENTS, getStudentByDni, checkIdempotency, saveIdempotency } from './mockData';
import type { AttendanceStatus, Student } from '@/types/attendance';

export { MOCK_STUDENTS, getStudentByDni, checkIdempotency, saveIdempotency };

// Log global de marcaciones (en producción: base de datos)
export interface AttendanceLogEntry {
  scan_id: string;
  student_id: string;
  student: Student;
  timestamp: string;
  is_burst: boolean;
  status: AttendanceStatus;
  is_offline_sync: boolean;
  scanner_id?: string;
  entrance_id?: string;
}

const attendanceLog: AttendanceLogEntry[] = [];

export function logAttendance(entry: AttendanceLogEntry): void {
  attendanceLog.push(entry);
}

export function getAttendanceLog(): AttendanceLogEntry[] {
  return [...attendanceLog].reverse(); // más recientes primero
}

export function getAttendanceByDate(date: string): AttendanceLogEntry[] {
  return attendanceLog.filter((a) => a.timestamp.startsWith(date));
}

export function clearAttendanceLog(): void {
  attendanceLog.length = 0;
}
