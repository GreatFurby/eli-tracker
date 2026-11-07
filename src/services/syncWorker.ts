import { uploadOperations } from './apiService';
import type { TrackerDatabase } from './localDatabase';

export interface SyncStatus {
  busy: boolean;
  error?: string;
}

export class SyncWorker {
  private running: Promise<void> | undefined;
  private requested = false;
  private failures = 0;
  private retryAt = 0;

  constructor(
    private readonly db: TrackerDatabase,
    private readonly onStatus: (status: SyncStatus) => void,
    private readonly isOnline = () => navigator.onLine,
    private readonly upload = uploadOperations,
  ) {}

  attempt(force = false): Promise<void> {
    if (this.db.mode !== 'controller') return Promise.resolve();
    if (force) this.retryAt = 0;
    if (this.running) {
      this.requested = true;
      return this.running;
    }
    if (!this.isOnline() || Date.now() < this.retryAt) return Promise.resolve();

    this.running = this.run().finally(() => {
      this.running = undefined;
      if (this.requested) {
        this.requested = false;
        void this.attempt();
      }
    });
    return this.running;
  }

  private async run() {
    try {
      // Browsers that lack Web Locks still have a serialized worker in each tab.
      // The Apps Script lock and record revisions handle overlapping tab requests.
      const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
      if (locks) {
        await locks.request(`${this.db.name}-sync`, { ifAvailable: true }, async (lock) => {
          if (lock) await this.drain();
        });
      } else {
        await this.drain();
      }
    } catch (error) {
      this.failures += 1;
      this.retryAt = Date.now() + Math.min(120000, 5000 * 2 ** (this.failures - 1));
      this.onStatus({ busy: false, error: (error as Error).message });
    }
  }

  private async drain() {
    let started = false;
    while (this.isOnline()) {
      const state = await this.db.controllerState();
      if (!state?.ready) break;
      const batch = await this.db.pendingBatch();
      if (!batch.length) {
        this.failures = 0;
        this.retryAt = 0;
        break;
      }
      if (!started) {
        this.onStatus({ busy: true });
        started = true;
      }
      const operations = batch.map(({ seq: _seq, ...operation }) => operation);
      await this.upload(state.connection, state.datasetId, state.installationId, operations);
      await this.db.acknowledge(batch);
    }
    if (started) this.onStatus({ busy: false });
  }
}
