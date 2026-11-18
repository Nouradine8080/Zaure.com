import React from 'react';
import {
  Users,
  FileText,
  Layers,
  AlertTriangle,
  ArrowUpRight,
  Clock,
  Shield
} from 'lucide-react';
import {
  Capsule,
  CommunityGroup,
  GroupPost,
  GroupReport,
  UserProfile,
  UserReport
} from '../../types';
import { AdminAuditLog, AdminModuleId } from '../types';
import { ActivityTimelineChart, ContentBreakdownChart } from '../components/AdminCharts';

interface DashboardOverviewProps {
  users: UserProfile[];
  groupPosts: GroupPost[];
  capsules: Capsule[];
  groups: CommunityGroup[];
  commentsCount: number;
  userReports: UserReport[];
  groupReports: GroupReport[];
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

export const DashboardOverviewModule: React.FC<DashboardOverviewProps> = ({
  users,
  groupPosts,
  capsules,
  groups,
  commentsCount,
  userReports,
  groupReports,
  auditLogs,
  onNavigateModule
}) => {
  const totalPosts = groupPosts.length + capsules.length;
  const publicPostsCount = groupPosts.filter((p) => p.groupId === 'public').length;
  const circlePostsCount = groupPosts.length - publicPostsCount;
  const pendingPostsCount = groupPosts.filter((p) => p.status === 'pending').length;

  const pendingUserReports = userReports.filter((r) => r.status === 'en_attente');
  const pendingGroupReports = groupReports.filter((r) => r.status === 'pending');
  const pendingReportsTotal = pendingUserReports.length + pendingGroupReports.length;

  const recentUsers = users.slice(0, 5);
  const recentPosts = groupPosts.slice(0, 5);
  const recentLogs = auditLogs.slice(0, 6);

  const combinedPendingReports = [
    ...pendingGroupReports.map((r) => ({
      id: r.id,
      typeLabel: `Cercle (${r.targetType})`,
      reason: r.reason,
      reporter: r.reporterName,
      createdAt: r.createdAt
    })),
    ...pendingUserReports.map((r) => ({
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
      {/* KPI Stat Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigateModule('users')}
          className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Utilisateurs inscrits</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums mt-2">
            {users.length}
          </p>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Comptes actifs répertoriés</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateModule('posts')}
          className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Publications & Capsules</span>
            <FileText className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums mt-2">
            {totalPosts}
          </p>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>
              <span className="font-mono tabular-nums">{pendingPostsCount}</span> en attente d&apos;approbation
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateModule('circles')}
          className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Cercles communautaires</span>
            <Layers className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums mt-2">
            {groups.length}
          </p>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>
              <span className="font-mono tabular-nums">
                {groups.filter((g) => g.privacy === 'private').length}
              </span>{' '}
              privés ·{' '}
              <span className="font-mono tabular-nums">
                {groups.filter((g) => g.privacy === 'public').length}
              </span>{' '}
              publics
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateModule('reports')}
          className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Signalements en attente</span>
            <AlertTriangle
              className={`w-4 h-4 ${pendingReportsTotal > 0 ? 'text-amber-600' : 'text-emerald-600'}`}
            />
          </div>
          <p
            className={`text-2xl font-extrabold font-mono tabular-nums mt-2 ${
              pendingReportsTotal > 0 ? 'text-amber-600' : 'text-slate-900'
            }`}
          >
            {pendingReportsTotal}
          </p>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>
              Total historique :{' '}
              <span className="font-mono tabular-nums">
                {userReports.length + groupReports.length}
              </span>
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
          </p>
        </button>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <ActivityTimelineChart users={users} groupPosts={groupPosts} capsules={capsules} />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <ContentBreakdownChart
            publicPostsCount={publicPostsCount}
            circlePostsCount={circlePostsCount}
            capsulesCount={capsules.length}
            commentsCount={commentsCount}
          />
        </div>
      </div>

      {/* Operational Lists Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Users */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Utilisateurs récemment inscrits</h3>
            <button
              type="button"
              onClick={() => onNavigateModule('users')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Tout voir
            </button>
          </div>
          {recentUsers.length === 0 ? (
            <p className="p-6 text-xs text-slate-500 text-center">Aucun utilisateur enregistré pour le moment.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentUsers.map((u) => (
                <div key={u.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50">
                  <div className="flex items-center gap-3 min-w-0">
                    {u.avatar_url ? (
                      <img
                        src={u.avatar_url}
                        alt={u.nom}
                        className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {u.nom.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">{u.nom}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {u.email || u.id} · <span className="uppercase">{u.langue_preferee}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[11px] font-mono text-slate-600 uppercase">{u.role}</span>
                    <p className="text-[11px] font-mono tabular-nums text-slate-400">
                      {formatDateTime(u.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Publications */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Publications récentes</h3>
            <button
              type="button"
              onClick={() => onNavigateModule('posts')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Gérer
            </button>
          </div>
          {recentPosts.length === 0 ? (
            <p className="p-6 text-xs text-slate-500 text-center">Aucune publication enregistrée.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentPosts.map((p) => (
                <div key={p.id} className="px-5 py-3 flex items-start justify-between gap-3 hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {p.authorName}{' '}
                      <span className="font-normal text-slate-400">
                        · {p.groupId === 'public' ? 'Fil public' : p.groupId}
                      </span>
                    </p>
                    <p className="text-xs text-slate-600 truncate mt-0.5">
                      {p.content || `[Média ${p.type}]`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`text-[11px] font-semibold ${
                        p.status === 'published'
                          ? 'text-emerald-600'
                          : p.status === 'pending'
                            ? 'text-amber-600'
                            : 'text-slate-500'
                      }`}
                    >
                      {p.status}
                    </span>
                    <p className="text-[11px] font-mono tabular-nums text-slate-400">
                      {formatDateTime(p.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Reports */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Signalements en attente</h3>
            <button
              type="button"
              onClick={() => onNavigateModule('reports')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Traiter
            </button>
          </div>
          {combinedPendingReports.length === 0 ? (
            <p className="p-6 text-xs text-slate-500 text-center">
              Aucun signalement en attente de traitement.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {combinedPendingReports.map((r) => (
                <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">{r.reason}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {r.typeLabel} · Signalé par {r.reporter}
                    </p>
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-amber-700 shrink-0">
                    {formatDateTime(r.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Administrative Audit Activity */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Activité administrative</h3>
            <button
              type="button"
              onClick={() => onNavigateModule('audit')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Journal complet
            </button>
          </div>
          {recentLogs.length === 0 ? (
            <p className="p-6 text-xs text-slate-500 text-center">
              Aucune action administrative enregistrée pour le moment.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentLogs.map((log) => (
                <div key={log.id} className="px-5 py-3 flex items-start justify-between gap-3 hover:bg-slate-50">
                  <div className="min-w-0 flex items-start gap-2.5">
                    <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        <span className="font-mono text-blue-700">{log.action}</span> · {log.actorName}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">{log.details}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-slate-400 shrink-0 inline-flex items-center gap-1">
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
