import { useState, type FormEvent } from 'react';
import { AlertCircle, Calendar, CheckCircle2, Clock, Loader2, Moon, X } from 'lucide-react';
import type { SleepFields } from '../services/localDatabase';
import type { LocalSleep } from '../services/protocol';
import { formatIsoDateLocal, formatLocalTime, localInputsToDate } from '../utils/sleep';
import { SheetDialog } from './SheetDialog';

export type SleepAction = 'start' | 'stop' | 'add' | 'edit';

interface SleepFormProps {
  action: SleepAction;
  session?: LocalSleep;
  onSave: (fields: SleepFields, session?: LocalSleep) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

function DateTimeInputs({ label, date, time, setDate, setTime }: {
  label: string; date: string; time: string;
  setDate: (value: string) => void; setTime: (value: string) => void;
}) {
  const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-violet-500';
  return (
    <fieldset className="space-y-2">
      <legend className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</legend>
      <div className="grid grid-cols-2 gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
        <label className="space-y-1">
          <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><Calendar className="w-3 h-3" /> Datum</span>
          <input aria-label={`${label}datum`} type="date" value={date} onChange={(event) => setDate(event.target.value)} required className={inputClass} />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" /> Tijd</span>
          <input aria-label={`${label}tijd`} type="time" value={time} onChange={(event) => setTime(event.target.value)} required className={inputClass} />
        </label>
      </div>
    </fieldset>
  );
}

function readTime(date: string, time: string, original: Date | undefined) {
  if (original && date === formatIsoDateLocal(original) && time === formatLocalTime(original)) return original;
  return localInputsToDate(date, time);
}

export function SleepForm({ action, session: target, onSave, onDelete, onClose }: SleepFormProps) {
  const [session] = useState(target);
  const [openedAt] = useState(() => new Date());
  const [startDate, setStartDate] = useState(() => formatIsoDateLocal(session?.start ?? openedAt));
  const [startTime, setStartTime] = useState(() => formatLocalTime(session?.start ?? openedAt));
  const [endDate, setEndDate] = useState(() => formatIsoDateLocal(session?.end ?? openedAt));
  const [endTime, setEndTime] = useState(() => formatLocalTime(session?.end ?? openedAt));
  const [ongoing, setOngoing] = useState(action === 'start' || (action === 'edit' && !session?.end));
  const [remarks, setRemarks] = useState(session?.remarks ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const labels = {
    start: ['Start slaap', 'Slaap starten'],
    stop: ['Stop slaap', 'Slaap stoppen'],
    add: ['Slaapperiode toevoegen', 'Periode toevoegen'],
    edit: ['Slaapperiode bewerken', 'Opslaan'],
  };
  const [title, submitLabel] = labels[action];

  async function commit(change: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await change();
      onClose();
    } catch (cause) {
      setError((cause as Error).message || 'De slaapperiode kon niet worden opgeslagen.');
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const start = readTime(startDate, startTime, session?.start ?? (action === 'start' ? openedAt : undefined));
    const end = ongoing ? null : readTime(endDate, endTime, session?.end ?? (action === 'stop' ? openedAt : undefined));
    if (!start || (!ongoing && !end)) {
      setError('Controleer datum en tijd.');
      return;
    }
    void commit(() => onSave({ start, end, remarks }, session));
  }

  return (
    <SheetDialog title={title} onClose={busy ? undefined : onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center"><Moon className="w-5 h-5" /></div>
            <h3 className="text-base font-bold">{title}</h3>
          </div>
          <button type="button" aria-label="Sluiten" disabled={busy} onClick={onClose} className="p-2 rounded-full text-slate-400 hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>

        {action !== 'stop' && <DateTimeInputs label="Start" date={startDate} time={startTime} setDate={setStartDate} setTime={setStartTime} />}
        {action === 'edit' && (
          <label className="flex items-center gap-2 text-xs font-semibold text-indigo-800">
            <input type="checkbox" checked={ongoing} onChange={(event) => setOngoing(event.target.checked)} className="accent-indigo-600" />
            Slaap loopt nog
          </label>
        )}
        {!ongoing && <DateTimeInputs label="Eind" date={endDate} time={endTime} setDate={setEndDate} setTime={setEndTime} />}

        <label className="block space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Opmerking <span className="normal-case font-medium">(optioneel)</span></span>
          <textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} rows={2} maxLength={50000} placeholder="bijv. in de draagdoek" className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-violet-500" />
        </label>

        {error && (
          <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5 text-xs text-rose-800 font-medium flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-bold shadow-sm flex items-center justify-center gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {busy ? 'Opslaan…' : submitLabel}
        </button>
        {onDelete && (
          <button type="button" disabled={busy} onClick={() => {
            if (window.confirm('Deze slaapperiode verwijderen?')) void commit(onDelete);
          }} className="w-full rounded-xl py-2 text-xs font-bold text-rose-700 hover:bg-rose-50">Verwijderen</button>
        )}
      </form>
    </SheetDialog>
  );
}
