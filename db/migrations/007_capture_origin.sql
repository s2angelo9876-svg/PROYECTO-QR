ALTER TABLE attendance_events ADD COLUMN scanner_id text NOT NULL DEFAULT 'LEGACY';
ALTER TABLE attendance_events ADD COLUMN entrance_id text NOT NULL DEFAULT 'LEGACY';
