import React, { useState } from 'react';
import {
  X,
  ExternalLink,
  Save,
  Trash2,
  Info,
  Sheet,
} from 'lucide-react';
import {
  getActiveApiUrl,
  setCustomApiUrl,
  GOOGLE_SHEET_CONFIG,
} from '../config/apiConfig';

interface ApiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: () => void;
}

export const ApiConfigModal: React.FC<ApiConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const [urlInput, setUrlInput] = useState<string>(() => getActiveApiUrl());
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState<string>('');

  if (!isOpen) return null;

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = urlInput.trim();

    if (!cleanUrl) {
      setCustomApiUrl('');
      setTestStatus('idle');
      setTestMessage('Teruggezet naar demo data.');
      onConfigSaved();
      setTimeout(onClose, 800);
      return;
    }

    setTestStatus('testing');
    setTestMessage('Verbinding testen met Google Apps Script...');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(cleanUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      if (data && data.status === 'error') {
        throw new Error(data.message || 'Apps script rapporteerde een fout');
      }

      setCustomApiUrl(cleanUrl);
      setTestStatus('success');
      setTestMessage(
        `Verbinding geslaagd! ${data.count ?? (Array.isArray(data) ? data.length : 'Data')} rijen geladen.`
      );
      onConfigSaved();
      setTimeout(onClose, 1200);
    } catch (err: any) {
      console.warn('Verbindingstest mislukt:', err);
      // Even if CORS blocks raw GET in browser during test, save url
      setCustomApiUrl(cleanUrl);
      setTestStatus('error');
      setTestMessage(
        'URL opgeslagen. Let op: Zorg dat je Web App is ingesteld op "Anyone" (Iedereen).'
      );
      onConfigSaved();
    }
  };

  const handleResetToDemo = () => {
    setUrlInput('');
    setCustomApiUrl('');
    setTestStatus('idle');
    setTestMessage('Demo modus hersteld.');
    onConfigSaved();
    setTimeout(onClose, 500);
  };

  return (
    <div
      id="api-config-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
    >
      <div
        id="api-config-modal-content"
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in slide-in-from-bottom-6 duration-200"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Sheet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Google Sheet Koppeling</h2>
              <p className="text-xs text-slate-500">Gedeelde database voor beide ouders</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm text-slate-600">
          {/* Sheet Target Summary Card */}
          <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-100 text-xs space-y-1">
            <div className="font-semibold text-sky-900 flex items-center justify-between">
              <span>Bestaande Google Sheet</span>
              <a
                href={`https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_CONFIG.spreadsheetId}/edit`}
                target="_blank"
                rel="noreferrer"
                className="text-sky-700 hover:underline flex items-center gap-1"
              >
                Openen <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-sky-800/80 font-mono text-[11px] break-all">
              ID: {GOOGLE_SHEET_CONFIG.spreadsheetId}
            </p>
            <p className="text-sky-800/80">
              Werkbladen: <span className="font-semibold">{GOOGLE_SHEET_CONFIG.worksheetName}</span> + <span className="font-semibold">{GOOGLE_SHEET_CONFIG.sleepWorksheetName}</span>
            </p>
          </div>

          {/* URL Input Form */}
          <form onSubmit={handleTestAndSave} className="space-y-3">
            <div>
              <label htmlFor="gas-url-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Google Apps Script Web App URL
              </label>
              <input
                id="gas-url-input"
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs font-mono focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all placeholder:text-slate-400 bg-white"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Laat leeg om de app te testen met realistische demo data.
              </p>
            </div>

            {testMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-medium ${
                  testStatus === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : testStatus === 'error'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {testMessage}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                id="save-api-config-btn"
                disabled={testStatus === 'testing'}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-medium text-xs shadow-sm transition-all"
              >
                <Save className="w-4 h-4" />
                {testStatus === 'testing' ? 'Verbinding testen...' : 'Opslaan & Verifiëren'}
              </button>

              {urlInput && (
                <button
                  type="button"
                  onClick={handleResetToDemo}
                  className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs transition-colors"
                  title="Herstel naar Demo Modus"
                >
                  <Trash2 className="w-4 h-4 text-slate-500" />
                </button>
              )}
            </div>
          </form>

          <div className="border-t border-slate-100 pt-4">
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5"><Info className="w-4 h-4" /> API v2.1 is al ingesteld</div>
              <p>Gebruik hier enkel de bestaande Eli Tracker API v2.1-URL. De oude kopieerbare Apps Script-code is bewust verborgen, zodat slaaptracking niet per ongeluk door een verouderd script wordt overschreven.</p>
              <p className="text-amber-800/85">Let op: de Apps Script-webapp is publiek bereikbaar voor wie de URL kent. Deel de URL dus niet buiten jullie twee.</p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-200/80 hover:bg-slate-300 active:bg-slate-400 text-slate-800 font-semibold text-xs transition-colors"
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
};
