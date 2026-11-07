import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { claimController, downloadSnapshot, uploadOperations } from '../src/services/apiService';
import { TrackerDatabase, type EntryFields } from '../src/services/localDatabase';
import { parseSnapshot, PROTOCOL, type Snapshot, type SyncOperation } from '../src/services/protocol';
import { SyncWorker } from '../src/services/syncWorker';
import { buildDailySummary, buildWeeklySummary, getSleepMinutes } from '../src/utils/sleep';

process.env.TZ = 'Europe/Brussels';
const connection = { url: 'https://script.google.com/macros/s/test/exec', code: 'a'.repeat(64) };
const instant = '2026-10-10T12:00:00.000Z';
const meta = { revision: 0, createdAt: instant, modifiedAt: instant };
const blank: Snapshot = { entries: [], sleeps: [], datasetId: 'test_sheet', tag: 'c'.repeat(64) };
const milk: EntryFields = {
  date: '2026-10-10', time: '19:15', milkMl: 150, diaper: null, weightGrams: null, vomited: false,
  remarks: '', feedingType: 'Melk', solidFoodGrams: null, solidFoodSubtype: null, temperatureCelsius: null,
};

function rawSnapshot() {
  return {
    ...blank, protocol: PROTOCOL, success: true, entryCount: 2, sleepCount: 2,
    entries: [
      { ...meta, row: 2, id: 'first', cells: ['10-10-2026 19:30:47', '10/10/2026', '19:30:47', 140,
        'Pipi + kaka pamper', 5930, 'Ja', ' Controle\nKind en Gezin ', 'Melk', '', '', '36,5'] },
      { ...meta, row: 3, id: 'second', cells: ['11-10-2026 08:12:24', '', '', '',
        '', '', '', 'Peer', 'Vaste voeding', '72,5', 'Fruitpap', ''] },
    ],
    sleeps: [
      { ...meta, row: 2, id: 'night', cells: ['night', '10-10-2026 23:30:30', '2026-10-11T01:30:30+02:00', 'Dutje'] },
      { ...meta, row: 3, id: 'active', cells: ['active', '2026-10-11T13:45:00.000Z', '', ''] },
    ],
  };
}

async function controller(name: string, snapshot = blank) {
  const db = new TrackerDatabase('controller', name);
  await db.finishController(await db.stageController(connection, snapshot));
  return db;
}

function isolatedDb(t: TestContext, mode: 'controller' | 'viewer') {
  const db = new TrackerDatabase(mode, crypto.randomUUID());
  t.after(() => db.delete());
  return db;
}

test('legacy import preserves combined measurements, seconds, notes and active sleep', () => {
  const original = rawSnapshot();
  const snapshot = parseSnapshot(original);
  assert.equal(snapshot.entries.length, original.entryCount);
  assert.equal(snapshot.sleeps.length, original.sleepCount);
  assert.deepEqual(snapshot.entries.map((entry) => entry.id), ['first', 'second']);
  const [entry, solid] = snapshot.entries;
  assert.equal(entry.dateTime.getSeconds(), 47);
  assert.equal(entry.milkMl, 140);
  assert.equal(entry.temperatureCelsius, 36.5);
  assert.equal(entry.diaper, 'Pipi + kaka pamper');
  assert.equal(entry.weightGrams, 5930);
  assert.equal(entry.remarks, ' Controle\nKind en Gezin ');
  assert.equal(entry.vomited, true);
  assert.equal(solid.date, '2026-10-11');
  assert.equal(solid.time, '08:12');
  assert.equal(solid.solidFoodGrams, 72.5);
  assert.equal(solid.solidFoodSubtype, 'Fruitpap');
  assert.equal(getSleepMinutes(snapshot.sleeps[0]), 120);
  assert.equal(snapshot.sleeps[1].end, null);
});

