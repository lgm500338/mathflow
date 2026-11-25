import React, { useState } from 'react';
import { Check, Globe, X } from 'lucide-react';
import { LANGUAGES, type LanguageCode, type TranslationStrings } from '../i18n/translations';

interface LanguageSelectorProps {
  t: TranslationStrings;
  currentLang: LanguageCode;
  onChange: (lang: LanguageCode) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  t,
  currentLang,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const activeMeta = LANGUAGES.find((l) => l.code === currentLang) ?? LANGUAGES[0];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.languageLabel}
        className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition whitespace-nowrap shrink-0"
      >
        <Globe className="w-4 h-4 text-teal-700 shrink-0" />
        <span>{activeMeta.nativeName}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-xs p-0 sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-teal-700" />
                <h2 className="text-base font-bold text-slate-900">{t.languageLabel}</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t.close}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2">
              {LANGUAGES.map((lang) => {
                const selected = lang.code === currentLang;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      onChange(lang.code);
                      setOpen(false);
                    }}
                    className={`min-h-[48px] px-3 py-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition ${
                      selected
                        ? 'bg-teal-50 border-teal-700 text-teal-950 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm truncate">{lang.nativeName}</div>
                      <div className="text-[11px] text-slate-400 truncate">{lang.englishName}</div>
                    </div>
                    {selected && <Check className="w-4 h-4 text-teal-700 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
