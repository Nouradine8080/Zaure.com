import React from 'react';
import { Check, Globe, Info, Languages } from 'lucide-react';
import { UserProfile, UserSettings } from '../../types';
import { LANGUAGE_CATALOG, Language, useTranslation } from '../../context/LanguageContext';
import { zaureService } from '../../firebaseClient';

interface LanguageSectionProps {
  currentUser: UserProfile;
  settings: UserSettings;
  onProfileUpdated: (updated: UserProfile) => void;
  onSaveSettings: (patch: Partial<UserSettings>) => Promise<boolean>;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}

export default function LanguageSection({
  currentUser,
  settings,
  onProfileUpdated,
  onSaveSettings,
  onNotify
}: LanguageSectionProps) {
  const { language, setLanguage } = useTranslation();

  const handleSelectLanguage = async (code: Language) => {
    setLanguage(code);

    const ok = await onSaveSettings({
      langue_interface: code,
      langue_preferee: code
    });

    await zaureService.updateUserProfile(currentUser.id, {
      langue_preferee: code
    });

    onProfileUpdated({
      ...currentUser,
      langue_preferee: code
    });

    if (ok) {
      const meta = LANGUAGE_CATALOG.find((l) => l.code === code);
      onNotify(`Langue définie sur : ${meta?.nativeName || code}.`);
    } else {
      onNotify("Langue appliquée localement, mais erreur d'enregistrement serveur.", 'error');
    }
  };

  const handleToggleAutoTranslate = async () => {
    const next = !settings.traduction_auto;
    const ok = await onSaveSettings({ traduction_auto: next });
    if (ok) {
      onNotify(
        next ? 'Traduction automatique des capsules activée.' : 'Traduction automatique désactivée.'
      );
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
              Langue de l’interface ZAURE
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sélectionnez votre langue préférée. La couverture exacte de traduction est indiquée pour chaque langue.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {LANGUAGE_CATALOG.map((item) => {
            const active = language === item.code;
            const badgeText =
              language === 'en'
                ? item.coverageLabelEn
                : language === 'ha'
                ? item.coverageLabelHa
                : item.coverageLabelFr;
            const scopeText =
              language === 'en'
                ? item.scopeDescriptionEn
                : language === 'ha'
                ? item.scopeDescriptionHa
                : item.scopeDescriptionFr;

            return (
              <button
                key={item.code}
                type="button"
                onClick={() => handleSelectLanguage(item.code)}
                className={`w-full text-left p-4 rounded-2xl border transition min-h-[44px] ${
                  active
                    ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-[11px] font-extrabold text-slate-800 dark:text-slate-100 uppercase">
                      {item.code}
                    </span>
                    <span className="text-sm font-extrabold text-slate-950 dark:text-white">
                      {item.nativeName}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      ({item.frenchName} · {item.regionLabel})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        item.coverage === 'complete'
                          ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
                          : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                      }`}
                    >
                      {badgeText}
                    </span>
                    {active && (
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                  {scopeText}
                </p>
              </button>
            );
          })}
        </div>

        <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300">
          <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <p>
            Votre choix de langue est mémorisé localement et synchronisé avec votre compte afin
            d’être conservé après rechargement ou reconnexion. Les contenus rédigés par les
            membres restent affichés dans leur langue d’origine.
          </p>
        </div>
      </section>

      <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Languages className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-slate-950 dark:text-white">
                Afficher les traductions disponibles sur les capsules
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Propose automatiquement la version traduite d’une capsule lorsqu’elle existe dans
                votre langue préférée.
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={settings.traduction_auto}
            onClick={handleToggleAutoTranslate}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${
              settings.traduction_auto ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ${
                settings.traduction_auto ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </section>
    </div>
  );
}