test('first launch validates the full snapshot and stores it before activation', async (t) => {
  const db = isolatedDb(t, 'controller');
  assert.equal((await db.read()).settings, undefined);
  await assert.rejects(() => db.saveEntry(milk), /geen wijzigingen/);
  const snapshot = parseSnapshot(rawSnapshot());
  const staged = await db.stageController(connection, snapshot);
  assert.equal(staged.ready, false);
  assert.equal((await db.read()).entries.length, 2);
  await assert.rejects(() => db.saveEntry(milk), /geen wijzigingen/);
  const reopened = new TrackerDatabase('controller', db.name);
  t.after(() => reopened.close());
  assert.deepEqual(await reopened.controllerState(), staged);
  await reopened.finishController(staged);
  assert.equal((await reopened.controllerState())?.ready, true);
  assert.equal(await reopened.outbox.count(), 0);
  await assert.rejects(() => reopened.stageController(connection, blank), /al lokale gegevens/);
  assert.equal((await reopened.read()).entries.length, 2);
});

test('failed validation or initialization has no write path', async (t) => {
  const db = isolatedDb(t, 'controller');
  const malformed = rawSnapshot();
  malformed.entries[0].cells[1] = '31/02/2026';
  assert.throws(() => parseSnapshot(malformed), /rij 2: datum/);
  assert.throws(() => parseSnapshot({ ...rawSnapshot(), sleepCount: 5 }), /Onvolledige download/);
  let uploads = 0;
  const worker = new SyncWorker(db, () => {}, () => true, async () => { uploads++; });
  const staged = await db.stageController(connection, parseSnapshot(rawSnapshot()));
  await assert.rejects(() => db.finishController({ ...staged, tag: 'wrong' }), /intussen gewijzigd/);
  await worker.attempt();
  assert.equal(uploads, 0);
  assert.equal(await db.outbox.count(), 0);
  assert.equal((await db.controllerState())?.ready, false);
});

test('controller reopens offline, keeps all committed changes and syncs in order on reconnect', async (t) => {
  let online = false;
  const db = await controller(crypto.randomUUID(), parseSnapshot(rawSnapshot()));
  t.after(() => db.delete());
  await db.saveEntry(milk);
  const created = (await db.entries.toArray()).find((row) => row.revision === 1)!;
  await db.saveEntry({ ...milk, milkMl: 170 }, created);
  const updated = (await db.entries.get(created.id))!;
  assert.equal(updated.milkMl, 170);
  await assert.rejects(() => db.deleteRecord('entry', created), /intussen gewijzigd/);
  await db.deleteRecord('entry', updated);
  assert.equal(await db.entries.get(created.id), undefined);
  db.close();

  const reopened = new TrackerDatabase('controller', db.name);
  t.after(() => reopened.close());
  const calls: SyncOperation[][] = [];
  const worker = new SyncWorker(reopened, () => {}, () => online, async (_connection, _id, _device, batch) => {
    calls.push(batch);
  });
  await worker.attempt();
  assert.equal(calls.length, 0);
  assert.equal((await reopened.controllerState())?.ready, true);
  assert.equal((await reopened.read()).pending, 3);
  online = true;
  await worker.attempt(true);
  assert.deepEqual(calls[0].map((op) => [op.id, op.revision]), [[created.id, 1], [created.id, 2], [created.id, 3]]);
  assert.equal(calls[0][2].changes, null);
  assert.equal(await reopened.outbox.count(), 0);
  assert.equal(await reopened.entries.get(created.id), undefined);
});

test('a failed outbox write aborts the local record transaction', async (t) => {
  const db = await controller(crypto.randomUUID());
  t.after(() => db.delete());
  db.outbox.hook('creating', () => { throw new Error('opslagfout'); });
  await assert.rejects(() => db.saveEntry(milk), /opslagfout/);
  assert.equal(await db.entries.count(), 0);
  assert.equal(await db.outbox.count(), 0);
});

test('failed or ambiguous acknowledgement leaves the local save and queue intact', async (t) => {
  const db = await controller(crypto.randomUUID());
  t.after(() => db.delete());
  await db.saveEntry(milk);
  let calls = 0;
  const worker = new SyncWorker(db, () => {}, () => true, async () => {
    if (++calls === 1) throw new Error('antwoord verloren');
  });
  await worker.attempt();
  await worker.attempt();
  assert.equal(calls, 1, 'automatic attempts respect the retry delay');
  assert.equal(await db.outbox.count(), 1);
  assert.equal(await db.entries.count(), 1);
  await worker.attempt(true);
  assert.equal(await db.outbox.count(), 0);
});

