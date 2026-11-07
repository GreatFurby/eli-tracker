import assert from 'node:assert/strict';
import { preview } from 'vite';
import { endpoint, mockBackend, viewerCode, writerCode } from './fixtures/backendHarness';

const playwrightModule = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = await import(playwrightModule);
const backend = mockBackend();
backend.migrate();
const server = await preview({ preview: { host: '127.0.0.1', port: 4175, strictPort: true } });
const url = 'http://127.0.0.1:4175/eli-tracker/';
let invalidDownload = true;
let loseClaim = true;
const requests: { action: string; mode?: string }[] = [];
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: process.env.CHROMIUM_PATH
    ? ['--no-sandbox', '--disable-gpu', '--disable-software-rasterizer', '--use-gl=disabled', '--no-zygote']
    : [],
});

async function phone() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    timezoneId: 'Europe/Brussels',
  });
  await context.route(endpoint, async (route) => {
    const body = route.request().postDataJSON();
    requests.push({ action: body.action, mode: body.mode });
    const result = backend.request(body);
    if (invalidDownload && body.action === 'snapshot' && body.mode === 'controller') {
      invalidDownload = false;
      result.entryCount += 1;
    }
    if (loseClaim && body.action === 'claim') {
      loseClaim = false;
      assert.equal(result.success, true);
      await route.abort('failed');
    } else {
      await route.fulfill({ json: result, headers: { 'access-control-allow-origin': '*' } });
    }
  });
  return context;
}

