import React, { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Lock, Play } from 'lucide-react';
import { getTierForPuzzle } from '../engine/puzzleGenerator';
import type { TranslationStrings } from '../i18n/translations';

interface StageBrowserProps {
  t: TranslationStrings;
  currentPuzzleNo: number;
  consecutiveCleared: number;
  maxUnlockedPuzzleNo: number;
  clearedSet: Set<number>;
  bestTimes: Record<number, number>;
  onSelectPuzzle: (puzzleNo: number) => void;
}

const PAGE_SIZE = 30;

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const StageBrowser: React.FC<StageBrowserProps> = ({
  t,
  currentPuzzleNo,
  consecutiveCleared,
  maxUnlockedPuzzleNo,
  clearedSet,
  bestTimes,
  onSelectPuzzle,
}) => {
  // Show up to maxUnlockedPuzzleNo + 5 locked placeholders (strictly NO preview of locked puzzle contents)
  const visibleCeiling = maxUnlockedPuzzleNo + 5;
  const totalPages = Math.max(1, Math.ceil(visibleCeiling / PAGE_SIZE));
  const defaultPage = Math.max(0, Math.floor((currentPuzzleNo - 1) / PAGE_SIZE));
  const [page, setPage] = useState(Math.min(defaultPage, totalPages - 1));
  const [lockedNoticeNo, setLockedNoticeNo] = useState<number | null>(null);

  const safePage = Math.min(page, totalPages - 1);

  const stageNumbers = useMemo(() => {
    const start = safePage * PAGE_SIZE + 1;
    const end = Math.min(visibleCeiling, start + PAGE_SIZE - 1);
    const list: number[] = [];
    for (let n = start; n <= end; n++) list.push(n);
    return list;
  }, [safePage, visibleCeiling]);

  const getTierLabel = (puzzleNo: number) => {
    const tier = getTierForPuzzle(puzzleNo);
    if (tier === 1) return t.tier1Name;
    if (tier === 2) return t.tier2Name;
    if (tier === 3) return t.tier3Name;
    if (tier === 4) return t.tier4Name;
    return t.tier5Name;
  };

  const tierRoadmap = [
    { label: t.tier1Name, active: currentPuzzleNo <= 19 },
    { label: t.tier2Name, active: currentPuzzleNo >= 20 && currentPuzzleNo <= 99 },
    { label: t.tier3Name, active: currentPuzzleNo >= 100 && currentPuzzleNo <= 299 },
    { label: t.tier4Name, active: currentPuzzleNo >= 300 && currentPuzzleNo <= 999 },
    { label: t.tier5Name, active: currentPuzzleNo >= 1000 },
  ];

  const handleCardClick = (no: number) => {
    if (no > maxUnlockedPuzzleNo) {
      setLockedNoticeNo(no);
      return;
    }
    setLockedNoticeNo(null);
    onSelectPuzzle(no);
  };

  const nextRequiredNo = consecutiveCleared + 1;

  return (
    <div className="space-y-6">
      {/* Header & Frontier Rule Info */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t.navStages}
          </h1>
          <p className="mt-1 text-sm text-slate-600">{t.unlockedWindowNote}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 font-num">
            <span>
              {t.clearedBadge}: {clearedSet.size}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              NO.1 – NO.{maxUnlockedPuzzleNo}
            </span>
            <span aria-hidden="true">·</span>
            <span>{getTierLabel(nextRequiredNo)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setPage(0)}
            className="min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition whitespace-nowrap"
          >
            {t.jumpToFirst}
          </button>
          <button
            type="button"
            onClick={() => setPage(Math.floor((nextRequiredNo - 1) / PAGE_SIZE))}
            className="min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 transition whitespace-nowrap"
          >
            {t.jumpToCurrent} (NO.{nextRequiredNo})
          </button>
        </div>
      </div>

      {/* Locked feedback banner when user taps a locked stage */}
      {lockedNoticeNo !== null && (
        <div
          role="status"
          className="rounded-xl bg-slate-900 text-white px-4 py-3 flex items-center justify-between gap-3 text-sm"
        >
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong className="font-num mr-1.5">NO.{lockedNoticeNo}</strong>
              {t.stageLockedDesc.replace('{n}', String(nextRequiredNo))}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onSelectPuzzle(nextRequiredNo)}
            className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-xs font-semibold whitespace-nowrap shrink-0"
          >
            NO.{nextRequiredNo}
          </button>
        </div>
      )}

      {/* Stage Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-3">
        {stageNumbers.map((no) => {
          const isCleared = clearedSet.has(no);
          const isLocked = no > maxUnlockedPuzzleNo;
          const isCurrent = no === currentPuzzleNo;
          const best = bestTimes[no];

          let cardClass =
            'bg-white border-slate-200 text-slate-900 hover:border-teal-600/60 hover:bg-teal-50/30';
          if (isLocked) {
            cardClass = 'bg-slate-100/80 border-slate-200/70 text-slate-400 cursor-not-allowed';
          } else if (isCurrent) {
            cardClass = 'bg-teal-700 border-teal-700 text-white shadow-sm';
          } else if (isCleared) {
            cardClass = 'bg-[#EBF6F6] border-[#2A6F77]/35 text-slate-900 hover:border-teal-700';
          }

          return (
            <button
              key={no}
              type="button"
              onClick={() => handleCardClick(no)}
              className={`min-h-[78px] rounded-xl border p-3 flex flex-col justify-between text-left transition active:scale-[0.98] ${cardClass}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-num font-bold text-sm tracking-tight">NO.{no}</span>
                {isLocked ? (
                  <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                ) : isCleared ? (
                  <Check
                    className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-teal-100' : 'text-teal-700'}`}
                  />
                ) : (
                  <Play
                    className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-white' : 'text-teal-700'}`}
                  />
                )}
              </div>

              <div
                className={`text-xs font-num mt-2 ${
                  isLocked
                    ? 'text-slate-400'
                    : isCurrent
                      ? 'text-teal-100'
                      : 'text-slate-500'
                }`}
              >
                {isLocked
                  ? t.lockedBadge
                  : best !== undefined
                    ? formatDuration(best)
                    : isCurrent
                      ? t.currentBadge
                      : `NO.${no}`}
              </div>
            </button>
          );
        })}
      </div>

      {/* Pagination Controls (scales smoothly to NO.50,000+) */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
          <button
            type="button"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="min-h-[40px] inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="font-num">
              {Math.max(1, (safePage - 1) * PAGE_SIZE + 1)}–{Math.max(PAGE_SIZE, safePage * PAGE_SIZE)}
            </span>
          </button>

          <span className="text-xs font-num text-slate-500">
            {safePage + 1} / {totalPages}
          </span>

          <button
            type="button"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className="min-h-[40px] inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <span className="font-num">
              {(safePage + 1) * PAGE_SIZE + 1}–{Math.min(visibleCeiling, (safePage + 2) * PAGE_SIZE)}
            </span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Long-Term Stage Progression Roadmap */}
      <div className="pt-4 border-t border-slate-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {tierRoadmap.map((item) => (
            <div
              key={item.label}
              className={`rounded-xl px-3.5 py-2.5 text-xs border ${
                item.active
                  ? 'bg-teal-50/70 border-teal-700/40 text-teal-950 font-semibold'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
