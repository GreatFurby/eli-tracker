import Dexie, { type Table } from 'dexie';
import type { BabyEntry, SleepSession } from '../types';
import { localInputsToDate } from '../utils/sleep';
import {
  entryCells, sleepCells, SYNC_BATCH_SIZE,
  type Cell, type Connection, type LocalEntry, type LocalSleep, type Mode,
  type RecordMetadata, type Snapshot, type SyncOperation,
} from './protocol';

export type EntryFields = Omit<BabyEntry, 'id' | 'timestamp' | 'dateTime'>;
export type SleepFields = Pick<SleepSession, 'start' | 'end' | 'remarks'>;
export type PendingOperation = SyncOperation & { seq?: number };

export interface ControllerState {
  key: 'controller';
  connection: Connection;
  datasetId: string;
  installationId: string;
  ready: boolean;
  tag: string;
}

export interface ViewerState {
  key: 'viewer';
  connection: Connection;
  datasetId: string;
  refreshedAt: string;
}

function assertText(value: string) {
  if (value.length > 50000) throw new Error('Deze tekst is te lang om op te slaan.');
}

function sameConnection(left: Connection, right: Connection) {
  return left.url === right.url && left.code === right.code;
}

export class TrackerDatabase extends Dexie {
  entries!: Table<LocalEntry, string>;
  sleeps!: Table<LocalSleep, string>;
  outbox!: Table<PendingOperation, number>;
  settings!: Table<ControllerState | ViewerState, Mode>;

  constructor(readonly mode: Mode, name = `eli-tracker-v24-${mode}`) {
    super(name, { chromeTransactionDurability: 'strict' });
    this.version(1).stores({ entries: 'id', sleeps: 'id', outbox: '++seq', settings: 'key' });
  }

  controllerState() {
    return this.settings.get('controller') as Promise<ControllerState | undefined>;
  }

  viewerState() {
    return this.settings.get('viewer') as Promise<ViewerState | undefined>;
  }

  async read() {
    return this.transaction('r', [this.entries, this.sleeps, this.settings, this.outbox], async () => {
      const [entries, sleeps, settings, pending] = await Promise.all([
        this.entries.toArray(), this.sleeps.toArray(), this.settings.get(this.mode), this.outbox.count(),
      ]);
      return { entries, sleeps, settings, pending };
    });
  }

  async stageController(connection: Connection, snapshot: Snapshot): Promise<ControllerState> {
    if (this.mode !== 'controller') throw new Error('De kijkversie kan geen beheerder instellen.');
    return this.transaction('rw', [this.entries, this.sleeps, this.settings, this.outbox], async () => {
      const existing = await this.controllerState();
      if (existing?.ready || await this.outbox.count()) {
        throw new Error('Deze telefoon heeft al lokale gegevens. De download is gestopt.');
      }
      const sameDataset = existing?.datasetId === snapshot.datasetId;
      const state: ControllerState = {
        key: 'controller', connection, datasetId: snapshot.datasetId,
        installationId: sameDataset ? existing.installationId : crypto.randomUUID(),
        ready: false, tag: snapshot.tag,
      };
      await this.replaceRecords(snapshot);
      await this.settings.put(state);
      return state;
    });
  }

  async finishController(staged: ControllerState) {
    if (this.mode !== 'controller') throw new Error('De kijkversie kan geen beheerder instellen.');
    await this.transaction('rw', this.settings, async () => {
      const state = await this.controllerState();
      if (!state || state.tag !== staged.tag || state.installationId !== staged.installationId ||
        !sameConnection(state.connection, staged.connection)) {
        throw new Error('De koppeling is intussen gewijzigd. Open Eli Tracker opnieuw.');
      }
      await this.settings.put({ ...state, ready: true });
    });
  }

  async changeControllerCode(code: string) {
    await this.transaction('rw', this.settings, async () => {
      const state = await this.requireController();
      await this.settings.put({ ...state, connection: { ...state.connection, code } });
    });
  }

  async cacheViewer(connection: Connection, snapshot: Snapshot, previous?: ViewerState) {
    if (this.mode !== 'viewer') throw new Error('Lokale beheerdata kan niet worden vervangen.');
    return this.transaction('rw', [this.entries, this.sleeps, this.settings], async () => {
      const current = await this.viewerState();
      if (previous && (!current || !sameConnection(current.connection, previous.connection) ||
        current.datasetId !== previous.datasetId || snapshot.datasetId !== previous.datasetId)) {
        throw new Error('De gekoppelde database is gewijzigd. Controleer de instellingen.');
      }
      // A newer refresh in another tab already replaced this exact cache.
      if (previous && current?.refreshedAt !== previous.refreshedAt) return;
      await this.replaceRecords(snapshot);
      await this.settings.put({
        key: 'viewer', connection, datasetId: snapshot.datasetId, refreshedAt: new Date().toISOString(),
      });
    });
  }

