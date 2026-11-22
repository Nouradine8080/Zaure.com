import React, { useEffect, useState } from 'react';
import {
  AtSign,
  Eye,
  Globe,
  Loader2,
  Lock,
  MessageCircle,
  MessageSquare,
  Save,
  Shield,
  Users
} from 'lucide-react';
import {
  DEFAULT_PRIVACY_SETTINGS,
  InteractionAudience,
  MessageAudience,
  PrivacyAudience,
  UserPrivacySettings,
  UserProfile,
  UserSettings
} from '../../types';
import { normalizePrivacySettings, zaureService } from '../../firebaseClient';

interface PrivacySectionProps {
  currentUser: UserProfile;
  settings: UserSettings;
  onProfileUpdated: (updated: UserProfile) => void;
  onSaveSettings: (patch: Partial<UserSettings>) => Promise<boolean>;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}

const VISIBILITY_OPTIONS: Array<{ value: PrivacyAudience; label: string }> = [
  { value: 'public', label: 'Tout le monde (Public)' },
  { value: 'followers', label: 'Mes abonnés uniquement' },
  { value: 'cercles', label: 'Membres de mes communautés / cercles' },
  { value: 'private', label: 'Moi uniquement (Privé)' }
];

const MESSAGE_OPTIONS: Array<{ value: MessageAudience; label: string }> = [
  { value: 'tous', label: 'Tous les membres' },
  { value: 'followers', label: 'Mes abonnés uniquement' },
  { value: 'cercles', label: 'Membres de mes cercles & abonnés' },
  { value: 'mentors', label: 'Mentors et profils vérifiés' },
  { value: 'personne', label: 'Personne (désactiver les messages privés)' }
];

const INTERACTION_OPTIONS: Array<{ value: InteractionAudience; label: string }> = [
  { value: 'tous', label: 'Tout le monde' },
  { value: 'followers', label: 'Mes abonnés uniquement' },
  { value: 'cercles', label: 'Membres de mes cercles & abonnés' },
  { value: 'personne', label: 'Personne' }
];

