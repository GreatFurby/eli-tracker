import React from 'react';
import { ActiveTab } from '../types';
import { Home, PlusCircle, History, TrendingUp } from 'lucide-react';

interface NavigationProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => {
  const tabs = [
    {
      id: 'vandaag' as ActiveTab,
      label: 'Vandaag',
      icon: Home,
      accent: 'text-sky-600',
    },
    {
      id: 'ingave' as ActiveTab,
      label: 'Ingave',
      icon: PlusCircle,
      accent: 'text-teal-600',
      highlight: true,
    },
    {
      id: 'historiek' as ActiveTab,
      label: 'Historiek',
      icon: History,
      accent: 'text-indigo-600',
    },
    {
      id: 'groei' as ActiveTab,
      label: 'Groei',
      icon: TrendingUp,
      accent: 'text-emerald-600',
    },
  ];

  return (
    <nav
      id="bottom-navigation"
      aria-label="Hoofdnavigatie"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-[0_-4px_16px_rgba(0,0,0,0.04)]"
    >
      <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          if (tab.highlight) {
            return (
              <button
                key={tab.id}
                id={`nav-btn-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                type="button"
                className="relative -top-4 flex flex-col items-center group focus:outline-none"
              >
                <div
                  className={`w-13 h-13 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 ${
                    isActive
                      ? 'bg-gradient-to-tr from-teal-600 to-sky-500 text-white ring-4 ring-teal-50 shadow-teal-500/25'
                      : 'bg-gradient-to-tr from-teal-500 to-sky-400 text-white shadow-teal-500/20 hover:brightness-105'
                  }`}
                >
                  <Icon className="w-6 h-6 stroke-[2.5]" />
                </div>
                <span
                  className={`text-[11px] font-semibold tracking-tight mt-1 transition-colors ${
                    isActive ? 'text-teal-700' : 'text-slate-600'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              id={`nav-btn-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              type="button"
              className={`flex flex-col items-center justify-center flex-1 h-full py-1.5 transition-all active:scale-95 focus:outline-none ${
                isActive ? 'text-sky-700 font-semibold' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 stroke-[2.3]' : 'stroke-[1.8]'}`} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-sky-600" />
                )}
              </div>
              <span className={`text-[11px] mt-1 transition-colors ${isActive ? 'font-semibold text-sky-700' : 'font-normal'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
      {/* Mobile Safe Area Padding */}
      <div className="h-[env(safe-area-inset-bottom,0px)] bg-white" />
    </nav>
  );
};
