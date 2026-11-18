import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Compass,
  GraduationCap,
  Lightbulb,
  Microscope,
  Stethoscope,
} from 'lucide-react';
import {
  MEDICAL_BIO_TEMPLATE,
  PreferredLanguage,
  REGISTRATION_ROUTES,
  VOCATION_OPTIONS,
  VocationSpecialty,
} from '../../constants/registration';
import { useRegistration } from '../../context/RegistrationContext';
import { Circle } from '../../types';
import { RegistrationLayout } from './RegistrationLayout';

interface RegistrationVocationPageProps {
  circles: Circle[];
}

const VOCATION_ICONS: Record<VocationSpecialty, React.FC<{ className?: string }>> = {
  medecine: Stethoscope,
  mentor: GraduationCap,
  etudiant: Lightbulb,
  chercheur: Microscope,
};

const LANGUAGES: { id: PreferredLanguage; label: string; flag: string }[] = [
  { id: 'fr', label: 'Français', flag: '🇫🇷' },
  { id: 'ha', label: 'Hausa', flag: '🌍' },
  { id: 'en', label: 'English', flag: '🇬🇧' },
];

export const RegistrationVocationPage: React.FC<RegistrationVocationPageProps> = ({ circles }) => {
  const navigate = useNavigate();
  const {
    draft,
    isStep1Complete,
    updateFields,
    selectSpecialty,
    validateAndCompleteStep2,
  } = useRegistration();

  if (!isStep1Complete) {
    return <Navigate to={REGISTRATION_ROUTES.IDENTITE} replace />;
  }

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = validateAndCompleteStep2(circles);
    if (ok) {
      navigate(REGISTRATION_ROUTES.CERCLES_AVATAR);
    }
  };

  return (
    <RegistrationLayout
      currentStep={2}
      pageTitle="2. Profil & Vocation — Inscription Zaure"
      title="Profil & Vocation"
      subtitle="Définissez votre rôle académique, votre biographie et votre langue préférée."
      icon={<Compass className="w-5 h-5" />}
    >
      <form onSubmit={handleContinue} className="space-y-4">
        {/* Sélection du profil */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">
            Sélectionnez votre profil :
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {VOCATION_OPTIONS.map((option) => {
              const Icon = VOCATION_ICONS[option.id];
              const isSelected = draft.specialty === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => selectSpecialty(option.id)}
                  className={`p-3 rounded-2xl border text-left transition flex items-start gap-2.5 ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20 shadow-2xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div
                    className={`p-2 rounded-xl shrink-0 transition ${
                      isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <p className="text-xs font-extrabold text-slate-900 leading-tight truncate">
                        {option.title}
                      </p>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${option.badgeClass}`}
                      >
                        {option.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      {option.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Biographie */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="reg-bio" className="block text-xs font-bold text-slate-700">
              Votre biographie
            </label>
            <button
              type="button"
              onClick={() => updateFields({ bio: MEDICAL_BIO_TEMPLATE })}
              className="text-[11px] font-bold text-blue-700 hover:underline"
            >
              + Modèle médical
            </button>
          </div>
          <textarea
            id="reg-bio"
            rows={3}
            value={draft.bio}
            onChange={(e) => updateFields({ bio: e.target.value })}
            placeholder="Ex: Étudiant en médecine, passionné par la sémiologie et les cas pratiques..."
            className="w-full text-xs sm:text-sm px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 bg-slate-50 focus:bg-white transition resize-none"
          />
        </div>

        {/* Langue préférée */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Langue préférée
          </label>
          <div className="grid grid-cols-3 gap-2">
            {LANGUAGES.map((lang) => {
              const active = draft.langue === lang.id;
              return (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => updateFields({ langue: lang.id })}
                  className={`py-2.5 px-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    active
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Boutons Retour & Continuer */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate(REGISTRATION_ROUTES.IDENTITE)}
            className="px-4 py-2.5 border border-slate-200 text-slate-700 text-xs sm:text-sm rounded-xl hover:bg-slate-50 font-bold transition flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour</span>
          </button>

          <button
            type="submit"
            className="flex-1 sm:flex-none px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs sm:text-sm rounded-xl transition shadow-sm flex items-center justify-center gap-2"
          >
            <span>Continuer</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </RegistrationLayout>
  );
};
