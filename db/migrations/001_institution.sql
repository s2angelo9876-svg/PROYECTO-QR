CREATE TABLE schools (
 id uuid PRIMARY KEY, name text NOT NULL, timezone text NOT NULL DEFAULT 'America/Lima',
 settings_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE users (
 id uuid PRIMARY KEY, school_id uuid NOT NULL REFERENCES schools(id), username text NOT NULL,
 full_name text NOT NULL, password_hash text NOT NULL,
 role text NOT NULL CHECK(role IN ('admin','director','secretary','porter')),
 active boolean NOT NULL DEFAULT true, must_change_password boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(school_id,username), UNIQUE(school_id,id)
);
CREATE TABLE sessions (
 id uuid PRIMARY KEY, school_id uuid NOT NULL, user_id uuid NOT NULL, expires_at timestamptz NOT NULL,
 revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(school_id,user_id) REFERENCES users(school_id,id), UNIQUE(school_id,id)
);
CREATE TABLE login_limits (key text PRIMARY KEY, attempts integer NOT NULL, reset_at timestamptz NOT NULL);
CREATE TABLE schedules (
 id uuid PRIMARY KEY, school_id uuid NOT NULL REFERENCES schools(id), name text NOT NULL,
 start_time time NOT NULL, end_time time NOT NULL, grace_minutes integer NOT NULL CHECK(grace_minutes BETWEEN 0 AND 120),
 weekdays integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5], version integer NOT NULL DEFAULT 1,
 CHECK(end_time > start_time), UNIQUE(school_id,id), UNIQUE(school_id,name)
);
CREATE TABLE calendar_days (
 school_id uuid NOT NULL REFERENCES schools(id), local_date date NOT NULL, teaching boolean NOT NULL,
 reason text NOT NULL, version integer NOT NULL DEFAULT 1, PRIMARY KEY(school_id,local_date)
);
CREATE TABLE students (
 id uuid PRIMARY KEY, school_id uuid NOT NULL REFERENCES schools(id), code text NOT NULL,
 first_name text NOT NULL, last_name text NOT NULL,
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','SUSPENDED','GRADUATED')),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(school_id,code), UNIQUE(school_id,id)
);
CREATE TABLE enrollments (
 id uuid PRIMARY KEY, school_id uuid NOT NULL, student_id uuid NOT NULL, year integer NOT NULL CHECK(year BETWEEN 2000 AND 2200),
 grade text NOT NULL, section text NOT NULL, schedule_id uuid NOT NULL,
 valid_from date NOT NULL, valid_until date NOT NULL, active boolean NOT NULL DEFAULT true,
 FOREIGN KEY(school_id,student_id) REFERENCES students(school_id,id),
 FOREIGN KEY(school_id,schedule_id) REFERENCES schedules(school_id,id),
 CHECK(valid_until >= valid_from), UNIQUE(school_id,id), UNIQUE(school_id,student_id,year)
);
CREATE TABLE signing_keys (
 school_id uuid NOT NULL REFERENCES schools(id), kid uuid NOT NULL, purpose text NOT NULL CHECK(purpose IN ('QR','RECEIPT','PERMIT')),
 public_jwk jsonb NOT NULL, private_jwk jsonb NOT NULL, active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(school_id,kid)
);
CREATE UNIQUE INDEX one_active_signing_key ON signing_keys(school_id,purpose) WHERE active;
CREATE TABLE credentials (
 id uuid PRIMARY KEY, school_id uuid NOT NULL, student_id uuid NOT NULL, kid uuid NOT NULL,
 issued_at timestamptz NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz,
 FOREIGN KEY(school_id,student_id) REFERENCES students(school_id,id),
 FOREIGN KEY(school_id,kid) REFERENCES signing_keys(school_id,kid), UNIQUE(school_id,id)
);
CREATE TABLE terminals (
 id uuid PRIMARY KEY, school_id uuid NOT NULL REFERENCES schools(id), name text NOT NULL,
 entrance_id text NOT NULL, scanner_id text NOT NULL DEFAULT 'N1', enabled boolean NOT NULL DEFAULT true,
 direction text NOT NULL CHECK(direction IN ('ENTRY','EXIT')),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(school_id,id)
);
CREATE TABLE terminal_sessions (
 id uuid PRIMARY KEY, school_id uuid NOT NULL, terminal_id uuid NOT NULL, operator_id uuid NOT NULL,
 expires_at timestamptz NOT NULL, revoked_at timestamptz,
 FOREIGN KEY(school_id,terminal_id) REFERENCES terminals(school_id,id),
 FOREIGN KEY(school_id,operator_id) REFERENCES users(school_id,id), UNIQUE(school_id,id)
);
CREATE TABLE scan_receipts (
 id uuid PRIMARY KEY, school_id uuid NOT NULL, terminal_id uuid NOT NULL, event_id uuid NOT NULL,
 payload_hash text NOT NULL, http_status integer NOT NULL, result jsonb NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(school_id,terminal_id) REFERENCES terminals(school_id,id),
 UNIQUE(terminal_id,event_id), UNIQUE(school_id,id)
);
CREATE TABLE attendance_events (
 id uuid PRIMARY KEY, school_id uuid NOT NULL, student_id uuid NOT NULL, enrollment_id uuid NOT NULL,
 credential_id uuid, terminal_id uuid NOT NULL, event_id uuid NOT NULL,
 captured_by uuid NOT NULL, submitted_by uuid NOT NULL, direction text NOT NULL CHECK(direction IN ('ENTRY','EXIT')),
 occurred_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT now(), local_date date NOT NULL,
 rule_version integer NOT NULL, disposition text NOT NULL CHECK(disposition IN ('ACCEPTED','REVIEW','REJECTED')),
 status text NOT NULL, reason text, payload_hash text NOT NULL,
 FOREIGN KEY(school_id,student_id) REFERENCES students(school_id,id),
 FOREIGN KEY(school_id,enrollment_id) REFERENCES enrollments(school_id,id),
 FOREIGN KEY(school_id,credential_id) REFERENCES credentials(school_id,id),
 FOREIGN KEY(school_id,terminal_id) REFERENCES terminals(school_id,id),
 FOREIGN KEY(school_id,captured_by) REFERENCES users(school_id,id),
 FOREIGN KEY(school_id,submitted_by) REFERENCES users(school_id,id), UNIQUE(school_id,id)
);
CREATE INDEX events_day ON attendance_events(school_id,local_date,student_id);
CREATE INDEX events_received ON attendance_events(school_id,received_at DESC,id);
CREATE TABLE daily_attendance (
 school_id uuid NOT NULL, enrollment_id uuid NOT NULL, local_date date NOT NULL,
 first_entry timestamptz, last_exit timestamptz, state text NOT NULL DEFAULT 'NO_RECORD',
 version integer NOT NULL DEFAULT 0,
 FOREIGN KEY(school_id,enrollment_id) REFERENCES enrollments(school_id,id),
 PRIMARY KEY(enrollment_id,local_date)
);
CREATE TABLE attendance_adjustments (
 id uuid PRIMARY KEY, school_id uuid NOT NULL, event_id uuid, enrollment_id uuid NOT NULL,
 local_date date NOT NULL, actor_id uuid NOT NULL, reason text NOT NULL CHECK(length(reason) >= 10),
 decision text NOT NULL CHECK(decision IN ('ACCEPT','REJECT','JUSTIFY')), before_state jsonb NOT NULL, after_state jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(school_id,event_id) REFERENCES attendance_events(school_id,id),
 FOREIGN KEY(school_id,enrollment_id) REFERENCES enrollments(school_id,id),
 FOREIGN KEY(school_id,actor_id) REFERENCES users(school_id,id)
);
CREATE UNIQUE INDEX one_event_decision ON attendance_adjustments(event_id) WHERE event_id IS NOT NULL;
CREATE TABLE notifications (
 id uuid PRIMARY KEY, school_id uuid NOT NULL REFERENCES schools(id), title text NOT NULL, body text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE notification_reads (
 school_id uuid NOT NULL, notification_id uuid NOT NULL REFERENCES notifications(id), user_id uuid NOT NULL,
 read_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(notification_id,user_id),
 FOREIGN KEY(school_id,user_id) REFERENCES users(school_id,id)
);
CREATE TABLE audit_log (
 id uuid PRIMARY KEY, school_id uuid NOT NULL REFERENCES schools(id), actor_id uuid,
 action text NOT NULL, entity_id text, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_created ON audit_log(school_id,created_at DESC);
CREATE TABLE import_batches (
 id uuid PRIMARY KEY, school_id uuid NOT NULL, actor_id uuid NOT NULL, payload_hash text NOT NULL,
 rows jsonb NOT NULL, committed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(school_id,actor_id) REFERENCES users(school_id,id)
);
CREATE TABLE report_snapshots (
 id uuid PRIMARY KEY, school_id uuid NOT NULL, actor_id uuid NOT NULL, local_date date NOT NULL,
 payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(school_id,actor_id) REFERENCES users(school_id,id)
);

DO $$ DECLARE t text; BEGIN
 FOR t IN SELECT unnest(ARRAY['schools','users','sessions','schedules','calendar_days','students','enrollments','signing_keys','credentials','terminals','terminal_sessions','scan_receipts','attendance_events','daily_attendance','attendance_adjustments','notifications','notification_reads','audit_log','import_batches','report_snapshots']) LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  IF t='schools' THEN
   EXECUTE format('CREATE POLICY school_scope ON %I USING (id = nullif(current_setting(''app.school_id'',true),'''')::uuid) WITH CHECK (id = nullif(current_setting(''app.school_id'',true),'''')::uuid)',t);
  ELSE
   EXECUTE format('CREATE POLICY school_scope ON %I USING (school_id = nullif(current_setting(''app.school_id'',true),'''')::uuid) WITH CHECK (school_id = nullif(current_setting(''app.school_id'',true),'''')::uuid)',t);
  END IF;
 END LOOP;
END $$;

CREATE FUNCTION immutable_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 RAISE EXCEPTION 'Immutable evidence: append an adjustment instead';
END $$;
CREATE TRIGGER immutable_events BEFORE UPDATE OR DELETE ON attendance_events FOR EACH ROW EXECUTE FUNCTION immutable_evidence();
CREATE TRIGGER immutable_receipts BEFORE UPDATE OR DELETE ON scan_receipts FOR EACH ROW EXECUTE FUNCTION immutable_evidence();
CREATE TRIGGER immutable_adjustments BEFORE UPDATE OR DELETE ON attendance_adjustments FOR EACH ROW EXECUTE FUNCTION immutable_evidence();
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION immutable_evidence();

-- Only the backend database role can execute these narrowly scoped authentication functions.
CREATE FUNCTION auth_login(p_school uuid,p_username text) RETURNS SETOF users
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT * FROM users WHERE school_id=p_school AND username=p_username AND active;
$$;
CREATE FUNCTION auth_session(p_id uuid) RETURNS TABLE(id uuid,school_id uuid,username text,full_name text,role text,must_change_password boolean)
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT u.id,u.school_id,u.username,u.full_name,u.role,u.must_change_password FROM sessions s
 JOIN users u ON u.id=s.user_id AND u.school_id=s.school_id
 WHERE s.id=p_id AND s.revoked_at IS NULL AND s.expires_at>now() AND u.active;
$$;
REVOKE ALL ON FUNCTION auth_login(uuid,text),auth_session(uuid) FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
