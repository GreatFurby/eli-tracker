import { liveQuery } from 'dexie';
import { useCallback, useEffect, useRef, useState } from 'react';
import { downloadSnapshot } from './apiService';
import { TrackerDatabase } from './localDatabase';
import { type Mode } from './protocol';
import { SyncWorker, type SyncStatus } from './syncWorker';

export function useTracker(mode: Mode) {
  const [db] = useState(() => new TrackerDatabase(mode));
  const [data, setData] = useState<Awaited<ReturnType<TrackerDatabase['read']>>>();
  const [storageError, setStorageError] = useState(false);
  const [status, setStatus] = useState<SyncStatus>({ busy: false });
  const [online, setOnline] = useState(navigator.onLine);
  const [sync] = useState(() => new SyncWorker(db, setStatus));
  const refreshing = useRef<Promise<void> | null>(null);

  useEffect(() => {
    const subscription = liveQuery(() => db.read()).subscribe({
      next: setData,
      error: () => setStorageError(true),
    });
    return () => subscription.unsubscribe();
  }, [db]);

  const refreshViewer = useCallback(async () => {
    if (refreshing.current) return refreshing.current;
    if (!navigator.onLine) return;
    refreshing.current = (async () => {
      try {
        const previous = await db.viewerState();
        if (!previous) return;
        setStatus({ busy: true });
        const snapshot = await downloadSnapshot(previous.connection);
        await db.cacheViewer(previous.connection, snapshot, previous);
        setStatus({ busy: false });
      } catch (error) {
        setStatus({ busy: false, error: (error as Error).message });
      }
    })().finally(() => { refreshing.current = null; });
    return refreshing.current;
  }, [db]);

  const retry = useCallback((force = false) => {
    if (mode === 'controller') return sync.attempt(force);
    return refreshViewer();
  }, [mode, refreshViewer, sync]);

  useEffect(() => {
    const connectionChanged = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void retry(true);
    };
    const foreground = () => {
      if (document.visibilityState === 'visible') void retry(true);
    };
    window.addEventListener('online', connectionChanged);
    window.addEventListener('offline', connectionChanged);
    document.addEventListener('visibilitychange', foreground);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void retry();
    }, mode === 'controller' ? 10000 : 60000);
    void retry();
    return () => {
      window.removeEventListener('online', connectionChanged);
      window.removeEventListener('offline', connectionChanged);
      document.removeEventListener('visibilitychange', foreground);
      window.clearInterval(timer);
    };
  }, [mode, retry]);

  const pending = data?.pending ?? 0;
  useEffect(() => {
    if (mode === 'controller' && pending) void sync.attempt();
  }, [mode, pending, sync]);

  return { db, data, status, storageError, online, retry, setStatus };
}
