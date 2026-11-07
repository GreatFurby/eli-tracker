import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { PROTOCOL } from '../../src/services/protocol';

type Cell = string | number | boolean | Date;
type SheetData = { rows: Cell[][]; rowCapacity: number; columnCapacity: number };
type TypedCell = { userEnteredValue?: { numberValue?: number; boolValue?: boolean; stringValue?: string } };
type Update = {
  appendDimension?: { sheetId: number; dimension: string; length: number };
  updateCells?: {
    start: { sheetId: number; rowIndex: number; columnIndex: number };
    rows: { values: TypedCell[] }[];
    fields: string;
  };
};

export const sheetNames = ['Formulierreacties 1', 'Slaap'];
export const sheetId = 'eli_fixture';
export const endpoint = 'https://script.google.com/macros/s/eli-fixture/exec';
export const writerCode = 'a'.repeat(64);
export const viewerCode = 'b'.repeat(64);

function getBackendSource() {
  const file = process.env.ELI_BACKEND_PATH || [
    'EliTracker_Backend_v2.4.gs',
    '../EliTracker_Backend_v2.4.gs',
  ].find(existsSync);
  if (!file) throw new Error('Set ELI_BACKEND_PATH to the separate EliTracker_Backend_v2.4.gs file.');
  return readFileSync(file, 'utf8');
}

function formatDate(date: Date, timeZone: string, pattern: string) {
  const fields = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const component = (type: Intl.DateTimeFormatPartTypes) => fields.find((part) => part.type === type)?.value;
  return pattern.replace(/yyyy|MM|dd|HH|mm|ss/g, (token) => component({
    yyyy: 'year', MM: 'month', dd: 'day', HH: 'hour', mm: 'minute', ss: 'second',
  }[token] as Intl.DateTimeFormatPartTypes)!);
}

export function mockBackend() {
  let data: SheetData[] = [
    {
      rowCapacity: 5, columnCapacity: 12,
      rows: [
        ['Tijdstempel', 'Datum', 'Tijd', 'Hoeveelheid (ml)', 'Pampercontrole', 'Gewicht (in gram)', 'Overgegeven?',
          'Opmerkingen?', 'Voedingstype', 'Hoeveelheid vaste voeding (g)', 'Voedingssubtype', 'Temperatuur (°C)'],
        [new Date('2026-10-10T17:30:47.000Z'), new Date('2026-10-10T00:00:00+02:00'),
          '19:30:47', 140, 'Pipi + kaka pamper', 5930, 'Ja', 'Controle', 'Melk', '', '', '36,5'],
        [],
        ['11-10-2026 08:12:24', '11/10/2026', '08:12', '', '', '', '', 'Peer', 'Vaste voeding', '72,5', 'Fruitpap', ''],
      ],
    },
    {
      rowCapacity: 3, columnCapacity: 4,
      rows: [
        ['ID', 'Starttijd', 'Eindtijd', 'Opmerkingen'],
        ['overnight', new Date('2026-10-10T21:30:00.000Z'), new Date('2026-10-10T23:30:00.000Z'), 'Dutje'],
      ],
    },
  ];
  const properties = new Map([
    ['ELI_SPREADSHEET_ID', sheetId], ['ELI_CONTROLLER_CODE', writerCode], ['ELI_VIEWER_CODE', viewerCode],
  ]);
  let writes = 0;
  let rejectNextBatch = false;
  let locked = false;

  const sheets = sheetNames.map((name, index) => ({
    getName: () => name,
    getSheetId: () => index + 1,
    getLastRow: () => {
      let row = data[index].rows.length;
      while (row && !data[index].rows[row - 1]?.some((value) => value !== '' && value !== undefined)) row--;
      return row;
    },
    getMaxRows: () => data[index].rowCapacity,
    getMaxColumns: () => data[index].columnCapacity,
    getRange(row: number, column: number, rowCount: number, columnCount: number) {
      assert.ok(row + rowCount - 1 <= data[index].rowCapacity);
      assert.ok(column + columnCount - 1 <= data[index].columnCapacity);
      return {
        getValues: () => Array.from({ length: rowCount }, (_, r) => Array.from({ length: columnCount },
          (_, c) => data[index].rows[row - 1 + r]?.[column - 1 + c] ?? '')),
        getFormulas: () => Array.from({ length: rowCount }, () => Array<string>(columnCount).fill('')),
      };
    },
  }));
  const book = {
    getId: () => sheetId,
    getSheetByName: (name: string) => sheets.find((sheet) => sheet.getName() === name),
    getSpreadsheetTimeZone: () => 'Europe/Brussels',
  };
  const sandbox = {
    Date,
    console: { log: () => {} },
    Utilities: {
      getUuid: randomUUID, formatDate,
      computeDigest: (_algo: string, value: string) => [...createHash('sha256').update(value, 'utf8').digest()],
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
    },
    ContentService: {
      createTextOutput: (text: string) => ({ setMimeType: () => ({ getContent: () => text }) }),
      MimeType: { JSON: 'json' },
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => properties.get(key) ?? null,
        setProperty: (key: string, value: string) => properties.set(key, value),
        deleteProperty: (key: string) => properties.delete(key),
      }),
    },
    SpreadsheetApp: { openById: (id: string) => { assert.equal(id, sheetId); return book; } },
    LockService: { getScriptLock: () => ({
      tryLock: () => { assert.equal(locked, false); locked = true; return true; },
      releaseLock: () => { assert.equal(locked, true); locked = false; },
    }) },
    Sheets: { Spreadsheets: {
      batchUpdate({ requests }: { requests: Update[] }, id: string) {
        assert.equal(locked, true);
        assert.equal(id, sheetId);
        const draft = structuredClone(data);
        for (const request of requests) {
          if (request.appendDimension) {
            const append = request.appendDimension;
            const key = append.dimension === 'ROWS' ? 'rowCapacity' : 'columnCapacity';
            draft[append.sheetId - 1][key] += append.length;
          }
          if (request.updateCells) {
            const { start, rows, fields } = request.updateCells;
            const sheet = draft[start.sheetId - 1];
            assert.equal(fields, 'userEnteredValue');
            rows.forEach(({ values }, index) => {
              const row = start.rowIndex + index;
              assert.ok(row < sheet.rowCapacity);
              assert.ok(start.columnIndex + values.length <= sheet.columnCapacity);
              if (!values.length) return;
              sheet.rows[row] ||= [];
              values.forEach(({ userEnteredValue: value }, column) => {
                sheet.rows[row][start.columnIndex + column] = value?.numberValue ?? value?.boolValue ?? value?.stringValue ?? '';
              });
            });
          }
        }
        if (rejectNextBatch) {
          rejectNextBatch = false;
          throw new Error('Simulated Sheets batch failure before commit');
        }
        data = draft;
        writes++;
      },
    } },
  };
  const context = createContext(sandbox);
  runInContext(getBackendSource(), context, { filename: 'EliTracker_Backend_v2.4.gs' });
  return {
    properties,
    rows: (index: number) => data[index].rows,
    writeCount: () => writes,
    rejectNextBatch: () => { rejectNextBatch = true; },
    migrate: () => JSON.parse(JSON.stringify(context.migrateEliV24())),
    release: () => context.releaseEliV24Controller(),
    get: () => JSON.parse(context.doGet().getContent()),
    request: (body: Record<string, unknown>) => JSON.parse(context.doPost({
      postData: { contents: JSON.stringify({ protocol: PROTOCOL, ...body }) },
    }).getContent()),
  };
}
