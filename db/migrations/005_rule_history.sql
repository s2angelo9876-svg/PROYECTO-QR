CREATE TABLE schedule_versions (
 school_id uuid NOT NULL, schedule_id uuid NOT NULL, version integer NOT NULL,
 start_time time NOT NULL, end_time time NOT NULL, grace_minutes integer NOT NULL,
 weekdays integer[] NOT NULL, effective_from timestamptz NOT NULL,
 PRIMARY KEY(schedule_id,version), FOREIGN KEY(school_id,schedule_id) REFERENCES schedules(school_id,id)
);
INSERT INTO schedule_versions SELECT school_id,id,version,start_time,end_time,grace_minutes,weekdays,'-infinity'::timestamptz FROM schedules;
ALTER TABLE schedule_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY school_scope ON schedule_versions USING(school_id=nullif(current_setting('app.school_id',true),'')::uuid) WITH CHECK(school_id=nullif(current_setting('app.school_id',true),'')::uuid);
CREATE FUNCTION preserve_schedule_version() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 INSERT INTO schedule_versions VALUES(NEW.school_id,NEW.id,NEW.version,NEW.start_time,NEW.end_time,NEW.grace_minutes,NEW.weekdays,CASE WHEN TG_OP='INSERT' THEN '-infinity'::timestamptz ELSE now() END);
 RETURN NEW;
END $$;
CREATE TRIGGER schedule_history AFTER INSERT OR UPDATE ON schedules FOR EACH ROW EXECUTE FUNCTION preserve_schedule_version();
CREATE TRIGGER immutable_rule_history BEFORE UPDATE OR DELETE ON schedule_versions FOR EACH ROW EXECUTE FUNCTION immutable_evidence();
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='sca_runtime') THEN GRANT SELECT,INSERT ON schedule_versions TO sca_runtime; END IF; END $$;