  async saveEntry(fields: EntryFields, expected?: RecordMetadata) {
    const dateTime = localInputsToDate(fields.date, fields.time);
    if (!dateTime) throw new Error('Controleer datum en tijd.');
    for (const value of [fields.milkMl, fields.weightGrams, fields.solidFoodGrams]) {
      if (value !== null && (!Number.isFinite(value) || value < 0)) {
        throw new Error('Vul een geldige hoeveelheid in.');
      }
    }
    const temperature = fields.temperatureCelsius;
    if (temperature !== null && (!Number.isFinite(temperature) || temperature < 30 || temperature > 45)) {
      throw new Error('Vul een geldige temperatuur tussen 30,0 en 45,0 °C in.');
    }
    assertText(fields.remarks);
    assertText(fields.solidFoodSubtype ?? '');

    return this.transaction('rw', [this.entries, this.outbox, this.settings], async () => {
      await this.requireController();
      const current = expected ? await this.entries.get(expected.id) : undefined;
      this.assertUnchanged(current, expected);
      const metadata = this.nextMetadata(current);
      const sameTime = current?.date === fields.date && current.time === fields.time;
      const entry: LocalEntry = {
        ...fields, ...metadata, dateTime: sameTime ? current.dateTime : dateTime,
        timestamp: current?.timestamp ?? metadata.createdAt,
      };
      await this.recordChange(this.entries, 'entry', entry, entryCells(entry), current && entryCells(current));
    });
  }

  async saveSleep(fields: SleepFields, expected?: RecordMetadata) {
    const { start, end, remarks } = fields;
    const now = Date.now();
    if (!Number.isFinite(start.getTime()) || (end && !Number.isFinite(end.getTime()))) {
      throw new Error('Controleer datum en tijd.');
    }
    if (end && end <= start) throw new Error('De eindtijd moet na de starttijd liggen.');
    if (start.getTime() > now || (end && end.getTime() > now)) {
      throw new Error('De start- en eindtijd kunnen niet in de toekomst liggen.');
    }
    assertText(remarks);

    return this.transaction('rw', [this.sleeps, this.outbox, this.settings], async () => {
      await this.requireController();
      const sessions = await this.sleeps.toArray();
      const current = expected && sessions.find((session) => session.id === expected.id);
      this.assertUnchanged(current, expected);
      const timesChanged = !current || start.getTime() !== current.start.getTime() || end?.getTime() !== current.end?.getTime();
      const overlaps = timesChanged && sessions.some((session) => session.id !== current?.id &&
        start.getTime() < (session.end?.getTime() ?? Infinity) &&
        (end?.getTime() ?? Infinity) > session.start.getTime());
      if (overlaps) {
        throw new Error('Deze periode overlapt met een bestaande slaapperiode.');
      }
      const sleep: LocalSleep = { ...fields, ...this.nextMetadata(current) };
      await this.recordChange(this.sleeps, 'sleep', sleep, sleepCells(sleep), current && sleepCells(current));
    });
  }

  async deleteRecord(kind: 'entry' | 'sleep', expected: RecordMetadata) {
    const table = kind === 'entry' ? this.entries : this.sleeps;
    await this.transaction('rw', [table, this.outbox, this.settings], async () => {
      await this.requireController();
      const current = await table.get(expected.id);
      this.assertUnchanged(current, expected);
      await table.delete(expected.id);
      await this.outbox.add({ ...this.nextMetadata(current), kind, changes: null });
    });
  }

  pendingBatch() {
    return this.outbox.orderBy('seq').limit(SYNC_BATCH_SIZE).toArray();
  }

  async acknowledge(batch: PendingOperation[]) {
    if (this.mode !== 'controller') throw new Error('De kijkversie kan niet synchroniseren.');
    await this.outbox.bulkDelete(batch.map((operation) => operation.seq!));
  }

  async backup() {
    return this.transaction('r', [this.entries, this.sleeps, this.outbox, this.settings], async () => {
      const state = await this.requireController();
      const [entries, sleeps, pending] = await Promise.all([
        this.entries.toArray(), this.sleeps.toArray(), this.outbox.orderBy('seq').toArray(),
      ]);
      return { version: 1, exportedAt: new Date().toISOString(), datasetId: state.datasetId, entries, sleeps, pending };
    });
  }

  private async replaceRecords(snapshot: Snapshot) {
    await this.entries.clear();
    await this.sleeps.clear();
    await this.entries.bulkAdd(snapshot.entries);
    await this.sleeps.bulkAdd(snapshot.sleeps);
  }

  private async requireController(): Promise<ControllerState> {
    const state = this.mode === 'controller' && await this.controllerState();
    if (!state || !state.ready) throw new Error('Deze installatie kan nog geen wijzigingen opslaan.');
    return state;
  }

  private nextMetadata(current?: RecordMetadata): RecordMetadata {
    const now = new Date().toISOString();
    return {
      id: current?.id ?? crypto.randomUUID(),
      revision: (current?.revision ?? 0) + 1,
      createdAt: current?.createdAt ?? now,
      modifiedAt: now,
    };
  }

  private assertUnchanged(current?: RecordMetadata, expected?: RecordMetadata) {
    if (expected && (!current || current.revision !== expected.revision)) {
      throw new Error('Deze registratie is intussen gewijzigd of verwijderd. Open ze opnieuw.');
    }
  }

  private async recordChange<T extends RecordMetadata>(
    table: Table<T, string>, kind: 'entry' | 'sleep', record: T, cells: Cell[], previous?: Cell[],
  ) {
    const changes: NonNullable<SyncOperation['changes']> = [];
    cells.forEach((value, index) => {
      if (value !== previous?.[index]) changes.push([index, value]);
    });
    if (!changes.length) return;
    const { id, revision, createdAt, modifiedAt } = record;
    await table.put(record);
    await this.outbox.add({ id, revision, createdAt, modifiedAt, kind, changes });
  }
}
