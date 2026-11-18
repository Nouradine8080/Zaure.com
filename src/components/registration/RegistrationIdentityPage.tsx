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
  ShieldCheck,
  User,
} from 'lucide-react';
import { COUNTRY_DIAL_CODES, REGISTRATION_ROUTES } from '../../constants/registration';
import { useRegistration } from '../../context/RegistrationContext';
import { RegistrationLayout } from './RegistrationLayout';

export const RegistrationIdentityPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    draft,
    fullPhoneNumber,
    isSubmitting,
    updateFields,
    selectCountry,
    handlePhoneLocalChange,
    validateAndCompleteStep1,
  } = useRegistration();

  const [showPassword, setShowPassword] = useState(false);

  const selectedCountry =
    COUNTRY_DIAL_CODES.find((c) => c.code === draft.countryCode) || COUNTRY_DIAL_CODES[0];

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await validateAndCompleteStep1();
    if (ok) {
      navigate(REGISTRATION_ROUTES.VOCATION);
    }
  };

  const passwordsMatch =
    draft.password.length >= 6 &&
    draft.passwordConfirm.length > 0 &&
    draft.password === draft.passwordConfirm;

  return (
    <RegistrationLayout
      currentStep={1}
      pageTitle="1. Identité — Inscription Zaure"
      title="Identité & Sécurité"
      subtitle="Renseignez vos informations personnelles pour créer votre compte Zaure."
      icon={<ShieldCheck className="w-5 h-5" />}
    >
      <form onSubmit={handleContinue} className="space-y-4" noValidate>
        {/* Nom et prénom */}
        <div>
          <label htmlFor="reg-nom" className="block text-xs font-bold text-slate-700 mb-1.5">
            Nom et prénom <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <User className="w-4 h-4" />
            </div>
            <input
              id="reg-nom"
              type="text"
              autoComplete="name"
              placeholder="Ex: Mahamadou Garba"
              required
              value={draft.nom}
              onChange={(e) => updateFields({ nom: e.target.value })}
              className="w-full text-sm pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 bg-slate-50 focus:bg-white transition"
            />
          </div>
        </div>

        {/* Adresse e-mail */}
        <div>
          <label htmlFor="reg-email" className="block text-xs font-bold text-slate-700 mb-1.5">
            Adresse e-mail <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Mail className="w-4 h-4" />
            </div>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              placeholder="Ex: mahamadou@zaure.org"
              required
              value={draft.email}
              onChange={(e) => updateFields({ email: e.target.value })}
              className="w-full text-sm pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 bg-slate-50 focus:bg-white transition"
            />
          </div>
        </div>

        {/* Numéro de téléphone avec sélection du pays et indicatif */}
        <div>
          <label htmlFor="reg-phone" className="block text-xs font-bold text-slate-700 mb-1.5">
            Numéro de téléphone <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              aria-label="Pays et indicatif téléphonique"
              value={draft.countryCode}
              onChange={(e) => selectCountry(e.target.value)}
              className="sm:w-[195px] shrink-0 text-xs font-bold px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-800 bg-slate-50 focus:bg-white transition cursor-pointer"
            >
              {COUNTRY_DIAL_CODES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name} ({c.dial})
                </option>
              ))}
            </select>

            <div className="relative flex-1 flex items-center border border-slate-200 rounded-xl bg-slate-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-600 transition overflow-hidden">
              <span className="pl-3 pr-2.5 py-2.5 text-xs font-extrabold text-blue-700 bg-blue-50/70 border-r border-slate-200 flex items-center gap-1 shrink-0 select-none">
                <Phone className="w-3.5 h-3.5" />
                <span>{selectedCountry.dial}</span>
              </span>
              <input
                id="reg-phone"
                type="tel"
                autoComplete="tel-national"
                placeholder={selectedCountry.placeholder}
                required
                value={draft.phoneLocal}
                onChange={(e) => handlePhoneLocalChange(e.target.value)}
                className="w-full text-sm px-3 py-2.5 bg-transparent focus:outline-none text-slate-900"
              />
            </div>
          </div>
          {fullPhoneNumber && (
            <p className="text-[11px] text-slate-500 mt-1 px-0.5">
              Format enregistré : <span className="font-bold text-slate-700">{fullPhoneNumber}</span>
            </p>
          )}
        </div>

        {/* Mot de passe et Confirmation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="reg-password"
              className="block text-xs font-bold text-slate-700 mb-1.5"
            >
              Mot de passe <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Min. 6 caractères"
                required
                value={draft.password}
                onChange={(e) => updateFields({ password: e.target.value })}
                className="w-full text-sm pl-9 pr-9 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 bg-slate-50 focus:bg-white transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="reg-password-confirm"
              className="block text-xs font-bold text-slate-700 mb-1.5"
            >
              Confirmation du mot de passe <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="reg-password-confirm"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Répétez le mot de passe"
                required
                value={draft.passwordConfirm}
                onChange={(e) => updateFields({ passwordConfirm: e.target.value })}
                className="w-full text-sm pl-9 pr-9 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 bg-slate-50 focus:bg-white transition"
              />
              {passwordsMatch && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-emerald-600 pointer-events-none">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bouton Continuer */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-xl transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Vérification...</span>
              </>
            ) : (
              <>
                <span>Continuer</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </RegistrationLayout>
  );
};
