import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="min-h-[40px] flex items-center gap-2 rounded-xl bg-[#287BFF]/15 border border-[#287BFF]/30 px-3 py-2 text-xs font-semibold text-[#287BFF] dark:text-[#22D3EE] hover:bg-[#287BFF]/25 transition-colors whitespace-nowrap shrink-0"
      >
        <Download className="w-4 h-4" />
        {!compact && <span>Install App</span>}
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="min-h-[40px] flex items-center gap-2 rounded-xl border border-slate-200 dark:border-[#1E3554] px-3 py-2 text-xs font-medium text-slate-700 dark:text-[#A7B4C7] hover:bg-slate-100 dark:hover:bg-[#12243D] transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4" />
          {!compact && <span>Install iOS</span>}
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-[#1E3554] bg-white dark:bg-[#12243D] p-6 shadow-2xl">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Install SellSmart AI on iPhone / iPad</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-[#A7B4C7] leading-relaxed">
                1. Tap the <strong>Share</strong> button in your Safari toolbar.<br />
                2. Scroll down and select <strong>Add to Home Screen</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full min-h-[44px] rounded-xl bg-[#287BFF] py-2.5 text-sm font-semibold text-white hover:bg-blue-600 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
