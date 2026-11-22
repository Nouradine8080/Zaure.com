import React, { useEffect, useState } from 'react';
import { ExternalLink, Loader2, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import { UserProfile, UserSettings } from '../../types';
import { sanitizeUsername, zaureService } from '../../firebaseClient';
import ConfirmActionModal from './ConfirmActionModal';

interface BlockedUsersSectionProps {
  settings: UserSettings;
  onSettingsChange: (patch: Partial<UserSettings>) => void;
  onOpenUserProfile?: (userId: string) => void;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}

export default function BlockedUsersSection({
  settings,
  onSettingsChange,
  onOpenUserProfile,
  onNotify
}: BlockedUsersSectionProps) {
  const blockedIds = settings.utilisateurs_bloques || [];
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmTarget, setConfirmTarget] = useState<UserProfile | null>(null);
  const [unblocking, setUnblocking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadBlockedProfiles = async () => {
      if (blockedIds.length === 0) {
        setProfiles([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const allUsers = await zaureService.getAvailableUsers();
        const byId = new Map(allUsers.map((u) => [u.id, u]));
        const resolved = await Promise.all(
          blockedIds.map(async (id) => {
            const cached = byId.get(id);
            if (cached) return cached;
            const fetched = await zaureService.getUserPublicProfile(id);
            if (fetched) return fetched;
            return {
              id,
              nom: 'Utilisateur Zaure',
              username: id.slice(0, 12),
              email: '',
              bio: null,
              avatar_url: null,
              role: 'utilisateur',
              langue_preferee: 'fr'
            } as UserProfile;
          })
        );
        if (!cancelled) setProfiles(resolved);
      } catch {
        if (!cancelled) {
          setProfiles(
            blockedIds.map((id) => ({
              id,
              nom: 'Utilisateur Zaure',
              username: id.slice(0, 12),
              email: '',
              bio: null,
              avatar_url: null,
              role: 'utilisateur',
              langue_preferee: 'fr'
            }))
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadBlockedProfiles();
    return () => {
      cancelled = true;
    };
  }, [blockedIds.join(',')]);

  const handleConfirmUnblock = async () => {
    if (!confirmTarget) return;
    setUnblocking(true);
    try {
      const ok = await zaureService.unblockUser(confirmTarget.id);
      if (ok) {
        const nextIds = blockedIds.filter((id) => id !== confirmTarget.id);
        onSettingsChange({ utilisateurs_bloques: nextIds });
        onNotify(`${confirmTarget.nom} a été débloqué.`);
        setConfirmTarget(null);
      } else {
        onNotify('Impossible de débloquer cet utilisateur pour le moment.', 'error');
      }
    } finally {
      setUnblocking(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
                Utilisateurs bloqués ({blockedIds.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Les personnes bloquées ne peuvent plus vous envoyer de messages ni vous mentionner.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-10 flex items-center justify-center text-slate-400 gap-2 text-xs">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Chargement des comptes bloqués...</span>
          </div>
        ) : profiles.length === 0 ? (
          <div className="py-10 px-4 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 space-y-2">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              Aucun utilisateur bloqué
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Vous n’avez bloqué aucun membre pour le moment. Vous pouvez bloquer un compte depuis
              son profil ou depuis une conversation privée.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {profiles.map((u) => {
              const handle = sanitizeUsername(u.username, u.nom);
              return (
                <div
                  key={u.id}
                  className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={
                        u.avatar_url ||
                        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.nom)}`
                      }
                      alt={u.nom}
                      className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-700 bg-slate-100 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs sm:text-[13px] font-extrabold text-slate-950 dark:text-white truncate">
                          {u.nom}
                        </p>
                        {u.role !== 'utilisateur' && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase">
                            {u.role}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        @{handle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {onOpenUserProfile && (
                      <button
                        type="button"
                        onClick={() => onOpenUserProfile(u.id)}
                        className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Voir le profil</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setConfirmTarget(u)}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Débloquer</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <ConfirmActionModal
        isOpen={Boolean(confirmTarget)}
        title={confirmTarget ? `Débloquer ${confirmTarget.nom} ?` : 'Débloquer ce compte ?'}
        description={
          confirmTarget
            ? `Après déblocage, ${confirmTarget.nom} (@${sanitizeUsername(
                confirmTarget.username,
                confirmTarget.nom
              )}) pourra de nouveau consulter votre profil selon vos règles de confidentialité et interagir avec vous.`
            : ''
        }
        confirmLabel="Oui, débloquer"
        cancelLabel="Annuler"
        tone="warning"
        isLoading={unblocking}
        onConfirm={handleConfirmUnblock}
        onCancel={() => !unblocking && setConfirmTarget(null)}
      />
    </div>
  );
}
