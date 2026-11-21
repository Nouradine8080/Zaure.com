import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  Check,
  Eye,
  FileText,
  Globe,
  Loader2,
  Lock,
  MessageSquare,
  Settings,
  Shield,
  Users,
  X
} from 'lucide-react';
import {
  DEFAULT_PRIVACY_SETTINGS,
  MessageAudience,
  PrivacyAudience,
  UserPrivacySettings,
  UserProfile
} from '../../types';
import { normalizePrivacySettings, zaureService } from '../../firebaseClient';

interface ProfilePrivacyModalProps {
  isOpen: boolean;
  user: UserProfile;
  onClose: () => void;
  onSaved: (updated: UserProfile) => void;
  onOpenFullSettings: () => void;
}

const AUDIENCE_OPTIONS: { value: PrivacyAudience; label: string }[] = [
  { value: 'public', label: 'Tout le monde' },
  { value: 'followers', label: 'Abonnés' },
  { value: 'cercles', label: 'Mes cercles' },
  { value: 'private', label: 'Moi uniquement' }
];

const MESSAGE_OPTIONS: { value: MessageAudience; label: string }[] = [
  { value: 'tous', label: 'Tout le monde' },
  { value: 'followers', label: 'Mes abonnés' },
  { value: 'cercles', label: 'Membres de mes cercles' },
  { value: 'mentors', label: 'Mentors & vérifiés' },
  { value: 'personne', label: 'Personne' }
];

export default function ProfilePrivacyModal({
  isOpen,
  user,
  onClose,
  onSaved,
  onOpenFullSettings
}: ProfilePrivacyModalProps) {
  const [privacy, setPrivacy] = useState<UserPrivacySettings>(() =>
    normalizePrivacySettings(user.privacy_settings || DEFAULT_PRIVACY_SETTINGS)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPrivacy(normalizePrivacySettings(user.privacy_settings || DEFAULT_PRIVACY_SETTINGS));
      setError(null);
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { user: updated, error: err } = await zaureService.updateUserProfile(user.id, {
        privacy_settings: privacy
      });
      if (err || !updated) {
        throw new Error(err || 'Erreur lors de la sauvegarde.');
      }

      // Sync legacy settings fields smoothly
      await zaureService.saveUserSettings(user.id, {
        privacy_settings: privacy,
        profil_visibilite:
          privacy.profileMode === 'private' || privacy.infoVisibility === 'cercles'
            ? 'cercles'
            : 'public',
        capsules_visibilite: privacy.postsVisibility === 'cercles' ? 'cercles' : 'public',
        messages_autorises:
          privacy.allowMessages === 'cercles'
            ? 'cercles'
            : privacy.allowMessages === 'mentors'
            ? 'mentors'
            : 'tous'
      });

      onSaved(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Impossible de mettre à jour la confidentialité.');
    } finally {
      setSaving(false);
    }
  };

  const audienceRows: {
    key: keyof Omit<UserPrivacySettings, 'profileMode' | 'allowMessages'>;
    label: string;
    desc: string;
    icon: React.ElementType;
  }[] = [
    {
      key: 'infoVisibility',
      label: 'Informations personnelles (À propos)',
      desc: 'Profession, formation, localisation, site web et informations complémentaires.',
      icon: Eye
    },
    {
      key: 'postsVisibility',
      label: 'Publications, photos et vidéos',
      desc: 'Visibilité des onglets Publications, Photos et Vidéos sur votre profil.',
      icon: FileText
    },
    {
      key: 'followersVisibility',
      label: 'Liste de vos abonnés',
      desc: 'Qui peut consulter la liste des membres qui vous suivent.',
      icon: Users
    },
    {
      key: 'followingVisibility',
      label: 'Liste de vos abonnements',
      desc: 'Qui peut consulter la liste des membres que vous suivez.',
      icon: Users
    },
    {
      key: 'communitiesVisibility',
      label: 'Communautés rejointes',
      desc: 'Visibilité de vos communautés publiques sur votre profil.',
      icon: Globe
    }
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-950">
                Confidentialité du profil
              </h3>
              <p className="text-[11px] text-slate-500">
                Contrôlez précisément qui voit vos informations et peut vous écrire.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-slate-100 text-slate-500 flex items-center justify-center transition"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {error && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                {error}
              </div>
            )}

            {/* Profile Mode Switch (Public vs Private) */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs sm:text-sm font-extrabold text-slate-950 flex items-center gap-1.5">
                    {privacy.profileMode === 'private' ? (
                      <Lock className="w-4 h-4 text-amber-600" />
                    ) : (
                      <Globe className="w-4 h-4 text-blue-600" />
                    )}
                    <span>Mode du profil</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    En mode privé, seuls vos abonnés peuvent consulter vos publications, médias et détails.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPrivacy((p) => ({ ...p, profileMode: 'public' }))}
                  className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    privacy.profileMode === 'public'
                      ? 'border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-500/30'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Profil public</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrivacy((p) => ({ ...p, profileMode: 'private' }))}
                  className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    privacy.profileMode === 'private'
                      ? 'border-amber-600 bg-amber-50 text-amber-900 ring-1 ring-amber-500/30'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Profil privé</span>
                </button>
              </div>
            </div>

            {/* Granular Section Controls */}
            <div className="space-y-3">
              {audienceRows.map((row) => {
                const Icon = row.icon;
                return (
                  <div
                    key={row.key}
                    className="p-3.5 rounded-2xl border border-slate-200/80 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>{row.label}</span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{row.desc}</p>
                    </div>
                    <select
                      value={privacy[row.key]}
                      onChange={(e) =>
                        setPrivacy((p) => ({
                          ...p,
                          [row.key]: e.target.value as PrivacyAudience
                        }))
                      }
                      className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#F0F2F5] border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 shrink-0"
                    >
                      {AUDIENCE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}

              {/* Direct Messages Permission */}
              <div className="p-3.5 rounded-2xl border border-slate-200/80 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Qui peut vous envoyer des messages</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Détermine qui peut démarrer une discussion directe depuis votre profil.
                  </p>
                </div>
                <select
                  value={privacy.allowMessages}
                  onChange={(e) =>
                    setPrivacy((p) => ({
                      ...p,
                      allowMessages: e.target.value as MessageAudience
                    }))
                  }
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#F0F2F5] border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 shrink-0"
                >
                  {MESSAGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenFullSettings();
              }}
              className="w-full min-h-[42px] px-4 py-2 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-xs font-bold text-slate-700 flex items-center justify-center gap-2 transition"
            >
              <Settings className="w-4 h-4 text-slate-500" />
              <span>Accéder aux paramètres complets (compte, blocages, langue)</span>
            </button>
          </div>

          {/* Footer */}
          <div className="px-4 sm:px-6 py-3.5 border-t border-slate-100 bg-white flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>{saving ? 'Enregistrement...' : 'Appliquer'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body
  );
}
