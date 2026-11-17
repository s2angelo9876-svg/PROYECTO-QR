CREATE TABLE scanners (
 school_id uuid NOT NULL, terminal_id uuid NOT NULL, id text NOT NULL,
 protocol text NOT NULL CHECK(protocol IN ('HID','SERIAL')), baud_rate integer NOT NULL DEFAULT 9600 CHECK(baud_rate IN (9600,19200,38400,57600,115200)),
 enabled boolean NOT NULL DEFAULT true, PRIMARY KEY(terminal_id,id),
 FOREIGN KEY(school_id,terminal_id) REFERENCES terminals(school_id,id)
);
CREATE UNIQUE INDEX one_hid_stream ON scanners(terminal_id) WHERE protocol='HID' AND enabled;
INSERT INTO scanners(school_id,terminal_id,id,protocol) SELECT school_id,id,scanner_id,'HID' FROM terminals;
ALTER TABLE scanners ENABLE ROW LEVEL SECURITY;
CREATE POLICY school_scope ON scanners USING(school_id=nullif(current_setting('app.school_id',true),'')::uuid) WITH CHECK(school_id=nullif(current_setting('app.school_id',true),'')::uuid);
CREATE FUNCTION default_terminal_scanner() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 INSERT INTO scanners(school_id,terminal_id,id,protocol) VALUES(NEW.school_id,NEW.id,NEW.scanner_id,'HID'); RETURN NEW;
END $$;
CREATE TRIGGER default_scanner AFTER INSERT ON terminals FOR EACH ROW EXECUTE FUNCTION default_terminal_scanner();
CREATE FUNCTION preserve_credential_revocation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF ROW(OLD.school_id,OLD.id,OLD.student_id,OLD.kid,OLD.issued_at,OLD.expires_at) IS DISTINCT FROM ROW(NEW.school_id,NEW.id,NEW.student_id,NEW.kid,NEW.issued_at,NEW.expires_at) OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at) THEN RAISE EXCEPTION 'Credential identity and revocation are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER preserve_revocation BEFORE UPDATE ON credentials FOR EACH ROW EXECUTE FUNCTION preserve_credential_revocation();
ALTER TABLE audit_log ADD COLUMN request_id uuid DEFAULT nullif(current_setting('app.request_id',true),'')::uuid;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='sca_runtime') THEN GRANT SELECT,INSERT,UPDATE,DELETE ON scanners TO sca_runtime; END IF; END $$;
