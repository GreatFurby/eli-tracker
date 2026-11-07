import type { Mode } from '../services/protocol';

export function ConnectionFields({ mode, url, setUrl, code, setCode, lockedUrl }: {
  mode: Mode;
  url: string;
  setUrl: (value: string) => void;
  code: string;
  setCode: (value: string) => void;
  lockedUrl?: boolean;
}) {
  const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-sky-500 read-only:bg-slate-50';
  return (
    <>
      <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
        <span>Link van de Apps Script-web-app</span>
        <input required type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={url} onChange={(event) => setUrl(event.target.value)} readOnly={lockedUrl} placeholder="https://script.google.com/macros/s/…/exec" className={inputClass} />
      </label>
      <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
        <span>{mode === 'controller' ? 'Beheercode voor Kelly' : 'Kijkcode voor Ruben'}</span>
        <input required type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} value={code} onChange={(event) => setCode(event.target.value)} className={inputClass} />
      </label>
    </>
  );
}
