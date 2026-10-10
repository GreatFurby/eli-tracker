import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Calendar, CheckCircle2, Clock, Loader2, Moon, Plus, Square, X } from 'lucide-react';
import { addSleep, startSleep, stopSleep } from '../services/apiService';
import { SleepSession } from '../types';
import {
  formatDuration,
  formatIsoDateLocal,
  formatLocalTime,
  getActiveSleepSession,
  getSleepMinutes,
  localInputsToDate,
  sleepIntervalsOverlap,
} from '../utils/sleep';

type SleepMode = 'start' | 'stop' | 'add' | null;

interface SleepTrackerProps {
  sleepSessions: SleepSession[];
  onSleepChanged: () => void | Promise<void>;
  isLoading?: boolean;
}

function nowInputs(): { date: string; time: string } {
  const now = new Date();
  return { date: formatIsoDateLocal(now), time: formatLocalTime(now) };
}

/** Sleep controls intentionally live on the existing Ingave screen. */
export const SleepTracker: React.FC<SleepTrackerProps> = ({
  sleepSessions,
  onSleepChanged,
  isLoading = false,
}) => {
  const [mode, setMode] = useState<SleepMode>(null);
  const [startDate, setStartDate] = useState(nowInputs().date);
  const [startTime, setStartTime] = useState(nowInputs().time);
  const [endDate, setEndDate] = useState(nowInputs().date);
  const [endTime, setEndTime] = useState(nowInputs().time);
  const [remarks, setRemarks] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [now, setNow] = useState(() => new Date());

  const activeSession = useMemo(() => getActiveSleepSession(sleepSessions), [sleepSessions]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  const openDialog = (nextMode: Exclude<SleepMode, null>) => {
    const current = nowInputs();
    setErrorMessage('');
    setSuccessMessage('');
    setStartDate(nextMode === 'stop' && activeSession ? formatIsoDateLocal(activeSession.start) : current.date);
    setStartTime(nextMode === 'stop' && activeSession ? formatLocalTime(activeSession.start) : current.time);
    setEndDate(current.date);
    setEndTime(current.time);
    setRemarks(nextMode === 'stop' && activeSession ? activeSession.remarks : '');
    setMode(nextMode);
  };

  const closeDialog = () => {
    if (!isSaving) {
      setMode(null);
      setErrorMessage('');
    }
  };

  const validateInterval = (start: Date, end: Date, ignoredId?: string): string | null => {
    if (end.getTime() <= start.getTime()) {
      return 'De eindtijd moet na de starttijd liggen.';
    }
    if (sleepIntervalsOverlap(start, end, sleepSessions, ignoredId, now)) {
      return 'Deze periode overlapt met een bestaande slaapperiode.';
    }
    return null;
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!mode || isSaving) return;

    const start = localInputsToDate(startDate, startTime);
    const end = localInputsToDate(endDate, endTime);
    if (!start || ((mode === 'stop' || mode === 'add') && !end)) {
      setErrorMessage('Controleer datum en tijd.');
      return;
    }

    let validationError: string | null = null;
    if (mode === 'start') {
      if (activeSession) {
        validationError = 'Er loopt al een slaapperiode. Werk die eerst af.';
      } else if (start.getTime() > now.getTime() + 5 * 60 * 1000) {
        validationError = 'De starttijd kan niet in de toekomst liggen.';
      } else if (sleepIntervalsOverlap(start, now, sleepSessions, undefined, now)) {
        validationError = 'Deze starttijd overlapt met een bestaande slaapperiode.';
      }
    } else if (mode === 'stop') {
      if (!activeSession || !end) {
        validationError = 'Er is geen lopende slaapperiode om te stoppen.';
      } else {
        validationError = validateInterval(activeSession.start, end, activeSession.id);
      }
    } else if (mode === 'add' && end) {
      validationError = validateInterval(start, end);
    }

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    let result;
    if (mode === 'start') {
      result = await startSleep(start, remarks.trim());
    } else if (mode === 'stop' && activeSession && end) {
      result = await stopSleep(activeSession.id, end, remarks.trim());
    } else if (mode === 'add' && end) {
      result = await addSleep(start, end, remarks.trim());
    } else {
      setIsSaving(false);
      return;
    }

    if (!result.success) {
      setErrorMessage(result.error || 'De slaapperiode kon niet worden opgeslagen.');
      setIsSaving(false);
      return;
    }

    try {
      await onSleepChanged();
      setSuccessMessage(
        mode === 'start'
          ? 'Slaap gestart. De andere telefoon wordt bij de volgende synchronisatie bijgewerkt.'
          : mode === 'stop'
            ? 'Slaapperiode opgeslagen.'
            : 'Slaapperiode toegevoegd.',
      );
      window.setTimeout(() => {
        setMode(null);
        setSuccessMessage('');
      }, 900);
    } finally {
      setIsSaving(false);
    }
  };

  const dialogTitle = mode === 'start'
    ? 'Start slaap'
    : mode === 'stop'
      ? 'Stop slaap'
      : 'Slaapperiode toevoegen';

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
              {isLoading ? (
                <p className="text-xs text-slate-500 mt-0.5">Slaapgegevens ophalen…</p>
              ) : activeSession ? (
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
              onClick={() => openDialog('stop')}
              disabled={isLoading}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm active:scale-95 transition-all"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              Stop slaap
            </button>
          ) : (
            <button
              id="start-sleep-button"
              type="button"
              onClick={() => openDialog('start')}
              disabled={isLoading}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm active:scale-95 transition-all"
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
        onClick={() => openDialog('add')}
        disabled={isLoading}
        className="w-full py-2.5 rounded-xl border border-violet-200 bg-white hover:bg-violet-50 disabled:opacity-50 text-violet-800 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
      >
        <Plus className="w-4 h-4" />
        Slaapperiode toevoegen
      </button>

      {(errorMessage || successMessage) && !mode && (
        <div className={`rounded-xl px-3 py-2 text-xs font-medium flex gap-2 ${
          errorMessage ? 'bg-rose-50 border border-rose-200 text-rose-800' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
        }`}>
          {errorMessage ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{errorMessage || successMessage}</span>
        </div>
      )}

      {mode && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleSave}
            className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 p-5 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-200"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
                  <Moon className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{dialogTitle}</h3>
                  <p className="text-[11px] text-slate-500">
                    {mode === 'add' ? 'Voeg een vergeten slaapperiode toe.' : 'Pas datum en tijd aan indien nodig.'}
                  </p>
                </div>
              </div>
              <button type="button" onClick={closeDialog} disabled={isSaving} className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40">
                <X className="w-5 h-5" />
              </button>
            </div>

            {(mode === 'start' || mode === 'add') && (
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Start</label>
                <div className="grid grid-cols-2 gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <label className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><Calendar className="w-3 h-3" /> Datum</span>
                    <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-violet-500" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" /> Tijd</span>
                    <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-violet-500" />
                  </label>
                </div>
              </div>
            )}

            {(mode === 'stop' || mode === 'add') && (
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Einde</label>
                <div className="grid grid-cols-2 gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <label className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><Calendar className="w-3 h-3" /> Datum</span>
                    <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-violet-500" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" /> Tijd</span>
                    <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-violet-500" />
                  </label>
                </div>
              </div>
            )}

            <label className="block space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Opmerking <span className="normal-case font-medium">(optioneel)</span></span>
              <textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} rows={2} placeholder="bijv. in de draagdoek" className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-violet-500" />
            </label>

            {errorMessage && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5 text-xs text-rose-800 font-medium flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            {successMessage && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-xs text-emerald-800 font-medium flex gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-bold shadow-sm flex items-center justify-center gap-2 active:scale-[0.99] transition-all"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {isSaving ? 'Opslaan…' : mode === 'start' ? 'Slaap starten' : mode === 'stop' ? 'Slaap stoppen' : 'Periode toevoegen'}
            </button>
          </form>
        </div>
      )}
    </section>
  );
};
