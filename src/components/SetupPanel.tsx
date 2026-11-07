import { useState, type FormEvent } from 'react';
import { Database, Download, Loader2 } from 'lucide-react';
import { getPreviousApiUrl } from '../config/apiConfig';
import { claimController, downloadSnapshot } from '../services/apiService';
import type { ControllerState, TrackerDatabase } from '../services/localDatabase';
import { validateConnection, type Connection, type Snapshot } from '../services/protocol';
import { formatBelgianDate, formatTemperatureCelsius } from '../utils/normalization';
import { formatIsoDateLocal, formatLocalTime } from '../utils/sleep';
import { ConnectionFields } from './ConnectionFields';

const primaryButton = 'w-full flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-60';

export function SetupPanel({ db, staged }: { db: TrackerDatabase; staged?: ControllerState }) {
  const mode = db.mode;
  const controller = mode === 'controller';
  const [url, setUrl] = useState(() => staged?.connection.url ?? getPreviousApiUrl());
  const [code, setCode] = useState(staged?.connection.code ?? '');
  const [preview, setPreview] = useState<{ connection: Connection; snapshot: Snapshot }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (cause) {
      setError((cause as Error).message || 'De gegevens konden niet worden ingesteld. Probeer opnieuw.');
    } finally {
      setBusy(false);
    }
  }

  async function activate(state: ControllerState) {
    await claimController(state.connection, state.datasetId, state.installationId, state.tag);
    await db.finishController(state);
  }

  function download(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    void run(async () => {
      const connection = validateConnection(url, code);
      const snapshot = await downloadSnapshot(connection, mode);
      if (controller) {
        setPreview({ connection, snapshot });
      } else {
        await db.cacheViewer(connection, snapshot);
      }
    });
  }

  function confirmImport() {
    if (!preview || busy) return;
    void navigator.storage?.persist?.().catch(() => undefined);
    void run(async () => {
      const state = await db.stageController(preview.connection, preview.snapshot);
      await activate(state);
    });
  }

  const snapshot = preview?.snapshot;
  const sampleEntries = snapshot
    ? [...snapshot.entries].sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime())
    : [];
  const samples = sampleEntries.length > 1 ? [sampleEntries[0], sampleEntries.at(-1)!] : sampleEntries;
  const recentSleep = snapshot
    ? [...snapshot.sleeps].sort((a, b) => b.start.getTime() - a.start.getTime())[0]
    : undefined;

  return (
    <section className="mx-auto max-w-sm space-y-4 rounded-3xl border border-sky-100 bg-sky-50/60 p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-sky-100 p-2.5 text-sky-700"><Database className="h-5 w-5" /></div>
        <h2 className="text-base font-bold">{controller ? 'Geen lokale gegevens gevonden' : 'Kijkversie instellen'}</h2>
      </div>
      <p className="text-xs leading-relaxed text-slate-600">
        {controller
          ? 'Download de bestaande gegevens uit Google Sheets om Kelly’s telefoon in te stellen of te herstellen. Controleer de aantallen en voorbeelden vóór je bevestigt.'
          : 'Koppel de kijkversie aan Google Sheets. Na de eerste download kan je de laatst opgehaalde gegevens ook offline bekijken.'}
      </p>

      {snapshot ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-sky-100 bg-white p-3.5 text-xs leading-relaxed text-slate-700">
            <p className="font-bold">{snapshot.entries.length} {snapshot.entries.length === 1 ? 'registratie' : 'registraties'} · {snapshot.sleeps.length} {snapshot.sleeps.length === 1 ? 'slaapperiode' : 'slaapperiodes'}</p>
            {snapshot.sleeps.some((session) => !session.end) && <p>Inclusief lopende slaap.</p>}
            {!snapshot.entries.length && !snapshot.sleeps.length && (
              <p className="mt-2 font-semibold text-amber-800">De gekoppelde tabbladen zijn leeg. Controleer of dit het juiste werkblad is.</p>
            )}
            {samples.map((entry) => (
              <p key={entry.id} className="mt-2 break-words">
                {formatBelgianDate(entry.date)} om {entry.time}
                {entry.milkMl !== null && ` · ${entry.milkMl} ml`}
                {entry.diaper && ` · ${entry.diaper}`}
                {entry.weightGrams !== null && ` · ${entry.weightGrams} g gewicht`}
                {entry.solidFoodGrams !== null && ` · ${entry.solidFoodGrams} g ${entry.solidFoodSubtype || 'vaste voeding'}`}
                {entry.temperatureCelsius !== null && ` · ${formatTemperatureCelsius(entry.temperatureCelsius)}`}
                {entry.remarks && ` · ${entry.remarks.slice(0, 120)}`}
              </p>
            ))}
            {recentSleep && (
              <p className="mt-2">
                Laatste slaap: {formatBelgianDate(formatIsoDateLocal(recentSleep.start))} om {formatLocalTime(recentSleep.start)}
                {recentSleep.end ? ` tot ${formatBelgianDate(formatIsoDateLocal(recentSleep.end))} om ${formatLocalTime(recentSleep.end)}` : ' · loopt nog'}
              </p>
            )}
          </div>
          <button type="button" onClick={confirmImport} disabled={busy} className={primaryButton}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Gegevens bevestigen en activeren
          </button>
          <button type="button" disabled={busy} onClick={() => { setPreview(undefined); setError(''); }} className="w-full py-2 text-xs font-bold text-sky-700">
            Terug naar downloaden
          </button>
        </div>
      ) : (
        <form onSubmit={download} className="space-y-3">
          <ConnectionFields mode={mode} url={url} setUrl={setUrl} code={code} setCode={setCode} />
          <button type="submit" disabled={busy} className={primaryButton}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Downloaden uit Google Sheets
          </button>
          {staged && (
            <button type="button" disabled={busy} onClick={() => void run(() => activate(staged))} className="w-full py-2 text-xs font-bold text-sky-700">
              Eerdere koppeling voltooien
            </button>
          )}
        </form>
      )}
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-800">{error}</p>}
      {!controller && (
        <a href="?mode=controller" className="block text-center text-xs font-semibold text-sky-700 underline underline-offset-2">
          Beheerversie voor Kelly openen
        </a>
      )}
    </section>
  );
}
