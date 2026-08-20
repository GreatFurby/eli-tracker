import { BabyEntry, DiaperType, FeedingType, SolidFoodSubtype, TodayStats } from '../types';

/**
 * Normalizes any date value (string, Date object, ISO, Belgian DD/MM/YYYY, etc.) into YYYY-MM-DD
 */
export function normalizeDateToIso(rawDate: unknown): string {
  if (!rawDate) {
    const today = new Date();
    return formatIsoDate(today);
  }

  if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
    return formatIsoDate(rawDate);
  }

  const str = String(rawDate).trim();
  if (!str) {
    return formatIsoDate(new Date());
  }

  // Check if DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, '0');
    const month = ddmmyyyy[2].padStart(2, '0');
    const year = ddmmyyyy[3];
    return `${year}-${month}-${day}`;
  }

  // Check if YYYY-MM-DD
  const yyyymmdd = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (yyyymmdd) {
    const year = yyyymmdd[1];
    const month = yyyymmdd[2].padStart(2, '0');
    const day = yyyymmdd[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Try standard parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return formatIsoDate(parsed);
  }

  return formatIsoDate(new Date());
}

/**
 * Normalizes time value into HH:mm (24-hour format)
 */
export function normalizeTimeTo24h(rawTime: unknown): string {
  if (!rawTime) {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  if (rawTime instanceof Date && !isNaN(rawTime.getTime())) {
    return `${String(rawTime.getHours()).padStart(2, '0')}:${String(rawTime.getMinutes()).padStart(2, '0')}`;
  }

  const str = String(rawTime).trim();
  
  // Match HH:mm or HH:mm:ss
  const match = str.match(/^(\d{1,2}):(\d{1,2})/);
  if (match) {
    const hours = match[1].padStart(2, '0');
    const minutes = match[2].padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  return '00:00';
}

function formatIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Parses numeric values safely (supporting commas and points)
 */
export function parseNumberSafely(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    return isNaN(val) ? null : val;
  }
  const cleanStr = String(val).trim().replace(',', '.');
  const num = parseFloat(cleanStr);
  return isNaN(num) ? null : num;
}

/**
 * Formats a date string or Date into Belgian format: DD/MM/YYYY
 */
export function formatBelgianDate(dateInput: string | Date): string {
  let dateObj: Date;
  if (typeof dateInput === 'string') {
    const iso = normalizeDateToIso(dateInput);
    const [y, m, d] = iso.split('-').map(Number);
    dateObj = new Date(y, m - 1, d);
  } else {
    dateObj = dateInput;
  }
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Formats a date nicely in Dutch (e.g. "Vandaag", "Gisteren", "Vrijdag 20 aug")
 */
export function formatDutchDateLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const targetDate = new Date(y, m - 1, d);
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  
  const targetMidnight = new Date(y, m - 1, d);
  
  if (targetMidnight.getTime() === today.getTime()) {
    return 'Vandaag';
  }
  if (targetMidnight.getTime() === yesterday.getTime()) {
    return 'Gisteren';
  }

  const days = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
  const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  
  const dayName = days[targetDate.getDay()];
  const monthName = months[targetDate.getMonth()];
  return `${dayName} ${targetDate.getDate()} ${monthName}`;
}

/**
 * Calculates dynamic time ago in Dutch (e.g. "2u 34m geleden", "15m geleden", "Nu net")
 */
export function formatTimeAgo(dateTime: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - dateTime.getTime();

  if (diffMs < 0) {
    return 'Zojuist';
  }

  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 2) {
    return 'Nu net';
  }
  if (diffMins < 60) {
    return `${diffMins}m geleden`;
  }
  if (diffHours < 24) {
    const remainingMins = diffMins % 60;
    if (remainingMins === 0) {
      return `${diffHours}u geleden`;
    }
    return `${diffHours}u ${remainingMins}m geleden`;
  }
  if (diffDays === 1) {
    return 'Gisteren';
  }
  return `${diffDays}d geleden`;
}

/**
 * Normalizes raw sheet row or API record into a standardized BabyEntry object
 */
