import { BabyEntry } from '../types';
import { normalizeRecord } from '../utils/normalization';

/**
 * Generates rich, realistic demo data for Eli when Google Sheets endpoint is not yet connected.
 * Includes historical records going back to birth, historical rows with blank Voedingstype,
 * diaper types, weight evolution from 3.420g to 5.840g+, and today's dynamic timeline.
 */
export function generateDemoData(): BabyEntry[] {
  const now = new Date();
  
  // Format date helper: returns YYYY-MM-DD
  const formatOffsetDate = (daysAgo: number): string => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const rawRows: any[] = [];

  // ==========================================
  // 1. TODAY's Dynamic Events (Live test data)
  // ==========================================
  const today = formatOffsetDate(0);
  
  // Today 06:30 - Milk 120ml
  rawRows.push([
    `${today} 06:30:12`,
    today,
    '06:30',
    120, // Hoeveelheid (ml)
    '', // Pamper
    '', // Gewicht
    'Nee', // Overgegeven?
    'Vlot gedronken', // Opmerkingen
    'Melk', // Voedingstype
    '', // Vaste voeding (g)
    '' // Subtype
  ]);

  // Today 07:40 - Diaper Pipi + kaka
  rawRows.push([
    `${today} 07:40:05`,
    today,
    '07:40',
    '',
    'Pipi + kaka pamper',
    '',
    '',
    'Veel pipi',
    '',
    '',
    ''
  ]);

  // Today 08:15 - Milk 150ml
  rawRows.push([
    `${today} 08:15:33`,
    today,
    '08:15',
    150,
    '',
    '',
    'Nee',
    '',
    'Melk',
    '',
    ''
  ]);

  // Today 11:30 - Fruitpap 85g
  rawRows.push([
    `${today} 11:30:20`,
    today,
    '11:30',
    '',
    '',
    '',
    'Nee',
    'Banaan met koekjesmeel en sinaasappelsap, vond hij heerlijk!',
    'Vaste voeding',
    85,
    'Fruitpap'
  ]);

  // Today 14:10 - Diaper Pipi
  rawRows.push([
    `${today} 14:10:45`,
    today,
    '14:10',
    '',
    'Pipi pamper',
    '',
    '',
    '',
    '',
    '',
    ''
  ]);

  // Today 14:45 - Milk 160ml
  rawRows.push([
    `${today} 14:45:10`,
    today,
    '14:45',
    160,
    '',
    '',
    'Nee',
    'Helemaal leeggedronken',
    'Melk',
    '',
    ''
  ]);

  // ==========================================
  // 2. YESTERDAY's Events
  // ==========================================
  const yesterday = formatOffsetDate(1);

  // Yesterday 06:45 - Milk 140ml
  rawRows.push([`${yesterday} 06:45:00`, yesterday, '06:45', 140, '', '', 'Nee', '', 'Melk', '', '']);
  // Yesterday 08:00 - Diaper
  rawRows.push([`${yesterday} 08:00:00`, yesterday, '08:00', '', 'Pipi pamper', '', '', '', '', '', '']);
  // Yesterday 10:15 - Milk 150ml
  rawRows.push([`${yesterday} 10:15:00`, yesterday, '10:15', 150, '', '', 'Nee', '', 'Melk', '', '']);
  // Yesterday 11:45 - Groentepap 95g
  rawRows.push([`${yesterday} 11:45:00`, yesterday, '11:45', '', '', '', 'Nee', 'Wortel met aardappel', 'Vaste voeding', 95, 'Groentepap']);
  // Yesterday 13:30 - Diaper Pipi + kaka
  rawRows.push([`${yesterday} 13:30:00`, yesterday, '13:30', '', 'Pipi + kaka pamper', '', '', '', '', '', '']);
  // Yesterday 15:00 - Milk 150ml
  rawRows.push([`${yesterday} 15:00:00`, yesterday, '15:00', 150, '', '', 'Nee', '', 'Melk', '', '']);
  // Yesterday 18:30 - Milk 160ml
  rawRows.push([`${yesterday} 18:30:00`, yesterday, '18:30', 160, '', '', 'Nee', '', 'Melk', '', '']);
  // Yesterday 21:15 - Milk 180ml
  rawRows.push([`${yesterday} 21:15:00`, yesterday, '21:15', 180, '', '', 'Nee', 'Voor het slapengaan', 'Melk', '', '']);
  // Yesterday Weight: 5.840g
  rawRows.push([`${yesterday} 09:00:00`, yesterday, '09:00', '', '', 5840, '', 'Gewogen bij Kind en Gezin', '', '', '']);

  // ==========================================
  // 3. PAST WEEKS (Solid food + Milk + Diapers + Weight)
  // ==========================================
  for (let d = 2; d <= 21; d++) {
    const dayStr = formatOffsetDate(d);
    
    // Weight measurement every ~5-7 days
    if (d === 7) {
      rawRows.push([`${dayStr} 09:00:00`, dayStr, '09:00', '', '', 5670, '', 'Gewogen thuis', '', '', '']);
    } else if (d === 14) {
      rawRows.push([`${dayStr} 09:00:00`, dayStr, '09:00', '', '', 5520, '', 'Arts controle', '', '', '']);
    } else if (d === 21) {
      rawRows.push([`${dayStr} 09:00:00`, dayStr, '09:00', '', '', 5380, '', 'Gewogen thuis', '', '', '']);
    }

    // Milk feedings (4-5 per day)
    const milkPortions = [130, 140, 150, 150, 160];
    const times = ['06:30', '10:00', '14:00', '17:30', '21:00'];
    
    times.forEach((t, i) => {
      const ml = milkPortions[i % milkPortions.length];
      const vomited = (d === 5 && i === 2) ? 'Ja' : 'Nee'; // sample vomited record
      const remarks = vomited === 'Ja' ? 'Een klein beetje teruggegeven na boertje' : '';
      
      // For days 10-21, let some have explicit 'Melk' and some test historical blank Voedingstype!
      const feedingTypeVal = d > 12 ? '' : 'Melk';
      
      rawRows.push([
        `${dayStr} ${t}:00`,
        dayStr,
        t,
        ml,
        '',
        '',
        vomited,
        remarks,
        feedingTypeVal, // Tests blank Voedingstype compatibility!
        '',
        ''
      ]);
    });

    // Solid food (introduced around day 18)
    if (d <= 18) {
      const isFruit = d % 2 === 0;
      const g = 60 + Math.floor(Math.random() * 40);
      rawRows.push([
        `${dayStr} 11:30:00`,
        dayStr,
        '11:30',
        '',
        '',
        '',
        'Nee',
        isFruit ? 'Fruitpap met appel en peer' : 'Groentepap met courgette',
        'Vaste voeding',
        g,
        isFruit ? 'Fruitpap' : 'Groentepap'
      ]);
    }

    // Diaper changes (3 per day)
    const diaperTypes = ['Pipi pamper', 'Pipi + kaka pamper', 'Pipi pamper', 'Kaka pamper'];
    rawRows.push([`${dayStr} 07:15:00`, dayStr, '07:15', '', diaperTypes[d % 3], '', '', '', '', '', '']);
    rawRows.push([`${dayStr} 13:00:00`, dayStr, '13:00', '', diaperTypes[(d + 1) % 3], '', '', '', '', '', '']);
    rawRows.push([`${dayStr} 19:30:00`, dayStr, '19:30', '', diaperTypes[(d + 2) % 3], '', '', '', '', '', '']);
  }

  // ==========================================
  // 4. HISTORICAL DATA GOING BACK TO BIRTH (~120 days ago)
  // Testing historical "Propere pamper" and blank "Voedingstype"
  // ==========================================
  const historicalWeights = [
    { daysAgo: 120, grams: 3420, note: 'Geboortegewicht van Eli ❤️' },
    { daysAgo: 116, grams: 3310, note: 'Normale initiële daling na geboorte' },
    { daysAgo: 110, grams: 3550, note: 'Terug op geboortegewicht' },
    { daysAgo: 95, grams: 3980, note: '1 maand controle bij Kind en Gezin' },
    { daysAgo: 75, grams: 4450, note: 'Groei verloopt mooi volgens curve' },
    { daysAgo: 55, grams: 4890, note: '2 maanden controle' },
    { daysAgo: 35, grams: 5180, note: 'Gewogen thuis' },
  ];

  historicalWeights.forEach(hw => {
    const dStr = formatOffsetDate(hw.daysAgo);
    rawRows.push([
      `${dStr} 10:00:00`,
      dStr,
      '10:00',
      '',
      '',
      hw.grams,
      '',
      hw.note,
      '',
      '',
      ''
    ]);
  });

  // Historical early days milk and diapers with older formats
  for (const daysAgo of [30, 45, 60, 80, 100, 115]) {
    const dStr = formatOffsetDate(daysAgo);
    const amount = daysAgo > 90 ? 70 : (daysAgo > 60 ? 100 : 120);
    
    // Historical milk row with BLANK Voedingstype column
    rawRows.push([
      `${dStr} 07:00:00`,
      dStr,
      '07:00',
      amount,
      '',
      '',
      'Nee',
      '',
      '', // blank Voedingstype!
      '',
      ''
    ]);

    rawRows.push([
      `${dStr} 12:00:00`,
      dStr,
      '12:00',
      amount,
      '',
      '',
      'Nee',
      '',
      '', // blank Voedingstype!
      '',
      ''
    ]);

    // Historical diaper (including older "Propere pamper")
    if (daysAgo === 115) {
      rawRows.push([`${dStr} 09:30:00`, dStr, '09:30', '', 'Propere pamper', '', '', 'Controle', '', '', '']);
    } else {
      rawRows.push([`${dStr} 09:30:00`, dStr, '09:30', '', 'Pipi pamper', '', '', '', '', '', '']);
    }
  }

  // Normalize all raw records
  return rawRows.map((r, i) => normalizeRecord(r, i));
}
