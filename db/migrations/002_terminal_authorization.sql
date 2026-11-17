ALTER TABLE terminal_sessions ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE TABLE terminal_operators (
 school_id uuid NOT NULL, terminal_id uuid NOT NULL, user_id uuid NOT NULL,
 PRIMARY KEY(terminal_id,user_id),
 FOREIGN KEY(school_id,terminal_id) REFERENCES terminals(school_id,id),
 FOREIGN KEY(school_id,user_id) REFERENCES users(school_id,id)
);
ALTER TABLE terminal_operators ENABLE ROW LEVEL SECURITY;
CREATE POLICY school_scope ON terminal_operators USING (school_id = nullif(current_setting('app.school_id',true),'')::uuid) WITH CHECK (school_id = nullif(current_setting('app.school_id',true),'')::uuid);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='sca_runtime') THEN
 GRANT SELECT,INSERT,UPDATE,DELETE ON terminal_operators TO sca_runtime;
 GRANT DELETE ON login_limits,calendar_days TO sca_runtime;
 END IF; END $$;
ALTER TABLE notifications ADD UNIQUE(school_id,id);
ALTER TABLE notification_reads ADD FOREIGN KEY(school_id,notification_id) REFERENCES notifications(school_id,id);
