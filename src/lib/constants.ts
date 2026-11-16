export const SCANNER_CONFIG = {
  BURST_THRESHOLD_MS: 2500,
  MIN_QR_LENGTH: 8,
  MAX_QR_LENGTH: 200,
} as const;

export const UI_CONFIG = {
  RESULT_DISPLAY_MS: 5000,
  RECENT_SCANS_LIMIT: 10,
  OFFLINE_RETRY_INTERVAL_MS: 30_000,
  STATUS_BADGE_HEIGHT: 40,
} as const;

export const SYNC_CONFIG = {
  MAX_QUEUE_SIZE: 5000,
  RETRY_BASE_MS: 2_000,
  RETRY_MAX_MS: 5 * 60_000,
  LEASE_MS: 30_000,
  SYNC_TIMEOUT_MS: 10_000,
} as const;

export const STORAGE_KEYS = {
  DB_NAME: 'SCA_OFFLINE_DB',
  STORE_PENDING: 'pending_scans',
  STORE_RECENT: 'recent_scans',
} as const;

export const SHIFTS = {
  MORNING: { start: '07:00', end: '13:00', label: 'Mañana' },
  AFTERNOON: { start: '13:00', end: '18:00', label: 'Tarde' },
  EVENING: { start: '18:00', end: '22:00', label: 'Noche' },
} as const;

export const QR_FORMAT = {
  SEPARATOR: '|',
  // QR codificado: <dni>|<firma_simple>
  // En producción: <dni>|<hmac_sha256>
} as const;
