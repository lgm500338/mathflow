import { createPortal } from 'react-dom';
import React, { useState } from 'react';
import { Download, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import type { TranslationStrings } from '../i18n/translations';

interface PWAInstallButtonProps {
  t: TranslationStrings;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ t }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 active:scale-[0.98] transition whitespace-nowrap shrink-0 min-h-[38px]"
      >
        <Download className="w-3.5 h-3.5" />
        <span>{t.installApp}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition whitespace-nowrap shrink-0 min-h-[38px]"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{t.installIOS}</span>
        </button>

        {showIOSGuide && createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">{t.installIOSTitle}</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
                  aria-label={t.close}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-600 leading-relaxed">
                <p>{t.installIOSStep1}</p>
                <p>{t.installIOSStep2}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-teal-700 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 transition"
              >
                {t.close}
              </button>
            </div>
          </div>,
          document.body,
        )}
      </>
    );
  }

  return null;
};
