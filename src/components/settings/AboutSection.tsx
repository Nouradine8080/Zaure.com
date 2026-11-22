import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Compass,
  ExternalLink,
  FileText,
  Info,
  LogOut,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users
} from 'lucide-react';
import { Circle, UserProfile, UserSettings } from '../../types';
import { zaureService } from '../../firebaseClient';
import { PWAInstallButton } from '../PWAInstallButton';
import ConfirmActionModal from './ConfirmActionModal';
import LegalDocumentModal from './LegalDocumentModal';

interface AboutSectionProps {
  currentUser: UserProfile;
  settings: UserSettings;
  onSaveSettings: (patch: Partial<UserSettings>) => Promise<boolean>;
  onSignOut: () => void;
  onImmediateSignOut?: () => void;
  onOpenCircles?: () => void;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}

export default function AboutSection({
  currentUser,
  settings,
  onSaveSettings,
  onSignOut,
  onImmediateSignOut,
  onOpenCircles,
  onNotify
}: AboutSectionProps) {
  const [circles, setCircles] = useState<Circle[]>([]);
  const [joinedIds, setJoinedIds] = useState<string[]>([]);
  const [legalDoc, setLegalDoc] = useState<'terms' | 'privacy' | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadCircles = async () => {
      try {
        const [all, joined] = await Promise.all([
          zaureService.getCircles(),
          zaureService.getJoinedCircleIds(currentUser.id)
        ]);
        if (!cancelled) {
          setCircles(all);
          setJoinedIds(joined);
        }
      } catch {
        // non-fatal
      }
    };
    loadCircles();
    return () => {
      cancelled = true;
    };
  }, [currentUser.id]);

  const joinedCircles = circles.filter((c) => joinedIds.includes(c.id));

  const handleConfirmDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'SUPPRIMER') {
      onNotify('Tapez SUPPRIMER pour confirmer la suppression définitive.', 'error');
      return;
    }

    setDeletingAccount(true);
    try {
      const res = await zaureService.deleteAccount(
        currentUser.id,
        deletePassword.trim() || undefined
      );
      if (res.success) {
        onNotify('Votre compte a été supprimé définitivement.');
        setShowDeleteModal(false);
        if (onImmediateSignOut) onImmediateSignOut();
        else onSignOut();
      } else {
        onNotify(res.error || 'Impossible de supprimer le compte.', 'error');
      }
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Identité et mission de ZAURE */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-extrabold text-slate-950 dark:text-white">ZAURE</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 text-[10px] font-extrabold">
                  Plateforme Sociale & Savoirs
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                Un espace communautaire moderne conçu pour partager des connaissances, échanger en
                direct et développer des cercles d’entraide constructifs.
              </p>
            </div>
          </div>

          <div className="shrink-0">
            <PWAInstallButton />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <p className="text-[10px] font-bold uppercase text-slate-400">Compte actif</p>
            <p className="text-xs font-extrabold text-slate-900 dark:text-white mt-0.5 truncate">
              {currentUser.nom}
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <p className="text-[10px] font-bold uppercase text-slate-400">Rôle</p>
            <p className="text-xs font-extrabold text-slate-900 dark:text-white mt-0.5 capitalize">
              {currentUser.role || 'utilisateur'}
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <p className="text-[10px] font-bold uppercase text-slate-400">Membre depuis</p>
            <p className="text-xs font-extrabold text-slate-900 dark:text-white mt-0.5">
              {currentUser.created_at
                ? new Date(currentUser.created_at).toLocaleDateString('fr-FR')
                : 'Récemment'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => setLegalDoc('terms')}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 transition"
          >
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Conditions d’utilisation</span>
          </button>
          <button
            type="button"
            onClick={() => setLegalDoc('privacy')}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 transition"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Politique de confidentialité</span>
          </button>
        </div>
      </section>

      {/* Vos cercles & découvertes */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
                Vos cercles & suggestions ({joinedCircles.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Aperçu rapide des cercles de savoir que vous avez rejoints.
              </p>
            </div>
          </div>

          {onOpenCircles && (
            <button
              type="button"
              onClick={onOpenCircles}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center gap-1.5 transition shrink-0"
            >
              <Compass className="w-4 h-4" />
              <span>Explorer</span>
            </button>
          )}
        </div>

        {joinedCircles.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {joinedCircles.slice(0, 4).map((c) => (
              <div
                key={c.id}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-extrabold text-xs flex items-center justify-center shrink-0">
                  {(c.nom || 'Z').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {c.nom}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {c.categorie}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Vous n’avez pas encore rejoint de cercle thématique.
          </p>
        )}

        <div className="flex items-center justify-between gap-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
          <div>
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              Masquer les suggestions de communautés
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Réduit les cartes de recommandation dans votre fil d’actualité.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(settings.masquer_suggestions)}
            onClick={async () => {
              const next = !settings.masquer_suggestions;
              const ok = await onSaveSettings({ masquer_suggestions: next });
              if (ok) {
                onNotify(
                  next ? 'Suggestions masquées.' : 'Suggestions de communautés réactivées.'
                );
              }
            }}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${
              settings.masquer_suggestions ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ${
                settings.masquer_suggestions ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </section>

      {/* Session & suppression du compte */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
              Session & gestion du compte
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Déconnectez-vous de cet appareil ou supprimez définitivement votre compte ZAURE.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onSignOut}
            className="min-h-[44px] flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold flex items-center justify-center gap-2 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Se déconnecter</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setDeleteConfirmText('');
              setDeletePassword('');
              setShowDeleteModal(true);
            }}
            className="min-h-[44px] flex-1 px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-950/70 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs font-bold flex items-center justify-center gap-2 transition"
          >
            <Trash2 className="w-4 h-4" />
            <span>Supprimer définitivement mon compte</span>
          </button>
        </div>
      </section>

      <LegalDocumentModal docType={legalDoc} onClose={() => setLegalDoc(null)} />

      <ConfirmActionModal
        isOpen={showDeleteModal}
        title="Supprimer définitivement votre compte ?"
        description="Cette action est irréversible : votre profil, vos paramètres et vos accès personnels ZAURE seront supprimés."
        confirmLabel="Supprimer définitivement"
        cancelLabel="Conserver mon compte"
        tone="danger"
        isLoading={deletingAccount}
        onConfirm={handleConfirmDeleteAccount}
        onCancel={() => !deletingAccount && setShowDeleteModal(false)}
      >
        <div className="space-y-3 pt-1">
          <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 flex items-start gap-2 text-[11px] text-red-700 dark:text-red-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Tapez <strong>SUPPRIMER</strong> ci-dessous pour confirmer la suppression définitive.
            </span>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
              Confirmation
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Tapez SUPPRIMER"
              className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
              Mot de passe actuel (recommandé par sécurité)
            </label>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Saisissez votre mot de passe si demandé"
              className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>
      </ConfirmActionModal>
    </div>
  );
}
