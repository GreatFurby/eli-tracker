import React from 'react';
import { EntryCategory, SleepSession, TodayStats } from '../types';
import { formatTemperatureCelsius, getDiaperUiInfo } from '../utils/normalization';
import { formatDuration, formatLocalTime, getSleepMinutes } from '../utils/sleep';
import { Clock, Moon, Scale, TrendingUp } from 'lucide-react';

interface TodaySummaryCardsProps {
  stats: TodayStats;
  onQuickAdd: (category: EntryCategory) => void;
  activeSleep: SleepSession | null;
  latestCompletedSleep: SleepSession | null;
  onOpenSleep: () => void;
}

export const TodaySummaryCards: React.FC<TodaySummaryCardsProps> = ({
  stats,
  onQuickAdd,
  activeSleep,
  latestCompletedSleep,
  onOpenSleep,
}) => {
  const { lastMilk, milkToday, solidFoodToday, lastDiaper, lastWeight, lastTemperature } = stats;
  const diaperInfo = lastDiaper ? getDiaperUiInfo(lastDiaper.type) : null;
  const latestSleepEnd = latestCompletedSleep?.end || null;

  return (
    <section id="today-summary-section" aria-label="Overzicht Vandaag" className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <button
          id="card-sleep"
          type="button"
          onClick={onOpenSleep}
          className={`min-h-[148px] text-left p-4 rounded-2xl border shadow-sm flex flex-col justify-between active:scale-[0.98] transition-all ${
            activeSleep
              ? 'border-indigo-300 bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-indigo-200/70'
              : 'border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white hover:border-indigo-300'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${activeSleep ? 'text-indigo-100' : 'text-indigo-900'}`}>
              Slaap
            </span>
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${activeSleep ? 'bg-white/15 text-white' : 'bg-indigo-100 text-indigo-700'}`}>
              <Moon className="w-4 h-4" />
            </span>
          </div>

          <div className="my-2">
            {activeSleep ? (
              <>
                <div className="text-base font-black">Eli slaapt nu</div>
                <div className="text-xs font-medium mt-0.5 text-indigo-100">
                  Sinds {formatLocalTime(activeSleep.start)} · {formatDuration(getSleepMinutes(activeSleep))}
                </div>
              </>
            ) : latestCompletedSleep && latestSleepEnd ? (
              <>
                <div className="text-xl font-black text-slate-900">{formatDuration(getSleepMinutes(latestCompletedSleep))}</div>
                <div className="text-xs font-medium mt-0.5 text-indigo-700">Laatste slaap · tot {formatLocalTime(latestSleepEnd)}</div>
              </>
            ) : (
              <div className="text-xs text-slate-500 py-1">Nog geen slaap geregistreerd</div>
            )}
          </div>

          <div className={`text-[11px] font-medium pt-1 border-t ${activeSleep ? 'border-white/15 text-indigo-100' : 'border-indigo-100/70 text-indigo-700'}`}>
            {activeSleep ? 'Tik om slaap te stoppen' : 'Tik voor slaapregistratie'}
          </div>
        </button>

        <button
          id="card-last-temperature"
          type="button"
          onClick={() => onQuickAdd('temperatuur')}
          className="min-h-[148px] text-left p-4 rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50/80 to-white shadow-sm flex flex-col justify-between hover:border-rose-300 active:scale-[0.98] transition-all"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-rose-900 uppercase tracking-wider">Laatste temperatuur</span>
            <span className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center text-sm">🌡️</span>
          </div>

          <div className="my-2">
            {lastTemperature ? (
              <>
                <div className="text-xl font-black text-slate-900">{formatTemperatureCelsius(lastTemperature.celsius)}</div>
                <div className="text-xs font-medium text-rose-700 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3 text-rose-500" />
                  <span>{lastTemperature.time}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-600 font-normal">{lastTemperature.timeAgo}</span>
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-400 py-1">Nog geen meting</div>
            )}
          </div>

          <div className="text-[11px] font-medium text-rose-700 pt-1 border-t border-rose-100/70">Tik om temperatuur in te geven</div>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          id="card-last-milk"
          type="button"
          onClick={() => onQuickAdd('melk')}
          className="text-left bg-gradient-to-br from-sky-50/80 to-white p-4 rounded-2xl border border-sky-100/80 shadow-sm flex flex-col justify-between hover:border-sky-300 active:scale-[0.98] transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-sky-800 uppercase tracking-wider">Laatste melk</span>
            <span className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center text-xs">🍼</span>
          </div>
          <div className="my-2">
            {lastMilk ? (
              <>
                <div className="text-2xl font-black text-slate-900 tracking-tight">{lastMilk.ml} <span className="text-sm font-semibold text-slate-500">ml</span></div>
                <div className="text-xs font-semibold text-sky-700 flex items-center gap-1 mt-0.5"><Clock className="w-3 h-3 text-sky-500" /><span>{lastMilk.time}</span><span className="text-slate-400">•</span><span className="text-slate-600 font-normal">{lastMilk.timeAgo}</span></div>
              </>
            ) : <div className="text-xs text-slate-400 py-1">Nog geen melk geregistreerd</div>}
          </div>
          <div className="text-[11px] font-medium text-sky-600/90 pt-1 border-t border-sky-100/60">{milkToday.count > 0 ? `${milkToday.count}e voeding vandaag` : 'Tik om toe te voegen'}</div>
        </button>

        <button
          id="card-last-diaper"
          type="button"
          onClick={() => onQuickAdd('pamper')}
          className="text-left bg-gradient-to-br from-amber-50/70 to-white p-4 rounded-2xl border border-amber-100/80 shadow-sm flex flex-col justify-between hover:border-amber-300 active:scale-[0.98] transition-all"
        >
          <div className="flex items-center justify-between"><span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">Laatste pamper</span><span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center text-xs">🩲</span></div>
          <div className="my-2">
            {lastDiaper && diaperInfo ? (
              <>
                <div className="text-base font-bold text-slate-900 flex items-center gap-1.5 tracking-tight truncate"><span>{diaperInfo.icon}</span><span>{diaperInfo.label}</span></div>
                <div className="text-xs font-semibold text-amber-800 flex items-center gap-1 mt-0.5"><Clock className="w-3 h-3 text-amber-600" /><span>{lastDiaper.time}</span><span className="text-slate-400">•</span><span className="text-slate-600 font-normal">{lastDiaper.timeAgo}</span></div>
              </>
            ) : <div className="text-xs text-slate-400 py-1">Nog geen pamper vandaag</div>}
          </div>
          <div className="text-[11px] font-medium text-amber-700/90 pt-1 border-t border-amber-100/60">Tik voor nieuwe pamper</div>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          id="card-today-milk-total"
          type="button"
          onClick={() => onQuickAdd('melk')}
          className="text-left bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between hover:border-sky-200 transition-all"
        >
          <div className="flex items-center justify-between"><span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Melk vandaag</span><span className="text-xs">🥛</span></div>
          <div className="my-1.5"><div className="text-xl font-black text-slate-900 tracking-tight">{milkToday.totalMl} <span className="text-xs font-semibold text-slate-500">ml</span></div><div className="text-xs font-medium text-slate-600 mt-0.5">{milkToday.count === 1 ? '1 voeding' : `${milkToday.count} voedingen`}</div></div>
          <div className="text-[10px] text-slate-400 font-medium">{milkToday.count > 0 ? `Gem. ~${Math.round(milkToday.totalMl / milkToday.count)} ml / fles` : 'Nog niet gedronken'}</div>
        </button>

        <button
          id="card-today-solid-total"
          type="button"
          onClick={() => onQuickAdd('vaste_voeding')}
          className="text-left bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between hover:border-orange-200 transition-all"
        >
          <div className="flex items-center justify-between"><span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Vaste voeding</span><span className="text-xs">🥣</span></div>
          <div className="my-1.5"><div className="text-xl font-black text-slate-900 tracking-tight">{solidFoodToday.totalGrams} <span className="text-xs font-semibold text-slate-500">g</span></div><div className="text-xs font-medium text-slate-600 mt-0.5 truncate">{solidFoodToday.count === 0 ? 'Geen vaste voeding' : solidFoodToday.count === 1 ? '1 maaltijd' : `${solidFoodToday.count} maaltijden`}</div></div>
          <div className="text-[10px] text-orange-600 font-medium truncate">{solidFoodToday.subtypes.length > 0 ? solidFoodToday.subtypes.join(', ') : 'Fruit- of groentepap'}</div>
        </button>
      </div>

      <button
        id="card-last-weight"
        type="button"
        onClick={() => onQuickAdd('gewicht')}
        className="w-full text-left bg-gradient-to-r from-emerald-50/60 via-teal-50/40 to-white p-4 rounded-2xl border border-emerald-100 shadow-sm flex items-center justify-between hover:border-emerald-300 transition-all active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold"><Scale className="w-5 h-5" /></div>
          <div>
            <div className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">Laatste gewicht</div>
            <div className="flex items-baseline gap-1.5"><span className="text-xl font-black text-slate-900 tracking-tight">{lastWeight ? `${lastWeight.grams.toLocaleString('nl-BE')} g` : '—'}</span>{lastWeight && <span className="text-xs text-slate-500 font-medium">({(lastWeight.grams / 1000).toFixed(3).replace('.', ',')} kg)</span>}</div>
          </div>
        </div>
        <div className="text-right">
          {lastWeight ? (
            <>
              {lastWeight.diffFromPreviousGrams !== null && <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${lastWeight.diffFromPreviousGrams >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}><TrendingUp className="w-3 h-3" />{lastWeight.diffFromPreviousGrams >= 0 ? '+' : ''}{lastWeight.diffFromPreviousGrams} g</span>}
              <div className="text-[10px] text-slate-500 mt-1 font-medium">{lastWeight.date}</div>
            </>
          ) : <span className="text-xs text-slate-400">Nog niet gewogen</span>}
        </div>
      </button>
    </section>
  );
};
