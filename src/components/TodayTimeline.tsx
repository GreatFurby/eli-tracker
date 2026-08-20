import React from 'react';
import { BabyEntry } from '../types';
import { getDiaperUiInfo } from '../utils/normalization';
import { Clock, AlertCircle, PlusCircle, MessageSquare } from 'lucide-react';

interface TodayTimelineProps {
  entries: BabyEntry[];
  onOpenIngave: (category?: 'melk' | 'vaste_voeding' | 'pamper' | 'gewicht') => void;
}

export const TodayTimeline: React.FC<TodayTimelineProps> = ({
  entries,
  onOpenIngave,
}) => {
  // Sort chronological for today's timeline (earliest to latest)
  const sortedChronological = [...entries].sort(
    (a, b) => a.dateTime.getTime() - b.dateTime.getTime()
  );

  return (
    <section id="today-timeline-section" aria-label="Tijdlijn vandaag" className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Tijdlijn vandaag
          </h2>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
            {sortedChronological.length} {sortedChronological.length === 1 ? 'gebeurtenis' : 'gebeurtenissen'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onOpenIngave()}
          className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1 active:scale-95 transition-transform"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Ingave</span>
        </button>
      </div>

      {sortedChronological.length === 0 ? (
        <div
          id="today-empty-state"
          className="p-6 rounded-2xl bg-white border border-dashed border-slate-300 text-center space-y-3"
        >
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 mx-auto flex items-center justify-center text-xl shadow-inner">
            🌱
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Nog geen activiteiten vandaag</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Begin de dag door Eli&apos;s eerste fles, pamper of fruitpapje te registreren.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => onOpenIngave('melk')}
              className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-semibold border border-sky-200 transition-colors"
            >
              🍼 Melk
            </button>
            <button
              type="button"
              onClick={() => onOpenIngave('pamper')}
              className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold border border-amber-200 transition-colors"
            >
              💩 Pamper
            </button>
            <button
              type="button"
              onClick={() => onOpenIngave('vaste_voeding')}
              className="px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-800 text-xs font-semibold border border-orange-200 transition-colors"
            >
              🥣 Vaste voeding
            </button>
          </div>
        </div>
      ) : (
        <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
          {sortedChronological.map((entry, idx) => {
            const isMilk = entry.feedingType === 'Melk' || (entry.milkMl && entry.milkMl > 0);
            const isSolid = entry.feedingType === 'Vaste voeding' || (entry.solidFoodGrams && entry.solidFoodGrams > 0);
            const isDiaper = Boolean(entry.diaper);
            const isWeight = Boolean(entry.weightGrams && entry.weightGrams > 0);

            const diaperInfo = isDiaper ? getDiaperUiInfo(entry.diaper) : null;

            // Dot styling
            let dotBg = 'bg-slate-400';
            let dotEmoji = '•';

            if (isMilk) {
              dotBg = 'bg-sky-500';
              dotEmoji = '🍼';
            } else if (isSolid) {
              dotBg = 'bg-orange-500';
              dotEmoji = entry.solidFoodSubtype === 'Groentepap' ? '🥔' : '🍎';
            } else if (isDiaper) {
              dotBg = 'bg-amber-500';
              dotEmoji = diaperInfo?.icon || '🩲';
            } else if (isWeight) {
              dotBg = 'bg-emerald-500';
              dotEmoji = '⚖️';
            }

            return (
              <div
                key={entry.id || idx}
                id={`timeline-item-${entry.id || idx}`}
                className="relative group"
              >
                {/* Timeline node */}
                <div
                  className={`absolute -left-6 top-3 w-5 h-5 rounded-full ${dotBg} text-white flex items-center justify-center text-[10px] shadow-sm ring-4 ring-slate-50`}
                >
                  <span className="text-[10px]">{dotEmoji}</span>
                </div>

                {/* Timeline card */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                        {entry.time}
                      </span>

                      {/* Main Title / Amount */}
                      {isMilk && (
                        <span className="text-xs font-bold text-slate-800">
                          🍼 {entry.milkMl} ml melk
                        </span>
                      )}

                      {isSolid && (
                        <span className="text-xs font-bold text-slate-800">
                          {entry.solidFoodSubtype === 'Groentepap' ? '🥔' : '🍎'}{' '}
                          {entry.solidFoodGrams} g {entry.solidFoodSubtype || 'vaste voeding'}
                        </span>
                      )}

                      {isDiaper && diaperInfo && (
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-md border ${diaperInfo.badgeColor}`}
                        >
                          {diaperInfo.icon} {diaperInfo.label}
                        </span>
                      )}

                      {isWeight && (
                        <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          ⚖️ {entry.weightGrams?.toLocaleString('nl-BE')} g gewogen
                        </span>
                      )}
                    </div>

                    {/* Vomit Badge */}
                    {entry.vomited && (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200"
                        title="Overgegeven"
                      >
                        <AlertCircle className="w-3 h-3 text-rose-500" />
                        <span>Overgegeven</span>
                      </span>
                    )}
                  </div>

                  {/* Remarks / Notes */}
                  {entry.remarks && (
                    <div className="flex items-start gap-1.5 pt-1 text-xs text-slate-600 bg-slate-50/70 p-2 rounded-xl border border-slate-100">
                      <MessageSquare className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
                      <p className="italic text-slate-700 leading-snug">{entry.remarks}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
