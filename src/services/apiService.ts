import { BabyEntry, NewEntryPayload, SleepSession } from '../types';
import { getActiveApiUrl } from '../config/apiConfig';
import { generateDemoData } from '../data/demoData';
import { formatBelgianDate, normalizeRecord } from '../utils/normalization';
import { normalizeSleepRecord } from '../utils/sleep';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  isDemo?: boolean;
}

// In-memory cache for demo entries so users can create and see entries live in demo mode
let localDemoEntries: BabyEntry[] | null = null;

export interface SleepSaveResult {
  id?: string;
}

/**
 * Fetches all entries from Google Apps Script Web App endpoint or falls back to demo data
 */
export async function fetchAllEntries(): Promise<ApiResponse<BabyEntry[]>> {
  const apiUrl = getActiveApiUrl();

  // If no endpoint configured, return demo data
  if (!apiUrl) {
    if (!localDemoEntries) {
      localDemoEntries = generateDemoData();
    }
    return {
      success: true,
      data: [...localDemoEntries],
      isDemo: true,
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP fout: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    
    let rawRecords: any[] = [];
    if (json && Array.isArray(json.data)) {
      rawRecords = json.data;
    } else if (Array.isArray(json)) {
      rawRecords = json;
    } else if (json && json.status === 'error') {
      throw new Error(json.message || 'Google Apps Script rapporteerde een fout');
    }

    const normalizedEntries = rawRecords.map((r, i) => normalizeRecord(r, i));

    return {
      success: true,
      data: normalizedEntries,
      isDemo: false,
    };
  } catch (err: any) {
    console.error('Fout bij ophalen van Google Sheet data:', err);
    return {
      success: false,
      error: 'Kon de gegevens niet laden. Controleer je internetverbinding en de Google Apps Script URL, en probeer opnieuw.',
      isDemo: false,
    };
  }
}

/**
 * Creates and appends a new record to Google Sheets via Google Apps Script Web App endpoint
 */
export async function createNewEntry(payload: NewEntryPayload): Promise<ApiResponse<BabyEntry>> {
  const apiUrl = getActiveApiUrl();

  // Construct payload with exact Google Sheet column structure:
  // 1. Tijdstempel
  // 2. Datum
  // 3. Tijd
  // 4. Hoeveelheid (ml)
  // 5. Pampercontrole
  // 6. Gewicht (in gram)
  // 7. Overgegeven?
  // 8. Opmerkingen?
  // 9. Voedingstype
  // 10. Hoeveelheid vaste voeding (g)
  // 11. Voedingssubtype
  // 12. Temperatuur (°C)

  const formattedBelgianDate = formatBelgianDate(payload.date);
  const formattedTime = payload.time;

  let ml: number | null = null;
  let voedingstype: string = '';
  let vasteGram: number | null = null;
  let voedingssubtype: string = '';
  let pamper: string = '';
  let gewicht: number | null = null;
  let temperatuur: number | null = null;
  let overgegeven: string = '';

  if (payload.category === 'melk') {
    ml = payload.milkMl || 0;
    voedingstype = 'Melk';
    overgegeven = payload.vomited ? 'Ja' : 'Nee';
  } else if (payload.category === 'vaste_voeding') {
    vasteGram = payload.solidFoodGrams || 0;
    voedingstype = 'Vaste voeding';
    voedingssubtype = payload.solidFoodSubtype || '';
    overgegeven = payload.vomited ? 'Ja' : 'Nee';
  } else if (payload.category === 'pamper') {
    pamper = payload.diaper || '';
  } else if (payload.category === 'gewicht') {
    gewicht = payload.weightGrams || 0;
  } else if (payload.category === 'temperatuur') {
    temperatuur = payload.temperatureCelsius ?? null;
  }

  const postBody = {
    datum: formattedBelgianDate,
    tijd: formattedTime,
    ml,
    pamper,
    gewicht,
    overgegeven,
    opmerkingen: payload.remarks || '',
    voedingstype,
    vasteGram,
    voedingssubtype,
    temperatuur,
  };

  // If in demo mode, simulate adding to in-memory demo data
  if (!apiUrl) {
    if (!localDemoEntries) {
      localDemoEntries = generateDemoData();
    }
    const newEntry = normalizeRecord({
      tijdstempel: `${payload.date} ${payload.time}:00`,
      datum: payload.date,
      tijd: payload.time,
      ml,
      pamper,
      gewicht,
      overgegeven,
      opmerkingen: payload.remarks || '',
      voedingstype,
      vasteGram,
      voedingssubtype,
      temperatuur,
    }, localDemoEntries.length);

    localDemoEntries = [newEntry, ...localDemoEntries];

    return {
      success: true,
      data: newEntry,
      isDemo: true,
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', // Plain text to bypass CORS preflight in Google Apps Script
      },
      body: JSON.stringify(postBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Google Apps Script responses
    let resultJson: any = null;
    try {
      resultJson = await response.json();
    } catch {
      // If response text cannot be parsed as json, check if status is 200/ok
      if (!response.ok) {
        throw new Error('Geen geldige reactie van server');
      }
    }

    if (resultJson && resultJson.status === 'error') {
      throw new Error(resultJson.message || 'Google Apps Script kon de rij niet toevoegen');
    }

    const createdEntry = normalizeRecord({
      tijdstempel: new Date().toISOString(),
      datum: payload.date,
      tijd: payload.time,
      ml,
      pamper,
      gewicht,
      overgegeven,
      opmerkingen: payload.remarks || '',
      voedingstype,
      vasteGram,
      voedingssubtype,
      temperatuur,
    });

    return {
      success: true,
      data: createdEntry,
      isDemo: false,
    };
  } catch (err: any) {
    console.error('Fout bij opslaan in Google Sheet:', err);
    return {
      success: false,
      error: 'De ingave kon niet worden opgeslagen. Probeer opnieuw.',
      isDemo: false,
    };
  }
}

function apiUrlForAction(action: string): string {
  const apiUrl = getActiveApiUrl();
  if (!apiUrl) return '';
  const separator = apiUrl.includes('?') ? '&' : '?';
  return `${apiUrl}${separator}action=${encodeURIComponent(action)}`;
}

function extractSleepRows(payload: unknown): unknown[] {
  const data = payload as { data?: unknown; records?: unknown; sleep?: unknown } | unknown[];
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.records)
        ? data.records
        : Array.isArray(data?.sleep)
          ? data.sleep
          : [];

  // Apps Script getSleep returns an array with its header as the first row.
  if (Array.isArray(rows[0]) && String(rows[0][0] || '').trim().toLowerCase() === 'id') {
    return rows.slice(1);
  }
  return rows;
}

/** Fetches rows from the dedicated Slaap sheet without changing the original feed API. */
export async function fetchAllSleepSessions(): Promise<ApiResponse<SleepSession[]>> {
  const url = apiUrlForAction('getSleep');
  if (!url) {
    return { success: true, data: [], isDemo: true };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP fout: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    if (json && typeof json === 'object' && (json as { success?: boolean }).success === false) {
      throw new Error((json as { error?: string }).error || 'De slaapgegevens konden niet worden opgehaald');
    }
    if (json && typeof json === 'object' && (json as { status?: string }).status === 'error') {
      throw new Error((json as { message?: string }).message || 'De slaapgegevens konden niet worden opgehaald');
    }

    const sessions = extractSleepRows(json)
      .map((row, index) => normalizeSleepRecord(row, index))
      .filter((session): session is SleepSession => Boolean(session))
      .sort((a, b) => b.start.getTime() - a.start.getTime());

    return { success: true, data: sessions, isDemo: false };
  } catch (err) {
    console.error('Fout bij ophalen van slaapgegevens:', err);
    return {
      success: false,
      error: 'Kon de slaapgegevens niet laden. Probeer opnieuw wanneer je verbinding hersteld is.',
      isDemo: false,
    };
  }
}

async function saveSleepAction(payload: Record<string, unknown>): Promise<ApiResponse<SleepSaveResult>> {
  const apiUrl = getActiveApiUrl();
  if (!apiUrl) {
    return { success: false, error: 'Slaap registreren is niet beschikbaar in demo modus.', isDemo: true };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const responseText = await response.text();
    let result: { success?: boolean; status?: string; error?: string; message?: string; id?: string } | null = null;
    try {
      result = responseText ? JSON.parse(responseText) : null;
    } catch {
      // A successful action must return JSON. Treat a non-JSON body as uncertain,
      // rather than pretending a Google Apps Script HTTP 200 saved it.
      throw new Error('Geen geldige bevestiging van de slaapserver ontvangen');
    }

    if (!response.ok) {
      throw new Error(result?.error || result?.message || `HTTP fout: ${response.status}`);
    }
    // Apps Script can return HTTP 200 with success:false, so inspect the body as well.
    if (!result || result.success === false || result.status === 'error') {
      throw new Error(result?.error || result?.message || 'De slaapactie werd niet bevestigd door de server');
    }

    return { success: true, data: { id: result.id }, isDemo: false };
  } catch (err: any) {
    console.error('Fout bij opslaan van slaapgegevens:', err);
    return {
      success: false,
      error: err?.message || 'De slaapperiode kon niet worden opgeslagen. Probeer opnieuw.',
      isDemo: false,
    };
  }
}

export function startSleep(start: Date, remarks = ''): Promise<ApiResponse<SleepSaveResult>> {
  return saveSleepAction({
    action: 'startSleep',
    starttijd: start.toISOString(),
    opmerkingen: remarks,
  });
}

export function stopSleep(id: string, end: Date, remarks = ''): Promise<ApiResponse<SleepSaveResult>> {
  return saveSleepAction({
    action: 'stopSleep',
    id,
    eindtijd: end.toISOString(),
    opmerkingen: remarks,
  });
}

export function addSleep(start: Date, end: Date, remarks = ''): Promise<ApiResponse<SleepSaveResult>> {
  return saveSleepAction({
    action: 'addSleep',
    starttijd: start.toISOString(),
    eindtijd: end.toISOString(),
    opmerkingen: remarks,
  });
}
