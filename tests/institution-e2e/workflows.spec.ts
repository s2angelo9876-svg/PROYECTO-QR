import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { FIXTURE_PASSWORD } from "../helpers/institution.mts";
let fixture: {
  schoolId: string;
  scheduleId: string;
  terminalId: string;
  permit: string;
  today: string;
  students: { id: string; credentialId: string; token: string }[];
};
test.beforeAll(async () => {
  fixture = JSON.parse(await readFile("var/e2e-fixture.json", "utf8"));
});
async function login(page: Page, role = "admin") {
  await page.goto("/admin/login");
  await page.getByLabel("Usuario", { exact: true }).fill(role);
  await page.getByLabel("Contraseña", { exact: true }).fill(FIXTURE_PASSWORD);
  await page
    .getByRole("button", { name: "Iniciar Sesión", exact: true })
    .click();
  await expect(page).toHaveURL(
    role === "porter" ? /\/ingreso$/ : /\/admin\/dashboard$/,
  );
}
async function localRecords(page: Page) {
  return page.evaluate(
    () =>
      new Promise<
        {
          scanId: string;
          state: string;
          acknowledgement?: { persistence: string };
          serverReceipt?: unknown;
        }[]
      >((resolve, reject) => {
        const r = indexedDB.open("SCA_OFFLINE_DB");
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const db = r.result,
            q = db
              .transaction("pending_scans")
              .objectStore("pending_scans")
              .getAll();
          q.onsuccess = () => {
            db.close();
            resolve(q.result);
          };
        };
      }),
  );
}
test("database roles are enforced on server operations", async ({ page }) => {
  await login(page, "porter");
  expect(
    (
      await page.request.post("/api/admin/report-snapshots", {
        data: { date: fixture.today },
      })
    ).status(),
  ).toBe(403);
  expect((await page.request.get("/api/admin/manage/users")).status()).toBe(
    403,
  );
  expect((await page.request.get("/api/admin/manage/students")).status()).toBe(
    403,
  );
  expect(
    (
      await page.request.post("/api/terminal", {
        data: { terminalId: fixture.terminalId },
      })
    ).status(),
  ).toBe(200);
  await page.request.post("/api/admin/logout");
  await login(page, "secretary");
  expect((await page.request.get("/api/admin/manage/audit")).status()).toBe(
    403,
  );
  expect(
    (
      await page.request.post("/api/admin/manage/keys", {
        data: { purpose: "QR" },
      })
    ).status(),
  ).toBe(403);
});
test("an administrator creates an enrollment and prints a signed QR credential", async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole("link", { name: "Alumnos y matrículas", exact: true })
    .click();
  await page.getByRole("button", { name: "Nuevo alumno", exact: true }).click();
  await page.getByLabel("Código institucional").fill("E2ECREATE");
  await page.getByLabel("Nombres", { exact: true }).fill("Lucía de prueba");
  await page.getByLabel("Apellidos", { exact: true }).fill("Sintética");
  await page.getByLabel("Grado", { exact: true }).fill("2");
  await page.getByLabel("Sección", { exact: true }).fill("A");
  await page
    .getByLabel("Horario", { exact: true })
    .selectOption(fixture.scheduleId);
  await page
    .getByRole("button", { name: "Guardar alumno", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("guardados");
  await page.getByRole("searchbox").fill("E2ECREATE");
  const row = page.getByRole("row").filter({ hasText: "E2ECREATE" });
  await expect(row).toContainText("Lucía de prueba");
  await row.getByRole("button", { name: "Carnet", exact: true }).click();
  const issued = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/admin/manage/credentials") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Emitir carnet por 180 días" })
    .click();
  const data = await (await issued).json();
  const payload = JSON.parse(
    Buffer.from(data.token.slice(5).split(".")[1], "base64url").toString(),
  );
  expect(Object.keys(payload).sort()).toEqual([
    "exp",
    "iat",
    "iss",
    "jti",
    "ver",
  ]);
  expect(data.token.length).toBeLessThan(1025);
  await expect(
    page.getByRole("img", { name: /Código QR firmado/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Imprimir carnet" }),
  ).toBeEnabled();
});
test("CSV preview and idempotent confirmation validate the whole file", async ({
  page,
}) => {
  await login(page);
  const csv = `code,firstName,lastName,year,grade,section,scheduleId\nE2ECSV,Alumno CSV,Sintético,${fixture.today.slice(0, 4)},3,B,${fixture.scheduleId}\n`;
  const invalid = await page.request.post("/api/admin/imports", {
    data: { action: "preview", csv: csv + csv.split("\n")[1] + "\n" },
  });
  expect((await invalid.json()).valid).toBe(false);
  await page.goto("/admin/students");
  await page.getByRole("button", { name: "Importar CSV", exact: true }).click();
  await page.getByLabel("Contenido CSV").fill(csv);
  await page.getByRole("button", { name: "Validar y previsualizar" }).click();
  await expect(
    page.getByText("1 filas válidas.", { exact: false }),
  ).toBeVisible();
  const commit = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/admin/imports") &&
      r.request().postData()?.includes("commit") === true,
  );
  await page
    .getByRole("button", { name: "Confirmar importación de 1 alumnos" })
    .click();
  const response = await commit,
    command = response.request().postDataJSON();
  expect((await response.json()).imported).toBe(1);
  const repeated = await page.request.post("/api/admin/imports", {
    data: command,
  });
  expect((await repeated.json()).idempotent).toBe(true);
  await expect(page.getByRole("status")).toContainText("1 alumnos importados");
});
test("reports export every enrollment from one unchanged snapshot", async ({
  page,
}) => {
  await login(page);
  const created = await page.request.post("/api/admin/report-snapshots", {
    data: { date: fixture.today },
  });
  expect(created.status()).toBe(200);
  const { snapshot } = await created.json();
  expect(snapshot.rows.length).toBeGreaterThan(80);
  const csv = await page.request.get(
    `/api/admin/report-snapshots?id=${snapshot.id}&format=csv`,
  );
  expect((await csv.text()).split("\r\n")).toHaveLength(
    snapshot.rows.length + 1,
  );
  const pdf = await page.request.get(
    `/api/admin/report-snapshots?id=${snapshot.id}&format=pdf`,
  );
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
  const again = await page.request.get(
    `/api/admin/report-snapshots?id=${snapshot.id}`,
  );
  expect((await again.json()).snapshot.hash).toBe(snapshot.hash);
  await page.goto("/admin/reports");
  await page
    .getByRole("button", { name: "Crear instantánea", exact: true })
    .click();
  await expect(page.getByRole("link", { name: "PDF completo" })).toBeVisible();
  await expect(
    page.getByText("Las exportaciones incluyen todos los alumnos.", {
      exact: false,
    }),
  ).toBeVisible();
});
test("the real terminal persists offline, verifies a durable receipt and survives reload", async ({
  page,
  context,
}) => {
  await login(page, "porter");
  await page.getByRole("button", { name: "Autorizar por 8 horas" }).click();
  await expect(
    page.getByRole("heading", { name: "Listo para leer el carnet" }),
  ).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Listo para leer el carnet" }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.locator("h1").click();
  await page.keyboard.type("N1|" + fixture.students[100].token);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("status-warning")).toContainText(
    "Guardado localmente",
  );
  const original = (await localRecords(page))[0].scanId;
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Listo para leer el carnet" }),
  ).toBeVisible();
  await expect(page.getByTestId("connectivity-badge")).toContainText("OFFLINE");
  await context.setOffline(false);
  await expect
    .poll(async () => (await localRecords(page))[0]?.state)
    .toBe("ACKED");
  expect((await localRecords(page))[0].scanId).toBe(original);
  expect((await localRecords(page))[0].acknowledgement?.persistence).toBe(
    "durable",
  );
  expect((await localRecords(page))[0].serverReceipt).toBeTruthy();
});
test("review resolution is appended and does not rewrite the issued receipt", async ({
  page,
}) => {
  await login(page);
  const authorization = await page.request.post("/api/terminal", {
    data: { terminalId: fixture.terminalId },
  });
  const { snapshot } = await authorization.json();
  const cmd = {
    client_scan_id: crypto.randomUUID(),
    qr_code: fixture.students[101].token,
    qr_signature: "JWS-ES256",
    terminal_id: fixture.terminalId,
    scanner_id: "N1",
    entrance_id: "PRINCIPAL",
    is_burst: false,
    direction: "ENTRY",
    terminal_permit: snapshot.permit,
    offline_timestamp: new Date(Date.now() + 5 * 60000).toISOString(),
  };
  const original = await page.request.post("/api/attendances/scan", {
    data: cmd,
  });
  expect(original.status()).toBe(409);
  const receipt = await original.json();
  expect(receipt.code).toBe("CLOCK_FUTURE");
  await page.goto("/admin/review");
  await page
    .getByRole("row")
    .filter({ hasText: "Alumno 102 Sintético" })
    .getByRole("button", { name: "Revisar", exact: true })
    .click();
  await page
    .getByLabel("Motivo de la resolución")
    .fill("Prueba sintética de resolución auditada.");
  await page
    .getByRole("button", { name: "Aceptar captura", exact: true })
    .click();
  await expect(
    page.getByText("Incidencia aceptada con trazabilidad."),
  ).toBeVisible();
  const repeated = await page.request.post("/api/attendances/scan", {
    data: cmd,
  });
  expect(repeated.status()).toBe(409);
  expect((await repeated.json()).receipt).toBe(receipt.receipt);
});

