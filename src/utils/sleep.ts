import { BabyEntry, SleepSession } from '../types';

export interface SleepSegment {
  sessionId: string;
  date: string;
  start: Date;
  end: Date;
  minutes: number;
  remarks: string;
  isOngoing: boolean;
}

export interface DailySummary {
  date: string;
  milkMl: number;
  solidFoodGrams: number;
  diaperCount: number;
  diaperPipi: number;
  diaperKaka: number;
  diaperMixed: number;
  diaperClean: number;
  weightCount: number;
  sleepMinutes: number;
  hasOngoingSleep: boolean;
}

export interface WeeklySummary {
  weekStart: Date;
  weekEnd: Date;
  isoWeek: number;
  isoYear: number;
  days: DailySummary[];
  milkMl: number;
  solidFoodGrams: number;
  diaperCount: number;
  sleepMinutes: number;
  hasOngoingSleep: boolean;
}

const MINUTE_MS = 60 * 1000;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Formats a browser-local date as YYYY-MM-DD without UTC date shifting. */
export function formatIsoDateLocal(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatLocalTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder} min`;
  if (remainder === 0) return `${hours}u`;
  return `${hours}u ${remainder}m`;
}

/**
 * Creates a Date from an HTML date/time control in the phone's local timezone.
 * `toISOString()` on that date is an ISO 8601 timestamp with an explicit UTC
 * offset (Z), which is what the Apps Script endpoint expects.
 */
export function localInputsToDate(date: string, time: string): Date | null {
  const dateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = time.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]) - 1;
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const second = Number(timeMatch[3] || 0);
  const parsed = new Date(year, month, day, hour, minute, second, 0);

  // Reject rollover values such as 2026-02-31 instead of silently changing them.
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hour ||
    parsed.getMinutes() !== minute
  ) {
    return null;
  }
  return parsed;
}

/**
 * Parses the display values returned by Apps Script. The Slaap sheet uses
 * getDisplayValues(), so Belgian values such as `10/10/2026 13:45:00` must be
 * interpreted as local Belgian time, rather than passed directly to Date.parse.
 */
export function parseSleepTimestamp(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getTime());
  }
  if (value === null || value === undefined || String(value).trim() === '') return null;

  const raw = String(value).trim();
  const belgian = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (belgian) {
    const result = new Date(
      Number(belgian[3]),
      Number(belgian[2]) - 1,
      Number(belgian[1]),
      Number(belgian[4] || 0),
      Number(belgian[5] || 0),
      Number(belgian[6] || 0),
      0,
    );
    return Number.isNaN(result.getTime()) ? null : result;
  }

  // A timezone-bearing ISO string is unambiguous, including daylight-saving changes.
  if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)) {
    const result = new Date(raw);
    return Number.isNaN(result.getTime()) ? null : result;
  }

  const isoLocal = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (isoLocal) {
    const result = new Date(
      Number(isoLocal[1]),
      Number(isoLocal[2]) - 1,
      Number(isoLocal[3]),
      Number(isoLocal[4] || 0),
      Number(isoLocal[5] || 0),
      Number(isoLocal[6] || 0),
      0,
    );
    return Number.isNaN(result.getTime()) ? null : result;
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

/** Normalizes one row returned by the separate Slaap worksheet. */
export function normalizeSleepRecord(raw: unknown, index = 0): SleepSession | null {
  const row = raw as Record<string, unknown> | unknown[];
  const isArray = Array.isArray(row);
  const objectRow = isArray ? null : (row as Record<string, unknown>);
  const idRaw = isArray ? row[0] : objectRow?.id ?? objectRow?.ID;
  const startRaw = isArray
    ? row[1]
    : objectRow?.starttijd ?? objectRow?.Starttijd ?? objectRow?.start;
  const endRaw = isArray
    ? row[2]
    : objectRow?.eindtijd ?? objectRow?.Eindtijd ?? objectRow?.end;
  const remarksRaw = isArray
    ? row[3]
    : objectRow?.opmerkingen ?? objectRow?.Opmerkingen ?? objectRow?.remarks;

  const start = parseSleepTimestamp(startRaw);
  if (!start) return null;

  const parsedEnd = parseSleepTimestamp(endRaw);
  const end = parsedEnd && parsedEnd.getTime() > start.getTime() ? parsedEnd : null;
  const fallbackId = `sleep-${formatIsoDateLocal(start)}-${formatLocalTime(start)}-${index}`;

  return {
    id: String(idRaw || fallbackId).trim() || fallbackId,
    start,
    end,
    remarks: String(remarksRaw || '').trim(),
  };
}

export function getActiveSleepSession(sessions: SleepSession[]): SleepSession | null {
  return [...sessions]
    .filter((session) => !session.end)
    .sort((a, b) => b.start.getTime() - a.start.getTime())[0] || null;
}

export function getSleepMinutes(session: SleepSession, now = new Date()): number {
  const end = session.end || now;
  return Math.max(0, Math.round((end.getTime() - session.start.getTime()) / MINUTE_MS));
}

/** Splits a session at every local midnight, correctly covering overnight and DST periods. */
export function splitSleepSessionByDay(session: SleepSession, now = new Date()): SleepSegment[] {
  const effectiveEnd = session.end || now;
  if (effectiveEnd.getTime() <= session.start.getTime()) return [];

  const segments: SleepSegment[] = [];
  let cursor = new Date(session.start.getTime());
  while (cursor.getTime() < effectiveEnd.getTime()) {
    const nextMidnight = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate() + 1,
      0,
      0,
      0,
      0,
    );
    const segmentEnd = new Date(Math.min(nextMidnight.getTime(), effectiveEnd.getTime()));
    const minutes = Math.round((segmentEnd.getTime() - cursor.getTime()) / MINUTE_MS);
    if (minutes > 0) {
      segments.push({
        sessionId: session.id,
        date: formatIsoDateLocal(cursor),
        start: new Date(cursor.getTime()),
        end: segmentEnd,
        minutes,
        remarks: session.remarks,
        isOngoing: !session.end,
      });
    }
    cursor = segmentEnd;
  }
  return segments;
}

export function sleepIntervalsOverlap(
  start: Date,
  end: Date,
  sessions: SleepSession[],
  ignoredId?: string,
  now = new Date(),
): boolean {
  return sessions.some((session) => {
    if (session.id === ignoredId) return false;
    const existingEnd = session.end || now;
    return start.getTime() < existingEnd.getTime() && end.getTime() > session.start.getTime();
  });
}

function createEmptyDailySummary(date: string): DailySummary {
  return {
    date,
    milkMl: 0,
    solidFoodGrams: 0,
    diaperCount: 0,
    diaperPipi: 0,
    diaperKaka: 0,
    diaperMixed: 0,
    diaperClean: 0,
    weightCount: 0,
    sleepMinutes: 0,
    hasOngoingSleep: false,
  };
}

/** Creates one neutral summary that counts every mixed diaper exactly once. */
export function buildDailySummary(
  date: string,
  entries: BabyEntry[],
  sleepSessions: SleepSession[],
  now = new Date(),
): DailySummary {
  const summary = createEmptyDailySummary(date);

  entries.filter((entry) => entry.date === date).forEach((entry) => {
    if ((entry.feedingType === 'Melk' || (entry.milkMl || 0) > 0) && entry.milkMl) {
      summary.milkMl += entry.milkMl;
    }
    if ((entry.feedingType === 'Vaste voeding' || (entry.solidFoodGrams || 0) > 0) && entry.solidFoodGrams) {
      summary.solidFoodGrams += entry.solidFoodGrams;
    }
    if (entry.diaper) {
      summary.diaperCount += 1;
      if (entry.diaper === 'Pipi pamper') summary.diaperPipi += 1;
      else if (entry.diaper === 'Kaka pamper') summary.diaperKaka += 1;
      else if (entry.diaper === 'Pipi + kaka pamper') summary.diaperMixed += 1;
      else if (entry.diaper === 'Propere pamper') summary.diaperClean += 1;
    }
    if ((entry.weightGrams || 0) > 0) summary.weightCount += 1;
  });

  sleepSessions.forEach((session) => {
    splitSleepSessionByDay(session, now).forEach((segment) => {
      if (segment.date === date) {
        summary.sleepMinutes += segment.minutes;
        if (segment.isOngoing) summary.hasOngoingSleep = true;
      }
    });
  });

  return summary;
}

/** Returns summaries only for dates that actually contain recorded activity. */
export function buildDailySummaries(
  entries: BabyEntry[],
  sleepSessions: SleepSession[],
  now = new Date(),
): DailySummary[] {
  const dates = new Set(entries.map((entry) => entry.date));
  sleepSessions.forEach((session) => {
    splitSleepSessionByDay(session, now).forEach((segment) => dates.add(segment.date));
  });
  return [...dates].sort().map((date) => buildDailySummary(date, entries, sleepSessions, now));
}

export function startOfIsoWeek(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  const mondayOffset = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - mondayOffset);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addLocalDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 0, 0, 0, 0);
}

export function getIsoWeekNumber(date: Date): { week: number; year: number } {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  const day = (local.getDay() + 6) % 7;
  local.setDate(local.getDate() - day + 3); // Thursday decides ISO year.
  const isoYear = local.getFullYear();
  const firstThursday = new Date(isoYear, 0, 4, 12, 0, 0, 0);
  const firstThursdayDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstThursdayDay + 3);
  const week = 1 + Math.round((local.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return { week, year: isoYear };
}

export function buildWeeklySummary(
  requestedDate: Date,
  entries: BabyEntry[],
  sleepSessions: SleepSession[],
  now = new Date(),
): WeeklySummary {
  const weekStart = startOfIsoWeek(requestedDate);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = formatIsoDateLocal(addLocalDays(weekStart, index));
    return buildDailySummary(date, entries, sleepSessions, now);
  });
  const { week, year } = getIsoWeekNumber(weekStart);
  return {
    weekStart,
    weekEnd: addLocalDays(weekStart, 6),
    isoWeek: week,
    isoYear: year,
    days,
    milkMl: days.reduce((total, day) => total + day.milkMl, 0),
    solidFoodGrams: days.reduce((total, day) => total + day.solidFoodGrams, 0),
    diaperCount: days.reduce((total, day) => total + day.diaperCount, 0),
    sleepMinutes: days.reduce((total, day) => total + day.sleepMinutes, 0),
    hasOngoingSleep: days.some((day) => day.hasOngoingSleep),
  };
}
