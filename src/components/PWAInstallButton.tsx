import React, { useState } from 'react';
import { Download, Smartphone, Share, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Ne rien afficher si l'application tourne déjà en mode standalone installé
  if (isInstalled) {
    return null;
  }

  // Android / Chrome / Edge / Desktop
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        title="Installer Zaure sur votre appareil"
        className={`flex items-center gap-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition active:scale-95 ${
          compact ? 'px-2.5 py-1.5 text-[11px]' : 'px-3.5 py-2 text-xs'
        }`}
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className={compact ? 'hidden sm:inline' : ''}>Installer l'app</span>
      </button>
    );
  }

  // iOS Safari (WebKit ne déclenche pas beforeinstallprompt)
  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          title="Installer Zaure sur iPhone / iPad"
          className={`flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold transition active:scale-95 ${
            compact ? 'px-2.5 py-1.5 text-[11px]' : 'px-3.5 py-2 text-xs'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          <span className={compact ? 'hidden sm:inline' : ''}>Installer (iOS)</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-black flex items-center justify-center">
                    Z
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Installer Zaure sur iOS
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <Share className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p>
                    <strong>1.</strong> Touchez le bouton <strong>Partager</strong> dans la barre d'outils de Safari.
                  </p>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <PlusSquare className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p>
                    <strong>2.</strong> Faites défiler et sélectionnez <strong>Sur l'écran d'accueil</strong>, puis validez.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition"
              >
                Compris
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
