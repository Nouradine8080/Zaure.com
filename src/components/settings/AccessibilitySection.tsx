import React, { useEffect, useState } from 'react';
import { Accessibility, BookOpen, Check, Contrast, Sparkles, Type } from 'lucide-react';
import { UserSettings } from '../../types';
import {
  applyAndPersistAppearancePreferences,
  extractAppearancePreferences
} from '../../utils/appearancePreferences';

interface AccessibilitySectionProps {
  userId: string;
  settings: UserSettings;
  onSaveSettings: (patch: Partial<UserSettings>) => Promise<boolean>;
  onPreferencesApplied?: (
    effectiveTheme: 'light' | 'dark',
    settingsPatch: Partial<UserSettings>
  ) => void;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}

export default function AccessibilitySection({
  userId,
  settings,
  onSaveSettings,
  onPreferencesApplied,
  onNotify
}: AccessibilitySectionProps) {
  const [textSize, setTextSize] = useState<'normal' | 'grand' | 'tres_grand'>(
    settings.taille_texte || 'normal'
  );
  const [highContrast, setHighContrast] = useState<boolean>(Boolean(settings.contraste_eleve));
  const [reducedMotion, setReducedMotion] = useState<boolean>(
    Boolean(settings.animations_reduites)
  );
  const [enhancedReadability, setEnhancedReadability] = useState<boolean>(
    Boolean(settings.lisibilite_amelioree)
  );

  useEffect(() => {
    setTextSize(settings.taille_texte || 'normal');
    setHighContrast(Boolean(settings.contraste_eleve));
    setReducedMotion(Boolean(settings.animations_reduites));
    setEnhancedReadability(Boolean(settings.lisibilite_amelioree));
  }, [
    settings.taille_texte,
    settings.contraste_eleve,
    settings.animations_reduites,
    settings.lisibilite_amelioree
  ]);

  const applyAndSave = async (patch: Partial<UserSettings>, msg: string) => {
    const merged = { ...settings, ...patch };
    const prefs = extractAppearancePreferences(merged);
    applyAndPersistAppearancePreferences(prefs, userId, (effectiveTheme) => {
      onPreferencesApplied?.(effectiveTheme, patch);
    });
    const ok = await onSaveSettings(patch);
    if (ok) {
      onNotify(msg);
    } else {
      onNotify("Réglage appliqué localement, erreur de synchronisation cloud.", 'error');
    }
  };

  const sizeOptions: Array<{
    id: 'normal' | 'grand' | 'tres_grand';
    label: string;
    sampleSize: string;
    desc: string;
  }> = [
    { id: 'normal', label: 'Normal (100%)', sampleSize: 'text-sm', desc: 'Taille standard' },
    { id: 'grand', label: 'Grand (+10%)', sampleSize: 'text-base', desc: 'Lecture facilitée' },
    {
      id: 'tres_grand',
      label: 'Très grand (+20%)',
      sampleSize: 'text-lg',
      desc: 'Confort visuel maximal'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Taille du texte */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Type className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
              Taille du texte de l’interface
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Ajustez immédiatement la taille globale des textes sur ordinateur et smartphone.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {sizeOptions.map((opt) => {
            const active = textSize === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setTextSize(opt.id);
                  applyAndSave({ taille_texte: opt.id }, `Taille du texte : ${opt.label}.`);
                }}
                className={`text-left p-4 rounded-2xl border transition min-h-[44px] ${
                  active
                    ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-950 dark:text-white">
                    {opt.label}
                  </span>
                  {active && <Check className="w-4 h-4 text-blue-600" />}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{opt.desc}</p>
                <p className={`mt-2 font-bold text-slate-800 dark:text-slate-200 ${opt.sampleSize}`}>
                  Aa Exemple
                </p>
              </button>
            );
          })}
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <p className="text-[11px] font-bold uppercase text-slate-400 mb-1">Aperçu en direct</p>
          <p className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed">
            « Le savoir grandit lorsqu’on le partage avec clarté et bienveillance sur ZAURE. »
          </p>
        </div>
      </section>

      {/* Options visuelles et motrices */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Accessibility className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
              Confort visuel & mouvement
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Options d’accessibilité appliquées sans délai et sauvegardées sur votre compte.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Contraste élevé */}
          <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                <Contrast className="w-4 h-4 text-slate-700 dark:text-slate-200" />
              </div>
              <div>
                <p className="text-xs sm:text-[13px] font-bold text-slate-950 dark:text-white">
                  Contraste élevé
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Renforce la netteté des bordures, boutons et textes pour mieux distinguer chaque zone.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={highContrast}
              onClick={() => {
                const next = !highContrast;
                setHighContrast(next);
                applyAndSave(
                  { contraste_eleve: next },
                  next ? 'Contraste élevé activé.' : 'Contraste élevé désactivé.'
                );
              }}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${
                highContrast ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ${
                  highContrast ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Réduction des animations */}
          <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <p className="text-xs sm:text-[13px] font-bold text-slate-950 dark:text-white">
                  Réduire les animations
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Désactive les transitions rapides et les effets de mouvement dans toute l’application.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={reducedMotion}
              onClick={() => {
                const next = !reducedMotion;
                setReducedMotion(next);
                applyAndSave(
                  { animations_reduites: next },
                  next ? 'Animations réduites activées.' : 'Animations standards rétablies.'
                );
              }}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${
                reducedMotion ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ${
                  reducedMotion ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Lisibilité améliorée */}
          <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs sm:text-[13px] font-bold text-slate-950 dark:text-white">
                  Option de lisibilité améliorée
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Augmente l’interligne et l’espacement entre les lettres pour une lecture prolongée sans fatigue.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enhancedReadability}
              onClick={() => {
                const next = !enhancedReadability;
                setEnhancedReadability(next);
                applyAndSave(
                  { lisibilite_amelioree: next },
                  next ? 'Lisibilité améliorée activée.' : 'Lisibilité standard rétablie.'
                );
              }}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${
                enhancedReadability ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ${
                  enhancedReadability ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
