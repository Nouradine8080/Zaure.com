import {
  Capsule,
  CommunityGroup,
  GroupPost,
  GroupReport,
  SupportTicket,
  UserProfile,
  UserReport
} from '../../types';
import {
  AdminAuditLog,
  AdminModuleId,
  AdminSessionContext,
  IndexedZaureFile,
  MODULE_TO_PERMISSION
} from '../types';

export interface AdminGlobalSearchHit {
  key: string;
  module: AdminModuleId;
  category: string;
  title: string;
  subtitle: string;
  seed: string;
}

export interface AdminGlobalSearchParams {
  query: string;
  session: AdminSessionContext | null;
  users?: UserProfile[];
  groupPosts?: GroupPost[];
  capsules?: Capsule[];
  groups?: CommunityGroup[];
  files?: IndexedZaureFile[];
  userReports?: UserReport[];
  groupReports?: GroupReport[];
  supportTickets?: SupportTicket[];
  auditLogs?: AdminAuditLog[];
  signal?: AbortSignal;
}

export function safeText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

export function safeLower(value: unknown): string {
  return safeText(value, '').toLowerCase();
}

export function normalizeAdminModuleRoute(moduleId?: string): AdminModuleId {
  const normalizedRouteId = moduleId === 'communities' ? 'circles' : moduleId;
  return normalizedRouteId &&
    Object.prototype.hasOwnProperty.call(MODULE_TO_PERMISSION, normalizedRouteId)
    ? (normalizedRouteId as AdminModuleId)
    : 'dashboard';
}

