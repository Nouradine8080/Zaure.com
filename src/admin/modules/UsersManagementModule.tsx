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
  KeyRound,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Ban,
  History
} from 'lucide-react';
import { Capsule, GroupPost, UserProfile, UserReport } from '../../types';
import {
  AdminAuditLog,
  AdminSessionContext,
  AuthUserSummary,
  UserModeration
} from '../types';
import { adminService } from '../services/adminService';
import { ConfirmModal } from '../components/ConfirmModal';
import { canPerformAdminAction, parseTimestampMs } from '../utils/adminAnalytics';

interface UsersManagementProps {
  session: AdminSessionContext;
  users: UserProfile[];
  moderationMap: Record<string, UserModeration>;
  groupPosts: GroupPost[];
  capsules: Capsule[];
  userReports: UserReport[];
  auditLogs: AdminAuditLog[];
  initialSearch?: string;
  onRefresh: () => Promise<void>;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}

type SortField = 'nom' | 'role' | 'status' | 'created_at';
type SortDir = 'asc' | 'desc';

export const UsersManagementModule: React.FC<UsersManagementProps> = ({
  session,
  users,
  moderationMap,
  groupPosts,
  capsules,
  userReports,
  auditLogs,
  initialSearch = '',
  onRefresh,
  onNotify
}) => {
  const [search, setSearch] = useState(initialSearch);
  const [roleFilter, setRoleFilter] = useState<'all' | 'utilisateur' | 'mentor' | 'verifie'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'warned' | 'suspended'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | '7d' | '30d' | '90d'>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [reasonInput, setReasonInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [authMap, setAuthMap] = useState<Record<string, AuthUserSummary>>({});

  const canManageUsers = canPerformAdminAction(session, 'manageUsers');

  useEffect(() => {
    if (initialSearch) setSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, statusFilter, dateFilter, pageSize]);

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

  const filteredAndSortedUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const cutoff =
      dateFilter === '7d'
        ? now - 7 * 86400000
        : dateFilter === '30d'
          ? now - 30 * 86400000
          : dateFilter === '90d'
            ? now - 90 * 86400000
            : 0;

    const list = users.filter((u) => {
      const modStatus = moderationMap[u.id]?.status || 'active';
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter !== 'all' && modStatus !== statusFilter) return false;
      if (cutoff > 0) {
        const createdMs = parseTimestampMs(u.created_at);
        if (createdMs === null || createdMs < cutoff) return false;
      }
      if (!q) return true;
      return (
        u.nom.toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q) ||
        (u.phone || '').toLowerCase().includes(q)
      );
    });

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'nom') {
        cmp = (a.nom || '').localeCompare(b.nom || '');
      } else if (sortField === 'role') {
        cmp = (a.role || '').localeCompare(b.role || '');
      } else if (sortField === 'status') {
        const sA = moderationMap[a.id]?.status || 'active';
        const sB = moderationMap[b.id]?.status || 'active';
        cmp = sA.localeCompare(sB);
      } else {
        cmp = (a.created_at || '').localeCompare(b.created_at || '');
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [users, moderationMap, search, roleFilter, statusFilter, dateFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedUsers.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedUsers = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredAndSortedUsers.slice(start, start + pageSize);
  }, [filteredAndSortedUsers, safePage, pageSize]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'created_at' ? 'desc' : 'asc');
    }
  };

  const selectedUserActivity = useMemo(() => {
    if (!selectedUser) return { postsCount: 0, capsulesCount: 0, reportsAgainstCount: 0, logs: [] as AdminAuditLog[] };
    const postsCount = groupPosts.filter((p) => p.authorId === selectedUser.id).length;
    const capsulesCount = capsules.filter((c) => c.auteur_id === selectedUser.id).length;
    const reportsAgainstCount = userReports.filter((r) => r.reported_user_id === selectedUser.id).length;
    const logs = auditLogs
      .filter((l) => l.targetId === selectedUser.id || l.details.includes(selectedUser.id))
      .slice(0, 10);
    return { postsCount, capsulesCount, reportsAgainstCount, logs };
  }, [selectedUser, groupPosts, capsules, userReports, auditLogs]);

  const handleModerationAction = (
    user: UserProfile,
    status: 'active' | 'warned' | 'suspended'
  ) => {
    if (!canManageUsers) {
      onNotify('Permission manageUsers requise pour cette action.', 'error');
      return;
    }
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

  const handleBanUser = (user: UserProfile) => {
    if (!canManageUsers) {
      onNotify('Permission manageUsers requise pour bannir un compte.', 'error');
      return;
    }
    if (user.id === session.uid) {
      onNotify('Vous ne pouvez pas bannir votre propre compte.', 'error');
      return;
    }
    setConfirmState({
      open: true,
      title: 'Bannir définitivement ce compte',
      description: `Bannir "${user.nom}" appliquera une suspension administrative immédiate et tentera de désactiver Firebase Auth + révoquer les jetons actifs côté serveur.`,
      confirmLabel: 'Bannir le compte',
      tone: 'danger',
      action: async () => {
        const res = await adminService.banUserAccount(
          session,
          user,
          reasonInput || 'Non-respect grave des conditions Zaure'
        );
        if (res.authDisabled) {
          setAuthMap((prev) =>
            prev[user.id] ? { ...prev, [user.id]: { ...prev[user.id], disabled: true } } : prev
          );
          onNotify(`${user.nom} banni (Firestore + Firebase Auth désactivé).`);
        } else {
          onNotify(
            `${user.nom} suspendu/banni dans Firestore (${res.authMessage || 'Auth serveur non configuré IAM'}).`
          );
        }
        setReasonInput('');
        await onRefresh();
      }
    });
  };

  const handleBadgeChange = (
    user: UserProfile,
    nextBadge: 'utilisateur' | 'mentor' | 'verifie'
  ) => {
    if (!canManageUsers || user.role === nextBadge) return;
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
    if (!canManageUsers) {
      onNotify('Permission manageUsers requise.', 'error');
      return;
    }
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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, @pseudo, e-mail, téléphone ou UID..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-blue-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="min-h-[38px] px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
          >
            <option value="all">Tous les badges ({users.length})</option>
            <option value="utilisateur">Utilisateur</option>
            <option value="mentor">Mentor</option>
            <option value="verifie">Vérifié</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="min-h-[38px] px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actif</option>
            <option value="warned">Averti</option>
            <option value="suspended">Suspendu / Banni</option>
          </select>

          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="min-h-[38px] px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
          >
            <option value="all">Toute date</option>
            <option value="7d">Inscrits (7 jours)</option>
            <option value="30d">Inscrits (30 jours)</option>
            <option value="90d">Inscrits (90 jours)</option>
          </select>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('nom')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    <span>Utilisateur</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('role')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    <span>Badge social</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('status')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    <span>Statut</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('created_at')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    <span>Inscription</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500 dark:text-slate-400">
                    Aucun utilisateur ne correspond aux critères sélectionnés.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((u) => {
                  const mod = moderationMap[u.id];
                  const status = mod?.status || 'active';
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2.5">
                          {u.avatar_url ? (
                            <img
                              src={u.avatar_url}
                              alt={u.nom}
                              className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                              {u.nom.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-white truncate max-w-[180px]">
                              {u.nom}
                            </p>
                            <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 truncate max-w-[180px]">
                              {u.username ? `@${u.username}` : u.id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <p className="text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                          {u.email || 'Masqué (PII)'}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 dark:text-slate-500">
                          <span>{u.phone || '—'}</span>
                          {authMap[u.id] && (
                            <span
                              className={
                                authMap[u.id].disabled
                                  ? 'text-red-600 dark:text-red-400 font-semibold'
                                  : authMap[u.id].emailVerified
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-amber-600 dark:text-amber-400'
                              }
                            >
                              · {authMap[u.id].disabled ? 'Auth bloqué' : authMap[u.id].emailVerified ? 'Vérifié' : 'Non vérifié'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <select
                          disabled={!canManageUsers}
                          value={u.role}
                          onChange={(e) => handleBadgeChange(u, e.target.value as any)}
                          className="px-2 py-1 text-[11px] font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200 disabled:opacity-50"
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
                              ? 'text-red-600 dark:text-red-400'
                              : status === 'warned'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {status === 'suspended'
                            ? mod?.reason?.includes('[BANNISSEMENT]')
                              ? 'Banni'
                              : 'Suspendu'
                            : status === 'warned'
                              ? 'Averti'
                              : 'Actif'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
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
                            title="Inspecter le dossier"
                            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canManageUsers && (
                            <>
                              {status !== 'suspended' ? (
                                <button
                                  type="button"
                                  onClick={() => handleModerationAction(u, 'suspended')}
                                  title="Suspendre"
                                  className="p-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-md"
                                >
                                  <UserX className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleModerationAction(u, 'active')}
                                  title="Réactiver"
                                  className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-md"
                                >
                                  <UserCheck className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u)}
                                title="Supprimer le profil"
                                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Android Responsive Card List */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {paginatedUsers.length === 0 ? (
            <p className="py-10 px-4 text-center text-xs text-slate-500 dark:text-slate-400">
              Aucun utilisateur ne correspond aux critères sélectionnés.
            </p>
          ) : (
            paginatedUsers.map((u) => {
              const mod = moderationMap[u.id];
              const status = mod?.status || 'active';
              return (
                <div key={u.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {u.avatar_url ? (
                        <img
                          src={u.avatar_url}
                          alt={u.nom}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-900 dark:bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                          {u.nom.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{u.nom}</p>
                        <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                          {u.email || u.id}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-semibold shrink-0 ${
                        status === 'suspended'
                          ? 'text-red-600 dark:text-red-400'
                          : status === 'warned'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {status === 'suspended' ? 'Suspendu' : status === 'warned' ? 'Averti' : 'Actif'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    <span>Badge : {u.role}</span>
                    <span>{u.created_at ? new Date(u.created_at).toLocaleDateString('fr-FR') : '—'}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUser(u);
                        setReasonInput(mod?.reason || '');
                      }}
                      className="min-h-[40px] flex-1 px-3 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg inline-flex items-center justify-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Dossier</span>
                    </button>
                    {canManageUsers && status !== 'suspended' && (
                      <button
                        type="button"
                        onClick={() => handleModerationAction(u, 'suspended')}
                        className="min-h-[40px] px-3 py-2 text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900 rounded-lg"
                      >
                        Suspendre
                      </button>
                    )}
                    {canManageUsers && status === 'suspended' && (
                      <button
                        type="button"
                        onClick={() => handleModerationAction(u, 'active')}
                        className="min-h-[40px] px-3 py-2 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 rounded-lg"
                      >
                        Réactiver
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Bar */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <span className="font-mono tabular-nums">
              {filteredAndSortedUsers.length} résultat(s) · Page {safePage}/{totalPages}
            </span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Lignes par page"
              className="px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md"
            >
              <option value={10}>10 / page</option>
              <option value={15}>15 / page</option>
              <option value={30}>30 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="min-h-[36px] px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 inline-flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Préc.</span>
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="min-h-[36px] px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 inline-flex items-center gap-1"
            >
              <span>Suiv.</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Rich Inspection Drawer */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-[1px] flex justify-end"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 h-full border-l border-slate-200 dark:border-slate-800 p-6 overflow-y-auto space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Dossier Utilisateur</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                aria-label="Fermer le dossier"
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 text-xs min-w-0">
                <p className="font-bold text-base text-slate-900 dark:text-white">{selectedUser.nom}</p>
                {selectedUser.username && (
                  <p className="font-mono text-blue-600 dark:text-blue-400">@{selectedUser.username}</p>
                )}
                <p className="font-mono text-slate-500 dark:text-slate-400 break-all">UID: {selectedUser.id}</p>
              </div>
              <a
                href={`/?profile=${encodeURIComponent(selectedUser.id)}`}
                target="_blank"
                rel="noreferrer"
                className="min-h-[36px] px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg inline-flex items-center gap-1.5 shrink-0"
              >
                <span>Profil public</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <p className="text-base font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                  {selectedUserActivity.postsCount}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Publications</p>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <p className="text-base font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                  {selectedUserActivity.capsulesCount}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Capsules</p>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <p className="text-base font-extrabold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                  {selectedUserActivity.reportsAgainstCount}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Signalements</p>
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
              <p>E-mail : {selectedUser.email || '—'}</p>
              <p>Téléphone : {selectedUser.phone || '—'}</p>
              <p>Localisation : {selectedUser.localisation || '—'}</p>
              <p>Langue : {selectedUser.langue_preferee.toUpperCase()}</p>
              <p className="leading-relaxed">Bio : {selectedUser.bio || 'Aucune bio'}</p>
              {authMap[selectedUser.id] && (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1 font-mono text-[11px] mt-2">
                  <p className="text-slate-700 dark:text-slate-200">
                    Auth e-mail : {authMap[selectedUser.id].emailVerified ? 'Vérifié' : 'Non vérifié'} · Compte{' '}
                    {authMap[selectedUser.id].disabled ? 'DÉSACTIVÉ' : 'ACTIF'}
                  </p>
                  {authMap[selectedUser.id].lastSignInTime && (
                    <p className="text-slate-500 dark:text-slate-400">
                      Dernière connexion :{' '}
                      {new Date(authMap[selectedUser.id].lastSignInTime!).toLocaleString('fr-FR')}
                    </p>
                  )}
                </div>
              )}
            </div>

            {canManageUsers && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Motif de décision / modération
                </label>
                <textarea
                  rows={3}
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder="Motif documenté dans le journal d'audit..."
                  className="w-full p-2.5 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-600"
                />
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleModerationAction(selectedUser, 'active')}
                    className="min-h-[40px] py-2 px-2.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Réactiver
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModerationAction(selectedUser, 'warned')}
                    className="min-h-[40px] py-2 px-2.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white inline-flex items-center justify-center gap-1"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Avertir
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModerationAction(selectedUser, 'suspended')}
                    className="min-h-[40px] py-2 px-2.5 text-xs font-semibold rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white"
                  >
                    Suspendre
                  </button>
                </div>

                <button
                  type="button"
                  disabled={selectedUser.id === session.uid}
                  onClick={() => handleBanUser(selectedUser)}
                  className="min-h-[40px] w-full py-2 px-3 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg inline-flex items-center justify-center gap-1.5 disabled:opacity-40"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Bannir le compte (Suspension + Révocation Auth)</span>
                </button>

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
                    className="min-h-[40px] w-full py-2 px-3 text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg inline-flex items-center justify-center gap-1.5"
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
            )}

            {/* User Audit History */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                <History className="w-3.5 h-3.5 text-slate-400" />
                <span>Historique administratif ({selectedUserActivity.logs.length})</span>
              </div>
              {selectedUserActivity.logs.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Aucune action administrative enregistrée pour cet utilisateur.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedUserActivity.logs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-semibold text-blue-700 dark:text-blue-400">
                          {log.action}
                        </span>
                        <span className="font-mono text-slate-400">
                          {new Date(log.createdAt).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 mt-1">{log.details}</p>
                    </div>
                  ))}
                </div>
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
