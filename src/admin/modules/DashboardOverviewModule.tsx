import React, { useMemo, useState } from 'react';
import {
  Users,
  UserCheck,
  UserPlus,
  FileText,
  MessageSquare,
  Layers,
  AlertTriangle,
  ShieldAlert,
  ArrowUpRight,
  Clock,
  Shield,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  LifeBuoy
} from 'lucide-react';
import {
  Capsule,
  Comment,
  CommunityGroup,
  GroupPost,
  GroupReport,
  PostComment,
  SupportTicket,
  UserProfile,
  UserReport
} from '../../types';
import { AdminAuditLog, AdminModuleId } from '../types';
import {
  ActivityTimelineChart,
  CommunityActivityChart,
  ContentBreakdownChart,
  UserGrowthChart
} from '../components/AdminCharts';
import {
  buildDashboardTimelineSeries,
  buildTopCommunitiesActivity,
  computeActiveUserIdsInRange,
  computeMetricDelta,
  isInRange,
  MetricDelta,
  resolvePeriodBounds,
  TimeRangePreset
} from '../utils/adminAnalytics';
import { ZAURE_ICON_CHIPS, ZAURE_SURFACES } from '../../styles/designSystem';

interface DashboardOverviewProps {
  users: UserProfile[];
  groupPosts: GroupPost[];
  capsules: Capsule[];
  postComments: PostComment[];
  capsuleComments: Comment[];
  groups: CommunityGroup[];
  userReports: UserReport[];
  groupReports: GroupReport[];
  supportTickets: SupportTicket[];
  auditLogs: AdminAuditLog[];
  onNavigateModule: (module: AdminModuleId) => void;
}

function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

const DeltaLabel: React.FC<{ delta: MetricDelta; contextText: string }> = ({
  delta,
  contextText
}) => {
  if (delta.direction === 'na' || delta.deltaPct === null) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 font-mono">
        <Minus className="w-3 h-3" />
        <span>{contextText}</span>
      </span>
    );
  }
  if (delta.direction === 'up') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
        <TrendingUp className="w-3 h-3" />
        <span>+{delta.deltaPct}% vs préc.</span>
      </span>
    );
  }
  if (delta.direction === 'down') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-amber-600 dark:text-amber-400">
        <TrendingDown className="w-3 h-3" />
        <span>{delta.deltaPct}% vs préc.</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 dark:text-slate-400">
      <Minus className="w-3 h-3" />
      <span>0% vs préc.</span>
    </span>
  );
};

