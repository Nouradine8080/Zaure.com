import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Check, Sparkles, Users } from 'lucide-react';
import {
  AVATAR_PRESETS,
  REGISTRATION_ROUTES,
  VOCATION_OPTIONS,
} from '../../constants/registration';
import { useRegistration } from '../../context/RegistrationContext';
import { Circle, UserProfile } from '../../types';
import { compressImageFile } from '../../utils/imageCompressor';
import { RegistrationLayout } from './RegistrationLayout';

interface RegistrationCirclesAvatarPageProps {
  circles: Circle[];
  onRegistrationSuccess: (user: UserProfile) => void;
}

export const RegistrationCirclesAvatarPage: React.FC<RegistrationCirclesAvatarPageProps> = ({
  circles,
  onRegistrationSuccess,
}) => {
  const navigate = useNavigate();
  const {
    draft,
    fullPhoneNumber,
    isStep1Complete,
    isStep2Complete,
    isSubmitting,
    setErrorMessage,
    updateFields,
    toggleCircleSelect,
    autoSelectInitialCircles,
    finalizeRegistration,
  } = useRegistration();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCompressingAvatar, setIsCompressingAvatar] = useState(false);

  useEffect(() => {
    autoSelectInitialCircles(circles);
  }, [circles, autoSelectInitialCircles]);

  if (!isStep1Complete) {
    return <Navigate to={REGISTRATION_ROUTES.IDENTITE} replace />;
  }

  if (!isStep2Complete) {
    return <Navigate to={REGISTRATION_ROUTES.VOCATION} replace />;
  }

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressingAvatar(true);
      const dataUrl = await compressImageFile(file, 250, 250, 0.8);
      updateFields({ avatarUrl: dataUrl });
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erreur lors du traitement de la photo.');
    } finally {
      setIsCompressingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await finalizeRegistration((user) => {
      onRegistrationSuccess(user);
      navigate('/', { replace: true });
    });
  };

  const selectedVocation = VOCATION_OPTIONS.find((v) => v.id === draft.specialty);

  return (
    <RegistrationLayout
      currentStep={3}
      pageTitle="3. Cercles & Avatar — Inscription Zaure"
      title="Cercles & Avatar"
      subtitle="Personnalisez votre avatar et sélectionnez vos premiers cercles de savoir."
      icon={<Sparkles className="w-5 h-5" />}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Photo de profil / Avatar */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Photo de profil / Avatar
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarFileChange}
            className="hidden"
          />

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 mb-2.5 flex items-center gap-3">
            <img
              src={draft.avatarUrl}
              alt="Aperçu avatar"
              className="w-14 h-14 rounded-full object-cover ring-2 ring-blue-600 shrink-0 bg-white"
            />
            <div className="flex-1 min-w-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isCompressingAvatar || isSubmitting}
                className="w-full px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-200 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Camera className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="truncate">
                  {isCompressingAvatar
                    ? 'Traitement photo...'
                    : 'Importer ma propre photo (Galerie)'}
                </span>
              </button>
            </div>
          </div>

          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
            Ou choisir un modèle :
          </p>
          <div className="grid grid-cols-6 gap-2">
            {AVATAR_PRESETS.map((preset) => {
              const active = draft.avatarUrl === preset.url;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => updateFields({ avatarUrl: preset.url })}
                  title={preset.label}
                  className={`relative rounded-xl overflow-hidden aspect-square border-2 transition ${
                    active
                      ? 'border-blue-600 ring-2 ring-blue-500/35 scale-105 shadow-xs'
                      : 'border-transparent opacity-75 hover:opacity-100 hover:border-slate-300'
                  }`}
                >
                  <img src={preset.url} alt={preset.label} className="w-full h-full object-cover" />
                  {active && (
                    <div className="absolute inset-0 bg-blue-600/30 flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sélection des Cercles */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Rejoindre vos premiers cercles :
            </label>
            {circles.length > 0 && (
              <span className="text-[11px] font-bold text-blue-700">
                {draft.selectedCircleIds.length} sélectionné(s)
              </span>
            )}
          </div>

          {circles.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
              {circles.map((circle) => {
                const isSelected = draft.selectedCircleIds.includes(circle.id);
                return (
                  <button
                    key={circle.id}
                    type="button"
                    onClick={() => toggleCircleSelect(circle.id)}
                    className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2.5 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/80 text-blue-950 font-bold shadow-2xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <img
                      src={circle.image}
                      alt={circle.nom}
                      className="w-8 h-8 rounded-lg object-cover shrink-0 bg-slate-100"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate">{circle.nom}</p>
                      <span className="text-[10px] text-slate-500 truncate block">
                        {circle.categorie}
                      </span>
                    </div>
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] shrink-0 transition ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'border border-slate-300 text-transparent'
                      }`}
                    >
                      ✓
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2.5 text-xs text-slate-600">
              <Users className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                Vous pourrez découvrir, rejoindre ou créer vos cercles dès votre arrivée dans{' '}
                <strong className="text-slate-800">Communautés</strong>.
              </span>
            </div>
          )}
        </div>

        {/* Résumé compact du compte */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex items-center gap-3">
          <img
            src={draft.avatarUrl}
            alt={draft.nom || 'Profil'}
            className="w-10 h-10 rounded-full object-cover border border-white shadow-xs shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold text-slate-900 truncate">
              {draft.nom || 'Nouvel Utilisateur'}
            </p>
            <p className="text-[11px] text-slate-500 truncate">
              {draft.email} {fullPhoneNumber ? `• ${fullPhoneNumber}` : ''}
            </p>
            <p className="text-[10px] font-bold text-blue-700 mt-0.5 truncate">
              {selectedVocation?.title || 'Membre'} • Langue : {draft.langue.toUpperCase()}
            </p>
          </div>
        </div>

        {/* Boutons Retour & Terminer l'inscription */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => navigate(REGISTRATION_ROUTES.VOCATION)}
            className="px-4 py-2.5 border border-slate-200 text-slate-700 text-xs sm:text-sm rounded-xl hover:bg-slate-50 font-bold transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour</span>
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 sm:flex-none px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs sm:text-sm rounded-xl transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Création en cours...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Terminer l'inscription</span>
              </>
            )}
          </button>
        </div>
      </form>
    </RegistrationLayout>
  );
};
