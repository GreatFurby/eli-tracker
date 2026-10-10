import React, { useState, useMemo } from 'react';
import { BabyEntry, SleepSession } from '../types';
import { formatBelgianDate } from '../utils/normalization';
import { buildDailySummaries, formatDuration } from '../utils/sleep';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Area,
  AreaChart,
} from 'recharts';
import { Moon } from 'lucide-react';

interface GrowthChartsProps {
  entries: BabyEntry[];
  sleepSessions: SleepSession[];
}

type GrowthTab = 'gewicht' | 'melk' | 'vaste_voeding' | 'ontwikkeling' | 'slaap' | 'pampers';

export const GrowthCharts: React.FC<GrowthChartsProps> = ({ entries, sleepSessions }) => {
  const [activeSubTab, setActiveSubTab] = useState<GrowthTab>('gewicht');

  // ==========================================
  // 1. WEIGHT DATA COMPUTATION
  // ==========================================
  const weightData = useMemo(() => {
    // Filter all entries with weight > 0
    const weightEntries = entries
      .filter((e) => e.weightGrams !== null && e.weightGrams > 0)
      .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime()); // Chronological from birth

    if (weightEntries.length === 0) return [];

    return weightEntries.map((e, index) => {
      const prev = index > 0 ? weightEntries[index - 1] : null;
      const diff = prev ? (e.weightGrams || 0) - (prev.weightGrams || 0) : 0;
      return {
        dateIso: e.date,
        formattedDate: formatBelgianDate(e.date),
        weightGrams: e.weightGrams,
        weightKg: Number(((e.weightGrams || 0) / 1000).toFixed(3)),
        diff,
        remarks: e.remarks || '',
      };
    });
  }, [entries]);

  const weightStats = useMemo(() => {
    if (weightData.length === 0) return null;
    const first = weightData[0];
    const latest = weightData[weightData.length - 1];
    const totalGain = (latest.weightGrams || 0) - (first.weightGrams || 0);

    const prev = weightData.length > 1 ? weightData[weightData.length - 2] : null;
    const diffLast = prev ? (latest.weightGrams || 0) - (prev.weightGrams || 0) : null;

    return {
      birthWeightGrams: first.weightGrams,
      currentWeightGrams: latest.weightGrams,
      currentWeightKg: latest.weightKg,
      totalGainGrams: totalGain,
      diffLast,
      lastDate: latest.formattedDate,
    };
  }, [weightData]);

  // ==========================================
  // 2. DAILY MILK DATA COMPUTATION
  // ==========================================
  const dailyMilkData = useMemo(() => {
    // Group all milk feedings by date
    const dayMap: { [dateIso: string]: { totalMl: number; count: number } } = {};

    entries.forEach((e) => {
      // Historical compatibility: milk if feedingType == 'Melk' OR (e.milkMl > 0)
      if ((e.feedingType === 'Melk' || (e.milkMl && e.milkMl > 0)) && e.milkMl) {
        if (!dayMap[e.date]) {
          dayMap[e.date] = { totalMl: 0, count: 0 };
        }
        dayMap[e.date].totalMl += e.milkMl;
        dayMap[e.date].count += 1;
      }
    });

    const dates = Object.keys(dayMap).sort();
    // Return last 21 recorded days for mobile clarity
    const recentDates = dates.slice(-21);

    return recentDates.map((dateIso) => ({
      dateIso,
      displayDate: formatBelgianDate(dateIso).substring(0, 5), // DD/MM
      totalMl: dayMap[dateIso].totalMl,
      count: dayMap[dateIso].count,
      avgPerFeed: Math.round(dayMap[dateIso].totalMl / dayMap[dateIso].count),
    }));
  }, [entries]);

  const milkStats = useMemo(() => {
    if (dailyMilkData.length === 0) return null;
    const totalMlSum = dailyMilkData.reduce((acc, d) => acc + d.totalMl, 0);
    const totalFeedsSum = dailyMilkData.reduce((acc, d) => acc + d.count, 0);
    const avgDailyMl = Math.round(totalMlSum / dailyMilkData.length);
    const avgPerFeed = Math.round(totalMlSum / (totalFeedsSum || 1));

    return {
      avgDailyMl,
      avgPerFeed,
      daysTracked: dailyMilkData.length,
    };
  }, [dailyMilkData]);

  // ==========================================
  // 3. DAILY SOLID FOOD DATA COMPUTATION
  // ==========================================
  const dailySolidData = useMemo(() => {
    const dayMap: {
      [dateIso: string]: {
        fruitpap: number;
        groentepap: number;
        andere: number;
        totalGrams: number;
        count: number;
      };
    } = {};

    entries.forEach((e) => {
      if ((e.feedingType === 'Vaste voeding' || (e.solidFoodGrams && e.solidFoodGrams > 0)) && e.solidFoodGrams) {
        if (!dayMap[e.date]) {
          dayMap[e.date] = { fruitpap: 0, groentepap: 0, andere: 0, totalGrams: 0, count: 0 };
        }
        const grams = e.solidFoodGrams;
        dayMap[e.date].totalGrams += grams;
        dayMap[e.date].count += 1;

        if (e.solidFoodSubtype === 'Fruitpap') {
          dayMap[e.date].fruitpap += grams;
        } else if (e.solidFoodSubtype === 'Groentepap') {
          dayMap[e.date].groentepap += grams;
        } else {
          dayMap[e.date].andere += grams;
        }
      }
    });

    const dates = Object.keys(dayMap).sort();
    const recentDates = dates.slice(-21);

    return recentDates.map((dateIso) => ({
      dateIso,
      displayDate: formatBelgianDate(dateIso).substring(0, 5),
      fruitpap: dayMap[dateIso].fruitpap,
      groentepap: dayMap[dateIso].groentepap,
      andere: dayMap[dateIso].andere,
      totalGrams: dayMap[dateIso].totalGrams,
      count: dayMap[dateIso].count,
    }));
  }, [entries]);

  // ==========================================
  // 4. FEEDING DEVELOPMENT (Milk vs Solids trend without adding ml & g)
  // ==========================================
  const feedingDevelopmentData = useMemo(() => {
    const datesSet = new Set<string>();
    entries.forEach((e) => {
      if (e.milkMl || e.solidFoodGrams) {
        datesSet.add(e.date);
      }
    });

    const sortedDates = Array.from(datesSet).sort().slice(-21);

    return sortedDates.map((dateIso) => {
      const dayEntries = entries.filter((e) => e.date === dateIso);
      const milkMl = dayEntries.reduce((acc, e) => acc + (e.milkMl || 0), 0);
      const solidG = dayEntries.reduce((acc, e) => acc + (e.solidFoodGrams || 0), 0);

      return {
        dateIso,
        displayDate: formatBelgianDate(dateIso).substring(0, 5),
        melkMl: milkMl,
        vasteVoedingGrams: solidG,
      };
    });
  }, [entries]);

  // ==========================================
  // 5. DAILY SLEEP AND DIAPER DATA
  // ==========================================
  const dailySummaries = useMemo(
    () => buildDailySummaries(entries, sleepSessions),
    [entries, sleepSessions],
  );

  const dailySleepData = useMemo(() => {
    return dailySummaries
      .filter((day) => day.sleepMinutes > 0)
      .slice(-21)
      .map((day) => ({
        ...day,
        displayDate: formatBelgianDate(day.date).substring(0, 5),
        hours: Number((day.sleepMinutes / 60).toFixed(2)),
      }));
  }, [dailySummaries]);

  const sleepStats = useMemo(() => {
    if (dailySleepData.length === 0) return null;
    const totalMinutes = dailySleepData.reduce((total, day) => total + day.sleepMinutes, 0);
    return {
      averageMinutes: Math.round(totalMinutes / dailySleepData.length),
      daysTracked: dailySleepData.length,
      hasOngoingSleep: dailySleepData.some((day) => day.hasOngoingSleep),
    };
  }, [dailySleepData]);

  const dailyDiaperData = useMemo(() => {
    return dailySummaries
      .filter((day) => day.diaperCount > 0)
      .slice(-21)
      .map((day) => ({
        ...day,
        displayDate: formatBelgianDate(day.date).substring(0, 5),
      }));
  }, [dailySummaries]);

  const diaperStats = useMemo(() => {
    if (dailyDiaperData.length === 0) return null;
    const total = dailyDiaperData.reduce((sum, day) => sum + day.diaperCount, 0);
    return {
      average: Number((total / dailyDiaperData.length).toFixed(1)),
      total,
      daysTracked: dailyDiaperData.length,
    };
  }, [dailyDiaperData]);

  return (
    <section id="growth-charts-section" className="space-y-4 max-w-md mx-auto">
      {/* Section Title */}
      <div>
        <h2 className="text-lg font-bold text-slate-900">Groei &amp; Ontwikkeling</h2>
        <p className="text-xs text-slate-500">Statistieken en evolutie sinds Eli&apos;s geboorte</p>
      </div>

      {/* SUB-TABS */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100/90 rounded-2xl border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveSubTab('gewicht')}
          className={`py-2 text-[11px] font-bold rounded-xl transition-all ${
            activeSubTab === 'gewicht'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          ⚖️ Gewicht
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('melk')}
          className={`py-2 text-[11px] font-bold rounded-xl transition-all ${
            activeSubTab === 'melk'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          🍼 Melk
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('vaste_voeding')}
          className={`py-2 text-[11px] font-bold rounded-xl transition-all ${
            activeSubTab === 'vaste_voeding'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          🥣 Vaste pap
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('ontwikkeling')}
          className={`py-2 text-[11px] font-bold rounded-xl transition-all ${
            activeSubTab === 'ontwikkeling'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          📈 Evolutie
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('slaap')}
          className={`py-2 text-[11px] font-bold rounded-xl transition-all ${
            activeSubTab === 'slaap'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          🌙 Slaap
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('pampers')}
          className={`py-2 text-[11px] font-bold rounded-xl transition-all ${
            activeSubTab === 'pampers'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          🩲 Pampers
        </button>
      </div>

      {/* 1. GEWICHT TAB */}
      {activeSubTab === 'gewicht' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          {weightStats && (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3.5 rounded-2xl bg-white border border-emerald-100 shadow-xs">
                <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                  Huidig gewicht
                </div>
                <div className="text-xl font-black text-slate-900 mt-0.5">
                  {weightStats.currentWeightGrams?.toLocaleString('nl-BE')} g
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  {weightStats.lastDate}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-emerald-100 shadow-xs">
                <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                  Totale groei
                </div>
                <div className="text-xl font-black text-emerald-700 mt-0.5">
                  +{weightStats.totalGainGrams?.toLocaleString('nl-BE')} g
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  Geboorte: {weightStats.birthWeightGrams?.toLocaleString('nl-BE')} g
                </div>
              </div>
            </div>
          )}

          {/* Weight Line Chart */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800">
                Gewichtscurve (in gram)
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {weightData.length} metingen
              </span>
            </div>

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={weightData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="formattedDate"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={['dataMin - 200', 'dataMax + 200']}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="p-2.5 bg-slate-900 text-white rounded-xl text-xs space-y-1 shadow-lg">
                            <div className="font-bold">{data.formattedDate}</div>
                            <div className="text-emerald-400 font-mono font-bold text-sm">
                              {data.weightGrams?.toLocaleString('nl-BE')} g ({data.weightKg} kg)
                            </div>
                            {data.diff !== 0 && (
                              <div className="text-[10px] text-slate-300">
                                {data.diff > 0 ? '+' : ''}
                                {data.diff} g sinds vorige
                              </div>
                            )}
                            {data.remarks && (
                              <div className="text-[10px] italic text-slate-300 border-t border-slate-700 pt-1 mt-1">
                                &quot;{data.remarks}&quot;
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="weightGrams"
                    stroke="#059669"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#weightGradient)"
                    dot={{ fill: '#059669', stroke: '#fff', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: '#047857' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* 2. MELK TAB */}
      {activeSubTab === 'melk' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          {milkStats && (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3.5 rounded-2xl bg-white border border-sky-100 shadow-xs">
                <div className="text-[10px] font-bold text-sky-800 uppercase tracking-wider">
                  Daggemiddelde
                </div>
                <div className="text-xl font-black text-slate-900 mt-0.5">
                  {milkStats.avgDailyMl}{' '}
                  <span className="text-xs font-semibold text-slate-500">ml/dag</span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  Over {milkStats.daysTracked} dagen
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-sky-100 shadow-xs">
                <div className="text-[10px] font-bold text-sky-800 uppercase tracking-wider">
                  Gem. per fles
                </div>
                <div className="text-xl font-black text-sky-700 mt-0.5">
                  ~{milkStats.avgPerFeed}{' '}
                  <span className="text-xs font-semibold text-slate-500">ml</span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  Per voeding
                </div>
              </div>
            </div>
          )}

          {/* Daily Milk Bar Chart */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800">
                Dagelijkse melkinname (ml)
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                Laatste 21 dagen
              </span>
            </div>

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dailyMilkData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="displayDate"
                    tick={{ fontSize: 9, fill: '#64748b' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="p-2.5 bg-slate-900 text-white rounded-xl text-xs space-y-1 shadow-lg">
                            <div className="font-bold">{formatBelgianDate(data.dateIso)}</div>
                            <div className="text-sky-400 font-mono font-bold text-sm">
                              {data.totalMl} ml totaal
                            </div>
                            <div className="text-[10px] text-slate-300">
                              {data.count} voedingen (~{data.avgPerFeed} ml/fles)
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="totalMl"
                    fill="#0284c7"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* 3. VASTE VOEDING TAB */}
      {activeSubTab === 'vaste_voeding' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800">
                Vaste voeding per dag (in gram)
              </span>
              <div className="flex items-center gap-2 text-[10px] font-semibold">
                <span className="flex items-center gap-1 text-orange-600">
                  <span className="w-2 h-2 rounded-full bg-orange-500" /> Fruitpap
                </span>
                <span className="flex items-center gap-1 text-emerald-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Groentepap
                </span>
              </div>
            </div>

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dailySolidData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="displayDate"
                    tick={{ fontSize: 9, fill: '#64748b' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="p-2.5 bg-slate-900 text-white rounded-xl text-xs space-y-1 shadow-lg">
                            <div className="font-bold">{formatBelgianDate(data.dateIso)}</div>
                            {data.fruitpap > 0 && (
                              <div className="text-orange-400 font-mono">
                                🍎 Fruitpap: {data.fruitpap} g
                              </div>
                            )}
                            {data.groentepap > 0 && (
                              <div className="text-emerald-400 font-mono">
                                🥔 Groentepap: {data.groentepap} g
                              </div>
                            )}
                            {data.andere > 0 && (
                              <div className="text-purple-400 font-mono">
                                🥣 Andere: {data.andere} g
                              </div>
                            )}
                            <div className="border-t border-slate-700 pt-1 font-bold text-white">
                              Totaal vast: {data.totalGrams} g
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="fruitpap" stackId="a" fill="#f97316" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="groentepap" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="andere" stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* 4. EVOLUTIE / ONTWIKKELING TAB */}
      {activeSubTab === 'ontwikkeling' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  Voedingsontwikkeling
                </span>
                <span className="text-[10px] text-slate-400">
                  Melk (ml) vs. Vaste voeding (g)
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-semibold">
                <span className="flex items-center gap-1 text-sky-600">
                  <span className="w-2 h-2 rounded-full bg-sky-500" /> Melk (ml)
                </span>
                <span className="flex items-center gap-1 text-orange-600">
                  <span className="w-2 h-2 rounded-full bg-orange-500" /> Vaste pap (g)
                </span>
              </div>
            </div>

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={feedingDevelopmentData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="displayDate"
                    tick={{ fontSize: 9, fill: '#64748b' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="p-2.5 bg-slate-900 text-white rounded-xl text-xs space-y-1 shadow-lg">
                            <div className="font-bold">{formatBelgianDate(data.dateIso)}</div>
                            <div className="text-sky-400 font-mono">
                              🍼 Melk: {data.melkMl} ml
                            </div>
                            <div className="text-orange-400 font-mono">
                              🥣 Vaste voeding: {data.vasteVoedingGrams} g
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="melkMl"
                    stroke="#0284c7"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="vasteVoedingGrams"
                    stroke="#f97316"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-slate-400 text-center italic pt-1">
              Melk en vaste voeding worden apart weergegeven om een zuiver beeld van Eli&apos;s overgang te bewaren.
            </p>
          </div>
        </div>
      )}

      {/* 5. SLAAP TAB */}
      {activeSubTab === 'slaap' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          {sleepStats ? (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3.5 rounded-2xl bg-white border border-indigo-100 shadow-xs">
                <div className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider">Gemiddelde slaap</div>
                <div className="text-xl font-black text-slate-900 mt-0.5">{formatDuration(sleepStats.averageMinutes)}</div>
                <div className="text-[11px] text-slate-500 font-medium">Over {sleepStats.daysTracked} geregistreerde dagen</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-indigo-100 shadow-xs">
                <div className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider">Per dag</div>
                <div className="text-xl font-black text-indigo-700 mt-0.5">🌙 slaap</div>
                <div className="text-[11px] text-slate-500 font-medium">Sessie(s) worden op de juiste dag verdeeld</div>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-white border border-slate-200 text-center">
              <Moon className="w-7 h-7 mx-auto text-indigo-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">Nog geen slaapgegevens</p>
              <p className="text-xs text-slate-400 mt-1">Registreer Eli&apos;s eerste slaapperiode bij Ingave.</p>
            </div>
          )}

          {dailySleepData.length > 0 && (
            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Totale slaap per dag</span>
                  <span className="text-[10px] text-slate-400">Laatste 21 dagen met slaapregistraties</span>
                </div>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg">uren</span>
              </div>
              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailySleepData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="sleepGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.32} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="displayDate" tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                    <Tooltip content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return <div className="p-2.5 bg-slate-900 text-white rounded-xl text-xs space-y-1 shadow-lg"><div className="font-bold">{formatBelgianDate(data.date)}</div><div className="text-indigo-300 font-mono font-bold">🌙 {formatDuration(data.sleepMinutes)}</div>{data.hasOngoingSleep && <div className="text-[10px] text-indigo-200">Bevat lopende slaap tot nu</div>}</div>;
                      }
                      return null;
                    }} />
                    <Area type="monotone" dataKey="hours" stroke="#4f46e5" strokeWidth={3} fill="url(#sleepGradient)" dot={{ fill: '#4f46e5', stroke: '#fff', strokeWidth: 2, r: 3 }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {sleepStats?.hasOngoingSleep && <p className="text-[10px] text-indigo-700 text-center font-semibold">De huidige dag bevat een lopende slaapperiode tot nu, geen voltooid totaal.</p>}
            </div>
          )}
        </div>
      )}

      {/* 6. PAMPERS TAB */}
      {activeSubTab === 'pampers' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          {diaperStats ? (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3.5 rounded-2xl bg-white border border-amber-100 shadow-xs">
                <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Gemiddeld per dag</div>
                <div className="text-xl font-black text-slate-900 mt-0.5">{String(diaperStats.average).replace('.', ',')}</div>
                <div className="text-[11px] text-slate-500 font-medium">Over {diaperStats.daysTracked} dagen</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-amber-100 shadow-xs">
                <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Totaal</div>
                <div className="text-xl font-black text-amber-700 mt-0.5">{diaperStats.total}</div>
                <div className="text-[11px] text-slate-500 font-medium">Elke gemengde pamper telt één keer</div>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-white border border-slate-200 text-center"><p className="text-sm font-semibold text-slate-700">Nog geen pampergegevens</p><p className="text-xs text-slate-400 mt-1">Nieuwe pamperregistraties verschijnen hier per dag.</p></div>
          )}

          {dailyDiaperData.length > 0 && (
            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div><span className="text-xs font-bold text-slate-800 block">Pampers per dag</span><span className="text-[10px] text-slate-400">Laatste 21 dagen met registraties</span></div>
                <div className="flex items-center gap-1.5 text-[9px] font-semibold text-slate-500"><span>💧 pipi</span><span>💩 kaka</span><span>✨ proper</span></div>
              </div>
              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyDiaperData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="displayDate" tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                    <Tooltip content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return <div className="p-2.5 bg-slate-900 text-white rounded-xl text-xs space-y-1 shadow-lg"><div className="font-bold">{formatBelgianDate(data.date)}</div><div className="text-amber-300 font-mono font-bold">🩲 {data.diaperCount} totaal</div>{data.diaperPipi > 0 && <div className="text-[10px] text-slate-300">💧 Pipi: {data.diaperPipi}</div>}{data.diaperKaka > 0 && <div className="text-[10px] text-slate-300">💩 Kaka: {data.diaperKaka}</div>}{data.diaperMixed > 0 && <div className="text-[10px] text-slate-300">💧💩 Gemengd: {data.diaperMixed}</div>}{data.diaperClean > 0 && <div className="text-[10px] text-slate-300">✨ Proper: {data.diaperClean}</div>}</div>;
                      }
                      return null;
                    }} />
                    <Bar dataKey="diaperPipi" stackId="diapers" fill="#38bdf8" />
                    <Bar dataKey="diaperKaka" stackId="diapers" fill="#b45309" />
                    <Bar dataKey="diaperMixed" stackId="diapers" fill="#14b8a6" />
                    <Bar dataKey="diaperClean" stackId="diapers" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
