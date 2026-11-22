import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Users,
  UserCheck,
  UserPlus,
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
  History,
  Pencil,
  FileText,
  MessageSquare,
  Layers,
  Save,
  RotateCcw
} from 'lucide-react';
import {
  Capsule,
  Circle,
  CircleMember,
  Comment,
  CommunityGroup,
  CommunityMember,
  GroupPost,
  PostComment,
  UserProfile,
  UserReport
} from '../../types';
import {
  AdminAccount,
  AdminAuditLog,
  AdminSessionContext,
  AuthUserSummary,
  UserModeration
} from '../types';
import { adminService } from '../services/adminService';
import { ConfirmModal } from '../components/ConfirmModal';
import {
  buildUserLastActivityMap,
  canPerformAdminAction,
  computeUsersSummaryStats,
  filterAndSortAdminUsers,
  UserPresetFilter,
  UserSortField
} from '../utils/adminAnalytics';

interface UsersManagementProps {
  session: AdminSessionContext;
  users: UserProfile[];
  moderationMap: Record<string, UserModeration>;
  groupPosts: GroupPost[];
  capsules: Capsule[];
  postComments: PostComment[];
  capsuleComments: Comment[];
  groups: CommunityGroup[];
  legacyCircles: Circle[];
  admins: AdminAccount[];
  userReports: UserReport[];
  auditLogs: AdminAuditLog[];
  initialSearch?: string;
  onRefresh: () => Promise<void>;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}

type DrawerTab = 'overview' | 'posts' | 'comments' | 'communities' | 'audit';

function formatShortDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR');
}

function formatActivityDate(ms?: number | null): string {
  if (!ms) return '—';
  const diffMin = Math.floor((Date.now() - ms) / 60000);
  if (diffMin >= 0 && diffMin < 60) return `Il y a ${Math.max(1, diffMin)} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours >= 0 && diffHours < 24) return `Il y a ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays >= 0 && diffDays < 7) return `Il y a ${diffDays} j`;
  return new Date(ms).toLocaleDateString('fr-FR');
}

