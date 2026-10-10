import React, { useEffect, useMemo, useState } from 'react';
import { BabyEntry, SleepSession } from '../types';
import { formatBelgianDate, formatDutchDateLabel, getDiaperUiInfo } from '../utils/normalization';
import {
  buildDailySummary,
  buildWeeklySummary,
  formatDuration,
  formatIsoDateLocal,
  formatLocalTime,
  startOfIsoWeek,
  splitSleepSessionByDay,
} from '../utils/sleep';
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Moon,
  Search,
  X,
} from 'lucide-react';

interface HistoryListProps {
  entries: BabyEntry[];
  sleepSessions: SleepSession[];
  onOpenIngave: () => void;
}

type FilterType = 'alles' | 'melk' | 'vaste_voeding' | 'pamper' | 'gewicht' | 'slaap';
type HistoryView = 'dag' | 'week';

type HistoryEvent =
  | { kind: 'entry'; date: string; dateTime: Date; entry: BabyEntry }
  | {
      kind: 'sleep';
      date: string;
      dateTime: Date;
      sessionId: string;
      end: Date;
      minutes: number;
      remarks: string;
      isOngoing: boolean;
    };

function filterEntry(entry: BabyEntry, activeFilter: FilterType): boolean {
  if (activeFilter === 'alles') return true;
  if (activeFilter === 'melk') return entry.feedingType === 'Melk' || (entry.milkMl || 0) > 0;
  if (activeFilter === 'vaste_voeding') return entry.feedingType === 'Vaste voeding' || (entry.solidFoodGrams || 0) > 0;
  if (activeFilter === 'pamper') return Boolean(entry.diaper);
  if (activeFilter === 'gewicht') return (entry.weightGrams || 0) > 0;
  return false;
}

function SummaryCell({ label, value, emoji }: { label: string; value: string; emoji: string }) {
  return (
    <div className="min-w-0 text-center">
      <div className="text-[11px] font-black text-slate-800 truncate">{emoji} {value}</div>
      <div className="text-[9px] uppercase tracking-wide text-slate-400 font-bold truncate">{label}</div>
    </div>
  );
}

