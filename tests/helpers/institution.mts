import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { generateKeyPair, exportJWK, SignJWT, importJWK } from "jose";
import type { Client } from "pg";
export const FIXTURE_PASSWORD = "Only-synthetic-tests-2026!";
export async function seedInstitution(
  client: Client,
  count = 120,
  withAttendance = false,
) {
  const schoolId = randomUUID(),
    scheduleId = randomUUID(),
    terminalId = randomUUID(),
    sessionId = randomUUID(),
    today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Lima",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
    year = Number(today.slice(0, 4));
  const ids = {
    admin: randomUUID(),
    director: randomUUID(),
    secretary: randomUUID(),
    porter: randomUUID(),
  };
  await client.query("INSERT INTO schools(id,name) VALUES($1,$2)", [
    schoolId,
    "Institución de pruebas · Datos sintéticos",
  ]);
  const passwordHash = await bcrypt.hash(FIXTURE_PASSWORD, 12);
  for (const [role, id] of Object.entries(ids))
    await client.query(
      "INSERT INTO users(id,school_id,username,full_name,password_hash,role,must_change_password) VALUES($1,$2,$3,$4,$5,$6,false)",
      [id, schoolId, role, `${role} de prueba`, passwordHash, role],
    );
  await client.query(
    "INSERT INTO schedules(id,school_id,name,start_time,end_time,grace_minutes,weekdays) VALUES($1,$2,$3,$4,$5,$6,$7)",
    [
      scheduleId,
      schoolId,
      "Horario sintético",
      "00:00",
      "23:59",
      10,
      [0, 1, 2, 3, 4, 5, 6],
    ],
  );
  await client.query(
    "INSERT INTO terminals(id,school_id,name,entrance_id,scanner_id,direction) VALUES($1,$2,$3,$4,$5,$6)",
    [terminalId, schoolId, "Entrada principal", "PRINCIPAL", "N1", "ENTRY"],
  );
  await client.query(
    "INSERT INTO terminal_operators(school_id,terminal_id,user_id) VALUES($1,$2,$3)",
    [schoolId, terminalId, ids.porter],
  );
  const start = new Date(`${today}T00:00:00-05:00`),
    expiresAt = new Date(Date.now() + 8 * 3600000);
  await client.query(
    "INSERT INTO terminal_sessions(id,school_id,terminal_id,operator_id,created_at,expires_at) VALUES($1,$2,$3,$4,$5,$6)",
    [sessionId, schoolId, terminalId, ids.porter, start, expiresAt],
  );
  const keyIds: { [key: string]: string } = {},
    privateJwks: { [key: string]: Awaited<ReturnType<typeof exportJWK>> } = {};
  for (const purpose of ["QR", "RECEIPT", "PERMIT"]) {
    const pair = await generateKeyPair("ES256", { extractable: true }),
      kid = randomUUID();
    keyIds[purpose] = kid;
    privateJwks[purpose] = await exportJWK(pair.privateKey);
    await client.query(
      "INSERT INTO signing_keys(school_id,kid,purpose,public_jwk,private_jwk) VALUES($1,$2,$3,$4,$5)",
      [
        schoolId,
        kid,
        purpose,
        await exportJWK(pair.publicKey),
        privateJwks[purpose],
      ],
    );
  }
  const permit = await new SignJWT({
    ver: 1,
    sid: sessionId,
    sub: ids.porter,
    terminal_id: terminalId,
    direction: "ENTRY",
  })
    .setProtectedHeader({
      alg: "ES256",
      kid: keyIds.PERMIT,
      typ: "sca-terminal+jwt",
    })
    .setIssuer(schoolId)
    .setIssuedAt(Math.floor(start.getTime() / 1000))
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(await importJWK(privateJwks.PERMIT, "ES256"));
  const students: {
    id: string;
    enrollmentId: string;
    credentialId: string;
    token: string;
  }[] = [];
  for (let i = 1; i <= count; i++) {
    const id = randomUUID(),
      enrollmentId = randomUUID(),
      credentialId = randomUUID();
    await client.query(
      "INSERT INTO students(id,school_id,code,first_name,last_name) VALUES($1,$2,$3,$4,$5)",
      [
        id,
        schoolId,
        `TEST${String(i).padStart(4, "0")}`,
        `Alumno ${i}`,
        "Sintético",
      ],
    );
    await client.query(
      "INSERT INTO enrollments(id,school_id,student_id,year,grade,section,schedule_id,valid_from,valid_until) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        enrollmentId,
        schoolId,
        id,
        year,
        String((i % 5) + 1),
        i % 2 ? "A" : "B",
        scheduleId,
        `${year}-01-01`,
        `${year}-12-31`,
      ],
    );
    await client.query(
      "INSERT INTO credentials(id,school_id,student_id,kid,issued_at,expires_at) VALUES($1,$2,$3,$4,now()-interval '1 day',now()+interval '180 days')",
      [credentialId, schoolId, id, keyIds.QR],
    );
    const token =
      "SCA1:" +
      (await new SignJWT({ ver: 1 })
        .setProtectedHeader({
          alg: "ES256",
          kid: keyIds.QR,
          typ: "sca-credential+jwt",
        })
        .setIssuer(schoolId)
        .setJti(credentialId)
        .setIssuedAt(Math.floor(Date.now() / 1000) - 86400)
        .setExpirationTime("180d")
        .sign(await importJWK(privateJwks.QR, "ES256")));
    students.push({ id, enrollmentId, credentialId, token });
    if (withAttendance && i <= 72) {
      const occurred = new Date(
        `${today}T${String(6 + Math.floor(i / 18)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}:00-05:00`,
      );
      if (occurred < new Date()) {
        await client.query(
          "INSERT INTO daily_attendance(school_id,enrollment_id,local_date,first_entry,state,version) VALUES($1,$2,$3,$4,$5,1)",
          [schoolId, enrollmentId, today, occurred, i % 9 ? "ON_TIME" : "LATE"],
        );
        await client.query(
          "INSERT INTO attendance_events(id,school_id,student_id,enrollment_id,credential_id,terminal_id,event_id,captured_by,submitted_by,direction,occurred_at,local_date,rule_version,disposition,status,payload_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8,'ENTRY',$9,$10,1,'ACCEPTED',$11,$12)",
          [
            randomUUID(),
            schoolId,
            id,
            enrollmentId,
            credentialId,
            terminalId,
            randomUUID(),
            ids.porter,
            occurred,
            today,
            i % 9 ? "ON_TIME" : "LATE",
            "0".repeat(64),
          ],
        );
      }
    }
  }
  return {
    schoolId,
    scheduleId,
    terminalId,
    sessionId,
    ids,
    permit,
    students,
    today,
    keyIds,
  };
}
