import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  User,
  UserPlus,
} from 'lucide-react';
import { COUNTRY_DIAL_CODES } from '../../constants/registration';
import { useRegistration } from '../../context/RegistrationContext';
import { UserProfile } from '../../types';
import LegalDocumentModal from '../settings/LegalDocumentModal';
import { RegistrationLayout } from './RegistrationLayout';
import { ZAURE_SURFACES } from '../../styles/designSystem';

interface RegistrationIdentityPageProps {
  onRegistrationSuccess?: (user: UserProfile) => void;
}

export const RegistrationIdentityPage: React.FC<RegistrationIdentityPageProps> = ({
  onRegistrationSuccess,
}) => {
  const navigate = useNavigate();
  const {
    draft,
    fullPhoneNumber,
    isSubmitting,
    updateFields,
    selectCountry,
    handlePhoneLocalChange,
    submitRegistration,
    signInWithGoogle,
  } = useRegistration();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [legalDoc, setLegalDoc] = useState<'terms' | 'privacy' | null>(null);

  const selectedCountry =
    COUNTRY_DIAL_CODES.find((c) => c.code === draft.countryCode) || COUNTRY_DIAL_CODES[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitRegistration((user) => {
      onRegistrationSuccess?.(user);
      navigate('/feed', { replace: true });
    });
  };

  const handleGoogleContinue = async () => {
    await signInWithGoogle((user) => {
      onRegistrationSuccess?.(user);
      navigate('/feed', { replace: true });
    });
  };

  const passwordsMatch =
    draft.password.length >= 6 &&
    draft.passwordConfirm.length > 0 &&
    draft.password === draft.passwordConfirm;

  return (
    <RegistrationLayout
      pageTitle="Inscription | ZAURE"
      title="Inscription"
      subtitle="Créez votre compte en quelques secondes"
      icon={<UserPlus className="w-5 h-5" />}
    >
      <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
        {/* Nom et prénom */}
        <div>
          <label htmlFor="reg-nom" className="sr-only">
            Nom et prénom
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-blue-600/80 dark:text-blue-400">
              <User className="w-4 h-4" />
            </div>
            <input
              id="reg-nom"
              type="text"
              autoComplete="name"
              placeholder="Nom et prénom *"
              required
              value={draft.nom}
              onChange={(e) => updateFields({ nom: e.target.value })}
              className="w-full min-h-[46px] text-sm pl-11 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-full bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
            />
          </div>
        </div>

        {/* Adresse e-mail */}
        <div>
          <label htmlFor="reg-email" className="sr-only">
            Adresse e-mail
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-blue-600/80 dark:text-blue-400">
              <Mail className="w-4 h-4" />
            </div>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              placeholder="Adresse e-mail *"
              required
              value={draft.email}
              onChange={(e) => updateFields({ email: e.target.value })}
              className="w-full min-h-[46px] text-sm pl-11 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-full bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
            />
          </div>
        </div>

        {/* Numéro de téléphone avec indicatif pays intégré */}
        <div>
          <label htmlFor="reg-phone" className="sr-only">
            Numéro de téléphone
          </label>
          <div className="flex items-center min-h-[46px] border border-slate-200 dark:border-slate-700 rounded-full bg-white dark:bg-slate-800/80 focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-blue-600 transition overflow-hidden">
            <div className="pl-4 pr-2 flex items-center gap-1.5 border-r border-slate-200 dark:border-slate-700 shrink-0 bg-slate-50/70 dark:bg-slate-800 self-stretch">
              <Phone className="w-4 h-4 text-blue-600/80 dark:text-blue-400 shrink-0" />
              <select
                aria-label="Pays et indicatif téléphonique"
                value={draft.countryCode}
                onChange={(e) => selectCountry(e.target.value)}
                className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-transparent focus:outline-none cursor-pointer py-2 pr-1"
              >
                {COUNTRY_DIAL_CODES.map((c) => (
                  <option key={c.code} value={c.code} className="dark:bg-slate-900 dark:text-slate-100">
                    {c.flag} {c.dial} ({c.name})
                  </option>
                ))}
              </select>
            </div>
            <input
              id="reg-phone"
              type="tel"
              autoComplete="tel-national"
              placeholder={`Numéro de téléphone * (${selectedCountry.placeholder})`}
              required
              value={draft.phoneLocal}
              onChange={(e) => handlePhoneLocalChange(e.target.value)}
              className="flex-1 min-w-0 text-sm px-3.5 py-2.5 bg-transparent focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
          {fullPhoneNumber && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 px-4">
              Numéro complet : <span className="font-bold text-slate-700 dark:text-slate-200">{fullPhoneNumber}</span>
            </p>
          )}
        </div>

        {/* Mot de passe */}
        <div>
          <label htmlFor="reg-password" className="sr-only">
            Mot de passe
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-blue-600/80 dark:text-blue-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Mot de passe * (min. 6 caractères)"
              required
              value={draft.password}
              onChange={(e) => updateFields({ password: e.target.value })}
              className="w-full min-h-[46px] text-sm pl-11 pr-11 py-2.5 border border-slate-200 dark:border-slate-700 rounded-full bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Confirmer le mot de passe */}
        <div>
          <label htmlFor="reg-password-confirm" className="sr-only">
            Confirmer le mot de passe
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-blue-600/80 dark:text-blue-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="reg-password-confirm"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Confirmer le mot de passe *"
              required
              value={draft.passwordConfirm}
              onChange={(e) => updateFields({ passwordConfirm: e.target.value })}
              className="w-full min-h-[46px] text-sm pl-11 pr-16 py-2.5 border border-slate-200 dark:border-slate-700 rounded-full bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
            />
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center gap-2">
              {passwordsMatch && (
                <CheckCircle2
                  aria-label="Mots de passe identiques"
                  className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0"
                />
              )}
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={
                  showConfirmPassword
                    ? 'Masquer la confirmation du mot de passe'
                    : 'Afficher la confirmation du mot de passe'
                }
                className="text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Acceptation des conditions d'utilisation et de la politique de confidentialité */}
        <div className="pt-1">
          <label
            htmlFor="reg-terms"
            className="flex items-start gap-2.5 px-1.5 py-1 cursor-pointer select-none"
          >
            <input
              id="reg-terms"
              type="checkbox"
              checked={draft.acceptedTerms}
              onChange={(e) => updateFields({ acceptedTerms: e.target.checked })}
              required
              className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-600 shrink-0 cursor-pointer"
            />
            <span className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              J'accepte les{' '}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setLegalDoc('terms');
                }}
                className="font-bold text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
              >
                Conditions d'utilisation
              </button>{' '}
              et la{' '}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setLegalDoc('privacy');
                }}
                className="font-bold text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
              >
                Politique de confidentialité
              </button>
            </span>
          </label>
        </div>

        {/* Primary Submit CTA */}
        <div className="pt-1.5">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full min-h-[48px] py-3 px-6 text-sm sm:text-base gap-2.5 disabled:opacity-50 cursor-pointer ${ZAURE_SURFACES.primaryButton}`}
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Création du compte...</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Créer mon compte</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* Divider */}
        <div className="relative flex py-1.5 items-center">
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
          <span className="shrink mx-3 text-xs font-semibold text-slate-400 dark:text-slate-500">Ou</span>
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
        </div>

        {/* Continuer avec Google */}
        <button
          type="button"
          onClick={handleGoogleContinue}
          disabled={isSubmitting}
          className="w-full min-h-[46px] py-2.5 px-5 rounded-full bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/90 text-slate-800 dark:text-slate-100 font-bold text-sm border border-slate-200 dark:border-slate-700 transition shadow-2xs flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer zaure-btn-press"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#EA4335"
              d="M12 5.04c1.5 0 2.85.51 3.9 1.5l2.9-2.9C17.05 1.9 14.7 1 12 1 7.35 1 3.4 3.65 1.5 7.5l3.5 2.7C5.85 6.95 8.7 5.04 12 5.04z"
            />
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.82-.07-1.61-.21-2.38H12v4.51h6.44c-.28 1.46-1.1 2.69-2.34 3.52l3.63 2.82c2.13-1.97 3.36-4.87 3.36-8.47z"
            />
            <path
              fill="#FBBC05"
              d="M5 14.8c-.25-.75-.39-1.55-.39-2.38s.14-1.63.39-2.38L1.5 7.34C.55 9.24 0 11.36 0 13.6s.55 4.36 1.5 6.26l3.5-2.06z"
            />
            <path
              fill="#34A853"
              d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.63-2.82c-1.01.68-2.3 1.09-3.9 1.09-3.3 0-6.15-1.91-7.15-4.78l-3.5 2.7C3.4 20.35 7.35 23 12 23z"
            />
          </svg>
          <span>Continuer avec Google</span>
        </button>
      </form>

      <LegalDocumentModal docType={legalDoc} onClose={() => setLegalDoc(null)} />
    </RegistrationLayout>
  );
};
