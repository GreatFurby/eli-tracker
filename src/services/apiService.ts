import { BabyEntry, NewEntryPayload } from '../types';
import { getActiveApiUrl } from '../config/apiConfig';
import { generateDemoData } from '../data/demoData';
import { formatBelgianDate, normalizeRecord } from '../utils/normalization';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  isDemo?: boolean;
}

// In-memory cache for demo entries so users can create and see entries live in demo mode
let localDemoEntries: BabyEntry[] | null = null;

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

  const formattedBelgianDate = formatBelgianDate(payload.date);
  const formattedTime = payload.time;

  let ml: number | null = null;
  let voedingstype: string = '';
  let vasteGram: number | null = null;
  let voedingssubtype: string = '';
  let pamper: string = '';
  let gewicht: number | null = null;
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
