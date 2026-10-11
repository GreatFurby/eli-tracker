import assert from 'node:assert/strict';
import { BabyEntry, SleepSession } from '../src/types';
import {
  buildDailySummary,
  buildWeeklySummary,
  formatIsoDateLocal,
  getSleepMinutes,
  splitSleepSessionByDay,
} from '../src/utils/sleep';
import { normalizeRecord } from '../src/utils/normalization';

const overnight: SleepSession = {
  id: 'overnight',
  start: new Date(2026, 9, 10, 23, 30),
  end: new Date(2026, 9, 11, 1, 30),
  remarks: '',
};

const segments = splitSleepSessionByDay(overnight);
assert.equal(segments.length, 2, 'overnight sleep is split into two days');
assert.deepEqual(
  segments.map((segment) => ({ date: segment.date, minutes: segment.minutes })),
  [
    { date: '2026-10-10', minutes: 30 },
    { date: '2026-10-11', minutes: 90 },
  ],
);

// On the Belgian DST jump forward, 00:30 to 03:30 is two elapsed hours, not three.
const dstSession: SleepSession = {
  id: 'dst',
  start: new Date(2026, 2, 29, 0, 30),
  end: new Date(2026, 2, 29, 3, 30),
  remarks: '',
};
assert.equal(getSleepMinutes(dstSession), 120, 'DST spring-forward uses elapsed time');

const entry: BabyEntry = {
  id: 'mixed-diaper',
  timestamp: '',
  date: '2026-10-10',
  time: '09:00',
  dateTime: new Date(2026, 9, 10, 9, 0),
  milkMl: 150,
  diaper: 'Pipi + kaka pamper',
  weightGrams: null,
  vomited: false,
  remarks: '',
  feedingType: 'Melk',
  solidFoodGrams: null,
  solidFoodSubtype: null,
  temperatureCelsius: 36.5,
};

const daily = buildDailySummary('2026-10-10', [entry], [overnight]);
assert.equal(daily.milkMl, 150);
assert.equal(daily.diaperCount, 1, 'a mixed diaper counts once in the total');
assert.equal(daily.diaperMixed, 1);
assert.equal(daily.sleepMinutes, 30);
assert.equal(daily.temperatureCount, 1);
assert.equal(daily.averageTemperatureCelsius, 36.5);

const weekly = buildWeeklySummary(new Date(2026, 9, 10), [entry], [overnight]);
assert.equal(formatIsoDateLocal(weekly.weekStart), '2026-10-05', 'ISO weeks begin on Monday');
assert.equal(weekly.isoWeek, 41);
assert.equal(weekly.milkMl, 150);
assert.equal(weekly.diaperCount, 1);
assert.equal(weekly.sleepMinutes, 120, 'weekly totals include both overnight portions exactly once');
assert.equal(weekly.averageTemperatureCelsius, 36.5);

const migratedTemperature = normalizeRecord([
  '11/10/2026 08:30:00',
  '11/10/2026',
  '08:30',
  '', '', '', '', '', '', '', '',
  '36,5',
]);
assert.equal(migratedTemperature.temperatureCelsius, 36.5, 'Belgian comma temperature values are parsed');

console.log('sleep-utils tests passed');
