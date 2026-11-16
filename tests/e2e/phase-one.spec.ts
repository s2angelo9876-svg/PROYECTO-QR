import { test, expect, type Page } from '@playwright/test';

async function records(page: Page) {
  return page.evaluate(() => new Promise<Array<{ scanId: string; state: string; acknowledgement?: { persistence: string } }>>((resolve, reject) => {
    const request = indexedDB.open('SCA_OFFLINE_DB');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const get = db.transaction('pending_scans').objectStore('pending_scans').getAll();
      get.onsuccess = () => { db.close(); resolve(get.result); };
      get.onerror = () => { db.close(); reject(get.error); };
    };
  }));
}
async function openTerminal(page: Page) {
  await page.goto('/ingreso');
  await expect(page.getByRole('button', { name: 'Simular Sofía' })).toBeVisible();
  await expect.poll(() => page.evaluate(async () => {
    const dbs = await indexedDB.databases(); return dbs.find((db) => db.name === 'SCA_OFFLINE_DB')?.version;
  })).toBe(4);
  // The initialization resolves storage before enabling capture; wait for the roster response too.
  await expect.poll(() => page.evaluate(() => new Promise<number>((resolve) => {
    const request = indexedDB.open('SCA_OFFLINE_DB'); request.onsuccess = () => {
      const db = request.result; const count = db.transaction('students').objectStore('students').count();
      count.onsuccess = () => { db.close(); resolve(count.result); };
    };
  }))).toBe(8);
}

test('the compiled app registers its worker and preserves an offline capture across a cold reload', async ({ page, context }) => {
  await openTerminal(page);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Simular Sofía' }).click();
  await expect(page.getByTestId('status-warning')).toContainText('Guardado localmente');
  const before = await records(page); expect(before).toHaveLength(1);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('connectivity-badge')).toContainText('OFFLINE');
  await expect.poll(async () => (await records(page))[0]?.scanId).toBe(before[0].scanId);
  await context.setOffline(false);
  await expect.poll(async () => (await records(page))[0]?.state, { timeout: 15_000 }).toBe('ACKED');
  expect((await records(page))[0].acknowledgement?.persistence).toBe('memory-demo');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar copia local' }).click();
  expect((await download).suggestedFilename()).toMatch(/^sca-qr-copia-.*\.json$/);
});

test('HTTP 503 keeps a local record and never displays definitive success', async ({ page }) => {
  await page.route('**/api/attendances/scan', (route) => route.fulfill({ status: 503, json: { ok: false } }));
  await openTerminal(page);
  const failure = page.waitForResponse((r) => r.url().endsWith('/api/attendances/scan') && r.status() === 503);
  await page.getByRole('button', { name: 'Simular Mateo' }).click(); await failure;
  await expect(page.getByTestId('status-warning')).toContainText('Copia local conservada');
  await expect(page.getByTestId('status-success')).toHaveCount(0);
  const original = (await records(page))[0].scanId;
  await page.reload(); expect((await records(page))[0].scanId).toBe(original);
  await page.unroute('**/api/attendances/scan');
  await page.getByRole('button', { name: 'Reintentar pendientes' }).click();
  await expect.poll(async () => (await records(page))[0]?.state).toBe('ACKED');
});

test('unsafe login redirects cannot execute and private data is unavailable after logout', async ({ page }) => {
  await openTerminal(page);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  const destination = "javascript:void(document.documentElement.dataset.reviewProbe='executed')";
  await page.goto('/admin/login?redirect=' + encodeURIComponent(destination));
  await page.locator('input[type=text]').fill('admin'); await page.locator('input[type=password]').fill('admin123');
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  expect(await page.evaluate(() => document.documentElement.dataset.reviewProbe)).toBeUndefined();
  expect(await page.evaluate(async () => (await fetch('/api/admin/stats', { cache: 'no-store' })).status)).toBe(200);
  const status = await page.evaluate(async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    return (await fetch('/api/admin/stats', { cache: 'no-store' })).status;
  });
  expect(status).toBe(401);
  const cached = await page.evaluate(async () => {
    const entries = await Promise.all((await caches.keys()).map(async (key) => (await (await caches.open(key)).keys()).map((r) => r.url)));
    // Public compiled JS can have /admin/ in its filename; only private routes/data are forbidden.
    return entries.flat().filter((url) => /^\/(api|admin)(\/|$)/.test(new URL(url).pathname));
  });
  expect(cached).toEqual([]);
});

test('production health is dynamic and cannot be served as a cached build timestamp', async ({ request }) => {
  const first = await request.get('/api/health');
  const second = await request.get('/api/health');
  expect(first.headers()['cache-control']).toContain('no-store');
  expect(second.headers()['x-nextjs-cache']).not.toBe('HIT');
  expect((await second.json()).uptime).toBeGreaterThanOrEqual((await first.json()).uptime);
});

test('the hardware test has no attendance side effect', async ({ page }) => {
  await openTerminal(page);
  await page.getByRole('button', { name: 'Abrir panel de escáneres' }).click();
  await page.getByRole('button', { name: /Probar/ }).click();
  await page.getByRole('button', { name: 'Entendido' }).click();
  await expect(page.getByTestId('status-warning')).toContainText('No registra asistencia');
  expect(await records(page)).toHaveLength(0);
});

test('a prefixed keyboard frame produces exactly one command with the correct reader', async ({ page }) => {
  await openTerminal(page);
  const commands: string[] = [];
  page.on('request', (request) => { if (request.url().endsWith('/api/attendances/scan') && request.method() === 'POST') commands.push(request.postData() || ''); });
  await page.keyboard.type('N1|73456789|signature123'); await page.keyboard.press('Enter');
  await expect.poll(async () => (await records(page))[0]?.state).toBe('ACKED');
  expect(commands).toHaveLength(1);
  expect(JSON.parse(commands[0])).toMatchObject({ qr_code: '73456789', scanner_id: 'N1', entrance_id: 'NORTE' });
});