export const UsersManagementModule: React.FC<UsersManagementProps> = ({
  session,
  users,
  moderationMap,
  groupPosts,
  capsules,
  postComments,
  capsuleComments,
  groups,
  legacyCircles,
  admins,
  userReports,
  auditLogs,
  initialSearch = '',
  onRefresh,
  onNotify
}) => {
  const [search, setSearch] = useState(initialSearch);
  const [presetFilter, setPresetFilter] = useState<UserPresetFilter>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'utilisateur' | 'mentor' | 'verifie'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | '7d' | '30d' | '90d'>('all');
  const [sortField, setSortField] = useState<UserSortField>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('overview');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState({
    nom: '',
    username: '',
    email: '',
    phone: '',
    bio: '',
    profession: '',
    formation: '',
    localisation: '',
    site_web: '',
    infos_complementaires: '',
    langue_preferee: 'fr' as 'fr' | 'ha' | 'en',
    role: 'utilisateur' as 'utilisateur' | 'mentor' | 'verifie'
  });

  const [joinedCommunities, setJoinedCommunities] = useState<{
    loading: boolean;
    communityMembers: CommunityMember[];
    circleMembers: CircleMember[];
  }>({ loading: false, communityMembers: [], circleMembers: [] });

  const [reasonInput, setReasonInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [authMap, setAuthMap] = useState<Record<string, AuthUserSummary>>({});

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    tone: 'danger' | 'warning' | 'primary';
    action: () => Promise<void>;
  } | null>(null);

  // Firestore rules require isAdmin() (SUPER_ADMIN or ADMIN) + manageUsers permission for user writes
  const canManageUsers =
    canPerformAdminAction(session, 'manageUsers') &&
    (session.role === 'SUPER_ADMIN' || session.role === 'ADMIN');

  const selectedUser = useMemo(
    () => (selectedUserId ? users.find((u) => u.id === selectedUserId) || null : null),
    [users, selectedUserId]
  );

  useEffect(() => {
    if (initialSearch) setSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    setPage(1);
  }, [search, presetFilter, roleFilter, dateFilter, pageSize]);

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

  useEffect(() => {
    if (!selectedUserId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmState) {
        setSelectedUserId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedUserId, confirmState]);

  useEffect(() => {
    if (!selectedUserId) {
      setJoinedCommunities({ loading: false, communityMembers: [], circleMembers: [] });
      return;
    }
    let active = true;
    setJoinedCommunities({ loading: true, communityMembers: [], circleMembers: [] });
    adminService
      .getUserJoinedCommunitiesAdmin(selectedUserId)
      .then((res) => {
        if (!active) return;
        setJoinedCommunities({
          loading: false,
          communityMembers: res.communityMembers,
          circleMembers: res.circleMembers
        });
      })
      .catch(() => {
        if (!active) return;
        setJoinedCommunities({ loading: false, communityMembers: [], circleMembers: [] });
      });
    return () => {
      active = false;
    };
  }, [selectedUserId]);

  const staffRoleMap = useMemo(() => {
    const map: Record<string, 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR'> = {};
    admins.forEach((a) => {
      if (a.isActive) {
        map[a.id] = a.role;
      }
    });
    return map;
  }, [admins]);

  const authLastSignInMap = useMemo(() => {
    const map: Record<string, string | null | undefined> = {};
    Object.keys(authMap).forEach((uid) => {
      const entry = authMap[uid];
      if (entry) {
        map[entry.uid] = entry.lastSignInTime;
      }
    });
    return map;
  }, [authMap]);

  const lastActivityMap = useMemo(
    () =>
      buildUserLastActivityMap({
        users,
        authLastSignInMap,
        groupPosts,
        capsules,
        postComments,
        capsuleComments
      }),
    [users, authLastSignInMap, groupPosts, capsules, postComments, capsuleComments]
  );

  const summaryStats = useMemo(
    () =>
      computeUsersSummaryStats({
        users,
        moderationMap,
        groupPosts,
        capsules,
        postComments,
        capsuleComments
      }),
    [users, moderationMap, groupPosts, capsules, postComments, capsuleComments]
  );

  const staffCounts = useMemo(() => {
    let adminCount = 0;
    let modCount = 0;
    users.forEach((u) => {
      const r = staffRoleMap[u.id];
      if (r === 'SUPER_ADMIN' || r === 'ADMIN') adminCount += 1;
      else if (r === 'MODERATOR') modCount += 1;
    });
    return { adminCount, modCount };
  }, [users, staffRoleMap]);

  const filteredAndSortedUsers = useMemo(
    () =>
      filterAndSortAdminUsers({
        users,
        moderationMap,
        staffRoleMap,
        lastActivityMap,
        search,
        presetFilter,
        roleFilter,
        dateFilter,
        sortField,
        sortDir
      }),
    [
      users,
      moderationMap,
      staffRoleMap,
      lastActivityMap,
      search,
      presetFilter,
      roleFilter,
      dateFilter,
      sortField,
      sortDir
    ]
  );

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedUsers.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedUsers = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredAndSortedUsers.slice(start, start + pageSize);
  }, [filteredAndSortedUsers, safePage, pageSize]);

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, safePage - 2);
    const end = Math.min(totalPages, safePage + 2);
    for (let i = start; i <= end; i += 1) pages.push(i);
    return pages;
  }, [safePage, totalPages]);

  const toggleSort = (field: UserSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'created_at' || field === 'last_active' ? 'desc' : 'asc');
    }
  };

  const openUserInspector = (u: UserProfile, initialTab: DrawerTab = 'overview', startEditing = false) => {
    const mod = moderationMap[u.id];
    setSelectedUserId(u.id);
    setDrawerTab(initialTab);
    setReasonInput(mod?.reason || '');
    setIsEditingProfile(startEditing);
    setEditForm({
      nom: u.nom || '',
      username: u.username || '',
      email: u.email || '',
      phone: u.phone || '',
      bio: u.bio || '',
      profession: u.profession || '',
      formation: u.formation || '',
      localisation: u.localisation || '',
      site_web: u.site_web || '',
      infos_complementaires: u.infos_complementaires || '',
      langue_preferee: u.langue_preferee || 'fr',
      role: u.role || 'utilisateur'
    });
  };

  const selectedUserActivity = useMemo(() => {
    if (!selectedUser) {
      return {
        userGroupPosts: [] as GroupPost[],
        userCapsules: [] as Capsule[],
        userPostComments: [] as PostComment[],
        userCapsuleComments: [] as Comment[],
        reportsAgainstCount: 0,
        logs: [] as AdminAuditLog[]
      };
    }
    const userGroupPosts = groupPosts.filter((p) => p.authorId === selectedUser.id);
    const userCapsules = capsules.filter((c) => c.auteur_id === selectedUser.id);
    const userPostComments = postComments.filter((c) => c.authorId === selectedUser.id);
    const userCapsuleComments = capsuleComments.filter((c) => c.auteur_id === selectedUser.id);
    const reportsAgainstCount = userReports.filter((r) => r.reported_user_id === selectedUser.id).length;
    const logs = auditLogs
      .filter((l) => l.targetId === selectedUser.id || l.details.includes(selectedUser.id))
      .slice(0, 20);
    return {
      userGroupPosts,
      userCapsules,
      userPostComments,
      userCapsuleComments,
      reportsAgainstCount,
      logs
    };
  }, [selectedUser, groupPosts, capsules, postComments, capsuleComments, userReports, auditLogs]);

  const groupMap = useMemo(() => {
    const map = new Map<string, CommunityGroup>();
    groups.forEach((g) => map.set(g.id, g));
    return map;
  }, [groups]);

  const circleMap = useMemo(() => {
    const map = new Map<string, Circle>();
    legacyCircles.forEach((c) => map.set(c.id, c));
    return map;
  }, [legacyCircles]);

  const handleModerationAction = (
    user: UserProfile,
    status: 'active' | 'warned' | 'suspended'
  ) => {
    if (!canManageUsers) {
      onNotify("Permission manageUsers et rôle ADMIN requis pour modifier le statut d'un compte.", 'error');
      return;
    }
    if (user.id === session.uid && status === 'suspended') {
      onNotify('Vous ne pouvez pas suspendre votre propre compte.', 'error');
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
      description: `Confirmez-vous le changement de statut de "${user.nom}" vers "${status}" ? Cette opération sera enregistrée dans Firestore et dans le journal d'audit.`,
      confirmLabel: status === 'suspended' ? 'Suspendre' : status === 'warned' ? 'Avertir' : 'Réactiver',
      tone: status === 'suspended' ? 'danger' : status === 'warned' ? 'warning' : 'primary',
      action: async () => {
        await adminService.setUserModerationStatus(
          session,
          user,
          status,
          reasonInput || `Statut modifié à ${status}`
        );
        if (status === 'active' && authMap[user.id]?.disabled) {
          const authRes = await adminService.toggleAuthUserDisabled(user.id, false);
          if (authRes.ok) {
            setAuthMap((prev) =>
              prev[user.id] ? { ...prev, [user.id]: { ...prev[user.id], disabled: false } } : prev
            );
          }
        }
        onNotify(`Statut de ${user.nom} mis à jour (${status}).`);
        setReasonInput('');
        await onRefresh();
      }
    });
  };

  const handleBanUser = (user: UserProfile) => {
    if (!canManageUsers) {
      onNotify('Permission manageUsers et rôle ADMIN requis pour bannir un compte.', 'error');
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
      title: 'Modifier le rôle / badge communautaire',
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

  const handleSaveProfileEdits = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !canManageUsers) return;
    if (!editForm.nom.trim()) {
      onNotify('Le nom complet est obligatoire.', 'error');
      return;
    }
    setConfirmState({
      open: true,
      title: 'Enregistrer les modifications du profil',
      description: `Confirmez-vous la mise à jour des informations de "${selectedUser.nom}" dans Firestore (/users et /public_profiles) ?`,
      confirmLabel: 'Enregistrer',
      tone: 'primary',
      action: async () => {
        await adminService.updateUserProfileAdmin(session, selectedUser, {
          nom: editForm.nom,
          username: editForm.username,
          email: editForm.email,
          phone: editForm.phone,
          bio: editForm.bio || null,
          profession: editForm.profession,
          formation: editForm.formation,
          localisation: editForm.localisation,
          site_web: editForm.site_web,
          infos_complementaires: editForm.infos_complementaires,
          langue_preferee: editForm.langue_preferee,
          role: editForm.role
        });
        setIsEditingProfile(false);
        onNotify(`Informations de ${editForm.nom.trim()} mises à jour dans Firebase.`);
        await onRefresh();
      }
    });
  };

  const handleDeleteUser = (user: UserProfile) => {
    if (!canManageUsers) {
      onNotify('Permission manageUsers et rôle ADMIN requis.', 'error');
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
        if (selectedUser?.id === user.id) setSelectedUserId(null);
        onNotify(`Profil de ${user.nom} supprimé.`);
        await onRefresh();
      }
    });
  };

  const hasActiveFilters =
    search.trim() !== '' || presetFilter !== 'all' || roleFilter !== 'all' || dateFilter !== 'all';

  const presetOptions: Array<{ id: UserPresetFilter; label: string; count: number }> = [
    { id: 'all', label: 'Tous les utilisateurs', count: summaryStats.totalUsers },
    { id: 'active', label: 'Utilisateurs actifs', count: summaryStats.activeAccountsCount },
    { id: 'suspended', label: 'Utilisateurs suspendus', count: summaryStats.suspendedUsersCount },
    { id: 'new_users', label: 'Nouveaux utilisateurs', count: summaryStats.newUsers30dCount },
    { id: 'admins', label: 'Administrateurs', count: staffCounts.adminCount },
    { id: 'moderators', label: 'Modérateurs', count: staffCounts.modCount }
  ];

  const totalCommentsForSelected =
    selectedUserActivity.userPostComments.length + selectedUserActivity.userCapsuleComments.length;
  const totalPostsForSelected =
    selectedUserActivity.userGroupPosts.length + selectedUserActivity.userCapsules.length;
  const totalJoinedForSelected =
    joinedCommunities.communityMembers.length + joinedCommunities.circleMembers.length;

  return (
    <div className="space-y-5">
      {/* 4 KPI Summary Cards (Matching Dashboard Design) */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => setPresetFilter('all')}
          className={`text-left bg-white dark:bg-slate-900 border rounded-xl p-4 transition flex flex-col justify-between ${
            presetFilter === 'all'
              ? 'border-blue-500/70 ring-1 ring-blue-500/20'
              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total utilisateurs
            </span>
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          </div>
          <p className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white mt-2">
            {summaryStats.totalUsers}
          </p>
          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1">
            {staffCounts.adminCount} admin · {staffCounts.modCount} modérateur(s)
          </p>
        </button>

        <button
          type="button"
          onClick={() => setPresetFilter('active')}
          className={`text-left bg-white dark:bg-slate-900 border rounded-xl p-4 transition flex flex-col justify-between ${
            presetFilter === 'active'
              ? 'border-emerald-500/70 ring-1 ring-emerald-500/20'
              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Utilisateurs actifs
            </span>
            <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          </div>
          <p className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white mt-2">
            {summaryStats.activeAccountsCount}
          </p>
          <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {summaryStats.recentlyActive30dCount} actif(s) sur 30j
          </p>
        </button>

        <button
          type="button"
          onClick={() => setPresetFilter('new_users')}
          className={`text-left bg-white dark:bg-slate-900 border rounded-xl p-4 transition flex flex-col justify-between ${
            presetFilter === 'new_users'
              ? 'border-indigo-500/70 ring-1 ring-indigo-500/20'
              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Nouveaux inscrits
            </span>
            <UserPlus className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          </div>
          <p className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white mt-2">
            {summaryStats.newUsers30dCount}
          </p>
          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1">
            {summaryStats.newUsers7dCount} sur 7 derniers jours
          </p>
        </button>

        <button
          type="button"
          onClick={() => setPresetFilter('suspended')}
          className={`text-left bg-white dark:bg-slate-900 border rounded-xl p-4 transition flex flex-col justify-between ${
            presetFilter === 'suspended'
              ? 'border-red-500/70 ring-1 ring-red-500/20'
              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Utilisateurs suspendus
            </span>
            <UserX className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          </div>
          <p className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white mt-2">
            {summaryStats.suspendedUsersCount}
          </p>
          <p className="text-[11px] font-mono text-red-600 dark:text-red-400 mt-1">
            {summaryStats.bannedUsersCount} banni(s) · {summaryStats.warnedUsersCount} averti(s)
          </p>
        </button>
      </div>

      {/* Filter Tabs + Search + Secondary Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3.5">
        {/* Segmented Filter Tabs */}
        <div
          className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg"
          role="tablist"
          aria-label="Filtres principaux des utilisateurs"
        >
          {presetOptions.map((opt) => {
            const active = presetFilter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPresetFilter(opt.id)}
                className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-md transition inline-flex items-center gap-1.5 ${
                  active
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>{opt.label}</span>
                <span className="font-mono tabular-nums text-[10px] text-slate-400 dark:text-slate-500">
                  ({opt.count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Instant Search & Advanced Dropdowns */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom, @pseudo, e-mail, téléphone, ville ou UID..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-blue-600"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Effacer la recherche"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              aria-label="Filtrer par badge"
              className="min-h-[38px] px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
            >
              <option value="all">Tous les badges</option>
              <option value="utilisateur">Utilisateur</option>
              <option value="mentor">Mentor</option>
              <option value="verifie">Vérifié</option>
            </select>

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              aria-label="Filtrer par date d'inscription"
              className="min-h-[38px] px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
            >
              <option value="all">Toute date d&apos;inscription</option>
              <option value="7d">Inscrits (7 derniers jours)</option>
              <option value="30d">Inscrits (30 derniers jours)</option>
              <option value="90d">Inscrits (90 derniers jours)</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setPresetFilter('all');
                  setRoleFilter('all');
                  setDateFilter('all');
                }}
                className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Réinitialiser</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Users Table (Desktop) & Cards (Mobile/Tablet) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="hidden lg:block overflow-x-auto">
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
                <th className="py-3 px-4">Adresse e-mail</th>
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('role')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    <span>Rôle</span>
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
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('last_active')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    <span>Dernière activité</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500 dark:text-slate-400">
                    Aucun utilisateur ne correspond aux critères sélectionnés.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((u) => {
                  const mod = moderationMap[u.id];
                  const status = mod?.status || 'active';
                  const staffRole = staffRoleMap[u.id];
                  const lastActMs = lastActivityMap[u.id];
                  return (
                    <tr
                      key={u.id}
                      onClick={() => openUserInspector(u)}
                      className="hover:bg-slate-50/90 dark:hover:bg-slate-800/40 cursor-pointer"
                    >
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
                              {(u.nom || 'U').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-white truncate max-w-[170px]">
                              {u.nom}
                            </p>
                            <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 truncate max-w-[170px]">
                              {u.username ? `@${u.username}` : u.id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <p className="text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                          {u.email || 'Masqué (PII)'}
                        </p>
                        {authMap[u.id] && (
                          <p
                            className={`text-[10px] font-mono ${
                              authMap[u.id].disabled
                                ? 'text-red-600 dark:text-red-400 font-semibold'
                                : authMap[u.id].emailVerified
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {authMap[u.id].disabled
                              ? 'Auth bloqué'
                              : authMap[u.id].emailVerified
                                ? 'E-mail vérifié'
                                : 'E-mail non vérifié'}
                          </p>
                        )}
                      </td>
                      <td className="py-2.5 px-4" onClick={(e) => e.stopPropagation()}>
                        <div className="space-y-1">
                          {staffRole && (
                            <p className="font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400">
                              {staffRole}
                            </p>
                          )}
                          <select
                            disabled={!canManageUsers}
                            value={u.role}
                            onChange={(e) => handleBadgeChange(u, e.target.value as any)}
                            className="px-2 py-1 text-[11px] font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200 disabled:opacity-60"
                          >
                            <option value="utilisateur">utilisateur</option>
                            <option value="mentor">mentor</option>
                            <option value="verifie">verifie</option>
                          </select>
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`font-semibold ${
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
                      <td className="py-2.5 px-4 font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatShortDate(u.created_at)}
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatActivityDate(lastActMs)}
                      </td>
                      <td className="py-2.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => openUserInspector(u, 'overview', false)}
                            title="Consulter la fiche"
                            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canManageUsers && (
                            <>
                              <button
                                type="button"
                                onClick={() => openUserInspector(u, 'overview', true)}
                                title="Modifier le profil"
                                className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-md"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
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
                                disabled={u.id === session.uid}
                                onClick={() => handleBanUser(u)}
                                title="Bannir"
                                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md disabled:opacity-35"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={u.id === session.uid}
                                onClick={() => handleDeleteUser(u)}
                                title="Supprimer le profil"
                                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md disabled:opacity-35"
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

        {/* Mobile & Tablet Responsive Card List */}
        <div className="lg:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {paginatedUsers.length === 0 ? (
            <p className="py-10 px-4 text-center text-xs text-slate-500 dark:text-slate-400">
              Aucun utilisateur ne correspond aux critères sélectionnés.
            </p>
          ) : (
            paginatedUsers.map((u) => {
              const mod = moderationMap[u.id];
              const status = mod?.status || 'active';
              const staffRole = staffRoleMap[u.id];
              const lastActMs = lastActivityMap[u.id];
              return (
                <div key={u.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => openUserInspector(u)}
                      className="flex items-center gap-3 min-w-0 text-left"
                    >
                      {u.avatar_url ? (
                        <img
                          src={u.avatar_url}
                          alt={u.nom}
                          className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-slate-900 dark:bg-blue-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
                          {(u.nom || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{u.nom}</p>
                        <p className="text-[11px] font-mono text-blue-600 dark:text-blue-400 truncate">
                          {u.username ? `@${u.username}` : u.id}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {u.email || 'Masqué (PII)'}
                        </p>
                      </div>
                    </button>
                    <span
                      className={`text-xs font-semibold shrink-0 ${
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
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    <span>
                      Rôle : {staffRole ? `${staffRole} · ${u.role}` : u.role}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Inscrit : {formatShortDate(u.created_at)}</span>
                    <span aria-hidden="true">·</span>
                    <span>Activité : {formatActivityDate(lastActMs)}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => openUserInspector(u, 'overview', false)}
                      className="min-h-[44px] flex-1 px-3 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg inline-flex items-center justify-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Consulter</span>
                    </button>
                    {canManageUsers && (
                      <>
                        <button
                          type="button"
                          onClick={() => openUserInspector(u, 'overview', true)}
                          className="min-h-[44px] px-3 py-2 text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900 rounded-lg inline-flex items-center gap-1"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Modifier</span>
                        </button>
                        {status !== 'suspended' ? (
                          <button
                            type="button"
                            onClick={() => handleModerationAction(u, 'suspended')}
                            className="min-h-[44px] px-3 py-2 text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900 rounded-lg"
                          >
                            Suspendre
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleModerationAction(u, 'active')}
                            className="min-h-[44px] px-3 py-2 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 rounded-lg"
                          >
                            Réactiver
                          </button>
                        )}
                      </>
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
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="min-h-[36px] px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 inline-flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Préc.</span>
            </button>
            <div className="hidden sm:flex items-center gap-1">
              {pageNumbers.map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setPage(num)}
                  className={`min-h-[36px] min-w-[36px] px-2 py-1 font-mono text-xs rounded-lg border ${
                    num === safePage
                      ? 'bg-slate-900 dark:bg-blue-600 text-white border-slate-900 dark:border-blue-600 font-bold'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="min-h-[36px] px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 inline-flex items-center gap-1"
            >
              <span className="hidden sm:inline">Suiv.</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Rich User Inspection & Governance Drawer */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-[1px] flex justify-end"
          onClick={() => setSelectedUserId(null)}
        >
          <div
            className="w-full max-w-xl bg-white dark:bg-slate-900 h-full border-l border-slate-200 dark:border-slate-800 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Fiche Utilisateur
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserId(null)}
                aria-label="Fermer la fiche"
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Identity Summary */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex items-start gap-3.5 min-w-0">
                  {selectedUser.avatar_url ? (
                    <img
                      src={selectedUser.avatar_url}
                      alt={selectedUser.nom}
                      className="w-14 h-14 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-slate-900 dark:bg-blue-600 text-white text-lg font-extrabold flex items-center justify-center shrink-0">
                      {(selectedUser.nom || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="space-y-0.5 text-xs min-w-0">
                    <p className="font-bold text-base text-slate-900 dark:text-white truncate">
                      {selectedUser.nom}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                      {selectedUser.username && (
                        <span className="text-blue-600 dark:text-blue-400">@{selectedUser.username}</span>
                      )}
                      {staffRoleMap[selectedUser.id] && (
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          · {staffRoleMap[selectedUser.id]}
                        </span>
                      )}
                      <span className="text-slate-500 dark:text-slate-400">· {selectedUser.role}</span>
                    </div>
                    <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400 break-all">
                      UID : {selectedUser.id}
                    </p>
                  </div>
                </div>
                <a
                  href={`/?profile=${encodeURIComponent(selectedUser.id)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[38px] px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg inline-flex items-center justify-center gap-1.5 shrink-0"
                >
                  <span>Profil public</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* 4 Activity Counters */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <button
                  type="button"
                  onClick={() => setDrawerTab('posts')}
                  className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-blue-400"
                >
                  <p className="text-base font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                    {totalPostsForSelected}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Publications</p>
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab('comments')}
                  className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-blue-400"
                >
                  <p className="text-base font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                    {totalCommentsForSelected}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Commentaires</p>
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab('communities')}
                  className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-blue-400"
                >
                  <p className="text-base font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                    {joinedCommunities.loading ? '…' : totalJoinedForSelected}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Communautés</p>
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab('audit')}
                  className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-blue-400"
                >
                  <p className="text-base font-extrabold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                    {selectedUserActivity.reportsAgainstCount}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Signalements</p>
                </button>
              </div>

              {/* Drawer Navigation Tabs */}
              <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg text-xs">
                {(
                  [
                    { id: 'overview', label: 'Infos & Actions' },
                    { id: 'posts', label: `Publications (${totalPostsForSelected})` },
                    { id: 'comments', label: `Commentaires (${totalCommentsForSelected})` },
                    { id: 'communities', label: `Communautés (${totalJoinedForSelected})` },
                    { id: 'audit', label: `Historique (${selectedUserActivity.logs.length})` }
                  ] as Array<{ id: DrawerTab; label: string }>
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setDrawerTab(tab.id)}
                    className={`min-h-[34px] px-2.5 py-1 rounded-md font-semibold transition ${
                      drawerTab === tab.id
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* TAB 1 : OVERVIEW, EDIT PROFILE & ADMIN ACTIONS */}
              {drawerTab === 'overview' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Informations personnelles
                    </h4>
                    {canManageUsers && (
                      <button
                        type="button"
                        onClick={() => setIsEditingProfile((v) => !v)}
                        className="min-h-[34px] px-3 py-1 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg inline-flex items-center gap-1.5"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>{isEditingProfile ? 'Annuler modification' : 'Modifier les infos'}</span>
                      </button>
                    )}
                  </div>

                  {isEditingProfile && canManageUsers ? (
                    <form onSubmit={handleSaveProfileEdits} className="space-y-3 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Nom complet *
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={120}
                            value={editForm.nom}
                            onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Identifiant (@username)
                          </label>
                          <input
                            type="text"
                            maxLength={40}
                            value={editForm.username}
                            onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                            className="w-full px-3 py-2 font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Adresse e-mail
                          </label>
                          <input
                            type="email"
                            maxLength={200}
                            value={editForm.email}
                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Téléphone
                          </label>
                          <input
                            type="text"
                            maxLength={32}
                            value={editForm.phone}
                            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Localisation
                          </label>
                          <input
                            type="text"
                            maxLength={120}
                            value={editForm.localisation}
                            onChange={(e) => setEditForm({ ...editForm, localisation: e.target.value })}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Profession
                          </label>
                          <input
                            type="text"
                            maxLength={120}
                            value={editForm.profession}
                            onChange={(e) => setEditForm({ ...editForm, profession: e.target.value })}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Langue préférée
                          </label>
                          <select
                            value={editForm.langue_preferee}
                            onChange={(e) => setEditForm({ ...editForm, langue_preferee: e.target.value as any })}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                          >
                            <option value="fr">Français (FR)</option>
                            <option value="en">Anglais (EN)</option>
                            <option value="ha">Haoussa (HA)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Badge communautaire
                          </label>
                          <select
                            value={editForm.role}
                            onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                          >
                            <option value="utilisateur">Utilisateur</option>
                            <option value="mentor">Mentor</option>
                            <option value="verifie">Vérifié</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Site web
                        </label>
                        <input
                          type="text"
                          maxLength={300}
                          value={editForm.site_web}
                          onChange={(e) => setEditForm({ ...editForm, site_web: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Biographie
                        </label>
                        <textarea
                          rows={3}
                          maxLength={1000}
                          value={editForm.bio}
                          onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsEditingProfile(false)}
                          className="min-h-[38px] px-3 py-1.5 font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                        >
                          Annuler
                        </button>
                        <button
                          type="submit"
                          disabled={isProcessing}
                          className="min-h-[38px] px-4 py-1.5 font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg inline-flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Enregistrer</span>
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">E-mail</p>
                        <p className="font-medium text-slate-900 dark:text-white mt-0.5 break-all">
                          {selectedUser.email || 'Masqué (PII)'}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Téléphone</p>
                        <p className="font-mono text-slate-900 dark:text-white mt-0.5">
                          {selectedUser.phone || '—'}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Inscription & Langue</p>
                        <p className="font-mono text-slate-900 dark:text-white mt-0.5">
                          {formatShortDate(selectedUser.created_at)} · {selectedUser.langue_preferee.toUpperCase()}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Dernière activité</p>
                        <p className="font-mono text-slate-900 dark:text-white mt-0.5">
                          {lastActivityMap[selectedUser.id]
                            ? new Date(lastActivityMap[selectedUser.id]).toLocaleString('fr-FR')
                            : 'Aucune enregistrée'}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Localisation</p>
                        <p className="text-slate-900 dark:text-white mt-0.5">
                          {selectedUser.localisation || '—'}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Profession / Formation</p>
                        <p className="text-slate-900 dark:text-white mt-0.5">
                          {selectedUser.profession || selectedUser.formation || '—'}
                        </p>
                      </div>
                      <div className="sm:col-span-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Biographie</p>
                        <p className="text-slate-800 dark:text-slate-200 mt-0.5 leading-relaxed">
                          {selectedUser.bio || 'Aucune biographie renseignée.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {authMap[selectedUser.id] && (
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1 font-mono text-[11px]">
                      <p className="text-slate-700 dark:text-slate-200">
                        Auth e-mail : {authMap[selectedUser.id].emailVerified ? 'Vérifié' : 'Non vérifié'} · Compte{' '}
                        {authMap[selectedUser.id].disabled ? 'DÉSACTIVÉ' : 'ACTIF'}
                      </p>
                      {authMap[selectedUser.id].lastSignInTime && (
                        <p className="text-slate-500 dark:text-slate-400">
                          Dernière connexion Auth :{' '}
                          {new Date(authMap[selectedUser.id].lastSignInTime!).toLocaleString('fr-FR')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Moderation & Governance Actions */}
                  {canManageUsers ? (
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Motif de décision administrative (journalisé dans l&apos;audit)
                      </label>
                      <textarea
                        rows={2}
                        value={reasonInput}
                        onChange={(e) => setReasonInput(e.target.value)}
                        placeholder="Précisez la raison de la suspension, réactivation ou du bannissement..."
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
                          <span>Avertir</span>
                        </button>
                        <button
                          type="button"
                          disabled={selectedUser.id === session.uid}
                          onClick={() => handleModerationAction(selectedUser, 'suspended')}
                          className="min-h-[40px] py-2 px-2.5 text-xs font-semibold rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white disabled:opacity-40"
                        >
                          Suspendre
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={selectedUser.id === session.uid}
                          onClick={() => handleBanUser(selectedUser)}
                          className="min-h-[40px] py-2 px-3 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg inline-flex items-center justify-center gap-1.5 disabled:opacity-40"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Bannir le compte</span>
                        </button>
                        <button
                          type="button"
                          disabled={selectedUser.id === session.uid}
                          onClick={() => handleDeleteUser(selectedUser)}
                          className="min-h-[40px] py-2 px-3 text-xs font-semibold border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/70 rounded-lg inline-flex items-center justify-center gap-1.5 disabled:opacity-40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Supprimer le profil</span>
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
                                const res = await adminService.toggleAuthUserDisabled(
                                  selectedUser.id,
                                  nextDisabled
                                );
                                if (!res.ok) {
                                  throw new Error(
                                    res.message || 'Impossible de mettre à jour Firebase Auth.'
                                  );
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
                  ) : (
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                      Consultation en lecture seule : votre rôle ({session.role}) n&apos;autorise pas la modification ou suppression directe des comptes utilisateurs.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2 : USER PUBLICATIONS */}
              {drawerTab === 'posts' && (
                <div className="space-y-2.5 text-xs">
                  {totalPostsForSelected === 0 ? (
                    <p className="py-8 text-center text-slate-500 dark:text-slate-400">
                      Aucune publication ni capsule enregistrée pour cet utilisateur.
                    </p>
                  ) : (
                    <>
                      {selectedUserActivity.userGroupPosts.map((p) => (
                        <div
                          key={p.id}
                          className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                            <span className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {p.groupId === 'public'
                                ? 'Fil public'
                                : groupMap.get(p.groupId)?.name || p.groupId}
                            </span>
                            <span className="text-slate-400">
                              {p.status} · {formatShortDate(p.createdAt)}
                            </span>
                          </div>
                          <p className="text-slate-800 dark:text-slate-200 line-clamp-3">
                            {p.content || `[${p.type}]`}
                          </p>
                        </div>
                      ))}
                      {selectedUserActivity.userCapsules.map((c) => (
                        <div
                          key={c.id}
                          className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                            <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                              Capsule · {c.circle_nom || c.circle_id}
                            </span>
                            <span className="text-slate-400">{formatShortDate(c.created_at)}</span>
                          </div>
                          <p className="text-slate-800 dark:text-slate-200 line-clamp-3">{c.contenu}</p>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* TAB 3 : USER COMMENTS */}
              {drawerTab === 'comments' && (
                <div className="space-y-2.5 text-xs">
                  {totalCommentsForSelected === 0 ? (
                    <p className="py-8 text-center text-slate-500 dark:text-slate-400">
                      Aucun commentaire enregistré pour cet utilisateur.
                    </p>
                  ) : (
                    <>
                      {selectedUserActivity.userPostComments.map((c) => (
                        <div
                          key={c.id}
                          className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
                            <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                              <MessageSquare className="w-3 h-3" />
                              Post {c.postId.slice(0, 12)}
                            </span>
                            <span>{formatShortDate(c.createdAt)}</span>
                          </div>
                          <p className="text-slate-800 dark:text-slate-200">{c.content}</p>
                        </div>
                      ))}
                      {selectedUserActivity.userCapsuleComments.map((c) => (
                        <div
                          key={c.id}
                          className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
                            <span>Capsule {c.capsule_id.slice(0, 12)}</span>
                            <span>{formatShortDate(c.created_at)}</span>
                          </div>
                          <p className="text-slate-800 dark:text-slate-200">{c.contenu}</p>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* TAB 4 : JOINED COMMUNITIES */}
              {drawerTab === 'communities' && (
                <div className="space-y-2.5 text-xs">
                  {joinedCommunities.loading ? (
                    <p className="py-8 text-center text-slate-500 dark:text-slate-400">
                      Chargement des communautés rejointes depuis Firestore...
                    </p>
                  ) : totalJoinedForSelected === 0 ? (
                    <p className="py-8 text-center text-slate-500 dark:text-slate-400">
                      Aucune adhésion communautaire enregistrée.
                    </p>
                  ) : (
                    <>
                      {joinedCommunities.communityMembers.map((m) => {
                        const grp = groupMap.get(m.groupId);
                        return (
                          <div
                            key={m.id}
                            className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                                <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                                <span className="truncate">{grp?.name || m.groupId}</span>
                              </p>
                              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                                {grp?.category || 'Communauté'} · Rôle : {m.role} · Statut : {m.status}
                              </p>
                            </div>
                            <span className="font-mono text-[11px] text-slate-400 shrink-0">
                              {formatShortDate(m.joinedAt)}
                            </span>
                          </div>
                        );
                      })}
                      {joinedCommunities.circleMembers.map((cm) => {
                        const circle = circleMap.get(cm.circle_id);
                        return (
                          <div
                            key={`${cm.circle_id}_${cm.user_id}`}
                            className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 dark:text-white truncate">
                                {circle?.nom || cm.circle_id}
                              </p>
                              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                Cercle historique · {cm.role}
                              </p>
                            </div>
                            <span className="font-mono text-[11px] text-slate-400 shrink-0">
                              {formatShortDate(cm.joined_at)}
                            </span>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}

              {/* TAB 5 : ADMIN AUDIT LOGS */}
              {drawerTab === 'audit' && (
                <div className="space-y-3 text-xs">
                  {moderationMap[selectedUser.id] && (
                    <div className="p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 space-y-1">
                      <p className="font-bold text-slate-900 dark:text-white">
                        Statut de modération actuel : {moderationMap[selectedUser.id].status}
                      </p>
                      <p className="text-slate-700 dark:text-slate-300">
                        Motif : {moderationMap[selectedUser.id].reason}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        Mis à jour le {formatShortDate(moderationMap[selectedUser.id].updatedAt)}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                    <History className="w-3.5 h-3.5 text-slate-400" />
                    <span>Journal administratif ({selectedUserActivity.logs.length})</span>
                  </div>

                  {selectedUserActivity.logs.length === 0 ? (
                    <p className="text-slate-500 dark:text-slate-400 py-4 text-center">
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
                          <p className="text-[10px] font-mono text-slate-400 mt-1">
                            Par {log.actorName} ({log.actorRole})
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
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
