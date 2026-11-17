import { randomBytes } from "node:crypto";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import pg from "pg";
import { loadLocalEnv } from "./local-env.mjs";
import { seedInstitution } from "../tests/helpers/institution.mts";
loadLocalEnv({ maintenance: true });
const count = Number(process.env.SCA_CAPACITY_EVENTS || 100000);
if (!Number.isInteger(count) || count < 10000 || count > 1000000)
  throw new Error("SCA_CAPACITY_EVENTS must be 10000–1000000.");
const name = "sca_capacity_" + randomBytes(6).toString("hex"),
  url = new URL(process.env.MIGRATION_DATABASE_URL),
  owner = new pg.Client({ connectionString: url.toString() });
await owner.connect();
await owner.query(`CREATE DATABASE "${name}"`);
url.pathname = "/" + name;
const client = new pg.Client({ connectionString: url.toString() });
await client.connect();
try {
  for (const file of (await readdir("db/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await client.query(await readFile("db/migrations/" + file, "utf8"));
  const f = await seedInstitution(client, 1000),
    started = performance.now();
  await client.query(
    `WITH generated AS (SELECT g,gen_random_uuid() AS id,gen_random_uuid() AS event_id,((g-1)%1000+1)::int AS n FROM generate_series(1,$1::int) g)
 INSERT INTO attendance_events(id,school_id,student_id,enrollment_id,credential_id,terminal_id,event_id,captured_by,submitted_by,direction,occurred_at,local_date,rule_version,disposition,status,payload_hash,scanner_id,entrance_id)
 SELECT id,$2,($3::uuid[])[n],($4::uuid[])[n],($5::uuid[])[n],$6,event_id,$7,$7,CASE WHEN g%2=0 THEN 'EXIT' ELSE 'ENTRY' END,
 (current_date-((g-1)/1000)::int)::timestamp AT TIME ZONE 'America/Lima'+interval '7 hours',current_date-((g-1)/1000)::int,1,'ACCEPTED',CASE WHEN g%2=0 THEN 'EXIT' ELSE 'ON_TIME' END,md5(id::text)||md5(event_id::text),'N1','PRINCIPAL' FROM generated`,
    [
      count,
      f.schoolId,
      f.students.map((s) => s.id),
      f.students.map((s) => s.enrollmentId),
      f.students.map((s) => s.credentialId),
      f.terminalId,
      f.ids.porter,
    ],
  );
  await client.query(`WITH results AS(SELECT a.*,jsonb_build_object('ok',true,'scan_id',a.id,'client_scan_id',a.event_id,'payload_hash',a.payload_hash,'terminal_id',a.terminal_id,'server_timestamp',a.received_at,'persistence','durable','attendance_status',a.status,'is_burst',false,'student',jsonb_build_object('id',s.id,'dni',s.code,'firstName',s.first_name,'lastName',s.last_name,'fullName',s.first_name||' '||s.last_name,'grade','1','section','A','shift','MORNING','status','ACTIVE','photoUrl','/icons/icon-192.svg'),'message','Captura sintética de capacidad') AS result FROM attendance_events a JOIN students s ON s.id=a.student_id)
 INSERT INTO scan_receipts(id,school_id,terminal_id,event_id,payload_hash,http_status,result) SELECT gen_random_uuid(),school_id,terminal_id,event_id,payload_hash,200,
 result||jsonb_build_object('receipt','eyJhbGciOiJFUzI1NiIsInR5cCI6InNjYS1yZWNlaXB0K2p3cyJ9.'||replace(encode(convert_to(jsonb_build_object('ver',1,'iss',school_id,'result',result)::text,'UTF8'),'base64'),chr(10),'')||'.'||md5(id::text)||md5(event_id::text)||md5(payload_hash)) FROM results`);
  await client.query("ANALYZE attendance_events;ANALYZE scan_receipts");
  const sizes = (
    await client.query(
      "SELECT relname AS table_name,pg_total_relation_size(relid)::text AS bytes FROM pg_catalog.pg_statio_user_tables WHERE schemaname='public' ORDER BY relname",
    )
  ).rows;
  const plan = (
    await client.query(
      "EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON) SELECT id,status FROM attendance_events WHERE school_id=$1 AND local_date=current_date AND student_id=$2",
      [f.schoolId, f.students[0].id],
    )
  ).rows[0]["QUERY PLAN"][0];
  const total = sizes.reduce((n, r) => n + Number(r.bytes), 0),
    report = {
      measuredAt: new Date().toISOString(),
      synthetic: true,
      method:
        "Isolated PostgreSQL; structural event/receipt data, not valid business history or signed receipt validation. SQL loading time is not application latency.",
      postgres: (await client.query("SELECT version()")).rows[0].version,
      students: 1000,
      events: count,
      receipts: count,
      loadSeconds: Number(((performance.now() - started) / 1000).toFixed(3)),
      totalBytes: total,
      annualEventsAssumption: 880000,
      annualBytesLinearEstimate: Math.round((total * 880000) / count),
      cloud500MiBFitsLinearEstimate:
        (total * 880000) / count < 500 * 1024 * 1024,
      sizes,
      queryPlan: plan,
    };
  await mkdir("docs/evidencia", { recursive: true });
  await writeFile(
    "docs/evidencia/capacidad.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    `Synthetic capacity measured: ${count} events + receipts, ${(total / 1024 / 1024).toFixed(1)} MiB. Linear annual estimate ${(report.annualBytesLinearEstimate / 1024 / 1024).toFixed(1)} MiB; see docs/evidencia/capacidad.json.`,
  );
} finally {
  await client.end();
  await owner.query(`DROP DATABASE "${name}" WITH(FORCE)`);
  await owner.end();
}
