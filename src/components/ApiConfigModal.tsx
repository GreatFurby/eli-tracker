import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Save,
  Trash2,
  HelpCircle,
  Sparkles,
  Sheet,
} from 'lucide-react';
import {
  getActiveApiUrl,
  setCustomApiUrl,
  GOOGLE_SHEET_CONFIG,
  GOOGLE_APPS_SCRIPT_TEMPLATE,
  GOOGLE_APPS_SCRIPT_WEBAPP_URL,
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
  const [copied, setCopied] = useState<boolean>(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState<string>('');
  const [showCode, setShowCode] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Kopiëren mislukt:', err);
    }
  };

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
              Werkblad: <span className="font-semibold">{GOOGLE_SHEET_CONFIG.worksheetName}</span> (11 kolommen)
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

          {/* Quick Setup Instructions Collapsible */}
          <div className="border-t border-slate-100 pt-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-teal-600" />
                Hoe koppel je de Google Sheet in 3 stappen?
              </span>
              <button
                type="button"
                onClick={() => setShowCode(!showCode)}
                className="text-xs text-sky-600 font-semibold hover:underline"
              >
                {showCode ? 'Verberg script' : 'Toon script'}
              </button>
            </div>

            <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside pl-1 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70">
              <li>
                Open je Google Sheet, ga naar <span className="font-semibold text-slate-800">Extensies &gt; Apps Script</span>.
              </li>
              <li>
                Plak onderstaande code in <code className="bg-slate-200 px-1 py-0.5 rounded text-[11px]">Code.gs</code> en klik op 💾 Opslaan.
              </li>
              <li>
                Klik op <span className="font-semibold text-slate-800">Implementeren &gt; Nieuwe implementatie</span>:
                <div className="pl-4 pt-1 text-[11px] text-slate-500 space-y-0.5">
                  <div>• Type: <span className="font-medium text-slate-700">Web-app</span></div>
                  <div>• Uitvoeren als: <span className="font-medium text-slate-700">Ikzelf</span></div>
                  <div>• Wie heeft toegang: <span className="font-medium text-slate-700">Iedereen</span></div>
                </div>
              </li>
              <li>Kopieer de Web-app URL en plak deze hierboven.</li>
            </ol>

            {/* Ready-to-copy code box */}
            {showCode && (
              <div className="space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-500">Code.gs</span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    id="copy-apps-script-btn"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 text-xs font-semibold transition-all"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Gekopieerd!' : 'Kopieer Apps Script Code'}
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48 leading-relaxed">
                  {GOOGLE_APPS_SCRIPT_TEMPLATE}
                </pre>
              </div>
            )}
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
