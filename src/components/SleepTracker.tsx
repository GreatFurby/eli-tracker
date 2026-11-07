import React, { useEffect, useMemo, useState } from 'react';
import { Moon, Plus, Square } from 'lucide-react';
import type { SleepFields } from '../services/localDatabase';
import type { LocalSleep } from '../services/protocol';
import { formatDuration, formatLocalTime, getActiveSleepSession, getSleepMinutes } from '../utils/sleep';
import { SleepForm, type SleepAction } from './SleepForm';

interface SleepTrackerProps {
  sleepSessions: LocalSleep[];
  onSave: (fields: SleepFields, session?: LocalSleep) => Promise<void>;
}

export const SleepTracker: React.FC<SleepTrackerProps> = ({ sleepSessions, onSave }) => {
  const [action, setAction] = useState<Exclude<SleepAction, 'edit'> | null>(null);
  const [now, setNow] = useState(() => new Date());
  const activeSession = useMemo(() => getActiveSleepSession(sleepSessions), [sleepSessions]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <section id="sleep-tracker" className="space-y-2.5">
      <div className={`rounded-2xl border p-4 shadow-sm ${
        activeSession
          ? 'border-indigo-200 bg-gradient-to-br from-indigo-50 via-violet-50 to-white'
          : 'border-violet-100 bg-gradient-to-br from-violet-50/70 to-white'
      }`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              activeSession ? 'bg-indigo-600 text-white shadow-indigo-200 shadow-md' : 'bg-violet-100 text-violet-700'
            }`}>
              <Moon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900">Slaap</h2>
              {activeSession ? (
                <>
                  <p className="text-xs font-semibold text-indigo-800 mt-0.5">Eli slaapt nu</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Sinds {formatLocalTime(activeSession.start)} · {formatDuration(getSleepMinutes(activeSession, now))}
                  </p>
                </>
              ) : (
                <p className="text-xs text-slate-500 mt-0.5">Geen lopende slaapperiode</p>
              )}
            </div>
          </div>

          {activeSession ? (
            <button
              id="stop-sleep-button"
              type="button"
              onClick={() => setAction('stop')}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm active:scale-95 transition-all"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              Stop slaap
            </button>
          ) : (
            <button
              id="start-sleep-button"
              type="button"
              onClick={() => setAction('start')}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shadow-sm active:scale-95 transition-all"
            >
              <Moon className="w-3.5 h-3.5" />
              Start slaap
            </button>
          )}
        </div>

        {activeSession?.remarks && (
          <p className="mt-3 text-[11px] text-indigo-900 bg-white/70 border border-indigo-100 rounded-xl px-2.5 py-2 italic">
            {activeSession.remarks}
          </p>
        )}
      </div>

      <button
        id="add-sleep-button"
        type="button"
        onClick={() => setAction('add')}
        className="w-full py-2.5 rounded-xl border border-violet-200 bg-white hover:bg-violet-50 text-violet-800 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
      >
        <Plus className="w-4 h-4" />
        Slaapperiode toevoegen
      </button>


      {action && (action !== 'stop' || activeSession) && (
        <SleepForm action={action} session={action === 'stop' ? activeSession : undefined} onSave={onSave} onClose={() => setAction(null)} />
      )}
    </section>
  );
};
