import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { claimController, downloadSnapshot } from '../src/services/apiService';
import { TrackerDatabase, type EntryFields } from '../src/services/localDatabase';
import type { SyncOperation } from '../src/services/protocol';
import { SyncWorker } from '../src/services/syncWorker';
import { endpoint, mockBackend, sheetId, viewerCode, writerCode } from './fixtures/backendHarness';

process.env.TZ = 'Europe/Brussels';
const now = '2026-10-12T13:30:00.000Z';
const device = 'kelly-phone';
const milk: EntryFields = {
  date: '2026-10-12', time: '15:30', milkMl: 150, diaper: null, weightGrams: null, vomited: false,
  remarks: '=1+1', feedingType: 'Melk', solidFoodGrams: null, solidFoodSubtype: null, temperatureCelsius: null,
};
const newOp: SyncOperation = {
  id: 'new-entry', kind: 'entry', revision: 1, createdAt: now, modifiedAt: now,
  changes: [now, '12/10/2026', '15:30', 150, '', '', 'Nee', '=1+1', 'Melk', '', '', '']
    .map((value, column) => [column, value]),
};

function pair(backend: ReturnType<typeof mockBackend>) {
  const snapshot = backend.request({ action: 'snapshot', accessCode: writerCode, mode: 'controller' });
  assert.equal(snapshot.success, true);
  const response = backend.request({
    action: 'claim', accessCode: writerCode, datasetId: sheetId, installationId: device, tag: snapshot.tag,
  });
  assert.equal(response.success, true);
  return snapshot;
}

function sync(backend: ReturnType<typeof mockBackend>, operations: SyncOperation[], installationId = device, accessCode = writerCode) {
  return backend.request({ action: 'sync', datasetId: sheetId, installationId, accessCode, operations });
}

test('migration adds stable IDs without rewriting or duplicating legacy values', () => {
  const backend = mockBackend();
  const originalEntries = structuredClone(backend.rows(0));
  const originalSleep = structuredClone(backend.rows(1));
  assert.equal(backend.request({ action: 'snapshot', accessCode: writerCode }).code, 'MIGRATION');
  const result = backend.migrate();
  assert.equal(result['Formulierreacties 1'].records, 2);
  assert.equal(result.Slaap.records, 1);
  assert.deepEqual(backend.rows(0).map((row) => row.slice(0, 12)), originalEntries);
  assert.deepEqual(backend.rows(1).map((row) => row.slice(0, 4)), originalSleep);
  const first = backend.request({ action: 'snapshot', accessCode: viewerCode });
  assert.equal(first.entries[0].cells[1], '2026-10-10');
  assert.equal(first.entries[0].cells[2], '19:30:47');
  assert.equal(first.entries[0].cells[11], '36,5');
  assert.equal(first.sleeps[0].id, 'overnight');
  assert.equal(first.sleeps[0].cells[2], '2026-10-10T23:30:00.000Z');
  assert.equal(backend.migrate()['Formulierreacties 1'].addedIds, 0);
  assert.equal(backend.writeCount(), 1);
  assert.deepEqual(backend.request({ action: 'snapshot', accessCode: viewerCode }), first);
});

test('migration refuses occupied columns and leaves both worksheets unchanged on failure', () => {
  const backend = mockBackend();
  backend.rows(1)[0][1] = 'Ander veld';
  assert.throws(() => backend.migrate(), /controleer kolom B/);
  assert.equal(backend.writeCount(), 0);
  backend.rows(1)[0][1] = 'Starttijd';
  backend.rejectNextBatch();
  assert.throws(() => backend.migrate(), /Simulated Sheets batch failure/);
  assert.equal(backend.rows(0)[0].length, 12);
  assert.equal(backend.rows(1)[0].length, 4);
  backend.migrate();
  assert.equal(backend.writeCount(), 1);
});

test('the online API requires a paired controller and gives the viewer read access only', () => {
  const backend = mockBackend();
  backend.migrate();
  assert.deepEqual(Object.keys(backend.get()).sort(), ['protocol', 'success']);
  assert.equal(backend.request({ action: 'snapshot' }).code, 'AUTH');
  assert.equal(backend.request({ action: 'snapshot', mode: 'controller', accessCode: viewerCode }).code, 'AUTH');
  assert.equal(backend.request({ action: 'startSleep', starttijd: now }).code, 'REQUEST');
  assert.equal(sync(backend, [newOp]).code, 'DEVICE');
  assert.equal(sync(backend, [newOp], device, viewerCode).code, 'AUTH');
  const snapshot = pair(backend);
  assert.equal(backend.request({ action: 'snapshot', accessCode: viewerCode }).success, true);
  assert.equal(backend.request({
    action: 'claim', accessCode: writerCode, datasetId: sheetId, installationId: 'other-phone', tag: snapshot.tag,
  }).code, 'DEVICE');
  assert.equal(sync(backend, [newOp], 'other-phone').code, 'DEVICE');
  backend.release();
  assert.equal(sync(backend, [newOp]).code, 'DEVICE');
});

