const SPREADSHEET_ID = '1s-mnu1hrMW-XompWT0JnJe-Aqcob74Du_-XGgDSG018';

const SHEET_NAME = 'Formulierreacties 1';
const SLEEP_SHEET_NAME = 'Slaap';

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(name) {
  const sheet = SpreadsheetApp
    .openById(SPREADSHEET_ID)
    .getSheetByName(name);

  if (!sheet) {
    throw new Error('Worksheet not found: ' + name);
  }

  return sheet;
}

// --------------------------------------------------
// SLEEP DISPLAY HELPERS
// --------------------------------------------------

// Use the underlying Date values, not a cell's display format. This prevents
// an end time such as 15:35 from being accidentally returned as date-only.
function formatSleepTimestamp(value) {
  if (!value) return '';

  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(
      value,
      'Europe/Brussels',
      'dd-MM-yyyy HH:mm:ss'
    );
  }

  return String(value);
}

function getSleepRows() {
  const sheet = getSheet(SLEEP_SHEET_NAME);
  const rows = sheet.getDataRange().getValues();

  return rows.map(function (row, index) {
    if (index === 0) {
      return row;
    }

    return [
      String(row[0] || ''),
      formatSleepTimestamp(row[1]),
      formatSleepTimestamp(row[2]),
      String(row[3] || '')
    ];
  });
}

// --------------------------------------------------
// GET REQUESTS
// --------------------------------------------------

function doGet(e) {
  const action = e && e.parameter
    ? e.parameter.action
    : '';

  if (action === 'getSleep') {
    return jsonResponse(getSleepRows());
  }

  // Feeding, diapers, weight and temperature.
  return jsonResponse(
    getSheet(SHEET_NAME).getDataRange().getDisplayValues()
  );
}

// --------------------------------------------------
// POST REQUESTS
// --------------------------------------------------

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || '';

    if (action === 'startSleep') return startSleep(data);
    if (action === 'stopSleep') return stopSleep(data);
    if (action === 'addSleep') return addSleep(data);

    return addOriginalEntry(data);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message
    });
  }
}

// --------------------------------------------------
// FEEDING, DIAPERS, WEIGHT AND TEMPERATURE
// --------------------------------------------------

function parseTemperature(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const parsed = typeof value === 'number'
    ? value
    : Number(String(value).replace(',', '.'));

  if (!isFinite(parsed) || parsed < 30 || parsed > 45) {
    throw new Error('Temperature must be between 30.0 and 45.0 °C.');
  }

  return Math.round(parsed * 10) / 10;
}

function addOriginalEntry(data) {
  const sheet = getSheet(SHEET_NAME);
  const temperature = parseTemperature(data.temperatuur);

  // Column order, including the new twelfth Temperature column:
  // 1 Tijdstempel, 2 Datum, 3 Tijd, 4 Hoeveelheid (ml),
  // 5 Pampercontrole, 6 Gewicht (in gram), 7 Overgegeven?,
  // 8 Opmerkingen?, 9 Voedingstype, 10 Hoeveelheid vaste voeding (g),
  // 11 Voedingssubtype, 12 Temperatuur (°C)
  sheet.appendRow([
    new Date(),
    data.datum || '',
    data.tijd || '',
    data.ml !== undefined && data.ml !== null ? data.ml : '',
    data.pamper || '',
    data.gewicht !== undefined && data.gewicht !== null ? data.gewicht : '',
    data.overgegeven || '',
    data.opmerkingen || '',
    data.voedingstype || '',
    data.vasteGram !== undefined && data.vasteGram !== null ? data.vasteGram : '',
    data.voedingssubtype || '',
    temperature
  ]);

  return jsonResponse({ success: true });
}

// --------------------------------------------------
// SLEEP HELPERS
// --------------------------------------------------

function parseSleepTime(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  ) {
    throw new Error('Invalid timestamp. Use ISO 8601 with timezone.');
  }

  const date = new Date(value);
  if (isNaN(date.getTime())) throw new Error('Invalid date or time.');
  if (date.getTime() > Date.now() + 60000) {
    throw new Error('Sleep time cannot be in the future.');
  }
  return date;
}

function findSleepRow(sheet, id) {
  if (!id) throw new Error('Sleep ID is required.');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

function withSleepLock(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

// --------------------------------------------------
// START SLEEP
// --------------------------------------------------

function startSleep(data) {
  return withSleepLock(function () {
    const sheet = getSheet(SLEEP_SHEET_NAME);
    const start = parseSleepTime(data.starttijd);
    const lastRow = sheet.getLastRow();

    if (lastRow >= 2) {
      const rows = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
      const active = rows.some(function (row) {
        return row[0] && row[1] && !row[2];
      });

      if (active) {
        return jsonResponse({
          success: false,
          error: 'There is already an active sleep session.'
        });
      }
    }

    const id = Utilities.getUuid();
    sheet.appendRow([id, start, '', data.opmerkingen || '']);
    return jsonResponse({ success: true, id: id });
  });
}

// --------------------------------------------------
// STOP SLEEP
// --------------------------------------------------

function stopSleep(data) {
  return withSleepLock(function () {
    const sheet = getSheet(SLEEP_SHEET_NAME);
    const row = findSleepRow(sheet, data.id);

    if (row === -1) {
      return jsonResponse({ success: false, error: 'Sleep session not found.' });
    }

    const start = sheet.getRange(row, 2).getValue();
    const existingEnd = sheet.getRange(row, 3).getValue();
    if (existingEnd) {
      return jsonResponse({ success: false, error: 'Sleep session has already ended.' });
    }

    const end = parseSleepTime(data.eindtijd);
    if (end.getTime() <= new Date(start).getTime()) {
      return jsonResponse({ success: false, error: 'End time must be after start time.' });
    }

    sheet.getRange(row, 3).setValue(end);
    return jsonResponse({ success: true, id: data.id });
  });
}

// --------------------------------------------------
// ADD COMPLETED SLEEP SESSION RETROACTIVELY
// --------------------------------------------------

function addSleep(data) {
  return withSleepLock(function () {
    const sheet = getSheet(SLEEP_SHEET_NAME);
    const start = parseSleepTime(data.starttijd);
    const end = parseSleepTime(data.eindtijd);

    if (end.getTime() <= start.getTime()) {
      return jsonResponse({ success: false, error: 'End time must be after start time.' });
    }

    const id = Utilities.getUuid();
    sheet.appendRow([id, start, end, data.opmerkingen || '']);
    return jsonResponse({ success: true, id: id });
  });
}
