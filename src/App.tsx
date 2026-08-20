/**
 * Eli Tracker - Mobile Baby Tracking App
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ActiveTab, BabyEntry, EntryCategory } from './types';
import { fetchAllEntries } from './services/apiService';
import { calculateTodayStats } from './utils/normalization';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { TodaySummaryCards } from './components/TodaySummaryCards';
import { TodayTimeline } from './components/TodayTimeline';
import { EntryForm } from './components/EntryForm';
import { HistoryList } from './components/HistoryList';
import { GrowthCharts } from './components/GrowthCharts';
import { ApiConfigModal } from './components/ApiConfigModal';
import { AlertCircle, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('vandaag');
  const [entries, setEntries] = useState<BabyEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDemo, setIsDemo] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [initialCategory, setInitialCategory] = useState<EntryCategory | undefined>(undefined);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // Load entries from API or demo dataset
  const loadData = useCallback(async (isSilent: boolean = false) => {
    if (!isSilent) {
      setIsLoading(true);
    }
    setErrorMessage('');

    const res = await fetchAllEntries();

    if (res.success && res.data) {
      setEntries(res.data);
      setIsDemo(Boolean(res.isDemo));
      setLastRefreshedAt(new Date());
    } else {
      setErrorMessage(
        res.error ||
          'Kon de gegevens niet laden. Controleer je internetverbinding en probeer opnieuw.'
      );
    }

    setIsLoading(false);
  }, []);

  // Initial load
  useEffect(() => {
    loadData();

    // Auto-refresh when tab becomes visible (sync for both parents on their phones)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData(true);
      }
    };

    // Periodic background sync every 60 seconds
    const interval = setInterval(() => {
      loadData(true);
    }, 60000);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [loadData]);

  // Compute live stats for today
  const todayStats = useMemo(() => {
    return calculateTodayStats(entries);
  }, [entries]);

  // Quick Action Jump to Ingave with preselected category
  const handleQuickAdd = (category?: EntryCategory) => {
    setInitialCategory(category);
    setActiveTab('ingave');
  };

  // Called after a new record is saved
  const handleEntrySaved = () => {
    loadData(true);
    setActiveTab('vandaag');
    setInitialCategory(undefined);
  };

  return (
    <div className="min-h-screen bg-slate-100/90 flex flex-col items-center">
      {/* Mobile Shell Wrapper (max-w-md on desktop with subtle shadow for clean app feel) */}
      <div className="w-full max-w-md bg-white min-h-screen flex flex-col shadow-xl sm:my-4 sm:min-h-[92vh] sm:rounded-3xl sm:border sm:border-slate-200/90 overflow-hidden relative pb-20">
        {/* Top App Header */}
        <Header
          isDemo={isDemo}
          isLoading={isLoading}
          onRefresh={() => loadData(false)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Demo Mode Notification Banner (Subtle and informative) */}
        {isDemo && (
          <div
            id="demo-mode-alert"
            onClick={() => setIsSettingsOpen(true)}
            role="button"
            tabIndex={0}
            className="bg-gradient-to-r from-amber-500 to-teal-600 text-white px-4 py-1.5 text-xs font-semibold flex items-center justify-between shadow-xs cursor-pointer hover:brightness-105 transition-all"
          >
            <div className="flex items-center gap-1.5 truncate">
              <Sparkles className="w-3.5 h-3.5 shrink-0 animate-pulse" />
              <span className="truncate">Demo modus actief: Klik om Google Sheet te koppelen</span>
            </div>
            <span className="text-[11px] underline font-bold shrink-0 ml-2">Instellen</span>
          </div>
        )}

        {/* Network / Load Error Banner with Retry */}
        {errorMessage && (
          <div
            id="error-banner"
            className="m-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 flex items-start justify-between gap-3 animate-in fade-in"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-rose-900">Verbindingsfout</div>
                <div className="text-[11px] mt-0.5 leading-snug">{errorMessage}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => loadData(false)}
              className="px-2.5 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-[11px] hover:bg-rose-700 active:scale-95 transition-all shrink-0"
            >
              Opnieuw
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-4 overflow-y-auto">
          <AnimatePresence mode="wait">
            {/* 1. VANDAAG TAB */}
            {activeTab === 'vandaag' && (
              <motion.div
                key="tab-vandaag"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
                <TodaySummaryCards
                  stats={todayStats}
                  onQuickAdd={handleQuickAdd}
                />
                <TodayTimeline
                  entries={todayStats.timelineToday}
                  onOpenIngave={handleQuickAdd}
                />
              </motion.div>
            )}

            {/* 2. INGAVE TAB */}
            {activeTab === 'ingave' && (
              <motion.div
                key="tab-ingave"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                <EntryForm
                  initialCategory={initialCategory}
                  onEntrySaved={handleEntrySaved}
                  onCancel={() => {
                    setInitialCategory(undefined);
                    setActiveTab('vandaag');
                  }}
                />
              </motion.div>
            )}

            {/* 3. HISTORIEK TAB */}
            {activeTab === 'historiek' && (
              <motion.div
                key="tab-historiek"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                <HistoryList
                  entries={entries}
                  onOpenIngave={() => handleQuickAdd()}
                />
              </motion.div>
            )}

            {/* 4. GROEI TAB */}
            {activeTab === 'groei' && (
              <motion.div
                key="tab-groei"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                <GrowthCharts entries={entries} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Bottom Navigation */}
        <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Google Apps Script & Sheets Configuration Modal */}
        <ApiConfigModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onConfigSaved={() => loadData(false)}
        />
      </div>
    </div>
  );
}
