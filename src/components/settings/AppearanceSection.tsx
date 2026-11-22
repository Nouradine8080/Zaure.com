import React, { useEffect, useState } from 'react';
import { Check, LayoutGrid, Monitor, Moon, Palette, Sun, Wifi } from 'lucide-react';
import { DisplayDensity, ThemeMode, UserSettings } from '../../types';
import {
  applyAndPersistAppearancePreferences,
  extractAppearancePreferences,
  resolveEffectiveTheme
} from '../../utils/appearancePreferences';

interface AppearanceSectionProps {
  userId: string;
  settings: UserSettings;
  onSaveSettings: (patch: Partial<UserSettings>) => Promise<boolean>;
  onPreferencesApplied?: (effectiveTheme: 'light' | 'dark', settingsPatch: Partial<UserSettings>) => void;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}

export default function AppearanceSection({
  userId,
  settings,
  onSaveSettings,
  onPreferencesApplied,
  onNotify
}: AppearanceSectionProps) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(settings.theme_mode || 'light');
  const [density, setDensity] = useState<DisplayDensity>(settings.densite_affichage || 'confort');
  const [lowData, setLowData] = useState<boolean>(Boolean(settings.mode_faible_consommation));
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() =>
    resolveEffectiveTheme('system')
  );

  useEffect(() => {
    setThemeMode(settings.theme_mode || 'light');
    setDensity(settings.densite_affichage || 'confort');
    setLowData(Boolean(settings.mode_faible_consommation));
  }, [settings.theme_mode, settings.densite_affichage, settings.mode_faible_consommation]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemTheme(mq.matches ? 'dark' : 'light');
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  const applyAndSave = async (patch: Partial<UserSettings>, feedbackMsg: string) => {
    const merged = { ...settings, ...patch };
    const prefs = extractAppearancePreferences(merged);

    applyAndPersistAppearancePreferences(prefs, userId, (effectiveTheme) => {
      onPreferencesApplied?.(effectiveTheme, patch);
    });

    const ok = await onSaveSettings(patch);
    if (ok) {
      onNotify(feedbackMsg);
    } else {
      onNotify("Préférence appliquée localement, mais échec d'enregistrement cloud.", 'error');
    }
  };

  const handleSelectTheme = async (mode: ThemeMode) => {
    setThemeMode(mode);
    const label =
      mode === 'dark'
        ? 'Thème sombre activé.'
        : mode === 'system'
        ? 'Thème automatique selon le système activé.'
        : 'Thème clair activé.';
    await applyAndSave({ theme_mode: mode }, label);
  };

  const handleSelectDensity = async (next: DisplayDensity) => {
    setDensity(next);
    await applyAndSave(
      { densite_affichage: next },
      next === 'compact' ? 'Densité compacte activée.' : 'Densité confortable activée.'
    );
  };

  const handleToggleLowData = async () => {
    const next = !lowData;
    setLowData(next);
    await applyAndSave(
      { mode_faible_consommation: next },
      next ? 'Mode économie de données activé.' : 'Mode économie de données désactivé.'
    );
  };

  const themeOptions: Array<{
    id: ThemeMode;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    previewClass: string;
  }> = [
    {
      id: 'light',
      title: 'Clair',
      subtitle: 'Surface lumineuse et contraste doux pour la journée',
      icon: <Sun className="w-5 h-5 text-amber-500" />,
      previewClass: 'bg-slate-50 border-slate-200'
    },
    {
      id: 'dark',
      title: 'Sombre',
      subtitle: 'Interface sombre reposante en faible luminosité',
      icon: <Moon className="w-5 h-5 text-indigo-400" />,
      previewClass: 'bg-slate-950 border-slate-800'
    },
    {
      id: 'system',
      title: 'Automatique selon le système',
      subtitle: `Suit votre appareil (actuellement : ${systemTheme === 'dark' ? 'Sombre' : 'Clair'})`,
      icon: <Monitor className="w-5 h-5 text-blue-500" />,
      previewClass:
        'bg-gradient-to-br from-slate-50 via-slate-100 to-slate-900 border-slate-300 dark:border-slate-700'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Thème d'affichage */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
              Thème d’affichage
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Le changement est immédiat sur toute l’application et mémorisé entre vos sessions.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {themeOptions.map((opt) => {
            const active = themeMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelectTheme(opt.id)}
                className={`text-left rounded-2xl border p-4 transition flex flex-col justify-between gap-3 min-h-[132px] ${
                  active
                    ? 'border-blue-600 ring-2 ring-blue-500/25 bg-blue-50/50 dark:bg-blue-950/40'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-2xs">
                    {opt.icon}
                  </div>
                  {active && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                      <Check className="w-3 h-3" /> Actif
                    </span>
                  )}
                </div>

                <div className={`h-8 w-full rounded-xl border ${opt.previewClass}`} />

                <div>
                  <p className="text-xs sm:text-[13px] font-extrabold text-slate-950 dark:text-white">
                    {opt.title}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    {opt.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Densité et économie de données */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <LayoutGrid className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
              Densité d’affichage & données mobiles
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Adaptez l’espacement des cartes et l’utilisation de la bande passante sur mobile.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              id: 'confort' as DisplayDensity,
              title: 'Confort (recommandé)',
              desc: 'Espacements aérés et lisibilité optimale sur grand écran et mobile.'
            },
            {
              id: 'compact' as DisplayDensity,
              title: 'Compact',
              desc: 'Affiche davantage d’éléments à l’écran en réduisant les marges.'
            }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectDensity(item.id)}
              className={`text-left p-4 rounded-2xl border transition min-h-[44px] ${
                density === item.id
                  ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-[13px] font-bold text-slate-950 dark:text-white">
                  {item.title}
                </span>
                {density === item.id && <Check className="w-4 h-4 text-blue-600" />}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{item.desc}</p>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Wifi className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs sm:text-[13px] font-bold text-slate-950 dark:text-white">
                Mode faible consommation de données
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Limite le préchargement automatique des médias lourds sur connexion cellulaire.
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={lowData}
            onClick={handleToggleLowData}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${
              lowData ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ${
                lowData ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </section>
    </div>
  );
}