try {
  const controller = await phone();
  const kelly = await controller.newPage();
  kelly.setDefaultTimeout(9000);
  const errors: string[] = [];
  kelly.on('pageerror', (error) => errors.push(error.message));


  await kelly.goto(url + '?mode=controller');
  await kelly.getByRole('heading', { name: 'Geen lokale gegevens gevonden' }).waitFor();
  await kelly.getByLabel('Link van de Apps Script-web-app').fill(endpoint);
  await kelly.getByLabel('Beheercode voor Kelly').fill(writerCode);
  await kelly.getByRole('button', { name: 'Downloaden uit Google Sheets' }).click();
  await kelly.getByText('Onvolledige download voor Formulierreacties 1.').waitFor();
  assert.equal(backend.properties.has('ELI_CONTROLLER_INSTALLATION'), false);
  await kelly.getByRole('button', { name: 'Downloaden uit Google Sheets' }).click();
  await kelly.getByText('2 registraties · 1 slaapperiode').waitFor();
  await kelly.getByRole('button', { name: 'Gegevens bevestigen en activeren' }).click();
  await kelly.getByText('Google Sheets is niet bereikbaar.', { exact: false }).waitFor();
  assert.equal(backend.properties.has('ELI_CONTROLLER_INSTALLATION'), true);
  await kelly.reload();
  await kelly.getByRole('button', { name: 'Eerdere koppeling voltooien' }).click();
  await kelly.getByText('Alles gesynchroniseerd').waitFor();

  await kelly.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await controller.setOffline(true);
  const countBefore = requests.length;
  const offlineNavigation = await kelly.reload();
  assert.equal(offlineNavigation?.fromServiceWorker(), true);
  await kelly.getByText('Offline · lokale gegevens').waitFor();
  await kelly.locator('#card-last-milk').click();
  await kelly.locator('input[type=number]').fill('155');
  await kelly.locator('#entry-remarks-input').fill('Offline flesje');
  await kelly.locator('#submit-entry-btn').click();
  await kelly.getByText('155 ml melk').waitFor();
  await kelly.locator('#today-timeline-section').getByRole('button', { name: /Registratie om .* bewerken/ }).click();
  await kelly.getByRole('dialog', { name: 'Registratie bewerken' }).waitFor();
  assert.equal(await kelly.locator('#entry-remarks-input').inputValue(), 'Offline flesje');
  await kelly.locator('input[type=number]').fill('175');
  await kelly.getByRole('button', { name: 'Opslaan', exact: true }).click();
  await kelly.getByText('175 ml melk').waitFor();

  await kelly.locator('#card-sleep').click();
  await kelly.getByRole('button', { name: 'Start slaap', exact: true }).click();
  await kelly.getByRole('button', { name: 'Slaap starten' }).click();
  await kelly.getByText('Eli slaapt nu', { exact: true }).waitFor();
  await kelly.getByRole('button', { name: 'Stop slaap', exact: true }).click();
  await kelly.getByRole('button', { name: 'Slaap stoppen' }).click();
  await kelly.getByText('Slaap lokaal opgeslagen', { exact: true }).waitFor();
  await kelly.locator('#nav-btn-vandaag').click();
  await kelly.locator('#today-timeline-section').getByRole('button', { name: /Slaap om .* bewerken/ }).click();
  await kelly.getByRole('dialog', { name: 'Slaapperiode bewerken' }).getByRole('button', { name: 'Sluiten' }).click();

  await kelly.locator('#nav-btn-historiek').click();
  await kelly.getByRole('button', { name: 'Slaap om 23:30 bewerken', exact: true }).click();
  await kelly.getByLabel('Eindtijd').fill('02:00');
  await kelly.getByRole('button', { name: 'Opslaan', exact: true }).click();
  await kelly.getByText('tot 02:00', { exact: true }).waitFor();
  await kelly.getByRole('button', { name: 'Weekoverzicht', exact: true }).click();
  await kelly.getByRole('button', { name: 'Vorige week' }).waitFor();
  await kelly.getByRole('button', { name: 'Dagoverzicht', exact: true }).click();
  await kelly.getByRole('button', { name: 'Registratie om 08:12 bewerken', exact: true }).click();
  kelly.once('dialog', (dialog) => void dialog.accept());
  await kelly.getByRole('button', { name: 'Verwijderen', exact: true }).click();
  await kelly.getByText('Lokaal verwijderd', { exact: true }).waitFor();
  assert.equal(await kelly.getByRole('button', { name: 'Registratie om 08:12 bewerken', exact: true }).count(), 0);

  await kelly.locator('#nav-btn-groei').click();
  await kelly.getByRole('button', { name: /Temperatuur/ }).waitFor();
  await kelly.getByRole('button', { name: /Temperatuur/ }).click();
  assert.equal(requests.length, countBefore);
  await kelly.reload();
  await kelly.getByText('175 ml melk').waitFor();

  await controller.setOffline(false);
  await kelly.getByText('Alles gesynchroniseerd').waitFor();
  const finalOnline = backend.request({ action: 'snapshot', accessCode: viewerCode });
  assert.equal(finalOnline.entryCount, 2);
  assert.equal(finalOnline.sleepCount, 2);
  assert.ok(finalOnline.entries.some((row: { cells: unknown[] }) => row.cells[3] === 175));
  assert.ok(!finalOnline.entries.some((row: { cells: unknown[] }) => row.cells[7] === 'Peer'));

  backend.rows(0)[1][3] = 142;
  await kelly.reload();
  await kelly.locator('#nav-btn-historiek').click();
  await kelly.getByText(/140 ml melk/).waitFor();
  assert.equal(await kelly.getByText(/142 ml melk/).count(), 0);

  const viewer = await phone();
  const ruben = await viewer.newPage();
  ruben.on('pageerror', (error) => errors.push(error.message));
  await ruben.goto(url + '?mode=viewer');
  await ruben.getByLabel('Link van de Apps Script-web-app').fill(endpoint);
  await ruben.getByLabel('Kijkcode voor Ruben').fill(viewerCode);
  await ruben.getByRole('button', { name: 'Downloaden uit Google Sheets' }).click();
  await ruben.getByText('175 ml melk').waitFor();
  await ruben.getByText('Laatst vernieuwd:', { exact: false }).waitFor();
  assert.equal(await ruben.locator('#nav-btn-ingave').count(), 0);
  assert.equal(await ruben.locator('#card-last-milk').evaluate((node) => node.tagName), 'DIV');
  assert.equal(await ruben.getByRole('button', { name: /bewerken/ }).count(), 0);
  await ruben.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await viewer.setOffline(true);
  await ruben.reload();
  await ruben.getByText('Offline · Laatst vernieuwd:', { exact: false }).waitFor();
  await ruben.locator('#nav-btn-historiek').click();
  await ruben.getByText(/142 ml melk/).waitFor();
  assert.equal(await ruben.getByRole('button', { name: /bewerken/ }).count(), 0);
  assert.deepEqual(errors, []);

  if (process.env.ELI_SMOKE_SCREENSHOTS) {
    await kelly.screenshot({ path: process.env.ELI_SMOKE_SCREENSHOTS + '/historiek-controller.png' });
    await ruben.screenshot({ path: process.env.ELI_SMOKE_SCREENSHOTS + '/historiek-viewer.png' });
  }
  console.log('Chromium production smoke passed: migration, claim recovery, offline reload, edits, sleep, charts, reconnect and viewer cache.');
} finally {
  await browser.close();
  await new Promise<void>((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
}
