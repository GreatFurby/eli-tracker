import React, { useState } from 'react';
import type { DiaperType, EntryCategory, SolidFoodSubtype } from '../types';
import type { EntryFields, SleepFields } from '../services/localDatabase';
import type { LocalEntry, LocalSleep } from '../services/protocol';
import { SleepTracker } from './SleepTracker';
import { formatTemperatureCelsius } from '../utils/normalization';
import { formatIsoDateLocal, formatLocalTime } from '../utils/sleep';
import confetti from 'canvas-confetti';
import {
  Calendar,
  Clock,
  AlertCircle,
  Plus,
  Minus,
  Loader2,
  ArrowLeft,
} from 'lucide-react';

interface EntryFormProps {
  initialCategory?: EntryCategory;
  editing?: LocalEntry;
  onSave: (fields: EntryFields) => Promise<void>;
  onEntrySaved: () => void;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
  sleepSessions?: LocalSleep[];
  onSaveSleep?: (fields: SleepFields, session?: LocalSleep) => Promise<void>;
}

export const EntryForm: React.FC<EntryFormProps> = ({
  initialCategory,
  editing,
  onSave,
  onEntrySaved,
  onCancel,
  onDelete,
  sleepSessions,
  onSaveSleep,
}) => {
  const [category, setCategory] = useState<EntryCategory | null>(initialCategory ?? null);
  const [date, setDate] = useState(() => editing?.date ?? formatIsoDateLocal(new Date()));
  const [time, setTime] = useState(() => editing?.time ?? formatLocalTime(new Date()));
  const [remarks, setRemarks] = useState(editing?.remarks ?? '');
  const [vomited, setVomited] = useState(editing?.vomited ?? false);
  const [milkMl, setMilkMl] = useState(editing ? editing.milkMl : 150);
  const [solidGrams, setSolidGrams] = useState(editing ? editing.solidFoodGrams : 90);
  const existingSubtype = editing?.solidFoodSubtype ?? '';
  const standardSubtype = ['Fruitpap', 'Groentepap', 'Andere'].includes(existingSubtype);
  const [solidSubtype, setSolidSubtype] = useState<SolidFoodSubtype>(
    editing ? (standardSubtype ? existingSubtype : 'Andere') : 'Fruitpap',
  );
  const [customSubtype, setCustomSubtype] = useState(standardSubtype ? '' : existingSubtype);
  const [diaperType, setDiaperType] = useState<DiaperType>(editing?.diaper ?? 'Pipi pamper');
  const [weightGrams, setWeightGrams] = useState(editing ? editing.weightGrams : 5840);
  const [temperatureCelsius, setTemperatureCelsius] = useState(
    editing?.temperatureCelsius == null ? '36,5' : String(editing.temperatureCelsius).replace('.', ','),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const milk = editing ? editing.milkMl !== null || editing.feedingType === 'Melk' : category === 'melk';
  const solid = editing
    ? editing.solidFoodGrams !== null || editing.feedingType === 'Vaste voeding' || editing.solidFoodSubtype !== null
    : category === 'vaste_voeding';
  const diaper = editing ? editing.diaper !== null : category === 'pamper';
  const weight = editing ? editing.weightGrams !== null : category === 'gewicht';
  const temperature = editing ? editing.temperatureCelsius !== null : category === 'temperatuur';

  const parseTemperatureInput = (value: string): number | null => {
    const normalized = value.trim().replace(',', '.');
    if (!/^\d{2}(?:\.\d+)?$/.test(normalized)) return null;
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 30 || parsed > 45) return null;
    return parsed;
  };

  const adjustTemperature = (delta: number) => {
    const current = parseTemperatureInput(temperatureCelsius) ?? 36.5;
    const next = Math.max(30, Math.min(45, Math.round((current + delta) * 10) / 10));
    setTemperatureCelsius(formatTemperatureCelsius(next, false));
  };

  async function commit(change: () => Promise<void>, celebrate = false) {
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await change();
      if (celebrate) {
        try {
          void confetti({
            particleCount: 40, spread: 60, origin: { y: 0.7 },
            colors: ['#0ea5e9', '#14b8a6', '#f59e0b', '#10b981'],
          });
        } catch {
          // Saving already succeeded if the animation is unavailable.
        }
      }
      onEntrySaved();
    } catch (error) {
      setErrorMessage((error as Error).message || 'De ingave kon niet worden opgeslagen. Probeer opnieuw.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if ((!editing && !category) || isSubmitting) return;
    const parsedTemperature = temperature ? parseTemperatureInput(temperatureCelsius) : null;
    if (temperature && parsedTemperature === null) {
      setErrorMessage('Vul een geldige temperatuur tussen 30,0 en 45,0 °C in.');
      return;
    }
    const resolvedSubtype = solidSubtype === 'Andere' ? customSubtype.trim() || 'Andere' : solidSubtype;
    const subtype = solid && !(editing && !existingSubtype && solidSubtype === 'Andere' && !customSubtype.trim())
      ? resolvedSubtype : null;
    void commit(() => onSave({
      date, time, remarks, vomited,
      feedingType: editing ? editing.feedingType : milk ? 'Melk' : solid ? 'Vaste voeding' : null,
      milkMl: milk ? milkMl : null,
      solidFoodGrams: solid ? solidGrams : null,
      solidFoodSubtype: subtype,
      diaper: diaper ? diaperType : null,
      weightGrams: weight ? weightGrams : null,
      temperatureCelsius: parsedTemperature,
    }), !editing);
  };

  const commonMilkOptions = [60, 90, 120, 150, 180, 210, 240];
  const commonSolidOptions = [40, 60, 80, 100, 120, 150, 200];

  return (
    <div id="entry-form-container" className="space-y-4 max-w-md mx-auto">
      {sleepSessions && onSaveSleep && <SleepTracker sleepSessions={sleepSessions} onSave={onSaveSleep} />}

      {/* Category Selector if none picked */}
      {!category && !editing ? (
        <div className="space-y-4 pt-1 animate-in fade-in duration-200">
          <div className="text-center space-y-1">
            <h2 className="text-lg font-bold text-slate-900">Wat wil je registreren?</h2>
            <p className="text-xs text-slate-500">Kies een type voor snelle registratie</p>
          </div>

          <div className="grid grid-cols-2 gap-3.5 pt-2">
            {/* Option 1: Melk */}
            <button
              type="button"
              id="select-category-melk"
              onClick={() => setCategory('melk')}
              className="p-5 rounded-2xl bg-gradient-to-br from-sky-50 to-white border-2 border-sky-100/90 shadow-sm flex flex-col items-center justify-center gap-2.5 text-center hover:border-sky-400 active:scale-95 transition-all group"
            >
              <div className="w-14 h-14 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shadow-xs">
                🍼
              </div>
              <div>
                <span className="text-base font-bold text-slate-900 block">Melk</span>
                <span className="text-[11px] text-slate-500">Flesje in ml</span>
              </div>
            </button>

            {/* Option 2: Vaste voeding */}
            <button
              type="button"
              id="select-category-vaste-voeding"
              onClick={() => setCategory('vaste_voeding')}
              className="p-5 rounded-2xl bg-gradient-to-br from-orange-50 to-white border-2 border-orange-100/90 shadow-sm flex flex-col items-center justify-center gap-2.5 text-center hover:border-orange-400 active:scale-95 transition-all group"
            >
              <div className="w-14 h-14 rounded-2xl bg-orange-100 text-orange-700 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shadow-xs">
                🥣
              </div>
              <div>
                <span className="text-base font-bold text-slate-900 block">Vaste voeding</span>
                <span className="text-[11px] text-slate-500">Fruit- of groentepap</span>
              </div>
            </button>

            {/* Option 3: Pamper */}
            <button
              type="button"
              id="select-category-pamper"
              onClick={() => setCategory('pamper')}
              className="p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-white border-2 border-amber-100/90 shadow-sm flex flex-col items-center justify-center gap-2.5 text-center hover:border-amber-400 active:scale-95 transition-all group"
            >
              <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shadow-xs">
                💩
              </div>
              <div>
                <span className="text-base font-bold text-slate-900 block">Pamper</span>
                <span className="text-[11px] text-slate-500">Pipi &amp; kaka</span>
              </div>
            </button>

            {/* Option 4: Gewicht */}
            <button
              type="button"
              id="select-category-gewicht"
              onClick={() => setCategory('gewicht')}
              className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-white border-2 border-emerald-100/90 shadow-sm flex flex-col items-center justify-center gap-2.5 text-center hover:border-emerald-400 active:scale-95 transition-all group"
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shadow-xs">
                ⚖️
              </div>
              <div>
                <span className="text-base font-bold text-slate-900 block">Gewicht</span>
                <span className="text-[11px] text-slate-500">Meting in gram</span>
              </div>
            </button>

            {/* Option 5: Temperatuur */}
            <button
              type="button"
              id="select-category-temperatuur"
              onClick={() => setCategory('temperatuur')}
              className="col-span-2 p-4 rounded-2xl bg-gradient-to-br from-rose-50 to-white border-2 border-rose-100/90 shadow-sm flex items-center justify-center gap-3 text-left hover:border-rose-400 active:scale-95 transition-all group"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform shadow-xs">
                🌡️
              </div>
              <div>
                <span className="text-base font-bold text-slate-900 block">Temperatuur</span>
                <span className="text-[11px] text-slate-500">Meting in °C</span>
              </div>
            </button>
          </div>
        </div>
      ) : (
        /* Form for Selected Category */
        <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in duration-200">
          {/* Header with Back button and Active category title */}
          <div className="flex items-center justify-between pb-1 border-b border-slate-200/80">
            <button
              type="button"
              onClick={editing ? onCancel : () => setCategory(null)}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 p-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{editing ? 'Terug' : 'Ander type'}</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xl">
                {category === 'melk' && '🍼'}
                {category === 'vaste_voeding' && '🥣'}
                {category === 'pamper' && '💩'}
                {category === 'gewicht' && '⚖️'}
                {category === 'temperatuur' && '🌡️'}
              </span>
              <span className="text-sm font-bold text-slate-900">
                {editing && 'Registratie bewerken'}
                {category === 'melk' && 'Melkvoeding'}
                {category === 'vaste_voeding' && 'Vaste voeding'}
                {category === 'pamper' && 'Pampercontrole'}
                {category === 'gewicht' && 'Gewichtsmeting'}
                {category === 'temperatuur' && 'Temperatuurmeting'}
              </span>
            </div>
          </div>

          {/* DATE & TIME BAR */}
          <div className="grid grid-cols-2 gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div>
              <label htmlFor="entry-date-input" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                Datum
              </label>
              <input
                id="entry-date-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-white focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>

            <div>
              <label htmlFor="entry-time-input" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                Tijd
              </label>
              <input
                id="entry-time-input"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-white focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>
          </div>

          {/* 1. MELK SPECIFIC FIELDS */}
          {milk && (
            <div className="p-4 rounded-2xl bg-white border border-sky-100 shadow-sm space-y-4">
              <div className="text-center space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Hoeveelheid melk
                </label>
                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => setMilkMl(Math.max(10, (milkMl ?? 0) - 10))}
                    className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 flex items-center justify-center text-lg font-bold transition-all"
                  >
                    <Minus className="w-5 h-5" />
                  </button>

                  <div className="flex items-baseline justify-center gap-1 min-w-32">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      value={milkMl ?? ''}
                      onChange={(e) => setMilkMl(e.target.value === '' ? null : Number(e.target.value))}
                      className="w-24 text-center text-4xl font-black text-slate-900 bg-transparent outline-none border-b-2 border-sky-400 focus:border-sky-600"
                    />
                    <span className="text-base font-bold text-slate-500">ml</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setMilkMl((milkMl ?? 0) + 10)}
                    className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-800 hover:bg-sky-200 active:scale-95 flex items-center justify-center text-lg font-bold transition-all"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                {/* Quick Amount Pills */}
                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
                  {commonMilkOptions.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setMilkMl(amount)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        milkMl === amount
                          ? 'bg-sky-600 text-white shadow-sm ring-2 ring-sky-200'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {amount} ml
                    </button>
                  ))}
                </div>
              </div>

              {/* Overgegeven selector */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Overgegeven?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVomited(false)}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${
                      !vomited
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-100'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    Nee
                  </button>
                  <button
                    type="button"
                    onClick={() => setVomited(true)}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${
                      vomited
                        ? 'bg-rose-50 text-rose-800 border-rose-300 ring-2 ring-rose-100'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    Ja (teruggegeven)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. VASTE VOEDING SPECIFIC FIELDS */}
          {solid && (
            <div className="p-4 rounded-2xl bg-white border border-orange-100 shadow-sm space-y-4">
              {/* Soort voeding */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Soort voeding
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSolidSubtype('Fruitpap')}
                    className={`p-3 rounded-2xl border text-center transition-all ${
                      solidSubtype === 'Fruitpap'
                        ? 'bg-orange-50 text-orange-900 border-orange-400 ring-2 ring-orange-200 font-bold'
                        : 'bg-white text-slate-700 border-slate-200 font-medium'
                    }`}
                  >
                    <span className="text-2xl block mb-1">🍎</span>
                    <span className="text-xs">Fruitpap</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSolidSubtype('Groentepap')}
                    className={`p-3 rounded-2xl border text-center transition-all ${
                      solidSubtype === 'Groentepap'
                        ? 'bg-orange-50 text-orange-900 border-orange-400 ring-2 ring-orange-200 font-bold'
                        : 'bg-white text-slate-700 border-slate-200 font-medium'
                    }`}
                  >
                    <span className="text-2xl block mb-1">🥔</span>
                    <span className="text-xs">Groentepap</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSolidSubtype('Andere')}
                    className={`p-3 rounded-2xl border text-center transition-all ${
                      solidSubtype === 'Andere'
                        ? 'bg-orange-50 text-orange-900 border-orange-400 ring-2 ring-orange-200 font-bold'
                        : 'bg-white text-slate-700 border-slate-200 font-medium'
                    }`}
                  >
                    <span className="text-2xl block mb-1">🥣</span>
                    <span className="text-xs">Andere</span>
                  </button>
                </div>

                {solidSubtype === 'Andere' && (
                  <input
                    type="text"
                    maxLength={50000}
                    value={customSubtype}
                    onChange={(e) => setCustomSubtype(e.target.value)}
                    placeholder="bijv. Broodkorst, Yoghurt..."
                    className="w-full mt-2 px-3 py-2 rounded-xl border border-orange-300 text-xs text-slate-900 focus:ring-2 focus:ring-orange-400 outline-none"
                  />
                )}
              </div>

              {/* Amount in grams */}
              <div className="text-center space-y-2 pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Hoeveelheid vaste voeding
                </label>
                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => setSolidGrams(Math.max(5, (solidGrams ?? 0) - 5))}
                    className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 flex items-center justify-center text-lg font-bold transition-all"
                  >
                    <Minus className="w-5 h-5" />
                  </button>

                  <div className="flex items-baseline justify-center gap-1 min-w-32">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      value={solidGrams ?? ''}
                      onChange={(e) => setSolidGrams(e.target.value === '' ? null : Number(e.target.value))}
                      className="w-24 text-center text-4xl font-black text-slate-900 bg-transparent outline-none border-b-2 border-orange-400 focus:border-orange-600"
                    />
                    <span className="text-base font-bold text-slate-500">gram</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSolidGrams((solidGrams ?? 0) + 5)}
                    className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-800 hover:bg-orange-200 active:scale-95 flex items-center justify-center text-lg font-bold transition-all"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                {/* Quick Gram Pills */}
                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
                  {commonSolidOptions.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setSolidGrams(amount)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        solidGrams === amount
                          ? 'bg-orange-600 text-white shadow-sm ring-2 ring-orange-200'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {amount} g
                    </button>
                  ))}
                </div>
              </div>

              {/* Overgegeven selector */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Overgegeven?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVomited(false)}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${
                      !vomited
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-100'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    Nee
                  </button>
                  <button
                    type="button"
                    onClick={() => setVomited(true)}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${
                      vomited
                        ? 'bg-rose-50 text-rose-800 border-rose-300 ring-2 ring-rose-100'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    Ja (teruggegeven)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. PAMPER SPECIFIC FIELDS */}
          {diaper && (
            <div className="p-4 rounded-2xl bg-white border border-amber-100 shadow-sm space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Pamper inhoud
              </label>

              {/* 3 Large Touch Choices: Pipi, Kaka, Pipi + kaka */}
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  id="diaper-option-pipi"
                  onClick={() => setDiaperType('Pipi pamper')}
                  className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all active:scale-95 ${
                    diaperType === 'Pipi pamper'
                      ? 'bg-sky-50 text-sky-900 border-sky-400 ring-4 ring-sky-100 shadow-xs font-bold'
                      : 'bg-white text-slate-700 border-slate-200 font-medium'
                  }`}
                >
                  <span className="text-3xl">💧</span>
                  <span className="text-xs font-bold">Pipi</span>
                </button>

                <button
                  type="button"
                  id="diaper-option-kaka"
                  onClick={() => setDiaperType('Kaka pamper')}
                  className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all active:scale-95 ${
                    diaperType === 'Kaka pamper'
                      ? 'bg-amber-50 text-amber-900 border-amber-400 ring-4 ring-amber-100 shadow-xs font-bold'
                      : 'bg-white text-slate-700 border-slate-200 font-medium'
                  }`}
                >
                  <span className="text-3xl">💩</span>
                  <span className="text-xs font-bold">Kaka</span>
                </button>

                <button
                  type="button"
                  id="diaper-option-pipi-kaka"
                  onClick={() => setDiaperType('Pipi + kaka pamper')}
                  className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all active:scale-95 ${
                    diaperType === 'Pipi + kaka pamper'
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-400 ring-4 ring-emerald-100 shadow-xs font-bold'
                      : 'bg-white text-slate-700 border-slate-200 font-medium'
                  }`}
                >
                  <span className="text-3xl">💧💩</span>
                  <span className="text-xs font-bold">Pipi + kaka</span>
                </button>
              </div>
              {editing?.diaper === 'Propere pamper' && (
                <button type="button" aria-pressed={diaperType === 'Propere pamper'} onClick={() => setDiaperType('Propere pamper')} className="w-full rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-700 aria-pressed:bg-amber-100">
                  Propere pamper
                </button>
              )}
            </div>
          )}

          {/* 4. GEWICHT SPECIFIC FIELDS */}
          {weight && (
            <div className="p-4 rounded-2xl bg-white border border-emerald-100 shadow-sm space-y-4">
              <div className="text-center space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Gewicht in gram
                </label>

                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => setWeightGrams(Math.max(1000, (weightGrams ?? 0) - 50))}
                    className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 flex items-center justify-center text-lg font-bold transition-all"
                  >
                    <Minus className="w-5 h-5" />
                  </button>

                  <div className="flex flex-col items-center justify-center min-w-36">
                    <div className="flex items-baseline justify-center gap-1">
                      <input
                        type="number"
                        inputMode="decimal"
                      min={0}
                      step="any"
                        value={weightGrams ?? ''}
                        onChange={(e) => setWeightGrams(e.target.value === '' ? null : Number(e.target.value))}
                        className="w-28 text-center text-4xl font-black text-slate-900 bg-transparent outline-none border-b-2 border-emerald-400 focus:border-emerald-600"
                      />
                      <span className="text-base font-bold text-slate-500">g</span>
                    </div>
                    <span className="text-xs font-semibold text-emerald-700 mt-1">
                      = {(weightGrams / 1000).toFixed(3).replace('.', ',')} kg
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setWeightGrams((weightGrams ?? 0) + 50)}
                    className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 hover:bg-emerald-200 active:scale-95 flex items-center justify-center text-lg font-bold transition-all"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                {/* Quick Weight Adjustments */}
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setWeightGrams((weightGrams ?? 0) - 10)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium"
                  >
                    -10g
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeightGrams((weightGrams ?? 0) + 10)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium"
                  >
                    +10g
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeightGrams((weightGrams ?? 0) + 50)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200"
                  >
                    +50g
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeightGrams((weightGrams ?? 0) + 100)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200"
                  >
                    +100g
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 5. TEMPERATUUR SPECIFIC FIELDS */}
          {temperature && (
            <div className="p-4 rounded-2xl bg-white border border-rose-100 shadow-sm space-y-4">
              <div className="text-center space-y-2">
                <label htmlFor="temperature-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Temperatuur in °C
                </label>

                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => adjustTemperature(-0.1)}
                    className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 flex items-center justify-center text-lg font-bold transition-all"
                    aria-label="0,1 graad lager"
                  >
                    <Minus className="w-5 h-5" />
                  </button>

                  <div className="flex items-baseline justify-center gap-1 min-w-36">
                    <input
                      id="temperature-input"
                      type="text"
                      inputMode="decimal"
                      value={temperatureCelsius}
                      onChange={(e) => setTemperatureCelsius(e.target.value)}
                      aria-label="Temperatuur in graden Celsius"
                      className="w-28 text-center text-4xl font-black text-slate-900 bg-transparent outline-none border-b-2 border-rose-400 focus:border-rose-600"
                    />
                    <span className="text-base font-bold text-slate-500">°C</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => adjustTemperature(0.1)}
                    className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-800 hover:bg-rose-200 active:scale-95 flex items-center justify-center text-lg font-bold transition-all"
                    aria-label="0,1 graad hoger"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
                  {[36.5, 37.0, 37.5, 38.0, 38.5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTemperatureCelsius(formatTemperatureCelsius(value, false))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        parseTemperatureInput(temperatureCelsius) === value
                          ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-200'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {formatTemperatureCelsius(value)}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 text-center">Je mag een komma of punt gebruiken, bijvoorbeeld 36,5.</p>
            </div>
          )}

          {/* OPMERKINGEN (OPTIONAL TEXT) */}
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1.5">
            <label htmlFor="entry-remarks-input" className="block text-xs font-bold text-slate-700">
              Opmerkingen <span className="text-slate-400 font-normal">(optioneel)</span>
            </label>
            <textarea
              id="entry-remarks-input"
              rows={2}
              maxLength={50000}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={
                category === 'melk'
                  ? 'bijv. Vlot gedronken, boertje gelaten...'
                  : category === 'vaste_voeding'
                  ? 'bijv. Met banaan en koekjesmeel...'
                  : category === 'pamper'
                  ? 'bijv. Veel pipi, lichte stoelgang...'
                  : category === 'temperatuur'
                  ? 'bijv. Rectaal gemeten, na een dutje...'
                  : 'bijv. Gewogen bij Kind en Gezin...'
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500 outline-none"
            />
          </div>

          {/* Error display */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ACTION BUTTONS */}
          <div className="flex items-center gap-2.5 pt-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="px-4 py-3.5 rounded-2xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors"
              >
                Annuleren
              </button>
            )}

            <button
              id="submit-entry-btn"
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 py-3.5 px-6 rounded-2xl font-bold text-sm text-white shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                category === 'melk'
                  ? 'bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-700 hover:to-sky-600 shadow-sky-500/20'
                  : category === 'vaste_voeding'
                  ? 'bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 shadow-orange-500/20'
                  : category === 'pamper'
                  ? 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 shadow-amber-500/20'
                  : category === 'temperatuur'
                  ? 'bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 shadow-rose-500/20'
                  : 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-emerald-500/20'
              } ${isSubmitting ? 'opacity-70 cursor-wait' : ''}`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Opslaan...</span>
                </>
              ) : (
                <>
                  <span>{editing ? 'Opslaan' : 'Ingave opslaan'}</span>
                </>
              )}
            </button>
          </div>
          {onDelete && (
            <button type="button" disabled={isSubmitting} onClick={() => {
              if (window.confirm('Deze registratie verwijderen?')) void commit(onDelete);
            }} className="w-full rounded-xl py-2 text-xs font-bold text-rose-700 hover:bg-rose-50">
              Verwijderen
            </button>
          )}
        </form>
      )}
    </div>
  );
};