export default function PrivacySection({
  currentUser,
  settings,
  onProfileUpdated,
  onSaveSettings,
  onNotify
}: PrivacySectionProps) {
  const [privacy, setPrivacy] = useState<UserPrivacySettings>(() =>
    normalizePrivacySettings(settings.privacy_settings || currentUser.privacy_settings)
  );
  const [mentoratAutorise, setMentoratAutorise] = useState<'tous' | 'verifies' | 'aucun'>(
    settings.mentorat_autorise || 'tous'
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPrivacy(
      normalizePrivacySettings(settings.privacy_settings || currentUser.privacy_settings)
    );
    setMentoratAutorise(settings.mentorat_autorise || 'tous');
  }, [settings.privacy_settings, settings.mentorat_autorise, currentUser.privacy_settings]);

  const handleSavePrivacy = async () => {
    setSaving(true);
    try {
      const normalized = normalizePrivacySettings(privacy);
      const legacyProfilVisibilite: 'public' | 'cercles' | 'mentors' =
        normalized.profileMode === 'private' || normalized.infoVisibility === 'private'
          ? 'mentors'
          : normalized.infoVisibility === 'cercles' || normalized.infoVisibility === 'followers'
          ? 'cercles'
          : 'public';

      const legacyCapsulesVisibilite: 'public' | 'cercles' | 'mentors' =
        normalized.postsVisibility === 'private'
          ? 'mentors'
          : normalized.postsVisibility === 'cercles' || normalized.postsVisibility === 'followers'
          ? 'cercles'
          : 'public';

      const legacyMessages: 'tous' | 'cercles' | 'mentors' =
        normalized.allowMessages === 'mentors'
          ? 'mentors'
          : normalized.allowMessages === 'cercles' ||
            normalized.allowMessages === 'followers' ||
            normalized.allowMessages === 'personne'
          ? 'cercles'
          : 'tous';

      const ok = await onSaveSettings({
        privacy_settings: normalized,
        profil_visibilite: legacyProfilVisibilite,
        capsules_visibilite: legacyCapsulesVisibilite,
        messages_autorises: legacyMessages,
        mentorat_autorise: mentoratAutorise
      });

      const profOk = await zaureService.updateUserProfile(currentUser.id, {
        privacy_settings: normalized
      });

      if (ok && profOk) {
        onProfileUpdated({
          ...currentUser,
          privacy_settings: normalized
        });
        onNotify('Paramètres de confidentialité enregistrés.');
      } else {
        onNotify('Impossible d’enregistrer les paramètres de confidentialité.', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Mode du profil */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
              Mode de visibilité du profil
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Choisissez si votre profil est ouvert à la communauté ou réservé à vos abonnés.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setPrivacy((p) => ({ ...p, profileMode: 'public' }))}
            className={`text-left p-4 rounded-2xl border transition min-h-[44px] ${
              privacy.profileMode === 'public'
                ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm text-slate-950 dark:text-white">
              <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Profil public
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Votre bio, vos publications publiques et vos communautés sont visibles selon vos règles ci-dessous.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setPrivacy((p) => ({ ...p, profileMode: 'private' }))}
            className={`text-left p-4 rounded-2xl border transition min-h-[44px] ${
              privacy.profileMode === 'private'
                ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm text-slate-950 dark:text-white">
              <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Profil privé
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Seuls vos abonnés peuvent consulter le contenu détaillé de votre profil.
            </p>
          </button>
        </div>
      </section>

      {/* 2. Qui peut voir vos contenus et listes */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
              Visibilité des informations & publications
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Rappel : votre e-mail, téléphone et date de naissance restent toujours privés.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
              Informations personnelles (profession, formation, site…)
            </label>
            <select
              value={privacy.infoVisibility}
              onChange={(e) =>
                setPrivacy((p) => ({ ...p, infoVisibility: e.target.value as PrivacyAudience }))
              }
              className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              {VISIBILITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
              Visibilité de mes publications
            </label>
            <select
              value={privacy.postsVisibility}
              onChange={(e) =>
                setPrivacy((p) => ({ ...p, postsVisibility: e.target.value as PrivacyAudience }))
              }
              className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              {VISIBILITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
              Liste de mes abonnés
            </label>
            <select
              value={privacy.followersVisibility}
              onChange={(e) =>
                setPrivacy((p) => ({ ...p, followersVisibility: e.target.value as PrivacyAudience }))
              }
              className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              {VISIBILITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
              Liste de mes abonnements
            </label>
            <select
              value={privacy.followingVisibility}
              onChange={(e) =>
                setPrivacy((p) => ({ ...p, followingVisibility: e.target.value as PrivacyAudience }))
              }
              className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              {VISIBILITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
              Communautés et cercles rejoints
            </label>
            <select
              value={privacy.communitiesVisibility}
              onChange={(e) =>
                setPrivacy((p) => ({
                  ...p,
                  communitiesVisibility: e.target.value as PrivacyAudience
                }))
              }
              className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              {VISIBILITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* 3. Interactions autorisées */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
              Messagerie, commentaires & mentions
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Ces règles sont appliquées directement dans les discussions privées, le fil d’actualité et les communautés.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Qui peut m’envoyer un message privé
            </label>
            <select
              value={privacy.allowMessages}
              onChange={(e) =>
                setPrivacy((p) => ({ ...p, allowMessages: e.target.value as MessageAudience }))
              }
              className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              {MESSAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                <MessageCircle className="w-3.5 h-3.5" /> Qui peut commenter mes publications
              </label>
              <select
                value={privacy.allowComments || DEFAULT_PRIVACY_SETTINGS.allowComments}
                onChange={(e) =>
                  setPrivacy((p) => ({
                    ...p,
                    allowComments: e.target.value as InteractionAudience
                  }))
                }
                className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                {INTERACTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                <AtSign className="w-3.5 h-3.5" /> Qui peut me mentionner (@)
              </label>
              <select
                value={privacy.allowMentions || DEFAULT_PRIVACY_SETTINGS.allowMentions}
                onChange={(e) =>
                  setPrivacy((p) => ({
                    ...p,
                    allowMentions: e.target.value as InteractionAudience
                  }))
                }
                className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                {INTERACTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
              <Users className="w-3.5 h-3.5" /> Demandes de mentorat
            </label>
            <select
              value={mentoratAutorise}
              onChange={(e) =>
                setMentoratAutorise(e.target.value as 'tous' | 'verifies' | 'aucun')
              }
              className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="tous">Accepter les demandes de toute la communauté</option>
              <option value="verifies">Profils vérifiés & mentors uniquement</option>
              <option value="aucun">Suspendre les nouvelles demandes</option>
            </select>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={handleSavePrivacy}
            disabled={saving}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Enregistrer la confidentialité</span>
          </button>
        </div>
      </section>
    </div>
  );
}