test("manual attendance retains a recoverable command and uses a signed receipt", async ({
  page,
}) => {
  await login(page, "secretary");
  await page.goto("/admin/scans");
  await page
    .getByRole("button", { name: "Registro manual", exact: true })
    .click();
  await page.getByLabel("Buscar alumno", { exact: true }).fill("TEST0111");
  await page
    .getByLabel("Alumno", { exact: true })
    .selectOption(fixture.students[110].id);
  await page
    .getByLabel("Terminal y movimiento")
    .selectOption(fixture.terminalId);
  await page
    .getByLabel("Motivo del registro manual")
    .fill("Registro sintético por carnet olvidado.");
  await page
    .getByRole("button", { name: "Registrar movimiento", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Registro manual confirmado",
  );
  const result = await page.evaluate(
    () =>
      new Promise<{ drafts: number; receipts: number }>((resolve) => {
        const r = indexedDB.open("SCA_OFFLINE_DB");
        r.onsuccess = () => {
          const db = r.result,
            q = db.transaction("metadata").objectStore("metadata").getAll();
          q.onsuccess = () => {
            db.close();
            resolve({
              drafts: q.result.filter((m: { key: string }) =>
                m.key.startsWith("manual_draft_"),
              ).length,
              receipts: q.result.filter((m: { key: string }) =>
                m.key.startsWith("manual_receipt_"),
              ).length,
            });
          };
        };
      }),
  );
  expect(result).toEqual({ drafts: 0, receipts: 1 });
});

test("password changes and user deactivation revoke server sessions", async ({
  page,
  browser,
}) => {
  await login(page);
  const username = "new_porter",
    initial = "Initial-test-password-2026!",
    replacement = "Replacement-test-password-2026!";
  const created = await page.request.post("/api/admin/manage/users", {
    data: {
      username,
      fullName: "Operador sintético nuevo",
      role: "porter",
      active: true,
      password: initial,
    },
  });
  expect(created.status()).toBe(200);
  const { id } = await created.json();
  const context = await browser.newContext(),
    staff = await context.newPage();
  await staff.goto("http://localhost:3101/admin/login");
  await staff.getByLabel("Usuario", { exact: true }).fill(username);
  await staff.getByLabel("Contraseña", { exact: true }).fill(initial);
  await staff
    .getByRole("button", { name: "Iniciar Sesión", exact: true })
    .click();
  await expect(staff).toHaveURL(/\/admin\/settings$/);
  expect(
    (await staff.request.get("http://localhost:3101/api/terminal")).status(),
  ).toBe(403);
  await staff.getByLabel("Contraseña actual").fill(initial);
  await staff.getByLabel("Nueva contraseña", { exact: true }).fill(replacement);
  await staff.getByRole("button", { name: "Cambiar contraseña" }).click();
  await expect(staff).toHaveURL(/\/ingreso$/);
  expect(
    (
      await staff.request.get("http://localhost:3101/api/admin/session")
    ).status(),
  ).toBe(200);
  await page.request.post("/api/admin/manage/users", {
    data: {
      id,
      username,
      fullName: "Operador sintético nuevo",
      role: "porter",
      active: false,
    },
  });
  expect(
    (
      await staff.request.get("http://localhost:3101/api/admin/session")
    ).status(),
  ).toBe(401);
  await context.close();
});

test("a porter records manual attendance only with the assigned terminal permit", async ({
  page,
}) => {
  await login(page, "porter");
  await page.getByRole("button", { name: "Autorizar por 8 horas" }).click();
  await expect(
    page.getByRole("heading", { name: "Listo para leer el carnet" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Registro manual con motivo", exact: true })
    .click();
  await page.getByLabel("Buscar alumno", { exact: true }).fill("TEST0116");
  await page
    .getByLabel("Alumno", { exact: true })
    .selectOption(fixture.students[115].id);
  await page
    .getByLabel("Motivo del registro manual")
    .fill("Identidad cotejada en prueba sintética.");
  await page
    .getByRole("button", { name: "Registrar movimiento", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Registro manual confirmado",
  );
  expect(
    (
      await page.request.post("/api/admin/manual-attendance", { data: {} })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post("/api/terminal/manual", {
        data: {
          clientScanId: crypto.randomUUID(),
          studentId: fixture.students[116].id,
          terminalId: fixture.terminalId,
          direction: "ENTRY",
          occurredAt: new Date().toISOString(),
          reason: "Intento sintético sin permiso firmado.",
        },
      })
    ).status(),
  ).toBe(422);
});
