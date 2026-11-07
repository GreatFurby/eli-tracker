import React from 'react';
import type { Mode } from '../services/protocol';
import { RefreshCw, Settings } from 'lucide-react';

interface HeaderProps {
  mode: Mode;
  isLoading: boolean;
  onRefresh?: () => void;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  isLoading,
  onRefresh,
  onOpenSettings,
}) => {
  // Format current date in Dutch
  const today = new Date();
  const days = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
  const months = [
    'januari',
    'februari',
    'maart',
    'april',
    'mei',
    'juni',
    'juli',
    'augustus',
    'september',
    'oktober',
    'november',
    'december',
  ];
  const dayName = days[today.getDay()];
  const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
  const formattedDate = `${capitalizedDay} ${today.getDate()} ${months[today.getMonth()]}`;

  return (
    <header
      id="app-header"
      className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
    >
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Baby Info & Current Date */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-teal-400 p-0.5 shadow-sm flex items-center justify-center text-white font-bold text-lg tracking-tight">
            👶
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none">
                Eli
              </h1>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${mode === 'controller'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-sky-50 text-sky-700 border-sky-200'}`}>
                {mode === 'controller' ? 'Beheer' : 'Kijkversie'}
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500 mt-0.5 capitalize">
              {formattedDate}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          {onRefresh && <button
            id="header-refresh-btn"
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className={`p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95 transition-all focus:outline-none ${
              isLoading ? 'opacity-70 cursor-wait' : ''
            }`}
            title={mode === 'controller' ? 'Synchroniseren' : 'Gegevens vernieuwen'}
            aria-label={mode === 'controller' ? 'Synchroniseren' : 'Gegevens vernieuwen'}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-sky-600' : ''}`} />
          </button>}

          {onOpenSettings && <button
            id="header-settings-btn"
            type="button"
            onClick={onOpenSettings}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95 transition-all focus:outline-none"
            title="Google Sheets Instellingen"
            aria-label="Google Sheets Instellingen"
          >
            <Settings className="w-4 h-4 text-emerald-600" />
          </button>}
        </div>
      </div>
    </header>
  );
};
