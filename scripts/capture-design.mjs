import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { FIXTURE_PASSWORD } from "../tests/helpers/institution.mts";
const base = process.env.SCA_REVIEW_URL || "http://localhost:3102",
  out = ".impeccable/review";
await mkdir(out, { recursive: true });
const browser = await chromium.launch(
    existsSync("/usr/bin/chromium")
      ? { executablePath: "/usr/bin/chromium" }
      : {},
  ),
  errors = [],
  metrics = [];
async function measure(page, name) {
  await page.evaluate(() => document.fonts.ready);
  metrics.push(
    await page.evaluate(
      (name) => ({
        name,
        width: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        title: document.title,
        focus: document.activeElement?.getAttribute("aria-label"),
        focusLabel: document.activeElement?.labels?.[0]?.textContent || null,
        editorTop: document
          .querySelector(".student-editor")
          ?.getBoundingClientRect().top,
        listTop: document
          .querySelector(".students-list")
          ?.getBoundingClientRect().top,
        errorVisible: !!document.querySelector('[role="alert"]'),
        font: getComputedStyle(document.body).fontFamily,
      }),
      name,
    ),
  );
}
try {
  const desktop = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    }),
    page = await desktop.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(base + "/admin/login");
  await page.getByRole("heading", { name: "Bienvenido de nuevo" }).waitFor();
  await measure(page, "login");
  await page.screenshot({ path: out + "/login.png", fullPage: true });
  await page.getByLabel("Usuario", { exact: true }).fill("admin");
  await page.getByLabel("Contraseña", { exact: true }).fill(FIXTURE_PASSWORD);
  await page
    .getByRole("button", { name: "Iniciar Sesión", exact: true })
    .click();
  await page.waitForURL("**/admin/dashboard");
  await page.getByRole("heading", { name: "El ritmo de la jornada" }).waitFor();
  await measure(page, "desktop-dashboard");
  await page.screenshot({ path: out + "/desktop.png", fullPage: true });
  await page.goto(base + "/admin/students");
  await page.getByRole("table", { name: "Padrón de alumnos" }).waitFor();
  await measure(page, "desktop-students");
  await page.screenshot({ path: out + "/students.png", fullPage: true });
  await page.getByRole("button", { name: "Nuevo alumno", exact: true }).click();
  await measure(page, "desktop-student-form");
  await page.screenshot({ path: out + "/student-form.png", fullPage: true });
  if (
    !(await page
      .getByLabel("Código institucional")
      .evaluate((el) => el === document.activeElement))
  )
    throw new Error("Desktop form did not receive focus");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  if (
    !(await page
      .getByRole("button", { name: "Nuevo alumno", exact: true })
      .evaluate((el) => el === document.activeElement))
  )
    throw new Error("Desktop creation trigger did not recover focus");
  const edit = page.getByRole("button", { name: /^Editar / }).first();
  await edit.click();
  if (
    !(await page
      .getByLabel("Código institucional")
      .evaluate((el) => el === document.activeElement))
  )
    throw new Error("Desktop edit did not receive focus");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  if (!(await edit.evaluate((el) => el === document.activeElement)))
    throw new Error("Desktop edit trigger did not recover focus");
  metrics.push({
    name: "desktop-form-focus",
    createFocus: true,
    createReturn: true,
    editFocus: true,
    editReturn: true,
  });
  await page.goto(base + "/ingreso");
  await page.getByRole("button", { name: "Autorizar por 8 horas" }).click();
  await page
    .getByRole("heading", { name: "Listo para leer el carnet" })
    .waitFor();
  await measure(page, "desktop-terminal");
  await page.screenshot({ path: out + "/terminal.png", fullPage: true });
  const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      storageState: await desktop.storageState(),
      reducedMotion: "reduce",
    }),
    phone = await mobile.newPage();
  phone.on("pageerror", (e) => errors.push(e.message));
  phone.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await phone.goto(base + "/admin/dashboard");
  await phone
    .getByRole("heading", { name: "El ritmo de la jornada" })
    .waitFor();
  await measure(phone, "mobile-dashboard");
  await phone.screenshot({ path: out + "/mobile.png", fullPage: true });
  await phone.getByRole("button", { name: "Abrir menú", exact: true }).click();
  await phone.getByRole("dialog", { name: "Navegación principal" }).waitFor();
  await measure(phone, "mobile-menu");
  await phone.screenshot({ path: out + "/mobile-menu.png" });
  await phone.keyboard.press("Tab");
  const trapped = await phone.evaluate(() =>
    document.querySelector(".sidebar")?.contains(document.activeElement),
  );
  await phone.keyboard.press("Escape");
  metrics.push({
    name: "mobile-keyboard",
    focusInsideDrawer: trapped,
    returnedFocus: await phone.evaluate(() =>
      document.activeElement?.getAttribute("aria-label"),
    ),
  });
  await phone.goto(base + "/admin/students");
  await phone.getByRole("table", { name: "Padrón de alumnos" }).waitFor();
  await measure(phone, "mobile-students");
  await phone.screenshot({
    path: out + "/mobile-students.png",
    fullPage: true,
  });
  await phone
    .getByRole("button", { name: "Nuevo alumno", exact: true })
    .click();
  await measure(phone, "mobile-student-form");
  await phone.screenshot({
    path: out + "/mobile-student-form.png",
    fullPage: true,
  });
  if (
    !(await phone
      .getByLabel("Código institucional")
      .evaluate((el) => el === document.activeElement))
  )
    throw new Error("Mobile form did not receive focus");
  if (
    !(await phone.evaluate(
      () =>
        document.querySelector(".student-editor").getBoundingClientRect().top <
        document.querySelector(".students-list").getBoundingClientRect().top,
    ))
  )
    throw new Error("Mobile form is behind the roster");
  await phone.getByRole("button", { name: "Cancelar", exact: true }).click();
  if (
    !(await phone
      .getByRole("button", { name: "Nuevo alumno", exact: true })
      .evaluate((el) => el === document.activeElement))
  )
    throw new Error("Mobile creation trigger did not recover focus");
  const mobileEdit = phone.getByRole("button", { name: /^Editar / }).first();
  await mobileEdit.click();
  if (
    !(await phone
      .getByLabel("Código institucional")
      .evaluate((el) => el === document.activeElement))
  )
    throw new Error("Mobile edit did not receive focus");
  await phone.getByRole("button", { name: "Cancelar", exact: true }).click();
  if (!(await mobileEdit.evaluate((el) => el === document.activeElement)))
    throw new Error("Mobile edit trigger did not recover focus");
  metrics.push({
    name: "mobile-form-focus",
    createFocus: true,
    createReturn: true,
    editFocus: true,
    editReturn: true,
    editorBeforeList: true,
  });
  await phone.goto(base + "/ingreso");
  await phone.getByRole("button", { name: "Autorizar por 8 horas" }).click();
  await phone
    .getByRole("heading", { name: "Listo para leer el carnet" })
    .waitFor();
  await measure(phone, "mobile-terminal");
  await phone.screenshot({
    path: out + "/mobile-terminal.png",
    fullPage: true,
  });
  await writeFile(
    out + "/metrics.json",
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        synthetic: true,
        base,
        metrics,
        errors,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({
      captures: 10,
      errors: errors.length,
      overflow: metrics
        .filter((m) => m.documentWidth > m.width)
        .map((m) => m.name),
      keyboard: metrics.find((m) => m.name === "mobile-keyboard"),
    }),
  );
} finally {
  await browser.close();
}
