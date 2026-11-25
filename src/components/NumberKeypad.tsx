import React from 'react';
import { Delete, Lightbulb, RotateCcw, Eraser } from 'lucide-react';
import type { TranslationStrings } from '../i18n/translations';

interface NumberKeypadProps {
  t: TranslationStrings;
  disabled: boolean;
  canHint: boolean;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onClearCell: () => void;
  onHint: () => void;
  onReset: () => void;
}

export const NumberKeypad: React.FC<NumberKeypadProps> = ({
  t,
  disabled,
  canHint,
  onDigit,
  onBackspace,
  onClearCell,
  onHint,
  onReset,
}) => {
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className="w-full space-y-2.5">
      {/* Utility Action Row */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onHint}
          disabled={disabled || !canHint}
          className="min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-semibold text-sm hover:bg-amber-100 active:scale-[0.97] transition disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap px-3"
        >
          <Lightbulb className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="truncate">{t.hint}</span>
        </button>

        <button
          type="button"
          onClick={onClearCell}
          disabled={disabled}
          className="min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 active:scale-[0.97] transition disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap px-3"
        >
          <Eraser className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="truncate">{t.clear}</span>
        </button>

        <button
          type="button"
          onClick={onReset}
          disabled={disabled}
          className="min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 active:scale-[0.97] transition disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap px-3"
        >
          <RotateCcw className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="truncate">{t.reset}</span>
        </button>
      </div>

      {/* Numeric Grid 1-9, 0, Backspace */}
      <div className="grid grid-cols-5 sm:grid-cols-3 gap-2">
        {digits.map((d) => (
          <button
            key={d}
            type="button"
            disabled={disabled}
            onClick={() => onDigit(d)}
            className="min-h-[48px] sm:min-h-[54px] rounded-xl bg-white border border-slate-200/90 text-slate-900 font-num font-bold text-xl shadow-[0_1px_1px_rgba(15,23,42,0.04)] hover:bg-teal-50/50 hover:border-teal-600/40 active:scale-[0.96] active:bg-teal-100/60 transition disabled:opacity-45 disabled:cursor-not-allowed"
          >
            {d}
          </button>
        ))}

        {/* On mobile 5-col layout, place 0 right after 9; on desktop 3-col layout, 0 spans nicely with Backspace */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onDigit('0')}
          className="min-h-[48px] sm:min-h-[54px] sm:col-span-2 rounded-xl bg-white border border-slate-200/90 text-slate-900 font-num font-bold text-xl shadow-[0_1px_1px_rgba(15,23,42,0.04)] hover:bg-teal-50/50 hover:border-teal-600/40 active:scale-[0.96] active:bg-teal-100/60 transition disabled:opacity-45 disabled:cursor-not-allowed"
        >
          0
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={onBackspace}
          aria-label={t.backspaceLabel}
          className="min-h-[48px] sm:min-h-[54px] col-span-5 sm:col-span-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center hover:bg-slate-200/70 active:scale-[0.97] transition disabled:opacity-45 disabled:cursor-not-allowed"
        >
          <Delete className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
