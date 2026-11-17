CREATE TABLE recovery_cases (
 id uuid PRIMARY KEY, school_id uuid NOT NULL REFERENCES schools(id), terminal_id uuid NOT NULL, event_id uuid NOT NULL,
 actor_id uuid NOT NULL, payload_hash text NOT NULL, command jsonb NOT NULL, signed_result jsonb NOT NULL, reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(terminal_id,event_id),
 FOREIGN KEY(school_id,terminal_id) REFERENCES terminals(school_id,id), FOREIGN KEY(school_id,actor_id) REFERENCES users(school_id,id)
);
ALTER TABLE recovery_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY school_scope ON recovery_cases USING (school_id=nullif(current_setting('app.school_id',true),'')::uuid) WITH CHECK(school_id=nullif(current_setting('app.school_id',true),'')::uuid);
CREATE TRIGGER immutable_recovery BEFORE UPDATE OR DELETE ON recovery_cases FOR EACH ROW EXECUTE FUNCTION immutable_evidence();
ALTER TABLE attendance_events ADD COLUMN capture_method text NOT NULL DEFAULT 'QR' CHECK(capture_method IN ('QR','MANUAL','RECOVERY'));
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='sca_runtime') THEN GRANT SELECT,INSERT ON recovery_cases TO sca_runtime; END IF; END $$;
