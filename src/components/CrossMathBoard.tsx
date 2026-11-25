import React from 'react';
import { Lightbulb } from 'lucide-react';
import type { CrossMathPuzzle } from '../engine/puzzleGenerator';
import type { TranslationStrings } from '../i18n/translations';

export type EquationStatus = 'incomplete' | 'valid' | 'invalid';

interface CrossMathBoardProps {
  t: TranslationStrings;
  puzzle: CrossMathPuzzle;
  userValues: Record<string, string>;
  hintedKeys: Set<string>;
  selectedKey: string | null;
  equationStatuses: Record<string, EquationStatus>;
  errorCellKeys: Set<string>;
  shakeKey: number;
  isSolved: boolean;
  onSelectCell: (key: string) => void;
}

export const CrossMathBoard: React.FC<CrossMathBoardProps> = ({
  t,
  puzzle,
  userValues,
  hintedKeys,
  selectedKey,
  equationStatuses,
  errorCellKeys,
  shakeKey,
  isSolved,
  onSelectCell,
}) => {
  const visualRows = puzzle.rows * 2 - 1;
  const visualCols = puzzle.cols * 2 - 1;

  // Responsive circle sizing: ensures 5x5 fits comfortably on 375px mobile AND shines on desktop
  const isCompact = puzzle.cols >= 5 || puzzle.rows >= 5;
  const colTemplate = Array.from({ length: visualCols }, (_, i) =>
    i % 2 === 0
      ? isCompact
        ? 'minmax(44px, 64px)'
        : 'minmax(54px, 76px)'
      : isCompact
        ? 'minmax(18px, 28px)'
        : 'minmax(22px, 32px)'
  ).join(' ');

  const rowTemplate = Array.from({ length: visualRows }, (_, i) =>
    i % 2 === 0
      ? isCompact
        ? 'minmax(44px, 64px)'
        : 'minmax(54px, 76px)'
      : isCompact
        ? 'minmax(18px, 28px)'
        : 'minmax(22px, 32px)'
  ).join(' ');

  const getFontSizeClass = (text: string) => {
    if (text.length >= 4) return isCompact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base';
    if (text.length === 3) return isCompact ? 'text-sm sm:text-lg' : 'text-base sm:text-xl';
    if (text.length === 2) return isCompact ? 'text-lg sm:text-2xl' : 'text-xl sm:text-2xl';
    return isCompact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl';
  };

  return (
    <div className="w-full flex items-center justify-center py-2 sm:py-4">
      <div
        key={shakeKey > 0 ? `board-${shakeKey}` : 'board'}
        className={`grid place-items-center select-none ${shakeKey > 0 ? 'animate-shake' : ''}`}
        style={{
          gridTemplateColumns: colTemplate,
          gridTemplateRows: rowTemplate,
          gap: '2px',
        }}
        role="grid"
        aria-label={`${t.appName} NO.${puzzle.puzzleNo}`}
      >
        {Array.from({ length: visualRows }).map((_, vr) =>
          Array.from({ length: visualCols }).map((__, vc) => {
            const isNodeRow = vr % 2 === 0;
            const isNodeCol = vc % 2 === 0;
            const cellId = `v-${vr}-${vc}`;

            // 1. Number Circle Cell
            if (isNodeRow && isNodeCol) {
              const r = vr / 2;
              const c = vc / 2;
              const nk = `${r},${c}`;
              const node = puzzle.nodes[nk];
              if (!node) {
                return <div key={cellId} className="w-full h-full" aria-hidden="true" />;
              }

              // Given (fixed) number circle — refined Nordic ice-teal aesthetic inspired by user's screenshot
              if (!node.isBlank) {
                const txt = String(node.answer);
                return (
                  <div
                    key={cellId}
                    className={`w-full aspect-square rounded-full flex items-center justify-center bg-[#EBF6F6] border-[1.75px] border-[#2A6F77] text-slate-900 font-num font-bold shadow-[0_1px_2px_rgba(15,23,42,0.05)] ${getFontSizeClass(txt)}`}
                  >
                    {txt}
                  </div>
                );
              }

              // Editable blank circle
              const val = userValues[nk] ?? '';
              const isSelected = selectedKey === nk && !isSolved;
              const isHinted = hintedKeys.has(nk);
              const isError = errorCellKeys.has(nk) && !isSolved;

              let styleClass =
                'bg-white border-2 border-slate-300 text-slate-900 hover:border-teal-600/70';

              if (isSolved) {
                styleClass = 'bg-teal-50 border-2 border-teal-600 text-teal-900';
              } else if (isHinted) {
                styleClass = 'bg-amber-50 border-2 border-amber-500 text-amber-900';
              } else if (isError) {
                styleClass = isSelected
                  ? 'bg-rose-50 border-2 border-rose-600 text-rose-700 ring-4 ring-rose-500/20'
                  : 'bg-rose-50/70 border-2 border-rose-500 text-rose-700';
              } else if (isSelected) {
                styleClass =
                  'bg-teal-50/50 border-2 border-teal-700 text-teal-900 ring-4 ring-teal-600/20 scale-[1.03]';
              } else if (val !== '') {
                styleClass = 'bg-white border-2 border-teal-700/60 text-teal-950';
              }

              return (
                <button
                  key={cellId}
                  type="button"
                  onClick={() => onSelectCell(nk)}
                  disabled={isSolved}
                  aria-label={`${t.cellLabel.replace('{r}', String(r + 1)).replace('{c}', String(c + 1))}: ${val || t.blankLabel}`}
                  aria-pressed={isSelected}
                  className={`relative w-full aspect-square rounded-full flex items-center justify-center font-num font-bold transition-[transform,border-color,background-color] duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/30 cursor-pointer disabled:cursor-default ${styleClass} ${getFontSizeClass(val || '0')}`}
                >
                  {val ? (
                    <span className="animate-pop">{val}</span>
                  ) : (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-teal-600' : 'bg-slate-300'}`}
                      aria-hidden="true"
                    />
                  )}
                  {isHinted && (
                    <span
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs"
                      aria-hidden="true"
                    >
                      <Lightbulb className="w-2.5 h-2.5" />
                    </span>
                  )}
                </button>
              );
            }

            // 2. Horizontal Edge Symbol (between (r,c) and (r,c+1))
            if (isNodeRow && !isNodeCol) {
              const r = vr / 2;
              const c = (vc - 1) / 2;
              const edge = puzzle.edges[`H:${r},${c}`];
              if (!edge) return <div key={cellId} aria-hidden="true" />;
              const status = equationStatuses[edge.equationId] ?? 'incomplete';
              const displaySym =
                edge.symbol === '=' && status === 'invalid' ? '≠' : edge.symbol;
              const symColor =
                status === 'invalid'
                  ? 'text-rose-600 font-extrabold'
                  : status === 'valid'
                    ? 'text-teal-700 font-extrabold'
                    : 'text-slate-800 font-bold';
              return (
                <div
                  key={cellId}
                  className={`flex items-center justify-center font-num leading-none ${isCompact ? 'text-base sm:text-xl' : 'text-lg sm:text-2xl'} ${symColor}`}
                  aria-hidden="true"
                >
                  {displaySym}
                </div>
              );
            }

            // 3. Vertical Edge Symbol (between (r,c) and (r+1,c))
            if (!isNodeRow && isNodeCol) {
              const r = (vr - 1) / 2;
              const c = vc / 2;
              const edge = puzzle.edges[`V:${r},${c}`];
              if (!edge) return <div key={cellId} aria-hidden="true" />;
              const status = equationStatuses[edge.equationId] ?? 'incomplete';
              const displaySym =
                edge.symbol === '=' && status === 'invalid' ? '≠' : edge.symbol;
              const symColor =
                status === 'invalid'
                  ? 'text-rose-600 font-extrabold'
                  : status === 'valid'
                    ? 'text-teal-700 font-extrabold'
                    : 'text-slate-800 font-bold';
              return (
                <div
                  key={cellId}
                  className={`flex items-center justify-center font-num leading-none ${isCompact ? 'text-base sm:text-xl' : 'text-lg sm:text-2xl'} ${symColor}`}
                  aria-hidden="true"
                >
                  {displaySym}
                </div>
              );
            }

            // 4. Empty diagonal gap
            return <div key={cellId} aria-hidden="true" />;
          })
        )}
      </div>
    </div>
  );
};