export function normalizeRecord(raw: any, index: number = 0): BabyEntry {
  // Can be an array (raw sheet row) or an object (JSON API response)
  const isArray = Array.isArray(raw);
  
  const timestampRaw = isArray ? raw[0] : (raw.tijdstempel ?? raw.timestamp ?? '');
  const dateRaw = isArray ? raw[1] : (raw.datum ?? raw.date ?? '');
  const timeRaw = isArray ? raw[2] : (raw.tijd ?? raw.time ?? '');
  const milkMlRaw = isArray ? raw[3] : (raw.ml ?? raw.hoeveelheidMl ?? raw.milkMl ?? raw['Hoeveelheid (ml)']);
  const diaperRaw = isArray ? raw[4] : (raw.pamper ?? raw.pampercontrole ?? raw.diaper ?? raw['Pampercontrole']);
  const weightGramsRaw = isArray ? raw[5] : (raw.gewicht ?? raw.gewichtGram ?? raw.weightGrams ?? raw['Gewicht (in gram)']);
  const vomitedRaw = isArray ? raw[6] : (raw.overgegeven ?? raw.vomited ?? raw['Overgegeven?']);
  const remarksRaw = isArray ? raw[7] : (raw.opmerkingen ?? raw.remarks ?? raw['Opmerkingen?']);
  const feedingTypeRaw = isArray ? raw[8] : (raw.voedingstype ?? raw.feedingType ?? raw['Voedingstype']);
  const solidGramsRaw = isArray ? raw[9] : (raw.vasteGram ?? raw.hoeveelheidVasteVoedingG ?? raw.solidFoodGrams ?? raw['Hoeveelheid vaste voeding (g)']);
  const solidSubtypeRaw = isArray ? raw[10] : (raw.voedingssubtype ?? raw.solidFoodSubtype ?? raw['Voedingssubtype']);

  const isoDate = normalizeDateToIso(dateRaw || timestampRaw);
  const time24h = normalizeTimeTo24h(timeRaw || timestampRaw);

  const [y, m, d] = isoDate.split('-').map(Number);
  const [hh, mm] = time24h.split(':').map(Number);
  const dateTime = new Date(y, m - 1, d, hh, mm);

  const milkMl = parseNumberSafely(milkMlRaw);
  const weightGrams = parseNumberSafely(weightGramsRaw);
  const solidFoodGrams = parseNumberSafely(solidGramsRaw);

  // Determine feeding type with historical fallback rule:
  // If milk amount is present and feedingType is blank, interpret as 'Melk'
  let feedingType: FeedingType | null = null;
  const cleanFeedingTypeStr = String(feedingTypeRaw || '').trim();
  if (cleanFeedingTypeStr === 'Melk' || cleanFeedingTypeStr === 'Vaste voeding') {
    feedingType = cleanFeedingTypeStr;
  } else if (milkMl !== null && milkMl > 0) {
    feedingType = 'Melk';
  } else if (solidFoodGrams !== null && solidFoodGrams > 0) {
    feedingType = 'Vaste voeding';
  }

  // Normalize Diaper
  let diaper: DiaperType | null = null;
  const cleanDiaperStr = String(diaperRaw || '').trim();
  if (
    cleanDiaperStr === 'Pipi pamper' ||
    cleanDiaperStr === 'Kaka pamper' ||
    cleanDiaperStr === 'Pipi + kaka pamper' ||
    cleanDiaperStr === 'Propere pamper'
  ) {
    diaper = cleanDiaperStr;
  }

  // Normalize vomited
  const cleanVomitedStr = String(vomitedRaw || '').trim().toLowerCase();
  const vomited = cleanVomitedStr === 'ja' || cleanVomitedStr === 'true' || cleanVomitedStr === '1';

  // Normalize solid food subtype
  let solidFoodSubtype: SolidFoodSubtype | null = null;
  if (solidSubtypeRaw && String(solidSubtypeRaw).trim()) {
    solidFoodSubtype = String(solidSubtypeRaw).trim();
  }

  const remarks = String(remarksRaw || '').trim();

  return {
    id: `entry-${index}-${isoDate}-${time24h}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: String(timestampRaw || ''),
    date: isoDate,
    time: time24h,
    dateTime,
    milkMl,
    diaper,
    weightGrams,
    vomited,
    remarks,
    feedingType,
    solidFoodGrams,
    solidFoodSubtype,
  };
}

/**
 * Computes all today stats, summary cards and timeline
 */
export function calculateTodayStats(entries: BabyEntry[]): TodayStats {
  const now = new Date();
  const todayIso = formatIsoDate(now);

  // Sort entries descending (newest first)
  const sortedDesc = [...entries].sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime());
  
  // Today's entries
  const todayEntries = entries
    .filter(e => e.date === todayIso)
    .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime()); // Chronological for today's timeline

  // 1. Laatste melkvoeding (any date or today, latest recorded milk)
  const allMilkEntries = sortedDesc.filter(e => (e.feedingType === 'Melk' || (e.milkMl && e.milkMl > 0)) && e.milkMl);
  const latestMilkEntry = allMilkEntries[0] || null;
  const lastMilk = latestMilkEntry && latestMilkEntry.milkMl
    ? {
        ml: latestMilkEntry.milkMl,
        time: latestMilkEntry.time,
        dateTime: latestMilkEntry.dateTime,
        timeAgo: formatTimeAgo(latestMilkEntry.dateTime),
      }
    : null;

  // 2. Melk vandaag
  const todayMilkEntries = todayEntries.filter(e => (e.feedingType === 'Melk' || (e.milkMl && e.milkMl > 0)) && e.milkMl);
  const totalMilkToday = todayMilkEntries.reduce((acc, curr) => acc + (curr.milkMl || 0), 0);
  const milkToday = {
    totalMl: totalMilkToday,
    count: todayMilkEntries.length,
  };

  // 3. Vaste voeding vandaag
  const todaySolidEntries = todayEntries.filter(e => (e.feedingType === 'Vaste voeding' || (e.solidFoodGrams && e.solidFoodGrams > 0)) && e.solidFoodGrams);
  const totalSolidGramsToday = todaySolidEntries.reduce((acc, curr) => acc + (curr.solidFoodGrams || 0), 0);
  const solidSubtypes = Array.from(
    new Set(todaySolidEntries.map(e => e.solidFoodSubtype).filter((s): s is string => Boolean(s)))
  );
  const solidFoodToday = {
    totalGrams: totalSolidGramsToday,
    count: todaySolidEntries.length,
    subtypes: solidSubtypes,
  };

  // 4. Laatste pamper
  const allDiaperEntries = sortedDesc.filter(e => Boolean(e.diaper));
  const latestDiaperEntry = allDiaperEntries[0] || null;
  const lastDiaper = latestDiaperEntry && latestDiaperEntry.diaper
    ? {
        type: latestDiaperEntry.diaper,
        time: latestDiaperEntry.time,
        dateTime: latestDiaperEntry.dateTime,
        timeAgo: formatTimeAgo(latestDiaperEntry.dateTime),
      }
    : null;

  // 5. Laatste gewicht
  const allWeightEntries = sortedDesc.filter(e => e.weightGrams && e.weightGrams > 0);
  const latestWeightEntry = allWeightEntries[0] || null;
  const previousWeightEntry = allWeightEntries[1] || null;
  
  let diffFromPreviousGrams: number | null = null;
  if (latestWeightEntry && previousWeightEntry && latestWeightEntry.weightGrams && previousWeightEntry.weightGrams) {
    diffFromPreviousGrams = latestWeightEntry.weightGrams - previousWeightEntry.weightGrams;
  }

  const lastWeight = latestWeightEntry && latestWeightEntry.weightGrams
    ? {
        grams: latestWeightEntry.weightGrams,
        date: formatBelgianDate(latestWeightEntry.date),
        dateTime: latestWeightEntry.dateTime,
        diffFromPreviousGrams,
      }
    : null;

  return {
    lastMilk,
    milkToday,
    solidFoodToday,
    lastDiaper,
    lastWeight,
    timelineToday: todayEntries,
  };
}

/**
 * Returns the UI label and icon for diaper types
 */
export function getDiaperUiInfo(type: DiaperType | string | null): { label: string; icon: string; badgeColor: string } {
  switch (type) {
    case 'Pipi pamper':
      return { label: 'Pipi', icon: '💧', badgeColor: 'bg-sky-50 text-sky-700 border-sky-200' };
    case 'Kaka pamper':
      return { label: 'Kaka', icon: '💩', badgeColor: 'bg-amber-50 text-amber-800 border-amber-200' };
    case 'Pipi + kaka pamper':
      return { label: 'Pipi + kaka', icon: '💧💩', badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    case 'Propere pamper':
      return { label: 'Propere pamper', icon: '✨', badgeColor: 'bg-slate-50 text-slate-600 border-slate-200' };
    default:
      return { label: 'Pamper', icon: '🩲', badgeColor: 'bg-slate-50 text-slate-700 border-slate-200' };
  }
}
