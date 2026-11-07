/**
 * Eli Tracker - Mobile Baby Tracking App
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';
import type { ActiveTab, EntryCategory } from './types';
import type { EntryFields, SleepFields } from './services/localDatabase';
import type { LocalEntry, LocalSleep, Mode } from './services/protocol';
import { useTracker } from './services/useTracker';
import { calculateTodayStats } from './utils/normalization';
import { getActiveSleepSession, getLatestCompletedSleepSession } from './utils/sleep';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { TodaySummaryCards } from './components/TodaySummaryCards';
import { TodayTimeline } from './components/TodayTimeline';
import { EntryForm } from './components/EntryForm';
import { HistoryList } from './components/HistoryList';
import { ApiConfigModal } from './components/ApiConfigModal';
import { SetupPanel } from './components/SetupPanel';
import { SheetDialog } from './components/SheetDialog';
import { SleepForm } from './components/SleepForm';

const GrowthCharts = lazy(() => import('./components/GrowthCharts').then((module) => ({ default: module.GrowthCharts })));

type EditTarget = { kind: 'entry'; record: LocalEntry } | { kind: 'sleep'; record: LocalSleep };

export default function App({ mode }: { mode: Mode }) {
  const { db, data, status, storageError, online, retry, setStatus } = useTracker(mode);
  const [activeTab, setActiveTab] = useState<ActiveTab>('vandaag');
  const [initialCategory, setInitialCategory] = useState<EntryCategory>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editing, setEditing] = useState<EditTarget>();
  const [notice, setNotice] = useState('');
  const [clock, setClock] = useState(0);
  const controller = mode === 'controller';
  const settings = data?.settings;
  const ready = settings?.key === 'controller' ? settings.ready : Boolean(settings);
  const pending = data?.pending ?? 0;
  const now = useMemo(() => new Date(), [clock, data]);

  useEffect(() => {
    const update = () => setClock((tick) => tick + 1);
    const timer = window.setInterval(update, 30000);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const todayStats = useMemo(() => calculateTodayStats(data?.entries ?? [], now), [data?.entries, now]);
  const activeSleep = useMemo(() => getActiveSleepSession(data?.sleeps ?? []), [data?.sleeps]);
  const latestSleep = useMemo(() => getLatestCompletedSleepSession(data?.sleeps ?? []), [data?.sleeps]);

  function selectTab(tab: ActiveTab) {
    setInitialCategory(undefined);
    setActiveTab(tab);
  }

  function quickAdd(category?: EntryCategory) {
    setInitialCategory(category);
    setActiveTab('ingave');
  }

  async function saveEntry(fields: EntryFields, entry?: LocalEntry) {
    await db.saveEntry(fields, entry);
    setNotice('Lokaal opgeslagen');
    void retry();
  }

  async function saveSleep(fields: SleepFields, session?: LocalSleep) {
    await db.saveSleep(fields, session);
    setNotice('Slaap lokaal opgeslagen');
    void retry();
  }

  async function removeRecord(target: EditTarget) {
    await db.deleteRecord(target.kind, target.record);
    setNotice('Lokaal verwijderd');
    void retry();
  }

  function closeEdit() {
    setEditing(undefined);
  }

  const editEntry = controller ? (record: LocalEntry) => setEditing({ kind: 'entry', record }) : undefined;
  const editSleep = controller ? (record: LocalSleep) => setEditing({ kind: 'sleep', record }) : undefined;
  const tabAnimation = { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 }, transition: { duration: 0.18 } };

  let statusLabel = '';
  if (controller) {
    const count = pending === 1 ? '1 wijziging wacht' : `${pending} wijzigingen wachten`;
    statusLabel = !online ? (pending ? `Offline · lokaal opgeslagen · ${count}` : 'Offline · lokale gegevens')
      : pending && status.busy ? `Synchroniseren… · ${count}`
        : pending && status.error ? `Synchronisatie mislukt · ${count}`
          : pending ? count : 'Alles gesynchroniseerd';
  } else if (settings?.key === 'viewer') {
    const last = new Date(settings.refreshedAt).toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' });
    const prefix = !online ? 'Offline · ' : status.error ? 'Vernieuwen mislukt · ' : '';
    statusLabel = `${prefix}Laatst vernieuwd: ${last}`;
  }

  return (
    <div className="min-h-screen bg-slate-100/90 flex flex-col items-center">
      <div className="w-full max-w-md bg-white min-h-screen flex flex-col shadow-xl sm:my-4 sm:min-h-[92vh] sm:rounded-3xl sm:border sm:border-slate-200/90 overflow-hidden relative pb-20">
        <Header mode={mode} isLoading={status.busy} onRefresh={ready ? () => void retry(true) : undefined} onOpenSettings={ready ? () => setSettingsOpen(true) : undefined} />

        {ready && (
          <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-2 text-[11px] text-slate-600">
            <div className="flex items-center justify-between gap-2">
              <p role="status" className="font-semibold">{statusLabel}</p>
              {online && (controller ? pending > 0 : Boolean(status.error)) && !status.busy && (
                <button type="button" onClick={() => void retry(true)} className="shrink-0 font-bold text-sky-700 hover:underline">Opnieuw proberen</button>
              )}
            </div>
            {online && status.error && (!controller || pending > 0) && <p className="mt-0.5 text-amber-800">{status.error}</p>}
          </div>
        )}

        <main className="flex-1 p-4 overflow-y-auto">
          {storageError ? (
            <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-800">
              De lokale opslag kon niet worden geopend. Open Eli Tracker opnieuw in dezelfde browser en hetzelfde profiel.
            </p>
          ) : !data ? (
            <p role="status" className="py-8 text-center text-xs text-slate-500">Lokale gegevens openen…</p>
          ) : !ready ? (
            <SetupPanel db={db} staged={settings?.key === 'controller' ? settings : undefined} />
          ) : (
            <AnimatePresence mode="wait">
              {activeTab === 'vandaag' && (
                <motion.div key="tab-vandaag" {...tabAnimation} className="space-y-4">
                  <TodaySummaryCards
                    stats={todayStats}
                    onQuickAdd={controller ? quickAdd : undefined}
                    activeSleep={activeSleep}
                    latestCompletedSleep={latestSleep}
                    onOpenSleep={controller ? () => quickAdd() : undefined}
                  />
                  <TodayTimeline
                    entries={todayStats.timelineToday}
                    sleepSessions={data.sleeps}
                    now={now}
                    onOpenIngave={controller ? quickAdd : undefined}
                    onEditEntry={editEntry}
                    onEditSleep={editSleep}
                  />
                </motion.div>
              )}

              {controller && activeTab === 'ingave' && (
                <motion.div key="tab-ingave" {...tabAnimation}>
                  <EntryForm
                    initialCategory={initialCategory}
                    onSave={saveEntry}
                    onEntrySaved={() => selectTab('vandaag')}
                    sleepSessions={data.sleeps}
                    onSaveSleep={saveSleep}
                    onCancel={() => selectTab('vandaag')}
                  />
                </motion.div>
              )}

              {activeTab === 'historiek' && (
                <motion.div key="tab-historiek" {...tabAnimation}>
                  <HistoryList entries={data.entries} sleepSessions={data.sleeps} onOpenIngave={controller ? () => quickAdd() : undefined} onEditEntry={editEntry} onEditSleep={editSleep} />
                </motion.div>
              )}

              {activeTab === 'groei' && (
                <motion.div key="tab-groei" {...tabAnimation}>
                  <Suspense fallback={<p role="status" className="text-xs text-slate-500">Grafieken openen…</p>}>
                    <GrowthCharts entries={data.entries} sleepSessions={data.sleeps} />
                  </Suspense>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </main>

        {ready && !storageError && <Navigation activeTab={activeTab} setActiveTab={selectTab} readOnly={!controller} />}
        {notice && (
          <p role="status" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 mx-auto flex w-max items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 shadow-sm">
            <CheckCircle2 className="h-4 w-4" /> {notice}
          </p>
        )}
        {ready && settings && settingsOpen && (
          <ApiConfigModal db={db} state={settings} pending={pending} onClose={() => setSettingsOpen(false)} onSaved={() => {
            setSettingsOpen(false);
            setStatus({ busy: false });
            if (controller) void retry(true);
          }} />
        )}

        {controller && editing?.kind === 'entry' && (
          <SheetDialog title="Registratie bewerken" onClose={closeEdit}>
            <EntryForm editing={editing.record} onSave={(fields) => saveEntry(fields, editing.record)} onEntrySaved={closeEdit} onCancel={closeEdit} onDelete={() => removeRecord(editing)} />
          </SheetDialog>
        )}
        {controller && editing?.kind === 'sleep' && (
          <SleepForm action="edit" session={editing.record} onSave={saveSleep} onDelete={() => removeRecord(editing)} onClose={closeEdit} />
        )}
      </div>
    </div>
  );
}