export const DashboardOverviewModule: React.FC<DashboardOverviewProps> = ({
  users,
  groupPosts,
  capsules,
  postComments,
  capsuleComments,
  groups,
  userReports,
  groupReports,
  supportTickets,
  auditLogs,
  onNavigateModule
}) => {
  const [preset, setPreset] = useState<TimeRangePreset>('30d');
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date(Date.now() - 14 * 24 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().slice(0, 10));

  const bounds = useMemo(
    () => resolvePeriodBounds(preset, customStart, customEnd),
    [preset, customStart, customEnd]
  );

  const metrics = useMemo(() => {
    const { startMs, endMs, prevStartMs, prevEndMs } = bounds;

    const totalUsers = users.length;
    const newUsersPeriod = users.filter((u) => isInRange(u.created_at, startMs, endMs)).length;
    const newUsersPrev = users.filter((u) => isInRange(u.created_at, prevStartMs, prevEndMs)).length;
    const newUsersDelta = computeMetricDelta(newUsersPeriod, newUsersPrev);

    const activeUsersSet = computeActiveUserIdsInRange(
      { users, groupPosts, capsules, postComments, capsuleComments },
      startMs,
      endMs
    );
    const activeUsersPrevSet = computeActiveUserIdsInRange(
      { users: [], groupPosts, capsules, postComments, capsuleComments },
      prevStartMs,
      prevEndMs
    );
    const activeUsersDelta = computeMetricDelta(activeUsersSet.size, activeUsersPrevSet.size);

    const totalPosts = groupPosts.length + capsules.length;
    const postsPeriod =
      groupPosts.filter((p) => isInRange(p.createdAt, startMs, endMs)).length +
      capsules.filter((c) => isInRange(c.created_at, startMs, endMs)).length;
    const postsPrev =
      groupPosts.filter((p) => isInRange(p.createdAt, prevStartMs, prevEndMs)).length +
      capsules.filter((c) => isInRange(c.created_at, prevStartMs, prevEndMs)).length;
    const postsDelta = computeMetricDelta(postsPeriod, postsPrev);

    const totalComments = postComments.length + capsuleComments.length;
    const commentsPeriod =
      postComments.filter((c) => isInRange(c.createdAt, startMs, endMs)).length +
      capsuleComments.filter((c) => isInRange(c.created_at, startMs, endMs)).length;
    const commentsPrev =
      postComments.filter((c) => isInRange(c.createdAt, prevStartMs, prevEndMs)).length +
      capsuleComments.filter((c) => isInRange(c.created_at, prevStartMs, prevEndMs)).length;
    const commentsDelta = computeMetricDelta(commentsPeriod, commentsPrev);

    const totalCommunities = groups.length;
    const newCommunitiesPeriod = groups.filter((g) => isInRange(g.createdAt, startMs, endMs)).length;
    const newCommunitiesPrev = groups.filter((g) => isInRange(g.createdAt, prevStartMs, prevEndMs)).length;
    const communitiesDelta = computeMetricDelta(newCommunitiesPeriod, newCommunitiesPrev);

    const pendingUserReports = userReports.filter((r) => r.status === 'en_attente');
    const pendingGroupReports = groupReports.filter((r) => r.status === 'pending');
    const pendingReportsTotal = pendingUserReports.length + pendingGroupReports.length;
    const pendingPostsCount = groupPosts.filter((p) => p.status === 'pending').length;

    const publicPostsCount = groupPosts.filter((p) => p.groupId === 'public').length;
    const circlePostsCount = groupPosts.length - publicPostsCount;

    return {
      totalUsers,
      newUsersPeriod,
      newUsersDelta,
      activeUsersCount: activeUsersSet.size,
      activeUsersDelta,
      totalPosts,
      postsPeriod,
      postsDelta,
      totalComments,
      commentsPeriod,
      commentsDelta,
      totalCommunities,
      communitiesDelta,
      pendingUserReports,
      pendingGroupReports,
      pendingReportsTotal,
      pendingPostsCount,
      publicPostsCount,
      circlePostsCount
    };
  }, [users, groupPosts, capsules, postComments, capsuleComments, groups, userReports, groupReports, bounds]);

  const timelineSeries = useMemo(
    () =>
      buildDashboardTimelineSeries(
        { users, groupPosts, capsules, postComments, capsuleComments },
        bounds
      ),
    [users, groupPosts, capsules, postComments, capsuleComments, bounds]
  );

  const topCommunities = useMemo(
    () =>
      buildTopCommunitiesActivity(
        groups,
        groupPosts,
        postComments,
        bounds.startMs,
        bounds.endMs
      ),
    [groups, groupPosts, postComments, bounds.startMs, bounds.endMs]
  );

  const recentUsers = users.slice(0, 5);
  const recentPosts = groupPosts.slice(0, 5);
  const recentLogs = auditLogs.slice(0, 6);
  const openTickets = supportTickets.filter((t) => t.status !== 'resolved').slice(0, 5);

  const combinedPendingReports = [
    ...metrics.pendingGroupReports.map((r) => ({
      id: r.id,
      typeLabel: `Communauté (${r.targetType})`,
      reason: r.reason,
      reporter: r.reporterName,
      createdAt: r.createdAt
    })),
    ...metrics.pendingUserReports.map((r) => ({
      id: r.id,
      typeLabel: 'Utilisateur',
      reason: r.reason,
      reporter: r.reporter_nom,
      createdAt: r.created_at
    }))
  ]
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Analytics Period Filter Toolbar */}
      <div className={`${ZAURE_SURFACES.card} p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3`}>
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${ZAURE_ICON_CHIPS.blue}`}>
            <Calendar className="w-3.5 h-3.5" />
          </span>
          <span className="font-semibold text-slate-900 dark:text-white">Période d&apos;analyse :</span>
          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{bounds.label}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-950 p-0.5">
            {(
              [
                { id: '24h', label: '24h' },
                { id: '7d', label: '7 jours' },
                { id: '30d', label: '30 jours' },
                { id: '90d', label: '90 jours' },
                { id: 'custom', label: 'Personnalisée' }
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPreset(opt.id)}
                className={`min-h-[34px] px-3 py-1 text-xs font-semibold rounded-lg transition zaure-btn-press ${
                  preset === opt.id
                    ? 'zaure-nav-pill-active'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                aria-label="Date de début"
                className="min-h-[36px] px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg"
              />
              <span className="text-xs text-slate-400">à</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                aria-label="Date de fin"
                className="min-h-[36px] px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
          )}
        </div>
      </div>

      {/* 8 Real KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigateModule('users')}
          className={`text-left ${ZAURE_SURFACES.cardInteractive} p-4 group`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Utilisateurs inscrits</span>
            <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${ZAURE_ICON_CHIPS.blue}`}>
              <Users className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums mt-2">
            {metrics.totalUsers}
          </p>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              Total base Firestore
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateModule('users')}
          className={`text-left ${ZAURE_SURFACES.cardInteractive} p-4 group`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Utilisateurs actifs</span>
            <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${ZAURE_ICON_CHIPS.emerald}`}>
              <UserCheck className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums mt-2">
            {metrics.activeUsersCount}
          </p>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <DeltaLabel
              delta={metrics.activeUsersDelta}
              contextText="Actifs sur la période"
            />
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateModule('users')}
          className={`text-left ${ZAURE_SURFACES.cardInteractive} p-4 group`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Nouveaux utilisateurs</span>
            <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${ZAURE_ICON_CHIPS.sky}`}>
              <UserPlus className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums mt-2">
            {metrics.newUsersPeriod}
          </p>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <DeltaLabel
              delta={metrics.newUsersDelta}
              contextText="Pas d'historique antérieur"
            />
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateModule('posts')}
          className={`text-left ${ZAURE_SURFACES.cardInteractive} p-4 group`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Publications totales</span>
            <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${ZAURE_ICON_CHIPS.indigo}`}>
              <FileText className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums mt-2">
            {metrics.totalPosts}
          </p>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              +{metrics.postsPeriod} sur la période
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateModule('comments')}
          className={`text-left ${ZAURE_SURFACES.cardInteractive} p-4 group`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Commentaires</span>
            <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${ZAURE_ICON_CHIPS.violet}`}>
              <MessageSquare className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums mt-2">
            {metrics.totalComments}
          </p>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <DeltaLabel
              delta={metrics.commentsDelta}
              contextText={`+${metrics.commentsPeriod} sur la période`}
            />
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateModule('circles')}
          className={`text-left ${ZAURE_SURFACES.cardInteractive} p-4 group`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Communautés</span>
            <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${ZAURE_ICON_CHIPS.emerald}`}>
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums mt-2">
            {metrics.totalCommunities}
          </p>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              {groups.filter((g) => g.privacy === 'private').length} privées ·{' '}
              {groups.filter((g) => g.privacy === 'public').length} publiques
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateModule('reports')}
          className={`text-left ${ZAURE_SURFACES.cardInteractive} p-4 group`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Signalements en attente</span>
            <span
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                metrics.pendingReportsTotal > 0 ? ZAURE_ICON_CHIPS.amber : ZAURE_ICON_CHIPS.emerald
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <p
            className={`text-2xl font-extrabold font-mono tabular-nums mt-2 ${
              metrics.pendingReportsTotal > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-slate-900 dark:text-white'
            }`}
          >
            {metrics.pendingReportsTotal}
          </p>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              Total historique : {userReports.length + groupReports.length}
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateModule('moderation')}
          className={`text-left ${ZAURE_SURFACES.cardInteractive} p-4 group`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Contenus en attente</span>
            <span
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                metrics.pendingPostsCount > 0 ? ZAURE_ICON_CHIPS.rose : ZAURE_ICON_CHIPS.emerald
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
            </span>
          </div>
          <p
            className={`text-2xl font-extrabold font-mono tabular-nums mt-2 ${
              metrics.pendingPostsCount > 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-slate-900 dark:text-white'
            }`}
          >
            {metrics.pendingPostsCount}
          </p>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              File de modération active
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
          </div>
        </button>
      </div>

      {/* Primary Interactive Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className={`xl:col-span-2 ${ZAURE_SURFACES.card} p-5`}>
          <ActivityTimelineChart series={timelineSeries} periodLabel={bounds.label} />
        </div>
        <div className={`${ZAURE_SURFACES.card} p-5`}>
          <ContentBreakdownChart
            publicPostsCount={metrics.publicPostsCount}
            circlePostsCount={metrics.circlePostsCount}
            capsulesCount={capsules.length}
            commentsCount={metrics.totalComments}
          />
        </div>
      </div>

      {/* Secondary Growth & Community Activity Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`${ZAURE_SURFACES.card} p-5`}>
          <UserGrowthChart series={timelineSeries} periodLabel={bounds.label} />
        </div>
        <div className={`${ZAURE_SURFACES.card} p-5`}>
          <CommunityActivityChart communities={topCommunities} periodLabel={bounds.label} />
        </div>
      </div>

      {/* Operational Lists Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`${ZAURE_SURFACES.card} overflow-hidden`}>
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Utilisateurs récemment inscrits</h3>
            <button
              type="button"
              onClick={() => onNavigateModule('users')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Tout voir
            </button>
          </div>
          {recentUsers.length === 0 ? (
            <p className="p-6 text-xs text-slate-500 dark:text-slate-400 text-center">
              Aucun utilisateur enregistré pour le moment.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentUsers.map((u) => (
                <div
                  key={u.id}
                  className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {u.avatar_url ? (
                      <img
                        src={u.avatar_url}
                        alt={u.nom}
                        className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {u.nom.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{u.nom}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {u.email || u.id} · <span className="uppercase">{u.langue_preferee}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300 uppercase">
                      {u.role}
                    </span>
                    <p className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
                      {formatDateTime(u.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`${ZAURE_SURFACES.card} overflow-hidden`}>
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Publications récentes</h3>
            <button
              type="button"
              onClick={() => onNavigateModule('posts')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Gérer
            </button>
          </div>
          {recentPosts.length === 0 ? (
            <p className="p-6 text-xs text-slate-500 dark:text-slate-400 text-center">
              Aucune publication enregistrée.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentPosts.map((p) => (
                <div
                  key={p.id}
                  className="px-5 py-3 flex items-start justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {p.authorName}{' '}
                      <span className="font-normal text-slate-400 dark:text-slate-500">
                        · {p.groupId === 'public' ? 'Fil public' : p.groupId}
                      </span>
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 truncate mt-0.5">
                      {p.content || `[Média ${p.type}]`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`text-[11px] font-semibold ${
                        p.status === 'published'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : p.status === 'pending'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {p.status}
                    </span>
                    <p className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
                      {formatDateTime(p.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`${ZAURE_SURFACES.card} overflow-hidden`}>
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Signalements & Tickets ouverts</h3>
            <button
              type="button"
              onClick={() => onNavigateModule('reports')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Traiter
            </button>
          </div>
          {combinedPendingReports.length === 0 && openTickets.length === 0 ? (
            <p className="p-6 text-xs text-slate-500 dark:text-slate-400 text-center">
              Aucun signalement ni ticket d&apos;assistance en attente.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {combinedPendingReports.map((r) => (
                <div
                  key={r.id}
                  className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{r.reason}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {r.typeLabel} · Signalé par {r.reporter}
                    </p>
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-amber-700 dark:text-amber-400 shrink-0">
                    {formatDateTime(r.createdAt)}
                  </span>
                </div>
              ))}
              {openTickets.map((t) => (
                <div
                  key={t.id}
                  className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <LifeBuoy className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{t.subject}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        Ticket {t.category} · {t.userName} ({t.status})
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-blue-600 dark:text-blue-400 shrink-0">
                    {formatDateTime(t.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`${ZAURE_SURFACES.card} overflow-hidden`}>
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Activité administrative</h3>
            <button
              type="button"
              onClick={() => onNavigateModule('audit')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Journal complet
            </button>
          </div>
          {recentLogs.length === 0 ? (
            <p className="p-6 text-xs text-slate-500 dark:text-slate-400 text-center">
              Aucune action administrative enregistrée pour le moment.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="px-5 py-3 flex items-start justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <div className="min-w-0 flex items-start gap-2.5">
                    <Shield className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        <span className="font-mono text-blue-700 dark:text-blue-400">{log.action}</span> ·{' '}
                        {log.actorName}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{log.details}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 shrink-0 inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDateTime(log.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
