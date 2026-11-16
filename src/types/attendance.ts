export type AttendanceStatus = 'ON_TIME' | 'LATE' | 'EARLY_LEAVE' | 'EXIT';
export type ScanStatus = 'SUCCESS' | 'WARNING' | 'ERROR';
export type SoundType = 'success' | 'warning' | 'error';
export type Shift = 'MORNING' | 'AFTERNOON' | 'EVENING';
export type StudentStatus = 'ACTIVE' | 'SUSPENDED' | 'GRADUATED';

export interface Student {
  id: string;
  dni: string;
  firstName: string;
  lastName: string;
  fullName: string;
  grade: string;
  section: string;
  shift: Shift;
  photoUrl: string;
  status: StudentStatus;
  guardianName?: string;
  guardianPhone?: string;
}

export interface ScanResult {
  status: ScanStatus;
  message: string;
  student?: Student;
  timestamp: string;
  isOffline?: boolean;
  attendanceStatus?: AttendanceStatus;
  scanId: string;
}

export interface PendingScan {
  id?: number;
  scanId: string;
  qrCode: string;
  qrSignature: string;
  isBurst: boolean;
  timestamp: string;
  retryCount: number;
  lastError?: string;
  terminalId?: string;
  scannerId?: string;
  entranceId?: string;
  state?: 'PENDING' | 'SENDING' | 'RETRY' | 'BLOCKED_AUTH' | 'REVIEW' | 'REJECTED' | 'ACKED';
  nextAttemptAt?: number;
  payloadHash?: string;
  acknowledgement?: ApiScanSuccess;
}

export interface RecentScan {
  scanId: string;
  studentName?: string;
  status: ScanStatus;
  timestamp: string;
  isOffline: boolean;
}

export interface ApiScanRequest {
  qr_code: string;
  qr_signature: string;
  is_burst: boolean;
  client_scan_id: string;
  scanner_id?: string;
  entrance_id?: string;
  offline_timestamp?: string;
  terminal_id?: string;
}

export interface ApiScanSuccess {
  ok: true;
  scan_id: string;
  attendance_status: AttendanceStatus;
  is_burst: boolean;
  student: Student;
  message: string;
  server_timestamp: string;
  idempotent?: boolean;
  client_scan_id: string;
  payload_hash: string;
  persistence: 'memory-demo' | 'durable';
}

export interface ApiScanError {
  ok: false;
  code: 'INVALID_QR' | 'EXPIRED_QR' | 'STUDENT_NOT_FOUND' | 'DUPLICATE_SCAN' | 'UNAUTHORIZED' | 'INTERNAL' | 'IDEMPOTENCY_KEY_REUSED' | 'INVALID_INPUT' | 'DEMO_DISABLED';
  message: string;
}

export type ApiScanResponse = ApiScanSuccess | ApiScanError;

// ============ Multi-Scanner Types ============

export interface ScannerConfig {
  id: string;             // 'A1', 'A2', 'A3', 'A4', 'N1', 'S1', etc.
  label: string;          // 'Entrada Principal', 'Puerta Lateral', etc.
  position: 'left' | 'center' | 'right' | 'special'; // Ubicación física
  prefix: string;         // Prefijo que envía el lector: 'A1|', 'A2|', etc.
}

export interface EntranceConfig {
  id: string;             // 'NORTE', 'SUR', 'PRINCIPAL', etc.
  label: string;          // 'Entrada Principal', 'Entrada Norte'
  scanners: ScannerConfig[];
}

export interface MultiScanEvent {
  qrCode: string;
  scannerId: string;
  entranceId: string;
  isBurst: boolean;
  timestamp: number;
}

export interface ScannerStatus {
  id: string;
  label: string;
  position: ScannerConfig['position'];
  lastScanAt: number | null;
  lastStudentName: string | null;
  lastStatus: ScanStatus | null;
  totalScans: number;
  isActive: boolean;
}
