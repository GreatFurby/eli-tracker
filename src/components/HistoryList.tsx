import React, { useState, useMemo } from 'react';
import { BabyEntry } from '../types';
import {
  formatDutchDateLabel,
  formatBelgianDate,
  getDiaperUiInfo,
} from '../utils/normalization';
import {
  Filter,
  Search,
  AlertCircle,
  MessageSquare,
  Scale,
  Calendar,
  X,
} from 'lucide-react';

interface HistoryListProps {
  entries: BabyEntry[];
  onOpenIngave: () => void;
}

type FilterType = 'alles' | 'melk' | 'vaste_voeding' | 'pamper' | 'gewicht';

export const HistoryList: React.FC<HistoryListProps> = ({ entries, onOpenIngave }) => {
  const [activeFilter, setActiveFilter] = useState<FilterType>('alles');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Filter & Search entries
  const filteredEntries = useMemo(() => {
    // Sort descending (newest first)
    const sorted = [...entries].sort(
      (a, b) => b.dateTime.getTime() - a.dateTime.getTime()
    );

    return sorted.filter((entry) => {
      // 1. Type Filter
      if (activeFilter === 'melk') {
        const isMilk =
          entry.feedingType === 'Melk' ||
          (entry.milkMl !== null && entry.milkMl > 0);
        if (!isMilk) return false;
      } else if (activeFilter === 'vaste_voeding') {
        const isSolid =
          entry.feedingType === 'Vaste voeding' ||
          (entry.solidFoodGrams !== null && entry.solidFoodGrams > 0);
        if (!isSolid) return false;
      } else if (activeFilter === 'pamper') {
        if (!entry.diaper) return false;
      } else if (activeFilter === 'gewicht') {
        if (!entry.weightGrams || entry.weightGrams <= 0) return false;
      }

      // 2. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesRemarks = entry.remarks.toLowerCase().includes(q);
        const matchesSubtype = (entry.solidFoodSubtype || '').toLowerCase().includes(q);
        const matchesDiaper = (entry.diaper || '').toLowerCase().includes(q);
        const matchesDate = entry.date.includes(q) || formatBelgianDate(entry.date).includes(q);
        return matchesRemarks || matchesSubtype || matchesDiaper || matchesDate;
      }

      return true;
    });
  }, [entries, activeFilter, searchQuery]);

  // Group filtered entries by date
  const groupedByDate = useMemo(() => {
    const groups: { [dateIso: string]: BabyEntry[] } = {};
    filteredEntries.forEach((entry) => {
      if (!groups[entry.date]) {
        groups[entry.date] = [];
      }
      groups[entry.date].push(entry);
    });

    return Object.entries(groups).map(([dateIso, items]) => ({
      dateIso,
      dateLabel: formatDutchDateLabel(dateIso),
      belgianDate: formatBelgianDate(dateIso),
      items,
    }));
  }, [filteredEntries]);

  const filterChips: { id: FilterType; label: string; icon: string }[] = [
    { id: 'alles', label: 'Alles', icon: '✨' },
    { id: 'melk', label: 'Melk', icon: '🍼' },
    { id: 'vaste_voeding', label: 'Vaste voeding', icon: '🥣' },
    { id: 'pamper', label: 'Pampers', icon: '💩' },
    { id: 'gewicht', label: 'Gewicht', icon: '⚖️' },
  ];

  return (
    <section id="history-section" className="space-y-4 max-w-md mx-auto">
      {/* Title & Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Historiek</h2>
          <p className="text-xs text-slate-500">
            {filteredEntries.length} {filteredEntries.length === 1 ? 'registratie' : 'registraties'} gevonden
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenIngave}
          className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-95 text-white text-xs font-semibold shadow-xs transition-all"
        >
          + Nieuwe ingave
        </button>
      </div>

      {/* FILTER CHIPS (Scrollable horizontally) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {filterChips.map((chip) => {
          const isActive = activeFilter === chip.id;
          return (
            <button
              key={chip.id}
              id={`filter-chip-${chip.id}`}
              type="button"
              onClick={() => setActiveFilter(chip.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border active:scale-95 ${
                isActive
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{chip.icon}</span>
              <span>{chip.label}</span>
            </button>
          );
        })}
      </div>

      {/* SEARCH INPUT */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Zoek in notities, smaken, data..."
          className="w-full pl-8 pr-8 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500 outline-none"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* GROUPED LIST OF ENTRIES */}
      {groupedByDate.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
          <p className="text-sm font-semibold text-slate-700">Geen registraties gevonden</p>
          <p className="text-xs text-slate-400">
            Probeer een ander filter of wis je zoekopdracht.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groupedByDate.map((group) => (
            <div key={group.dateIso} className="space-y-2">
              {/* Date Group Header */}
              <div className="sticky top-14 z-20 bg-slate-50/95 backdrop-blur-xs py-1 px-1 flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  {group.dateLabel}
                </span>
                <span className="text-[11px] font-medium text-slate-400">
                  {group.belgianDate}
                </span>
              </div>

              {/* Items for this Date */}
              <div className="space-y-2">
                {group.items.map((entry) => {
                  const isMilk =
                    entry.feedingType === 'Melk' ||
                    (entry.milkMl !== null && entry.milkMl > 0);
                  const isSolid =
                    entry.feedingType === 'Vaste voeding' ||
                    (entry.solidFoodGrams !== null && entry.solidFoodGrams > 0);
                  const isDiaper = Boolean(entry.diaper);
                  const isWeight = Boolean(entry.weightGrams && entry.weightGrams > 0);

                  const diaperInfo = isDiaper ? getDiaperUiInfo(entry.diaper) : null;

                  return (
                    <div
                      key={entry.id}
                      id={`history-entry-${entry.id}`}
                      className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all space-y-2"
                    >
                      {/* Top row: Time + Main content + Badges */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          {/* Time tag */}
                          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                            {entry.time}
                          </span>

                          {/* Milk representation */}
                          {isMilk && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-base">🍼</span>
                              <span className="text-sm font-bold text-slate-900">
                                {entry.milkMl} ml melk
                              </span>
                            </div>
                          )}

                          {/* Solid food representation */}
                          {isSolid && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-base">
                                {entry.solidFoodSubtype === 'Groentepap' ? '🥔' : '🍎'}
                              </span>
                              <span className="text-sm font-bold text-slate-900">
                                {entry.solidFoodGrams} g {entry.solidFoodSubtype || 'vaste voeding'}
                              </span>
                            </div>
                          )}

                          {/* Diaper representation */}
                          {isDiaper && diaperInfo && (
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-xs font-bold px-2 py-0.5 rounded-md border ${diaperInfo.badgeColor}`}
                              >
                                {diaperInfo.icon} {diaperInfo.label}
                              </span>
                            </div>
                          )}

                          {/* Weight representation */}
                          {isWeight && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                ⚖️ {entry.weightGrams?.toLocaleString('nl-BE')} g
                              </span>
                              <span className="text-[11px] text-slate-400">
                                ({(entry.weightGrams! / 1000).toFixed(3).replace('.', ',')} kg)
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Vomited Alert Badge if Ja */}
                        {entry.vomited && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                            <AlertCircle className="w-3 h-3 text-rose-500" />
                            <span>Overgegeven</span>
                          </span>
                        )}
                      </div>

                      {/* Remarks (only shown when not empty) */}
                      {entry.remarks && (
                        <div className="flex items-start gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <MessageSquare className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
                          <p className="italic text-slate-700 leading-snug">{entry.remarks}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
