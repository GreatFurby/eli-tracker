import {
  PROTOCOL, parseSnapshot, validateConnection,
  type Connection, type Mode, type Snapshot, type SyncOperation,
} from './protocol';

type Result = { protocol?: string; success?: boolean; code?: string; error?: string; [key: string]: unknown };

export class ServerError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
  }
}

async function request(connection: Connection, body: Record<string, unknown>): Promise<Result> {
  const { url, code } = validateConnection(connection.url, connection.code);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      // A CORS-safelisted request works with the Apps Script ContentService redirect.
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
      body: JSON.stringify({ ...body, protocol: PROTOCOL, accessCode: code }),
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data: Result = await response.json();
    if (data?.protocol !== PROTOCOL || typeof data.success !== 'boolean') {
      throw new ServerError('Deze link antwoordt niet als Eli Tracker v2.4. Controleer de Apps Script-implementatie.');
    }
    if (!data.success) {
      throw new ServerError(data.error || 'Google Sheets weigerde de aanvraag.', data.code);
    }
    return data;
  } catch (error) {
    if (error instanceof ServerError) throw error;
    if (error instanceof SyntaxError) {
      throw new ServerError('De web-app gaf geen gegevens terug. Controleer de link en of de implementatie toegankelijk is voor Iedereen.');
    }
    throw new ServerError('Google Sheets is niet bereikbaar. Probeer het opnieuw zodra je verbinding hebt.');
  } finally {
    clearTimeout(timeout);
  }
}

export async function downloadSnapshot(connection: Connection, mode: Mode = 'viewer'): Promise<Snapshot> {
  return parseSnapshot(await request(connection, { action: 'snapshot', mode }));
}

export async function claimController(
  connection: Connection, datasetId: string, installationId: string, tag: string,
): Promise<void> {
  const data = await request(connection, { action: 'claim', datasetId, installationId, tag });
  if (data.datasetId !== datasetId || data.installationId !== installationId) {
    throw new ServerError('De koppeling met Kelly’s telefoon is niet bevestigd.');
  }
}

export async function uploadOperations(
  connection: Connection, datasetId: string, installationId: string, operations: SyncOperation[],
): Promise<void> {
  const data = await request(connection, { action: 'sync', datasetId, installationId, operations });
  if (data.datasetId !== datasetId || !Array.isArray(data.ack) ||
    data.ack.length !== operations.length || !data.ack.every((ack, index) => {
      const op = operations[index];
      return ack && ack.kind === op.kind && ack.id === op.id && ack.revision === op.revision;
    })) {
    throw new ServerError('Google Sheets heeft de wijzigingen niet volledig bevestigd.');
  }
}