test('API validates role, claim and acknowledgements before confirming a write', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const op: SyncOperation = { ...meta, id: 'entry', revision: 1, kind: 'entry', changes: [[3, 150]] };
  const bodies: Record<string, unknown>[] = [];
  globalThis.fetch = async (_url, request) => {
    assert.equal(request?.method, 'POST');
    assert.match(JSON.stringify(request?.headers), /text\/plain/);
    const body = JSON.parse(String(request?.body));
    bodies.push(body);
    const response = body.action === 'snapshot' ? rawSnapshot()
      : body.action === 'claim' ? { success: true, protocol: PROTOCOL, datasetId: blank.datasetId, installationId: 'device' }
        : { success: true, protocol: PROTOCOL, datasetId: blank.datasetId, ack: [{ id: 'entry', kind: 'entry', revision: 2 }] };
    return Response.json(response);
  };
  assert.equal((await downloadSnapshot(connection, 'controller')).entries.length, 2);
  assert.equal(bodies[0].mode, 'controller');
  await claimController(connection, blank.datasetId, 'device', blank.tag);
  await assert.rejects(() => uploadOperations(connection, blank.datasetId, 'device', [op]), /niet volledig bevestigd/);
});

test('sleep edits are transactional, reject overlap and recalculate midnight summaries', async (t) => {
  const db = await controller(crypto.randomUUID());
  t.after(() => db.delete());
  await db.saveSleep({ start: new Date(2026, 9, 10, 23, 30), end: null, remarks: 'Slaapt' });
  const running = (await db.sleeps.toArray())[0];
  assert.equal(running.end, null);
  await assert.rejects(() => db.saveSleep({ ...running }), /overlapt/);
  await assert.rejects(() => db.saveSleep({ ...running, end: new Date(2026, 9, 10, 21) }, running), /eindtijd/);
  await db.saveSleep({ ...running, end: new Date(2026, 9, 11, 0, 45) }, running);
  const ended = (await db.sleeps.get(running.id))!;
  await db.saveSleep({ ...ended, start: new Date(2026, 9, 10, 23, 15), end: new Date(2026, 9, 11, 1, 5) }, ended);
  const sleeps = await db.sleeps.toArray();
  assert.equal(getSleepMinutes(sleeps[0]), 110);
  assert.equal(buildDailySummary('2026-10-10', [], sleeps).sleepMinutes, 45);
  assert.equal(buildDailySummary('2026-10-11', [], sleeps).sleepMinutes, 65);
  assert.equal(buildWeeklySummary(new Date(2026, 9, 10), [], sleeps).sleepMinutes, 110);
});

test('viewer cache reopens offline, cannot write, and has no effect on the controller', async (t) => {
  const local = await controller(crypto.randomUUID(), parseSnapshot(rawSnapshot()));
  t.after(() => local.delete());
  const viewer = isolatedDb(t, 'viewer');
  const changedSheet = rawSnapshot();
  changedSheet.entries[0].cells[3] = 100;
  await viewer.cacheViewer(connection, parseSnapshot(changedSheet));
  viewer.close();
  const cached = new TrackerDatabase('viewer', viewer.name);
  t.after(() => cached.close());
  assert.equal((await cached.entries.get('first'))?.milkMl, 100);
  assert.ok((await cached.viewerState())?.refreshedAt);
  assert.equal((await local.entries.get('first'))?.milkMl, 140);
  await assert.rejects(() => cached.saveEntry(milk), /geen wijzigingen/);
  await assert.rejects(() => cached.deleteRecord('entry', changedSheet.entries[0]), /geen wijzigingen/);
  await assert.rejects(() => local.cacheViewer(connection, parseSnapshot(changedSheet)), /niet worden vervangen/);
  const pendingBefore = await local.outbox.count();
  await new SyncWorker(cached, () => {}, () => true, async () => assert.fail('viewer uploaded')).attempt();
  assert.equal(await local.outbox.count(), pendingBefore);
});
