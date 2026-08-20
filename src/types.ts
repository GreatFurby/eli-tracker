/**
 * Type definitions for Eli Tracker
 */

export type DiaperType =
  | 'Pipi pamper'
  | 'Kaka pamper'
  | 'Pipi + kaka pamper'
  | 'Propere pamper'; // historical only

export type FeedingType = 'Melk' | 'Vaste voeding';

export type SolidFoodSubtype = 'Fruitpap' | 'Groentepap' | 'Andere' | string;

export interface BabyEntry {
  id: string;
  timestamp: string; // Tijdstempel column
  date: string; // YYYY-MM-DD or DD/MM/YYYY
  time: string; // HH:mm
  dateTime: Date;
  milkMl: number | null;
  diaper: DiaperType | null;
  weightGrams: number | null;
  vomited: boolean; // Overgegeven?
  remarks: string; // Opmerkingen
  feedingType: FeedingType | null; // Voedingstype (inferred as 'Melk' if milkMl is present and feedingType is blank)
  solidFoodGrams: number | null; // Hoeveelheid vaste voeding (g)
  solidFoodSubtype: SolidFoodSubtype | null; // Voedingssubtype
}

export type EntryCategory = 'melk' | 'vaste_voeding' | 'pamper' | 'gewicht';

export interface NewEntryPayload {
  category: EntryCategory;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  milkMl?: number;
  solidFoodGrams?: number;
  solidFoodSubtype?: SolidFoodSubtype;
  diaper?: 'Pipi pamper' | 'Kaka pamper' | 'Pipi + kaka pamper';
  weightGrams?: number;
  vomited?: boolean;
  remarks?: string;
}

export type ActiveTab = 'vandaag' | 'ingave' | 'historiek' | 'groei';

export interface TodayStats {
  lastMilk: {
    ml: number;
    time: string;
    dateTime: Date;
    timeAgo: string;
  } | null;
  milkToday: {
    totalMl: number;
    count: number;
  };
  solidFoodToday: {
    totalGrams: number;
    count: number;
    subtypes: string[];
  };
  lastDiaper: {
    type: DiaperType;
    time: string;
    dateTime: Date;
    timeAgo: string;
  } | null;
  lastWeight: {
    grams: number;
    date: string;
    dateTime: Date;
    diffFromPreviousGrams: number | null;
  } | null;
  timelineToday: BabyEntry[];
}
