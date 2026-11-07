import type { BabyEntry, SleepSession } from '../types';
import { formatBelgianDate, normalizeDateToIso, normalizeRecord, normalizeTimeTo24h, parseNumberSafely } from '../utils/normalization';
import { localInputsToDate } from '../utils/sleep';

export const PROTOCOL = 'eli-tracker-v2.4';
export const SYNC_BATCH_SIZE = 20;

export type Mode = 'controller' | 'viewer';
export type Kind = 'entry' | 'sleep';
export type Cell = string | number | boolean;

export interface Connection {
  url: string;
  code: string;
}

export interface RecordMetadata {
  id: string;
  revision: number;
  createdAt: string;
  modifiedAt: string;
}

export type LocalEntry = BabyEntry & RecordMetadata;
export type LocalSleep = SleepSession & RecordMetadata;

export interface SyncOperation extends RecordMetadata {
  kind: Kind;
  changes: [column: number, value: Cell][] | null;
}

export interface WireRow extends RecordMetadata {
  row: number;
  cells: Cell[];
}

export interface Snapshot {
  datasetId: string;
  tag: string;
  entries: LocalEntry[];
  sleeps: LocalSleep[];
}

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SHEET_DATE = /^(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})$/;
const SHEET_TIME = /^\d{1,2}:\d{2}(?::[0-5]\d)?$/;

export function isInstant(value: unknown): boolean {
  if (typeof value !== 'string' || !ISO_INSTANT.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

export function isRecordId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9_-]{1,100}$/i.test(value);
}

export function validateConnection(url: string, code: string): Connection {
  const endpoint = url.trim();
  const accessCode = code.trim().toLowerCase();
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(endpoint)) {
    throw new Error('Plak de HTTPS-link van de Google Apps Script-web-app die eindigt op /exec.');
  }
  if (!/^[0-9a-f]{64}$/.test(accessCode)) {
    throw new Error('Een toegangscode bestaat uit 64 letters (a–f) en cijfers.');
  }
  return { url: endpoint, code: accessCode };
}

function sleepDate(value: Cell): Date | null {
  if (typeof value !== 'string') return null;
  const iso = value.trim();
  const zoned = iso.match(/^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})$/i);
  if (zoned && localInputsToDate(zoned[1], '12:00')) {
    const date = new Date(iso);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  // Existing rows normally contain native Sheets dates. Support the v2.3 text formats too.
  const parts = iso.match(/^(.+?)[ T]+(\d{1,2}:\d{2}(?::[0-5]\d)?)$/);
  if (!parts || !SHEET_DATE.test(parts[1])) return null;
  const [hour, minute, second = '00'] = parts[2].split(':');
  return localInputsToDate(normalizeDateToIso(parts[1]), `${hour.padStart(2, '0')}:${minute}:${second}`);
}

function readRows<T>(
  rows: unknown,
  count: unknown,
  label: string,
  width: number,
  convert: (cells: Cell[], metadata: RecordMetadata) => T,
): T[] {
  if (!Array.isArray(rows) || rows.length !== count) {
    throw new Error(`Onvolledige download voor ${label}.`);
  }
  const ids = new Set<string>();
  return rows.map((row: WireRow, index) => {
    try {
      if (!row || !isRecordId(row.id) || ids.has(row.id) ||
        !Number.isSafeInteger(row.revision) || row.revision < 0 ||
        !isInstant(row.createdAt) || !isInstant(row.modifiedAt) ||
        !Array.isArray(row.cells) || row.cells.length !== width ||
        !row.cells.every((cell) => typeof cell === 'string' || typeof cell === 'boolean' || Number.isFinite(cell))) {
        throw new Error('ontbrekende of dubbele identificatie, versie of cellen');
      }
      const { id, revision, createdAt, modifiedAt } = row;
      ids.add(id);
      return convert(row.cells, { id, revision, createdAt, modifiedAt });
    } catch (error) {
      throw new Error(`${label}, rij ${row?.row || index + 2}: ${(error as Error).message}.`);
    }
  });
}

export function parseSnapshot(payload: unknown): Snapshot {
  const data = payload as {
    datasetId: string; tag: string; entryCount: number; sleepCount: number; entries: unknown; sleeps: unknown;
  } | null;
  if (!data || !isRecordId(data.datasetId) || !/^[0-9a-f]{64}$/.test(data.tag)) {
    throw new Error('Google Sheets gaf geen geldige database terug.');
  }
  const entries = readRows(data.entries, data.entryCount, 'Formulierreacties 1', 12, (cells, meta) => {
    const rawStamp = String(cells[0]);
    const timestampParts = rawStamp.trim().match(/^(.+?)[ T]+(\d{1,2}:\d{2}(?::\d{2})?)(?:\.\d{3}Z)?$/);
    const dateRaw = String(cells[1] || timestampParts?.[1] || '').trim();
    const timeRaw = String(cells[2] || timestampParts?.[2] || '').trim();
    const date = normalizeDateToIso(dateRaw);
    const time = normalizeTimeTo24h(timeRaw);
    const seconds = timeRaw.split(':')[2];
    const dateTime = localInputsToDate(date, seconds ? time + ':' + seconds : time);
    if (!SHEET_DATE.test(dateRaw) || !SHEET_TIME.test(timeRaw) || !dateTime) {
      throw new Error('datum of tijd is ongeldig');
    }
    const entry = normalizeRecord([rawStamp, date, time, ...cells.slice(3)]);
    for (const [index, value] of [
      [3, entry.milkMl], [5, entry.weightGrams], [9, entry.solidFoodGrams], [11, entry.temperatureCelsius],
    ] as const) {
      if (String(cells[index]).trim() && (!Number.isFinite(parseNumberSafely(cells[index])) || value === null)) {
        throw new Error(`ongeldige meting in kolom ${String.fromCharCode(65 + index)}`);
      }
    }
    if (String(cells[4]).trim() && !entry.diaper) throw new Error('onbekend pampertype');
    return { ...entry, ...meta, dateTime, remarks: String(cells[7]) };
  });
  const sleeps = readRows(data.sleeps, data.sleepCount, 'Slaap', 4, (cells, meta) => {
    const start = sleepDate(cells[1]);
    const end = cells[2] === '' ? null : sleepDate(cells[2]);
    if (!start || (cells[2] !== '' && (!end || end <= start))) {
      throw new Error('starttijd of eindtijd is ongeldig');
    }
    return { ...meta, start, end, remarks: String(cells[3]) };
  });
  return { datasetId: data.datasetId, tag: data.tag, entries, sleeps };
}

export function entryCells(entry: BabyEntry): Cell[] {
  return [
    entry.timestamp, formatBelgianDate(entry.date), entry.time, entry.milkMl ?? '',
    entry.diaper ?? '', entry.weightGrams ?? '', entry.vomited ? 'Ja' : 'Nee',
    entry.remarks, entry.feedingType ?? '', entry.solidFoodGrams ?? '',
    entry.solidFoodSubtype ?? '', entry.temperatureCelsius ?? '',
  ];
}

export function sleepCells(session: SleepSession): Cell[] {
  return [session.id, session.start.toISOString(), session.end?.toISOString() ?? '', session.remarks];
}
