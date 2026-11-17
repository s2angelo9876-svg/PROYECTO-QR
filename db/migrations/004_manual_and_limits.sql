ALTER TABLE attendance_events ADD COLUMN manual_reason text;
ALTER TABLE attendance_events ADD CONSTRAINT manual_reason_required CHECK(capture_method<>'MANUAL' OR length(manual_reason)>=10);
CREATE INDEX login_limits_reset ON login_limits(reset_at);
