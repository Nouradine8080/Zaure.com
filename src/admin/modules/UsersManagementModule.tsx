import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  UserCheck,
  UserX,
  AlertTriangle,
  Trash2,
  Eye,
  X,
  Shield,
  KeyRound
} from 'lucide-react';
import { UserProfile } from '../../types';
import { AdminSessionContext, AuthUserSummary, UserModeration } from '../types';
import { adminService } from '../services/adminService';
import { ConfirmModal } from '../components/ConfirmModal';

interface UsersManagementProps {
  session: AdminSessionContext;
  users: UserProfile[];
  moderationMap: Record<string, UserModeration>;
  onRefresh: () => Promise<void>;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}

export const UsersManagementModule: React.FC<UsersManagementProps> = ({
  session,
  users,
  moderationMap,
  onRefresh,
  onNotify
}) => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'utilisateur' | 'mentor' | 'verifie'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'warned' | 'suspended'>('all');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [reasonInput, setReasonInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [authMap, setAuthMap] = useState<Record<string, AuthUserSummary>>({});

  useEffect(() => {
    let active = true;
    if (session.role === 'SUPER_ADMIN' || session.role === 'ADMIN') {
      adminService.getAuthUsersMetadata().then((res) => {
        if (!active || res.users.length === 0) return;
        const map: Record<string, AuthUserSummary> = {};
        res.users.forEach((u) => {
          map[u.uid] = u;
        });
        setAuthMap(map);
      });
    }
    return () => {
      active = false;
    };
  }, [session.role, users.length]);

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    tone: 'danger' | 'warning' | 'primary';
    action: () => Promise<void>;
  } | null>(null);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const modStatus = moderationMap[u.id]?.status || 'active';
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter !== 'all' && modStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        u.nom.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q) ||
        (u.phone || '').toLowerCase().includes(q)
      );
    });
  }, [users, moderationMap, search, roleFilter, statusFilter]);

  const handleModerationAction = (
    user: UserProfile,
    status: 'active' | 'warned' | 'suspended'
  ) => {
    const labelMap = {
      active: 'Réactiver ce compte utilisateur',
      warned: 'Émettre un avertissement officiel',
      suspended: 'Suspendre ce compte utilisateur'
    };
    setConfirmState({
      open: true,
      title: labelMap[status],
      description: `Confirmez-vous le changement de statut de "${user.nom}" vers "${status}" ? Cette opération sera inscrite dans le journal d'audit.`,
      confirmLabel: status === 'suspended' ? 'Suspendre' : 'Confirmer',
      tone: status === 'suspended' ? 'danger' : status === 'warned' ? 'warning' : 'primary',
      action: async () => {
        await adminService.setUserModerationStatus(
          session,
          user,
          status,
          reasonInput || `Statut modifié à ${status}`
        );
        onNotify(`Statut de ${user.nom} mis à jour (${status}).`);
        setReasonInput('');
        await onRefresh();
      }
    });
  };

  const handleBadgeChange = (
    user: UserProfile,
    nextBadge: 'utilisateur' | 'mentor' | 'verifie'
  ) => {
    if (user.role === nextBadge) return;
    setConfirmState({
      open: true,
      title: 'Modifier le badge communautaire',
      description: `Attribuer le badge "${nextBadge}" à ${user.nom} (n'accorde aucun privilège d'administration /admin) ?`,
      confirmLabel: 'Mettre à jour',
      tone: 'primary',
      action: async () => {
        await adminService.updateUserBadgeRole(session, user, nextBadge);
        onNotify(`Badge de ${user.nom} mis à jour vers ${nextBadge}.`);
        await onRefresh();
      }
    });
  };

  const handleDeleteUser = (user: UserProfile) => {
    if (user.id === session.uid) {
      onNotify('Vous ne pouvez pas supprimer votre propre compte actif.', 'error');
      return;
    }
    setConfirmState({
      open: true,
      title: 'Supprimer définitivement ce profil',
      description: `Cette action supprime les données Firestore de "${user.nom}" (${user.email || user.id}) et est irréversible.`,
      confirmLabel: 'Supprimer le profil',
      tone: 'danger',
      action: async () => {
        await adminService.deleteUserAccountData(session, user);
        if (selectedUser?.id === user.id) setSelectedUser(null);
        onNotify(`Profil de ${user.nom} supprimé.`);
        await onRefresh();
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, e-mail, téléphone ou UID..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700"
          >
            <option value="all">Tous les badges ({users.length})</option>
            <option value="utilisateur">Utilisateur</option>
            <option value="mentor">Mentor</option>
            <option value="verifie">Vérifié</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actif</option>
            <option value="warned">Averti</option>
            <option value="suspended">Suspendu</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Utilisateur</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Badge social</th>
                <th className="py-3 px-4">Statut</th>
                <th className="py-3 px-4">Inscription</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    Aucun utilisateur ne correspond aux critères sélectionnés.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const mod = moderationMap[u.id];
                  const status = mod?.status || 'active';
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2.5">
                          {u.avatar_url ? (
                            <img
                              src={u.avatar_url}
                              alt={u.nom}
                              className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                              {u.nom.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate max-w-[180px]">{u.nom}</p>
                            <p className="text-[11px] font-mono text-slate-400 truncate max-w-[180px]">{u.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <p className="text-slate-700 truncate max-w-[200px]">{u.email || 'Masqué (PII)'}</p>
                        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                          <span>{u.phone || '—'}</span>
                          {authMap[u.id] && (
                            <span
                              className={
                                authMap[u.id].disabled
                                  ? 'text-red-600 font-semibold'
                                  : authMap[u.id].emailVerified
                                    ? 'text-emerald-600'
                                    : 'text-amber-600'
                              }
                            >
                              · {authMap[u.id].disabled ? 'Auth bloqué' : authMap[u.id].emailVerified ? 'Vérifié' : 'Non vérifié'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <select
                          value={u.role}
                          onChange={(e) => handleBadgeChange(u, e.target.value as any)}
                          className="px-2 py-1 text-[11px] font-semibold bg-slate-50 border border-slate-200 rounded-md text-slate-800"
                        >
                          <option value="utilisateur">utilisateur (USER)</option>
                          <option value="mentor">mentor</option>
                          <option value="verifie">verifie</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            status === 'suspended'
                              ? 'text-red-600'
                              : status === 'warned'
                                ? 'text-amber-600'
                                : 'text-emerald-600'
                          }`}
                        >
                          {status === 'suspended'
                            ? 'Suspendu'
                            : status === 'warned'
                              ? 'Averti'
                              : 'Actif'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-[11px] text-slate-500">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUser(u);
                              setReasonInput(mod?.reason || '');
                            }}
                            title="Inspecter"
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {status !== 'suspended' ? (
                            <button
                              type="button"
                              onClick={() => handleModerationAction(u, 'suspended')}
                              title="Suspendre"
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-md"
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleModerationAction(u, 'active')}
                              title="Réactiver"
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u)}
                            title="Supprimer le profil"
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspection Drawer / Modal */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 flex justify-end"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="w-full max-w-md bg-white h-full border-l border-slate-200 p-6 overflow-y-auto space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Dossier Utilisateur</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="font-bold text-base text-slate-900">{selectedUser.nom}</p>
              <p className="font-mono text-slate-500 break-all">UID: {selectedUser.id}</p>
              <p className="text-slate-700">E-mail : {selectedUser.email || '—'}</p>
              <p className="text-slate-700">Téléphone : {selectedUser.phone || '—'}</p>
              <p className="text-slate-700">Langue : {selectedUser.langue_preferee.toUpperCase()}</p>
              <p className="text-slate-700">Bio : {selectedUser.bio || 'Aucune bio'}</p>
              {authMap[selectedUser.id] && (
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1 font-mono text-[11px]">
                  <p className="text-slate-700">
                    Auth e-mail : {authMap[selectedUser.id].emailVerified ? 'Vérifié' : 'Non vérifié'} · Compte{' '}
                    {authMap[selectedUser.id].disabled ? 'DÉSACTIVÉ' : 'ACTIF'}
                  </p>
                  {authMap[selectedUser.id].lastSignInTime && (
                    <p className="text-slate-500">
                      Dernière connexion : {new Date(authMap[selectedUser.id].lastSignInTime!).toLocaleString('fr-FR')}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Motif de décision / modération
              </label>
              <textarea
                rows={3}
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                placeholder="Motif documenté dans le journal d'audit..."
                className="w-full p-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleModerationAction(selectedUser, 'active')}
                  className="py-2 px-2.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Actif
                </button>
                <button
                  type="button"
                  onClick={() => handleModerationAction(selectedUser, 'warned')}
                  className="py-2 px-2.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white inline-flex items-center justify-center gap-1"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Avertir
                </button>
                <button
                  type="button"
                  onClick={() => handleModerationAction(selectedUser, 'suspended')}
                  className="py-2 px-2.5 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white"
                >
                  Suspendre
                </button>
              </div>

              {authMap[selectedUser.id] && selectedUser.id !== session.uid && (
                <button
                  type="button"
                  onClick={() => {
                    const targetAuth = authMap[selectedUser.id];
                    const nextDisabled = !targetAuth.disabled;
                    setConfirmState({
                      open: true,
                      title: nextDisabled
                        ? 'Désactiver Firebase Auth & révoquer les sessions'
                        : 'Réactiver Firebase Auth',
                      description: nextDisabled
                        ? `Désactiver le compte d'authentification de "${selectedUser.nom}" côté serveur et révoquer ses jetons actifs ?`
                        : `Réactiver l'authentification Firebase de "${selectedUser.nom}" ?`,
                      confirmLabel: nextDisabled ? 'Désactiver Auth' : 'Réactiver Auth',
                      tone: nextDisabled ? 'danger' : 'primary',
                      action: async () => {
                        const res = await adminService.toggleAuthUserDisabled(selectedUser.id, nextDisabled);
                        if (!res.ok) {
                          throw new Error(res.message || 'Impossible de mettre à jour Firebase Auth.');
                        }
                        setAuthMap((prev) => ({
                          ...prev,
                          [selectedUser.id]: { ...prev[selectedUser.id], disabled: nextDisabled }
                        }));
                        onNotify(
                          nextDisabled
                            ? `Authentification de ${selectedUser.nom} désactivée côté serveur.`
                            : `Authentification de ${selectedUser.nom} réactivée.`
                        );
                        await onRefresh();
                      }
                    });
                  }}
                  className="w-full py-2 px-3 text-xs font-semibold border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg inline-flex items-center justify-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>
                    {authMap[selectedUser.id].disabled
                      ? 'Réactiver Firebase Auth'
                      : 'Bloquer Firebase Auth & Révoquer sessions'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmState && (
        <ConfirmModal
          open={confirmState.open}
          title={confirmState.title}
          description={confirmState.description}
          confirmLabel={confirmState.confirmLabel}
          tone={confirmState.tone}
          isLoading={isProcessing}
          onCancel={() => setConfirmState(null)}
          onConfirm={async () => {
            setIsProcessing(true);
            try {
              await confirmState.action();
              setConfirmState(null);
            } catch (err: any) {
              onNotify(err?.message || 'Erreur lors de la mise à jour.', 'error');
            } finally {
              setIsProcessing(false);
            }
          }}
        />
      )}
    </div>
  );
};