export async function executeAdminGlobalSearch(
  params: AdminGlobalSearchParams
): Promise<AdminGlobalSearchHit[]> {
  if (params.signal?.aborted) {
    throw new DOMException('Recherche annulée', 'AbortError');
  }

  const q = safeLower(params.query).trim();
  const session = params.session;
  if (!q || !session?.isAuthorized) {
    return [];
  }

  // Yield cleanly to microtask/event loop so UI remains responsive and AbortSignal checks apply
  await Promise.resolve();
  if (params.signal?.aborted) {
    throw new DOMException('Recherche annulée', 'AbortError');
  }

  const can = (mod: AdminModuleId) =>
    session.role === 'SUPER_ADMIN' || Boolean(session.permissions?.[MODULE_TO_PERMISSION[mod]]);

  const users = Array.isArray(params.users) ? params.users : [];
  const groupPosts = Array.isArray(params.groupPosts) ? params.groupPosts : [];
  const capsules = Array.isArray(params.capsules) ? params.capsules : [];
  const groups = Array.isArray(params.groups) ? params.groups : [];
  const files = Array.isArray(params.files) ? params.files : [];
  const userReports = Array.isArray(params.userReports) ? params.userReports : [];
  const groupReports = Array.isArray(params.groupReports) ? params.groupReports : [];
  const supportTickets = Array.isArray(params.supportTickets) ? params.supportTickets : [];
  const auditLogs = Array.isArray(params.auditLogs) ? params.auditLogs : [];

  const userNameById = new Map<string, string>();
  for (const u of users) {
    if (u && typeof u === 'object' && u.id) {
      userNameById.set(u.id, safeText(u.nom, u.id));
    }
  }

  const hits: AdminGlobalSearchHit[] = [];

  if (can('users')) {
    users
      .filter(
        (u) =>
          Boolean(u) &&
          (safeLower(u.nom).includes(q) ||
            safeLower(u.email).includes(q) ||
            safeLower(u.username).includes(q) ||
            safeLower(u.phone).includes(q) ||
            safeLower(u.id).includes(q))
      )
      .slice(0, 4)
      .forEach((u) => {
        const displayName = safeText(u.nom, 'Utilisateur');
        const subtitle =
          safeText(u.email) ||
          (u.username ? `@${safeText(u.username)}` : safeText(u.id));
        hits.push({
          key: `u_${safeText(u.id, displayName)}`,
          module: 'users',
          category: 'Utilisateur',
          title: displayName,
          subtitle,
          seed: displayName
        });
      });
  }

  if (can('posts')) {
    groupPosts
      .filter(
        (p) =>
          Boolean(p) &&
          (safeLower(p.content).includes(q) ||
            safeLower(p.authorName).includes(q) ||
            safeLower(p.id).includes(q))
      )
      .slice(0, 4)
      .forEach((p) => {
        const author = safeText(p.authorName, 'Auteur inconnu');
        const content = safeText(p.content, '');
        hits.push({
          key: `p_${safeText(p.id, author)}`,
          module: 'posts',
          category: 'Publication',
          title: author,
          subtitle: content.slice(0, 75) || safeText(p.id),
          seed: content.slice(0, 24) || author
        });
      });

    capsules
      .filter(
        (c) =>
          Boolean(c) &&
          (safeLower(c.contenu).includes(q) ||
            safeLower(c.auteur_nom).includes(q) ||
            safeLower(c.circle_nom).includes(q) ||
            safeLower(c.id).includes(q))
      )
      .slice(0, 2)
      .forEach((c) => {
        const author = safeText(c.auteur_nom, 'Auteur');
        const content = safeText(c.contenu, '');
        hits.push({
          key: `cap_${safeText(c.id, author)}`,
          module: 'posts',
          category: 'Capsule',
          title: author,
          subtitle: content.slice(0, 75) || safeText(c.circle_nom, c.id),
          seed: content.slice(0, 24) || author
        });
      });
  }

  if (can('circles')) {
    groups
      .filter(
        (g) =>
          Boolean(g) &&
          (safeLower(g.name).includes(q) ||
            safeLower(g.category).includes(q) ||
            safeLower(g.description).includes(q) ||
            safeLower(g.id).includes(q))
      )
      .slice(0, 4)
      .forEach((g) => {
        const groupName = safeText(g.name, 'Communauté');
        hits.push({
          key: `g_${safeText(g.id, groupName)}`,
          module: 'circles',
          category: 'Communauté',
          title: groupName,
          subtitle: `${safeText(g.category, 'Général')} · ${Number(g.memberCount) || 0} membre(s)`,
          seed: groupName
        });
      });
  }

  if (can('files')) {
    files
      .filter(
        (f) =>
          Boolean(f) &&
          (safeLower(f.name).includes(q) ||
            safeLower(f.ownerName).includes(q) ||
            safeLower(f.originLabel).includes(q) ||
            safeLower(f.contextTitle).includes(q))
      )
      .slice(0, 4)
      .forEach((f) => {
        const fileName = safeText(f.name, 'Fichier');
        hits.push({
          key: `f_${safeText(f.id, fileName)}`,
          module: 'files',
          category: 'Fichier',
          title: fileName,
          subtitle: `${safeText(f.originLabel, 'Média')} · ${safeText(f.ownerName, 'Membre')}`,
          seed: fileName
        });
      });
  }

  if (can('reports')) {
    // Firestore `reports` docs use UserReport fields (`reason`, `reporter_nom`, `reported_user_id`, `details`),
    // while legacy/merged items may include optional `reportedUserName` / `reporterName`. Guard every property safely.
    userReports
      .filter((r) => {
        if (!r) return false;
        const legacy = r as UserReport & { reportedUserName?: unknown; reporterName?: unknown };
        const reportedName =
          safeText(legacy.reportedUserName) || userNameById.get(safeText(r.reported_user_id)) || '';
        const reporterName = safeText(legacy.reporterName) || safeText(r.reporter_nom);
        return (
          safeLower(r.reason).includes(q) ||
          safeLower(r.details).includes(q) ||
          safeLower(reportedName).includes(q) ||
          safeLower(reporterName).includes(q) ||
          safeLower(r.reported_user_id).includes(q) ||
          safeLower(r.reporter_id).includes(q) ||
          safeLower(r.id).includes(q)
        );
      })
      .slice(0, 3)
      .forEach((r) => {
        const legacy = r as UserReport & { reportedUserName?: unknown };
        const reportedDisplay =
          safeText(legacy.reportedUserName) ||
          userNameById.get(safeText(r.reported_user_id)) ||
          safeText(r.reported_user_id, 'Utilisateur signalé');
        const reason = safeText(r.reason, 'Signalement');
        hits.push({
          key: `ur_${safeText(r.id, reportedDisplay)}`,
          module: 'reports',
          category: 'Signalement',
          title: reportedDisplay,
          subtitle: reason + (r.reporter_nom ? ` · Par ${safeText(r.reporter_nom)}` : ''),
          seed: reason
        });
      });

    groupReports
      .filter(
        (r) =>
          Boolean(r) &&
          (safeLower(r.reason).includes(q) ||
            safeLower(r.targetPreview).includes(q) ||
            safeLower(r.reporterName).includes(q) ||
            safeLower(r.id).includes(q))
      )
      .slice(0, 2)
      .forEach((r) => {
        const reason = safeText(r.reason, 'Signalement groupe');
        hits.push({
          key: `gr_${safeText(r.id, reason)}`,
          module: 'reports',
          category: 'Modération groupe',
          title: safeText(r.reporterName, 'Signalement'),
          subtitle: safeText(r.targetPreview) || reason,
          seed: reason
        });
      });

    supportTickets
      .filter(
        (t) =>
          Boolean(t) &&
          (safeLower(t.subject).includes(q) ||
            safeLower(t.description).includes(q) ||
            safeLower(t.userName).includes(q))
      )
      .slice(0, 2)
      .forEach((t) => {
        const subject = safeText(t.subject, 'Ticket support');
        hits.push({
          key: `tk_${safeText(t.id, subject)}`,
          module: 'reports',
          category: 'Ticket',
          title: subject,
          subtitle: `${safeText(t.userName, 'Membre')} · ${safeText(t.description).slice(0, 60)}`,
          seed: subject
        });
      });
  }

  if (can('audit')) {
    auditLogs
      .filter(
        (l) =>
          Boolean(l) &&
          (safeLower(l.action).includes(q) ||
            safeLower(l.actorName).includes(q) ||
            safeLower(l.details).includes(q) ||
            safeLower(l.module).includes(q))
      )
      .slice(0, 3)
      .forEach((l) => {
        const action = safeText(l.action, 'Action audit');
        hits.push({
          key: `al_${safeText(l.id, action)}`,
          module: 'audit',
          category: 'Audit',
          title: action,
          subtitle: safeText(l.details, safeText(l.actorName)).slice(0, 75),
          seed: action
        });
      });
  }

  return hits.slice(0, 14);
}
