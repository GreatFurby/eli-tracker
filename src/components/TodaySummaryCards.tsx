import React from 'react';
import { TodayStats } from '../types';
import { getDiaperUiInfo } from '../utils/normalization';
import { Clock, TrendingUp, Sparkles, Scale, Utensils, Baby } from 'lucide-react';

interface TodaySummaryCardsProps {
  stats: TodayStats;
  onQuickAdd: (category: 'melk' | 'vaste_voeding' | 'pamper' | 'gewicht') => void;
}

export const TodaySummaryCards: React.FC<TodaySummaryCardsProps> = ({
  stats,
  onQuickAdd,
}) => {
  const { lastMilk, milkToday, solidFoodToday, lastDiaper, lastWeight } = stats;

  const diaperInfo = lastDiaper ? getDiaperUiInfo(lastDiaper.type) : null;

  return (
    <section id="today-summary-section" aria-label="Overzicht Vandaag" className="space-y-3">
      {/* 2-Column Grid for Primary Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        {/* CARD 1: Laatste melkvoeding */}
        <div
          id="card-last-milk"
          onClick={() => onQuickAdd('melk')}
          role="button"
          tabIndex={0}
          className="bg-gradient-to-br from-sky-50/80 to-white p-4 rounded-2xl border border-sky-100/80 shadow-sm flex flex-col justify-between hover:border-sky-300 transition-all active:scale-[0.98] cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-sky-800 uppercase tracking-wider">
              Laatste melk
            </span>
            <span className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center text-xs">
              🍼
            </span>
          </div>

          <div className="my-2">
            {lastMilk ? (
              <>
                <div className="text-2xl font-black text-slate-900 tracking-tight">
                  {lastMilk.ml} <span className="text-sm font-semibold text-slate-500">ml</span>
                </div>
                <div className="text-xs font-semibold text-sky-700 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3 text-sky-500" />
                  <span>{lastMilk.time}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-600 font-normal">{lastMilk.timeAgo}</span>
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-400 py-1">Nog geen melk geregistreerd</div>
            )}
          </div>

          <div className="text-[11px] font-medium text-sky-600/90 pt-1 border-t border-sky-100/60">
            {milkToday.count > 0 ? `${milkToday.count}e voeding vandaag` : 'Tik om toe te voegen'}
          </div>
        </div>

        {/* CARD 4: Laatste pamper */}
        <div
          id="card-last-diaper"
          onClick={() => onQuickAdd('pamper')}
          role="button"
          tabIndex={0}
          className="bg-gradient-to-br from-amber-50/70 to-white p-4 rounded-2xl border border-amber-100/80 shadow-sm flex flex-col justify-between hover:border-amber-300 transition-all active:scale-[0.98] cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
              Laatste pamper
            </span>
            <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center text-xs">
              🩲
            </span>
          </div>

          <div className="my-2">
            {lastDiaper && diaperInfo ? (
              <>
                <div className="text-base font-bold text-slate-900 flex items-center gap-1.5 tracking-tight truncate">
                  <span>{diaperInfo.icon}</span>
                  <span>{diaperInfo.label}</span>
                </div>
                <div className="text-xs font-semibold text-amber-800 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3 text-amber-600" />
                  <span>{lastDiaper.time}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-600 font-normal">{lastDiaper.timeAgo}</span>
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-400 py-1">Nog geen pamper vandaag</div>
            )}
          </div>

          <div className="text-[11px] font-medium text-amber-700/90 pt-1 border-t border-amber-100/60">
            Tik voor nieuwe pamper
          </div>
        </div>
      </div>

      {/* 2-Column Grid for Daily Totals (Milk & Solid Food) */}
      <div className="grid grid-cols-2 gap-3">
        {/* CARD 2: Melk vandaag */}
        <div
          id="card-today-milk-total"
          onClick={() => onQuickAdd('melk')}
          role="button"
          tabIndex={0}
          className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between hover:border-sky-200 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Melk vandaag
            </span>
            <span className="text-xs">🥛</span>
          </div>

          <div className="my-1.5">
            <div className="text-xl font-black text-slate-900 tracking-tight">
              {milkToday.totalMl}{' '}
              <span className="text-xs font-semibold text-slate-500">ml</span>
            </div>
            <div className="text-xs font-medium text-slate-600 mt-0.5">
              {milkToday.count === 1
                ? '1 voeding'
                : `${milkToday.count} voedingen`}
            </div>
          </div>

          <div className="text-[10px] text-slate-400 font-medium">
            {milkToday.count > 0
              ? `Gem. ~${Math.round(milkToday.totalMl / milkToday.count)} ml / fles`
              : 'Nog niet gedronken'}
          </div>
        </div>

        {/* CARD 3: Vaste voeding vandaag */}
        <div
          id="card-today-solid-total"
          onClick={() => onQuickAdd('vaste_voeding')}
          role="button"
          tabIndex={0}
          className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between hover:border-orange-200 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Vaste voeding
            </span>
            <span className="text-xs">🥣</span>
          </div>

          <div className="my-1.5">
            <div className="text-xl font-black text-slate-900 tracking-tight">
              {solidFoodToday.totalGrams}{' '}
              <span className="text-xs font-semibold text-slate-500">g</span>
            </div>
            <div className="text-xs font-medium text-slate-600 mt-0.5 truncate">
              {solidFoodToday.count === 0
                ? 'Geen vaste voeding'
                : solidFoodToday.count === 1
                ? '1 maaltijd'
                : `${solidFoodToday.count} maaltijden`}
            </div>
          </div>

          <div className="text-[10px] text-orange-600 font-medium truncate">
            {solidFoodToday.subtypes.length > 0
              ? solidFoodToday.subtypes.join(', ')
              : 'Fruit- of groentepap'}
          </div>
        </div>
      </div>

      {/* CARD 5: Laatste gewicht */}
      <div
        id="card-last-weight"
        onClick={() => onQuickAdd('gewicht')}
        role="button"
        tabIndex={0}
        className="bg-gradient-to-r from-emerald-50/60 via-teal-50/40 to-white p-4 rounded-2xl border border-emerald-100 shadow-sm flex items-center justify-between hover:border-emerald-300 transition-all active:scale-[0.99] cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
              Laatste gewicht
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-slate-900 tracking-tight">
                {lastWeight ? `${lastWeight.grams.toLocaleString('nl-BE')} g` : '—'}
              </span>
              {lastWeight && (
                <span className="text-xs text-slate-500 font-medium">
                  ({(lastWeight.grams / 1000).toFixed(3).replace('.', ',')} kg)
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="text-right">
          {lastWeight ? (
            <>
              {lastWeight.diffFromPreviousGrams !== null && (
                <div
                  className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
                    lastWeight.diffFromPreviousGrams >= 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  <TrendingUp className="w-3 h-3" />
                  <span>
                    {lastWeight.diffFromPreviousGrams >= 0 ? '+' : ''}
                    {lastWeight.diffFromPreviousGrams} g
                  </span>
                </div>
              )}
              <div className="text-[10px] text-slate-500 mt-1 font-medium">
                {lastWeight.date}
              </div>
            </>
          ) : (
            <span className="text-xs text-slate-400">Nog niet gewogen</span>
          )}
        </div>
      </div>
    </section>
  );
};