test('claim refuses a stale preview and can resume after a lost claim response', () => {
  const backend = mockBackend();
  backend.migrate();
  const preview = backend.request({ action: 'snapshot', accessCode: writerCode });
  backend.rows(0)[1][3] = 145;
  const attempt = (tag: string) => backend.request({
    action: 'claim', accessCode: writerCode, datasetId: sheetId, installationId: device, tag,
  });
  assert.equal(attempt(preview.tag).code, 'STALE_SNAPSHOT');
  assert.equal(backend.properties.has('ELI_CONTROLLER_INSTALLATION'), false);
  const verified = backend.request({ action: 'snapshot', accessCode: writerCode });
  assert.equal(attempt(verified.tag).success, true);
  assert.equal(attempt(verified.tag).success, true);
  assert.equal(backend.writeCount(), 1);
});

test('a Sheets batch applies all values and revisions together and safely acknowledges repeats', () => {
  const backend = mockBackend();
  backend.migrate();
  const snapshot = pair(backend);
  const legacy = snapshot.entries[0];
  const edit: SyncOperation = {
    kind: 'entry', id: legacy.id, revision: 1, createdAt: legacy.createdAt, modifiedAt: now,
    changes: [[11, 36.8]],
  };
  const sleep: SyncOperation = {
    id: 'new-sleep', kind: 'sleep', revision: 1, createdAt: now, modifiedAt: now,
    changes: [[0, 'new-sleep'], [1, '2026-10-12T10:05:00.000Z'], [2, '2026-10-12T10:55:00.000Z'], [3, '=A1']],
  };
  assert.equal(sync(backend, [edit, { ...sleep, changes: [[1, 'bad time']] }]).code, 'REQUEST');
  backend.rejectNextBatch();
  assert.equal(sync(backend, [edit, newOp, sleep]).success, false);
  assert.equal(backend.rows(0)[1][11], '36,5');
  assert.equal(backend.rows(1).length, 2);
  const first = sync(backend, [edit, newOp, sleep]);
  assert.equal(first.success, true);
  assert.equal(backend.rows(0)[1][11], 36.8);
  assert.equal(backend.rows(0)[1][2], '19:30:47', 'only changed cells are written');
  assert.equal(backend.rows(0)[4][7], '=1+1');
  assert.equal(backend.rows(1)[2][3], '=A1');
  assert.deepEqual(sync(backend, [edit, newOp, sleep]), first);
  assert.equal(backend.writeCount(), 2);
  assert.equal(backend.request({ action: 'snapshot', accessCode: viewerCode }).entryCount, 3);
});

test('lost response, repeated edits and deletion remain idempotent through a new device recovery', async (t) => {
  const backend = mockBackend();
  backend.migrate();
  const db = new TrackerDatabase('controller', crypto.randomUUID());
  t.after(() => db.delete());
  let loseResponse = true;
  const fetchOriginal = globalThis.fetch;
  t.after(() => { globalThis.fetch = fetchOriginal; });
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(String(options?.body));
    const response = backend.request(body);
    if (body.action === 'sync' && loseResponse) {
      loseResponse = false;
      assert.equal(response.success, true);
      throw new Error('Connection broke after the server committed');
    }
    return Response.json(response);
  };

  const connection = { url: endpoint, code: writerCode };
  const snapshot = await downloadSnapshot(connection, 'controller');
  const state = await db.stageController(connection, snapshot);
  await claimController(connection, state.datasetId, state.installationId, state.tag);
  await db.finishController(state);
  await db.saveEntry(milk);
  const created = (await db.entries.toArray()).find((entry) => entry.revision === 1)!;
  const worker = new SyncWorker(db, () => {}, () => true);
  await worker.attempt();
  assert.equal(await db.outbox.count(), 1);
  assert.equal(backend.request({ action: 'snapshot', accessCode: viewerCode }).entryCount, 3);
  const original = (await db.pendingBatch())[0];
  await db.saveEntry({ ...milk, milkMl: 160 }, created);
  await db.saveEntry({ ...milk, milkMl: 170 }, (await db.entries.get(created.id))!);
  await worker.attempt(true);
  assert.equal(await db.outbox.count(), 0);
  const getSynced = () => backend.request({ action: 'snapshot', accessCode: viewerCode }).entries
    .find((entry: { id: string }) => entry.id === created.id);
  assert.equal(getSynced().cells[3], 170);
  assert.equal(sync(backend, [original], state.installationId).success, true);
  assert.equal(getSynced().cells[3], 170);
  await db.deleteRecord('entry', (await db.entries.get(created.id))!);
  const deletion = (await db.pendingBatch())[0];
  await worker.attempt(true);
  assert.equal(getSynced(), undefined);
  assert.equal(sync(backend, [deletion, original], state.installationId).success, true);
  assert.equal(getSynced(), undefined);

  backend.release();
  assert.equal(sync(backend, [original], state.installationId).code, 'DEVICE');
  const afterRecovery = await downloadSnapshot(connection, 'controller');
  assert.equal(afterRecovery.entries.length, snapshot.entries.length);
  assert.ok(!afterRecovery.entries.some((entry) => entry.id === created.id));
});