export const HistoryList: React.FC<HistoryListProps> = ({ entries, sleepSessions, onOpenIngave }) => {
  const [activeFilter, setActiveFilter] = useState<FilterType>('alles');
  const [searchQuery, setSearchQuery] = useState('');
  const [historyView, setHistoryView] = useState<HistoryView>('dag');
  const [selectedWeek, setSelectedWeek] = useState(() => startOfIsoWeek(new Date()));
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  const allEvents = useMemo<HistoryEvent[]>(() => {
    const entryEvents: HistoryEvent[] = entries.map((entry) => ({
      kind: 'entry',
      date: entry.date,
      dateTime: entry.dateTime,
      entry,
    }));
    const sleepEvents: HistoryEvent[] = sleepSessions.flatMap((session) =>
      splitSleepSessionByDay(session, now).map((segment) => ({
        kind: 'sleep' as const,
        date: segment.date,
        dateTime: segment.start,
        sessionId: segment.sessionId,
        end: segment.end,
        minutes: segment.minutes,
        remarks: segment.remarks,
        isOngoing: segment.isOngoing,
      })),
    );
    return [...entryEvents, ...sleepEvents];
  }, [entries, sleepSessions, now]);

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return allEvents
      .filter((event) => {
        if (event.kind === 'sleep') {
          if (activeFilter !== 'alles' && activeFilter !== 'slaap') return false;
          if (!query) return true;
          return [event.remarks, 'slaap', event.date, formatBelgianDate(event.date)]
            .some((value) => value.toLowerCase().includes(query));
        }

        if (activeFilter === 'slaap' || !filterEntry(event.entry, activeFilter)) return false;
        if (!query) return true;
        const entry = event.entry;
        return [
          entry.remarks,
          entry.solidFoodSubtype || '',
          entry.diaper || '',
          entry.date,
          formatBelgianDate(entry.date),
        ].some((value) => value.toLowerCase().includes(query));
      })
      .sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime());
  }, [allEvents, activeFilter, searchQuery]);

  const groups = useMemo(() => {
    const byDate = new Map<string, HistoryEvent[]>();
    filteredEvents.forEach((event) => {
      const existing = byDate.get(event.date) || [];
      existing.push(event);
      byDate.set(event.date, existing);
    });
    return [...byDate.entries()]
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([dateIso, items]) => ({
        dateIso,
        items,
        summary: buildDailySummary(dateIso, entries, sleepSessions, now),
      }));
  }, [entries, filteredEvents, now, sleepSessions]);

  const weeklySummary = useMemo(
    () => buildWeeklySummary(selectedWeek, entries, sleepSessions, now),
    [entries, now, selectedWeek, sleepSessions],
  );

  const currentWeek = startOfIsoWeek(new Date());
  const mayGoForward = selectedWeek.getTime() < currentWeek.getTime();

  const filterChips: { id: FilterType; label: string; icon: string }[] = [
    { id: 'alles', label: 'Alles', icon: '✨' },
    { id: 'melk', label: 'Melk', icon: '🍼' },
    { id: 'vaste_voeding', label: 'Vaste voeding', icon: '🥣' },
    { id: 'pamper', label: 'Pampers', icon: '💩' },
    { id: 'slaap', label: 'Slaap', icon: '🌙' },
    { id: 'gewicht', label: 'Gewicht', icon: '⚖️' },
  ];

  return (
    <section id="history-section" className="space-y-4 max-w-md mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Historiek</h2>
          <p className="text-xs text-slate-500">
            {historyView === 'dag'
              ? `${filteredEvents.length} ${filteredEvents.length === 1 ? 'registratie' : 'registraties'} gevonden`
              : `Week ${weeklySummary.isoWeek} · ${weeklySummary.isoYear}`}
          </p>
        </div>
        <button type="button" onClick={onOpenIngave} className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-95 text-white text-xs font-semibold shadow-xs transition-all">
          + Nieuwe ingave
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100 border border-slate-200">
        <button type="button" onClick={() => setHistoryView('dag')} className={`py-2 rounded-xl text-xs font-bold transition-all ${historyView === 'dag' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}>
          Dagoverzicht
        </button>
        <button type="button" onClick={() => setHistoryView('week')} className={`py-2 rounded-xl text-xs font-bold transition-all ${historyView === 'week' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}>
          Weekoverzicht
        </button>
      </div>

      {historyView === 'dag' ? (
        <>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {filterChips.map((chip) => {
              const isActive = activeFilter === chip.id;
              return (
                <button key={chip.id} type="button" onClick={() => setActiveFilter(chip.id)} className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border active:scale-95 ${isActive ? 'bg-slate-900 text-white border-slate-900 shadow-xs' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                  <span>{chip.icon}</span><span>{chip.label}</span>
                </button>
              );
            })}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Zoek in notities, smaken, data..." className="w-full pl-8 pr-8 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500 outline-none" />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {groups.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
              <p className="text-sm font-semibold text-slate-700">Geen registraties gevonden</p>
              <p className="text-xs text-slate-400">Probeer een ander filter of wis je zoekopdracht.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {groups.map((group) => (
                <div key={group.dateIso} className="space-y-2">
                  <div className="sticky top-14 z-20 bg-slate-50/95 backdrop-blur-xs py-1 px-1 flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wider">{formatDutchDateLabel(group.dateIso)}</span>
                    <span className="text-[11px] font-medium text-slate-400">{formatBelgianDate(group.dateIso)}</span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 rounded-2xl border border-slate-200 bg-slate-50/80 p-2.5">
                    <SummaryCell emoji="🍼" label="melk" value={`${group.summary.milkMl} ml`} />
                    <SummaryCell emoji="🥣" label="vast" value={`${group.summary.solidFoodGrams} g`} />
                    <SummaryCell emoji="🩲" label="pampers" value={String(group.summary.diaperCount)} />
                    <SummaryCell emoji="🌙" label="slaap" value={formatDuration(group.summary.sleepMinutes)} />
                  </div>
                  {group.summary.hasOngoingSleep && (
                    <p className="text-[10px] text-indigo-700 font-semibold px-1">🌙 Slaap van vandaag loopt nog; de duur is live bijgewerkt.</p>
                  )}

                  <div className="space-y-2">
                    {group.items.map((event) => {
                      if (event.kind === 'sleep') {
                        const isLivePart = event.isOngoing && event.date === formatIsoDateLocal(now);
                        return (
                          <div key={`sleep-${event.sessionId}-${event.date}-${event.dateTime.getTime()}`} className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50/80 to-white border border-indigo-100 shadow-xs space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="font-mono text-xs font-bold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded-md">{formatLocalTime(event.dateTime)}</span>
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Moon className="w-4 h-4 text-indigo-600 shrink-0" />
                                  <span className="text-sm font-bold text-slate-900 truncate">Slaap · {formatDuration(event.minutes)}</span>
                                </div>
                              </div>
                              <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${isLivePart ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-700 border border-indigo-200'}`}>
                                {isLivePart ? 'Loopt nog' : `tot ${formatLocalTime(event.end)}`}
                              </span>
                            </div>
                            {event.remarks && (
                              <div className="flex items-start gap-2 text-xs text-slate-600 bg-white/70 p-2.5 rounded-xl border border-indigo-100">
                                <MessageSquare className="w-3 h-3 text-indigo-400 mt-0.5 shrink-0" />
                                <p className="italic text-slate-700 leading-snug">{event.remarks}</p>
                              </div>
                            )}
                          </div>
                        );
                      }

                      const entry = event.entry;
                      const isMilk = entry.feedingType === 'Melk' || (entry.milkMl || 0) > 0;
                      const isSolid = entry.feedingType === 'Vaste voeding' || (entry.solidFoodGrams || 0) > 0;
                      const isDiaper = Boolean(entry.diaper);
                      const isWeight = (entry.weightGrams || 0) > 0;
                      const diaperInfo = isDiaper ? getDiaperUiInfo(entry.diaper) : null;
                      return (
                        <div key={`entry-${entry.id}`} className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">{entry.time}</span>
                              {isMilk && <span className="text-sm font-bold text-slate-900 truncate">🍼 {entry.milkMl} ml melk</span>}
                              {isSolid && <span className="text-sm font-bold text-slate-900 truncate">{entry.solidFoodSubtype === 'Groentepap' ? '🥔' : '🍎'} {entry.solidFoodGrams} g {entry.solidFoodSubtype || 'vaste voeding'}</span>}
                              {isDiaper && diaperInfo && <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${diaperInfo.badgeColor}`}>{diaperInfo.icon} {diaperInfo.label}</span>}
                              {isWeight && <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">⚖️ {entry.weightGrams?.toLocaleString('nl-BE')} g</span>}
                            </div>
                            {entry.vomited && <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 shrink-0"><AlertCircle className="w-3 h-3 text-rose-500" /> Overgegeven</span>}
                          </div>
                          {entry.remarks && <div className="flex items-start gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100"><MessageSquare className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" /><p className="italic text-slate-700 leading-snug">{entry.remarks}</p></div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <div className="rounded-2xl bg-white border border-slate-200 p-3 flex items-center justify-between gap-2">
            <button type="button" onClick={() => setSelectedWeek((week) => new Date(week.getFullYear(), week.getMonth(), week.getDate() - 7))} className="w-9 h-9 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center" aria-label="Vorige week">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center">
              <div className="text-xs font-black text-slate-900">Week {weeklySummary.isoWeek} · {weeklySummary.isoYear}</div>
              <div className="text-[10px] text-slate-500">{formatBelgianDate(weeklySummary.weekStart)} – {formatBelgianDate(weeklySummary.weekEnd)}</div>
            </div>
            <button type="button" onClick={() => setSelectedWeek((week) => new Date(week.getFullYear(), week.getMonth(), week.getDate() + 7))} disabled={!mayGoForward} className="w-9 h-9 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-35 flex items-center justify-center" aria-label="Volgende week">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-2xl bg-sky-50 border border-sky-100"><div className="text-[10px] uppercase tracking-wider font-bold text-sky-800">Melk</div><div className="text-lg font-black text-slate-900">{weeklySummary.milkMl} <span className="text-xs text-slate-500">ml</span></div></div>
            <div className="p-3 rounded-2xl bg-orange-50 border border-orange-100"><div className="text-[10px] uppercase tracking-wider font-bold text-orange-800">Vaste voeding</div><div className="text-lg font-black text-slate-900">{weeklySummary.solidFoodGrams} <span className="text-xs text-slate-500">g</span></div></div>
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-100"><div className="text-[10px] uppercase tracking-wider font-bold text-amber-800">Pampers</div><div className="text-lg font-black text-slate-900">{weeklySummary.diaperCount}</div></div>
            <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100"><div className="text-[10px] uppercase tracking-wider font-bold text-indigo-800">Slaap</div><div className="text-lg font-black text-slate-900">{formatDuration(weeklySummary.sleepMinutes)}</div></div>
          </div>
          {weeklySummary.hasOngoingSleep && <p className="text-[11px] text-indigo-700 font-semibold px-1">🌙 De slaapduur bevat een lopende slaapperiode tot nu.</p>}

          <div className="rounded-2xl bg-white border border-slate-200 divide-y divide-slate-100 overflow-hidden">
            {weeklySummary.days.map((day, index) => (
              <div key={day.date} className="px-3 py-2.5 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0"><CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="font-bold text-slate-700">{['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'][index]} {formatBelgianDate(day.date).slice(0, 5)}</span></div>
                <div className="flex items-center gap-2 text-[11px] text-slate-600 whitespace-nowrap"><span>🍼 {day.milkMl}</span><span>🩲 {day.diaperCount}</span><span>🌙 {formatDuration(day.sleepMinutes)}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
