import React from 'react';
import type { LearningAnalyticsSummary } from '../db/localDb';
import type { DifficultyTier, Operator } from '../engine/puzzleGenerator';
import type { TranslationStrings } from '../i18n/translations';

interface AnalyticsViewProps {
  t: TranslationStrings;
  summary: LearningAnalyticsSummary | null;
  onJumpToPuzzle: (no: number) => void;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  t,
  summary,
  onJumpToPuzzle,
}) => {
  if (!summary || summary.totalSessions === 0) {
    return (
      <div className="space-y-6">
        <div className="pb-4 border-b border-slate-200">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t.analyticsTitle}</h1>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-8 sm:p-12 text-center max-w-xl mx-auto">
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">{t.analyticsEmpty}</p>
          <button
            type="button"
            onClick={() => onJumpToPuzzle(1)}
            className="mt-6 min-h-[44px] px-6 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 transition"
          >
            NO.1 · {t.navPlay}
          </button>
        </div>
      </div>
    );
  }

  const opLabels: Record<Operator, string> = {
    '+': t.opAdd,
    '-': t.opSub,
    '×': t.opMul,
    '÷': t.opDiv,
  };

  const tierList: Array<{ tier: DifficultyTier; name: string; totalLabel: string }> = [
    { tier: 1, name: t.tier1Name, totalLabel: '/ 19' },
    { tier: 2, name: t.tier2Name, totalLabel: '/ 80' },
    { tier: 3, name: t.tier3Name, totalLabel: '/ 200' },
    { tier: 4, name: t.tier4Name, totalLabel: '/ 700' },
    { tier: 5, name: t.tier5Name, totalLabel: '/ ∞' },
  ];

  const maxDayCount = Math.max(1, ...summary.last7Days.map((d) => d.count));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t.analyticsTitle}</h1>
        <span className="text-xs text-slate-500 font-num">
          NO.1 – NO.{summary.maxUnlockedPuzzleNo}
        </span>
      </div>

      {/* 4-Column Core KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-500">{t.totalCleared}</div>
          <div className="mt-1.5 text-2xl sm:text-3xl font-bold font-num text-slate-900">
            {summary.totalClearedUnique}
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-500">{t.avgTime}</div>
          <div className="mt-1.5 text-2xl sm:text-3xl font-bold font-num text-slate-900">
            {formatDuration(summary.avgDurationSec)}
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-500">{t.overallAccuracy}</div>
          <div className="mt-1.5 text-2xl sm:text-3xl font-bold font-num text-teal-700">
            {summary.overallAccuracy}%
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-500">{t.dailyStreak}</div>
          <div className="mt-1.5 text-2xl sm:text-3xl font-bold font-num text-slate-900">
            {summary.currentStreakDays}{' '}
            <span className="text-sm font-normal text-slate-500">{t.daysUnit}</span>
          </div>
        </div>
      </div>

      {/* Two-Column Analytics Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Operation Mastery & Weakness Diagnosis */}
        <section className="lg:col-span-7 rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-5">
          <h2 className="text-base font-bold text-slate-900">{t.opMasteryTitle}</h2>

          <div className="space-y-4">
            {(['+', '-', '×', '÷'] as Operator[]).map((op) => {
              const stat = summary.opStats[op];
              const hasData = stat.solvedEqs > 0;
              return (
                <div key={op} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-800">{opLabels[op]}</span>
                    <div className="flex items-center gap-2 text-xs font-num text-slate-500">
                      <span>
                        {stat.solvedEqs} {t.equationsUnit}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-bold text-slate-900">
                        {hasData ? `${stat.accuracy}%` : '—'}
                      </span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        !hasData
                          ? 'bg-slate-200'
                          : stat.accuracy >= 85
                            ? 'bg-teal-600'
                            : stat.accuracy >= 65
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                      }`}
                      style={{ width: hasData ? `${Math.max(6, stat.accuracy)}%` : '0%' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Study Insight Diagnosis */}
          <div className="pt-4 border-t border-slate-100 text-sm text-slate-700 space-y-1.5">
            <div className="text-xs font-semibold text-slate-500">{t.weaknessInsight}</div>
            {summary.weakestOp && summary.strongestOp ? (
              <div className="space-y-1">
                <p>
                  <span className="text-slate-500">{t.strongestOp}:</span>{' '}
                  <strong className="text-teal-800">{opLabels[summary.strongestOp]}</strong>
                </p>
                <p>
                  <span className="text-slate-500">{t.focusOp}:</span>{' '}
                  <strong className="text-rose-700">{opLabels[summary.weakestOp]}</strong>
                </p>
              </div>
            ) : (
              <p className="text-slate-700">{t.balancedOp}</p>
            )}
          </div>
        </section>

        {/* Right Column: 7-Day Activity & Tier Progress */}
        <div className="lg:col-span-5 space-y-6">
          {/* Last 7 Days Bar Chart */}
          <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6">
            <h2 className="text-base font-bold text-slate-900 mb-5">{t.weeklyActivityTitle}</h2>
            <div className="grid grid-cols-7 gap-2 items-end h-32">
              {summary.last7Days.map((day) => {
                const heightPct = day.count > 0 ? Math.max(14, Math.round((day.count / maxDayCount) * 100)) : 4;
                return (
                  <div key={day.dateKey} className="flex flex-col items-center justify-end h-full gap-1.5">
                    <span className="text-[11px] font-num text-slate-500">
                      {day.count > 0 ? day.count : ''}
                    </span>
                    <div className="w-full max-w-[28px] flex-1 flex items-end">
                      <div
                        className={`w-full rounded-t-md transition-all ${
                          day.count > 0 ? 'bg-teal-600' : 'bg-slate-200'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-num text-slate-500">{day.label}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Tier Breakdown */}
          <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-3">
            <h2 className="text-base font-bold text-slate-900">{t.tierProgressTitle}</h2>
            <div className="divide-y divide-slate-100">
              {tierList.map((item) => (
                <div key={item.tier} className="py-2.5 flex items-center justify-between gap-2 text-sm">
                  <span className="text-slate-700 truncate">{item.name}</span>
                  <span className="font-num font-semibold text-slate-900 shrink-0">
                    {summary.tierClearedCounts[item.tier]}{' '}
                    <span className="text-slate-400 font-normal">{item.totalLabel}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Recent Solve History */}
      <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6">
        <h2 className="text-base font-bold text-slate-900 mb-3">{t.recentHistoryTitle}</h2>
        <div className="divide-y divide-slate-100">
          {summary.recentSessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => onJumpToPuzzle(session.puzzleNo)}
              className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50/70 px-2 -mx-2 rounded-lg transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-num font-bold text-sm text-teal-800 shrink-0">
                  NO.{session.puzzleNo}
                </span>
                <span className="text-xs text-slate-500 font-num truncate">
                  {session.dateKey}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs font-num text-slate-600 shrink-0">
                <span>{formatDuration(session.durationSec)}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {t.mistakesLabel} {session.mistakes}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {t.hintsLabel} {session.hintsUsed}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
