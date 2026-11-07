import { useState, type FormEvent } from 'react';
import { Download, X } from 'lucide-react';
import { downloadSnapshot } from '../services/apiService';
import type { ControllerState, TrackerDatabase, ViewerState } from '../services/localDatabase';
import { validateConnection } from '../services/protocol';
import { ConnectionFields } from './ConnectionFields';
import { SheetDialog } from './SheetDialog';

export function ApiConfigModal({ db, state, onClose, onSaved, pending }: {
  db: TrackerDatabase;
  state: ControllerState | ViewerState;
  onClose: () => void;
  onSaved: () => void;
  pending: number;
}) {
  const controller = state.key === 'controller';
  const [url, setUrl] = useState(state.connection.url);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const connection = validateConnection(url, code);
      if (controller) {
        await db.changeControllerCode(connection.code);
      } else {
        const snapshot = await downloadSnapshot(connection);
        await db.cacheViewer(connection, snapshot);
      }
      onSaved();
    } catch (cause) {
      setError((cause as Error).message || 'De instellingen konden niet worden opgeslagen.');
    } finally {
      setBusy(false);
    }
  }

  async function exportBackup() {
    setBusy(true);
    setError('');
    try {
      const backup = await db.backup();
      const objectUrl = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `Eli-Tracker-backup-${backup.exportedAt.slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    } catch (cause) {
      setError((cause as Error).message || 'De back-up kon niet worden geëxporteerd.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SheetDialog title="Google Sheets-instellingen" onClose={busy ? undefined : onClose}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">Google Sheets-instellingen</h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Sluiten" className="rounded-full p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-xs text-slate-600">{controller
          ? 'Gebruik dit scherm als de beheercode is gewijzigd. Je lokale gegevens blijven op deze telefoon.'
          : 'Hier kan je de link of kijkcode opnieuw instellen.'}</p>
        <form onSubmit={save} className="space-y-3">
          <ConnectionFields mode={state.key} url={url} setUrl={setUrl} code={code} setCode={setCode} lockedUrl={controller} />
          <button type="submit" disabled={busy} className="w-full rounded-xl bg-sky-600 py-2.5 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-60">
            Instellingen opslaan
          </button>
        </form>
        {controller && (
          <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
            <p>{pending} {pending === 1 ? 'wijziging wacht' : 'wijzigingen wachten'} op synchronisatie.</p>
            <button type="button" disabled={busy} onClick={() => void exportBackup()} className="flex items-center gap-1.5 font-bold text-sky-700 disabled:opacity-60">
              <Download className="h-4 w-4" /> Lokale back-up downloaden
            </button>
            <p>Bewaar het bestand privé. De back-up bevat ook wijzigingen die nog wachten op synchronisatie.</p>
          </div>
        )}
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-800">{error}</p>}
      </div>
    </SheetDialog>
  );
}
