import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  EyeOff,
  FileText,
  Flag,
  Lock,
  Megaphone,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Trash2,
  Unlock,
  Upload,
  UserCheck,
  UserMinus,
  Users,
  UserX,
  X
} from 'lucide-react';
import {
  CommunityGroup,
  CommunityMember,
  GroupAnnouncement,
  GroupEvent,
  GroupMemberRole,
  GroupPost,
  GroupReport,
  ModeratorPermissions,
  PostComment,
  UserProfile
} from '../../types';
import { communityService } from '../../services/communityService';
import {
  COMMUNITY_AVATAR_PRESETS,
  COMMUNITY_CATEGORIES,
  COMMUNITY_COVER_PRESETS
} from './communityAssets';

interface CommunityAdminDashboardProps {
  group: CommunityGroup;
  members: CommunityMember[];
  posts: GroupPost[];
  comments: PostComment[];
  reports: GroupReport[];
  events: GroupEvent[];
  announcements: GroupAnnouncement[];
  currentUser: UserProfile;
  currentMember: CommunityMember;
  onGroupDeleted: () => void;
}

type AdminSubTab = 'overview' | 'members' | 'moderation' | 'settings';

function formatShortDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatRelative(iso?: string): string {
  if (!iso) return '';
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '';
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Il y a ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `Il y a ${diffD} j`;
  return formatShortDate(iso);
}

const CommunityAdminDashboard: React.FC<CommunityAdminDashboardProps> = ({
  group,
  members,
  posts,
  comments,
  reports,
  events,
  announcements,
  currentUser,
  currentMember,
  onGroupDeleted
}) => {
  const isAdmin =
    currentMember.role === 'administrateur' || group.createdBy === currentUser.id;
  const perms = currentMember.permissions;
  const canApprovePosts = isAdmin || Boolean(perms?.approvePosts);
  const canManageReports = isAdmin || Boolean(perms?.manageReports);
  const canApproveMembers = isAdmin || Boolean(perms?.approveMembers);

  const [subTab, setSubTab] = useState<AdminSubTab>('overview');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Members filters & role modal
  const [memberSearch, setMemberSearch] = useState('');
  const [memberFilter, setMemberFilter] = useState<'all' | GroupMemberRole | 'suspended'>('all');
  const [editingPermsMember, setEditingPermsMember] = useState<CommunityMember | null>(null);
  const [draftRole, setDraftRole] = useState<GroupMemberRole>('moderateur');
  const [draftPerms, setDraftPerms] = useState<ModeratorPermissions>({
    approvePosts: true,
    manageComments: true,
    manageReports: true,
    approveMembers: false
  });

  // Confirmation modal (Replaces window.confirm cleanly)
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Settings form state
  const [editName, setEditName] = useState(group.name);
  const [editDesc, setEditDesc] = useState(group.description);
  const [editCat, setEditCat] = useState(group.category);
  const [editPrivacy, setEditPrivacy] = useState<'public' | 'private'>(group.privacy);
  const [editPostPerm, setEditPostPerm] = useState<'all_members' | 'admins_only'>(
    group.postPermission
  );
  const [editReqPostApproval, setEditReqPostApproval] = useState(group.requirePostApproval);
  const [editReqMemberApproval, setEditReqMemberApproval] = useState(group.requireMemberApproval);
  const [editAllowAnon, setEditAllowAnon] = useState(group.allowAnonymousPosts);
  const [editCover, setEditCover] = useState(group.coverPhoto || '');
  const [editAvatar, setEditAvatar] = useState(group.avatarPhoto || '');
  const [editRules, setEditRules] = useState<string[]>(group.rules || []);
  const [newRuleText, setNewRuleText] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<'cover' | 'avatar' | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    window.setTimeout(() => {
      setFeedback((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  // Real derived stats
  const activeMembers = useMemo(
    () => members.filter((m) => m.status === 'active'),
    [members]
  );
  const pendingMembers = useMemo(
    () => members.filter((m) => m.status === 'pending'),
    [members]
  );
  const publishedPosts = useMemo(
    () => posts.filter((p) => p.status === 'published'),
    [posts]
  );
  const pendingPosts = useMemo(
    () => posts.filter((p) => p.status === 'pending' || p.status === 'scheduled'),
    [posts]
  );
  const pendingReports = useMemo(
    () => reports.filter((r) => r.status === 'pending'),
    [reports]
  );

  // Member growth over the last 7 days computed from real `joinedAt`
  const growthChart = useMemo(() => {
    const days: { key: string; label: string; newCount: number; cumulative: number }[] = [];
    const now = new Date();
    const startWindow = new Date(now);
    startWindow.setHours(0, 0, 0, 0);
    startWindow.setDate(startWindow.getDate() - 6);

    const baseline = activeMembers.filter((m) => {
      const t = new Date(m.joinedAt).getTime();
      return !Number.isNaN(t) && t < startWindow.getTime();
    }).length;

    let running = baseline;
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);

      const newCount = activeMembers.filter((m) => {
        const t = new Date(m.joinedAt).getTime();
        return !Number.isNaN(t) && t >= d.getTime() && t < nextDay.getTime();
      }).length;

      running += newCount;
      days.push({
        key: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        newCount,
        cumulative: running
      });
    }
    const maxVal = Math.max(...days.map((d) => d.cumulative), 1);
    return { days, maxVal };
  }, [activeMembers]);

  // Recent real activity feed
  const recentActivities = useMemo(() => {
    type ActItem = {
      id: string;
      at: string;
      label: string;
      detail: string;
      kind: 'member' | 'post' | 'event' | 'announcement' | 'report';
    };
    const items: ActItem[] = [];

    members.slice(0, 12).forEach((m) => {
      items.push({
        id: `act_m_${m.id}`,
        at: m.joinedAt,
        label:
          m.status === 'pending'
            ? `${m.userName} demande à rejoindre le cercle`
            : `${m.userName} a rejoint le cercle`,
        detail: `Rôle : ${m.role}`,
        kind: 'member'
      });
    });

    posts.slice(0, 12).forEach((p) => {
      items.push({
        id: `act_p_${p.id}`,
        at: p.createdAt,
        label: `${p.isAnonymous ? 'Publication anonyme' : p.authorName} — ${
          p.status === 'pending'
            ? 'En attente de validation'
            : p.status === 'scheduled'
              ? 'Publication programmée'
              : 'Nouvelle publication'
        }`,
        detail: p.content.slice(0, 80) || p.type,
        kind: 'post'
      });
    });

    events.slice(0, 6).forEach((ev) => {
      items.push({
        id: `act_e_${ev.id}`,
        at: ev.createdAt,
        label: `Événement créé : ${ev.title}`,
        detail: `Par ${ev.createdByName}`,
        kind: 'event'
      });
    });

    announcements.slice(0, 6).forEach((ann) => {
      items.push({
        id: `act_a_${ann.id}`,
        at: ann.createdAt,
        label: `Annonce (${ann.priority}) : ${ann.title}`,
        detail: `Par ${ann.authorName}`,
        kind: 'announcement'
      });
    });

    reports.slice(0, 6).forEach((rep) => {
      items.push({
        id: `act_r_${rep.id}`,
        at: rep.createdAt,
        label: `Signalement (${rep.reason})`,
        detail: `Par ${rep.reporterName} — ${rep.status}`,
        kind: 'report'
      });
    });

    return items
      .sort((a, b) => (b.at || '').localeCompare(a.at || ''))
      .slice(0, 12);
  }, [members, posts, events, announcements, reports]);

  const filteredDirectoryMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return members.filter((m) => {
      if (m.status === 'pending') return false;
      if (memberFilter === 'suspended' && m.status !== 'suspended') return false;
      if (
        memberFilter !== 'all' &&
        memberFilter !== 'suspended' &&
        m.role !== memberFilter
      ) {
        return false;
      }
      if (q && !m.userName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [members, memberSearch, memberFilter]);

  const handleApproveMember = async (member: CommunityMember) => {
    try {
      setBusyId(member.id);
      await communityService.approveMemberRequest(group, member.userId, currentUser.nom);
      showToast('success', `${member.userName} a été accepté(e) dans le cercle.`);
    } catch (err: any) {
      showToast('error', err?.message || "Impossible d'accepter ce membre.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDeclineMember = (member: CommunityMember) => {
    setConfirmModal({
      title: member.status === 'pending' ? "Refuser la demande ?" : "Exclure ce membre ?",
      message:
        member.status === 'pending'
          ? `Voulez-vous refuser la demande d'adhésion de ${member.userName} ?`
          : `${member.userName} perdra l'accès à ce cercle communautaire.`,
      confirmLabel: member.status === 'pending' ? 'Refuser' : 'Exclure le membre',
      danger: true,
      onConfirm: async () => {
        await communityService.rejectOrRemoveMember(
          group.id,
          member.userId,
          member.status === 'active'
        );
        showToast(
          'success',
          member.status === 'pending'
            ? `Demande de ${member.userName} refusée.`
            : `${member.userName} a été exclu(e) du cercle.`
        );
      }
    });
  };

  const handleToggleSuspend = async (member: CommunityMember) => {
    const suspend = member.status !== 'suspended';
    setConfirmModal({
      title: suspend ? 'Suspendre ce membre ?' : 'Réactiver ce membre ?',
      message: suspend
        ? `${member.userName} ne pourra plus publier ni commenter tant que la suspension est active.`
        : `${member.userName} retrouvera ses droits d'accès au cercle.`,
      confirmLabel: suspend ? 'Suspendre' : 'Réactiver',
      danger: suspend,
      onConfirm: async () => {
        await communityService.suspendMember(group.id, member.userId, suspend);
        showToast(
          'success',
          suspend ? `${member.userName} a été suspendu(e).` : `${member.userName} a été réactivé(e).`
        );
      }
    });
  };

  const openRoleEditor = (member: CommunityMember) => {
    setEditingPermsMember(member);
    setDraftRole(member.role);
    setDraftPerms(
      member.permissions || {
        approvePosts: true,
        manageComments: true,
        manageReports: true,
        approveMembers: false
      }
    );
  };

  const handleSaveRoleEditor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPermsMember) return;
    try {
      setBusyId(editingPermsMember.id);
      await communityService.updateMemberRole(
        group,
        editingPermsMember.userId,
        draftRole,
        currentUser.nom,
        draftRole === 'membre'
          ? undefined
          : draftRole === 'administrateur'
            ? {
                approvePosts: true,
                manageComments: true,
                manageReports: true,
                approveMembers: true
              }
            : draftPerms
      );
      showToast('success', `Rôle mis à jour pour ${editingPermsMember.userName}.`);
      setEditingPermsMember(null);
    } catch (err: any) {
      showToast('error', err?.message || 'Erreur lors de la mise à jour du rôle.');
    } finally {
      setBusyId(null);
    }
  };

  const handleApprovePost = async (post: GroupPost) => {
    try {
      setBusyId(post.id);
      await communityService.updateGroupPost(post.id, { status: 'published' });
      if (post.authorId !== currentUser.id) {
        await communityService.createNotification({
          userId: post.authorId,
          groupId: group.id,
          groupName: group.name,
          type: 'post_approved',
          message: `Votre publication dans « ${group.name} » a été approuvée et publiée.`,
          actorName: currentUser.nom
        });
      }
      showToast('success', 'Publication approuvée et visible dans le fil.');
    } catch (err: any) {
      showToast('error', err?.message || "Impossible d'approuver cette publication.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDeletePendingPost = (post: GroupPost) => {
    setConfirmModal({
      title: 'Supprimer cette publication ?',
      message: 'Cette publication sera définitivement supprimée du cercle.',
      confirmLabel: 'Supprimer',
      danger: true,
      onConfirm: async () => {
        await communityService.deleteGroupPost(post.id, group.id);
        showToast('success', 'Publication supprimée.');
      }
    });
  };

  const handleResolveReport = async (
    report: GroupReport,
    action: 'resolve_only' | 'delete_target' | 'dismiss'
  ) => {
    try {
      setBusyId(report.id);
      if (action === 'delete_target') {
        if (report.targetType === 'post') {
          const targetPost = posts.find((p) => p.id === report.targetId);
          if (targetPost) {
            await communityService.deleteGroupPost(targetPost.id, group.id);
          }
        } else if (report.targetType === 'comment') {
          const targetCom = comments.find((c) => c.id === report.targetId);
          if (targetCom) {
            await communityService.deletePostComment(targetCom.id, targetCom.postId);
          }
        }
        await communityService.resolveReport(report.id, 'resolved', currentUser.id);
        showToast('success', 'Contenu supprimé et signalement résolu.');
      } else if (action === 'resolve_only') {
        await communityService.resolveReport(report.id, 'resolved', currentUser.id);
        showToast('success', 'Signalement marqué comme résolu.');
      } else {
        await communityService.resolveReport(report.id, 'dismissed', currentUser.id);
        showToast('success', 'Signalement classé sans suite.');
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Erreur lors du traitement du signalement.');
    } finally {
      setBusyId(null);
    }
  };

  const handleUploadBrandingImage = async (
    file: File,
    kind: 'cover' | 'avatar'
  ) => {
    try {
      setUploadingImage(kind);
      const uploaded = await communityService.uploadCommunityMedia(group.id, file, 'branding');
      if (kind === 'cover') setEditCover(uploaded.url);
      else setEditAvatar(uploaded.url);
      showToast('success', 'Image téléversée avec succès.');
    } catch (err: any) {
      showToast('error', err?.message || "Échec du téléversement de l'image.");
    } finally {
      setUploadingImage(null);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      showToast('error', 'Le nom du cercle est obligatoire.');
      return;
    }
    try {
      setSavingSettings(true);
      await communityService.updateGroupSettings(group.id, {
        name: editName,
        description: editDesc,
        category: editCat,
        privacy: editPrivacy,
        postPermission: editPostPerm,
        requirePostApproval: editReqPostApproval,
        requireMemberApproval: editReqMemberApproval,
        allowAnonymousPosts: editAllowAnon,
        coverPhoto: editCover,
        avatarPhoto: editAvatar,
        rules: editRules
      });
      showToast('success', 'Paramètres et règles du cercle enregistrés.');
    } catch (err: any) {
      showToast('error', err?.message || "Impossible d'enregistrer les paramètres.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteCircle = () => {
    setConfirmModal({
      title: `Supprimer définitivement « ${group.name} » ?`,
      message:
        'Cette action supprimera ce cercle communautaire de manière irréversible. Tous les membres perdront l’accès.',
      confirmLabel: 'Supprimer le cercle',
      danger: true,
      onConfirm: async () => {
        await communityService.deleteGroup(group.id);
        onGroupDeleted();
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Header Banner & Navigation */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                Tableau de bord {isAdmin ? 'Administrateur' : 'Modération'}
              </h2>
              <p className="text-xs text-slate-500">
                Pilotage, modération et paramètres de « {group.name} »
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'overview' as AdminSubTab, label: "Vue d'ensemble", icon: BarChart3 },
              {
                id: 'members' as AdminSubTab,
                label: `Membres${pendingMembers.length > 0 ? ` (${pendingMembers.length})` : ''}`,
                icon: Users
              },
              {
                id: 'moderation' as AdminSubTab,
                label: `Modération${
                  pendingPosts.length + pendingReports.length > 0
                    ? ` (${pendingPosts.length + pendingReports.length})`
                    : ''
                }`,
                icon: ShieldAlert
              },
              ...(isAdmin
                ? [{ id: 'settings' as AdminSubTab, label: 'Paramètres', icon: Settings }]
                : [])
            ].map((tab) => {
              const Icon = tab.icon;
              const active = subTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSubTab(tab.id)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                    active
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-[#F0F2F5] text-slate-700 hover:bg-slate-200/80'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {feedback && (
          <div
            className={`mt-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold flex items-center justify-between gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            <span>{feedback.text}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="p-0.5 opacity-70 hover:opacity-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 1. OVERVIEW TAB */}
      {subTab === 'overview' && (
        <div className="space-y-4">
          {/* 6 KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              {
                label: 'Membres actifs',
                value: activeMembers.length,
                icon: Users,
                tone: 'text-blue-600 bg-blue-50'
              },
              {
                label: 'Publications',
                value: publishedPosts.length,
                icon: FileText,
                tone: 'text-indigo-600 bg-indigo-50'
              },
              {
                label: 'Commentaires',
                value: comments.length,
                icon: MessageSquare,
                tone: 'text-emerald-600 bg-emerald-50'
              },
              {
                label: 'En attente',
                value: pendingPosts.length,
                icon: Clock,
                tone: 'text-amber-600 bg-amber-50'
              },
              {
                label: 'Demandes adhésion',
                value: pendingMembers.length,
                icon: UserCheck,
                tone: 'text-purple-600 bg-purple-50'
              },
              {
                label: 'Signalements',
                value: pendingReports.length,
                icon: Flag,
                tone: 'text-red-600 bg-red-50'
              }
            ].map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div
                  key={kpi.label}
                  className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-xs"
                >
                  <div className={`w-8 h-8 rounded-xl ${kpi.tone} flex items-center justify-center mb-2`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <p className="text-xl font-black text-slate-900 tabular-nums">{kpi.value}</p>
                  <p className="text-[11px] font-semibold text-slate-500 mt-0.5">{kpi.label}</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Member growth SVG chart */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Évolution des membres (7 jours)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Progression cumulée calculée depuis les adhésions réelles
                  </p>
                </div>
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-xl tabular-nums">
                  {activeMembers.length} total
                </span>
              </div>

              <div className="h-44 flex items-end gap-2 pt-4">
                {growthChart.days.map((d) => {
                  const pct = Math.max(12, Math.round((d.cumulative / growthChart.maxVal) * 100));
                  return (
                    <div key={d.key} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                      <span className="text-[10px] font-bold text-slate-700 tabular-nums">
                        {d.cumulative}
                      </span>
                      <div className="w-full max-w-[34px] flex-1 flex items-end bg-[#F0F2F5] rounded-xl overflow-hidden p-0.5">
                        <div
                          className="w-full bg-blue-600 rounded-lg transition-all duration-300"
                          style={{ height: `${pct}%` }}
                          title={`${d.label} : ${d.cumulative} membres (+${d.newCount})`}
                        />
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400 tabular-nums">
                        {d.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent activity timeline */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <span>Activités récentes</span>
                </h3>
                <span className="text-[11px] text-slate-400 font-semibold">Temps réel</span>
              </div>

              {recentActivities.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">
                  Aucune activité enregistrée pour le moment.
                </p>
              ) : (
                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {recentActivities.map((act) => (
                    <div
                      key={act.id}
                      className="flex items-start gap-2.5 p-2 rounded-xl bg-[#F0F2F5]/70"
                    >
                      <div className="w-7 h-7 rounded-lg bg-white border border-slate-200/80 flex items-center justify-center shrink-0 mt-0.5">
                        {act.kind === 'member' && <Users className="w-3.5 h-3.5 text-blue-600" />}
                        {act.kind === 'post' && <FileText className="w-3.5 h-3.5 text-indigo-600" />}
                        {act.kind === 'event' && <Calendar className="w-3.5 h-3.5 text-emerald-600" />}
                        {act.kind === 'announcement' && (
                          <Megaphone className="w-3.5 h-3.5 text-amber-600" />
                        )}
                        {act.kind === 'report' && <Flag className="w-3.5 h-3.5 text-red-600" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate">{act.label}</p>
                        <p className="text-[11px] text-slate-500 truncate">{act.detail}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0 tabular-nums">
                        {formatRelative(act.at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. MEMBERS & REQUESTS TAB */}
      {subTab === 'members' && (
        <div className="space-y-4">
          {/* Pending membership requests */}
          {canApproveMembers && (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-purple-600" />
                  <span>Demandes d'adhésion en attente ({pendingMembers.length})</span>
                </h3>
              </div>

              {pendingMembers.length === 0 ? (
                <p className="text-xs text-slate-400 py-3">
                  Aucune demande d'adhésion en attente.
                </p>
              ) : (
                <div className="space-y-2">
                  {pendingMembers.map((req) => (
                    <div
                      key={req.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-[#F0F2F5]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {req.userAvatar ? (
                          <img
                            src={req.userAvatar}
                            alt={req.userName}
                            className="w-10 h-10 rounded-full object-cover shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0">
                            {req.userName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{req.userName}</p>
                          <p className="text-[11px] text-slate-500">
                            Demandé le {formatShortDate(req.joinedAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={busyId === req.id}
                          onClick={() => handleApproveMember(req)}
                          className="min-h-[38px] px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Accepter</span>
                        </button>
                        <button
                          type="button"
                          disabled={busyId === req.id}
                          onClick={() => handleDeclineMember(req)}
                          className="min-h-[38px] px-3.5 py-1.5 bg-white hover:bg-red-50 text-red-600 border border-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Refuser</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Active & Suspended Members Management */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-extrabold text-slate-900">
                Gestion des membres ({filteredDirectoryMembers.length})
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Rechercher un membre..."
                    className="bg-[#F0F2F5] text-xs pl-8 pr-3 py-2 rounded-xl border border-transparent focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                </div>
                <select
                  value={memberFilter}
                  onChange={(e) =>
                    setMemberFilter(e.target.value as 'all' | GroupMemberRole | 'suspended')
                  }
                  className="bg-[#F0F2F5] text-xs font-bold text-slate-700 px-3 py-2 rounded-xl focus:outline-none"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="administrateur">Administrateurs</option>
                  <option value="moderateur">Modérateurs</option>
                  <option value="membre">Membres</option>
                  <option value="suspended">Suspendus</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              {filteredDirectoryMembers.map((member) => {
                const isSelf = member.userId === currentUser.id;
                const isCreator = member.userId === group.createdBy;
                return (
                  <div
                    key={member.id}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200/70 hover:bg-slate-50/80 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {member.userAvatar ? (
                        <img
                          src={member.userAvatar}
                          alt={member.userName}
                          className="w-10 h-10 rounded-full object-cover shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0">
                          {member.userName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {member.userName}
                          </p>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-lg capitalize ${
                              member.role === 'administrateur'
                                ? 'bg-blue-100 text-blue-800'
                                : member.role === 'moderateur'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {member.role}
                          </span>
                          {member.status === 'suspended' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-red-100 text-red-700">
                              Suspendu
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Membre depuis le {formatShortDate(member.joinedAt)}
                        </p>
                      </div>
                    </div>

                    {isAdmin && !isSelf && !isCreator && (
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => openRoleEditor(member)}
                          className="min-h-[36px] px-3 py-1.5 bg-[#F0F2F5] hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Rôle & Droits</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleSuspend(member)}
                          className={`min-h-[36px] px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition ${
                            member.status === 'suspended'
                              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                              : 'bg-amber-50 hover:bg-amber-100 text-amber-800'
                          }`}
                        >
                          {member.status === 'suspended' ? (
                            <>
                              <Unlock className="w-3.5 h-3.5" />
                              <span>Réactiver</span>
                            </>
                          ) : (
                            <>
                              <UserX className="w-3.5 h-3.5" />
                              <span>Suspendre</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeclineMember(member)}
                          className="min-h-[36px] px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                          <span>Exclure</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. MODERATION & REPORTS TAB */}
      {subTab === 'moderation' && (
        <div className="space-y-4">
          {/* Pending & Scheduled Posts Queue */}
          {canApprovePosts && (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Publications en attente ou programmées ({pendingPosts.length})</span>
              </h3>

              {pendingPosts.length === 0 ? (
                <p className="text-xs text-slate-400 py-3">
                  Aucune publication en attente de modération.
                </p>
              ) : (
                <div className="space-y-3">
                  {pendingPosts.map((post) => (
                    <div
                      key={post.id}
                      className="p-4 rounded-2xl border border-slate-200/80 bg-[#F0F2F5]/60 space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            {post.isAnonymous ? 'Membre anonyme' : post.authorName}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                              post.status === 'scheduled'
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {post.status === 'scheduled'
                              ? `Programmée (${formatShortDate(post.scheduledFor)})`
                              : 'En attente'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {formatRelative(post.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                        {post.content || '(Publication média / sondage)'}
                      </p>

                      {post.media.length > 0 && (
                        <p className="text-[11px] font-semibold text-blue-700">
                          {post.media.length} média(x) joint(s) ({post.type})
                        </p>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={busyId === post.id}
                          onClick={() => handleApprovePost(post)}
                          className="min-h-[38px] px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Publier maintenant</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePendingPost(post)}
                          className="min-h-[38px] px-3.5 py-1.5 bg-white hover:bg-red-50 text-red-600 border border-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Rejeter & Supprimer</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Reports Queue */}
          {canManageReports && (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Flag className="w-4 h-4 text-red-600" />
                <span>Signalements ({reports.length})</span>
              </h3>

              {reports.length === 0 ? (
                <p className="text-xs text-slate-400 py-3">
                  Aucun signalement enregistré dans ce cercle.
                </p>
              ) : (
                <div className="space-y-3">
                  {reports.map((rep) => (
                    <div
                      key={rep.id}
                      className="p-4 rounded-2xl border border-slate-200/80 bg-white space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg bg-red-50 text-red-700">
                            {rep.targetType} · {rep.reason}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                              rep.status === 'pending'
                                ? 'bg-amber-100 text-amber-800'
                                : rep.status === 'resolved'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {rep.status === 'pending'
                              ? 'À traiter'
                              : rep.status === 'resolved'
                                ? 'Résolu'
                                : 'Ignoré'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          Signalé par {rep.reporterName} · {formatRelative(rep.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 bg-[#F0F2F5] p-2.5 rounded-xl">
                        « {rep.targetPreview || 'Contenu signalé'} »
                      </p>

                      {rep.details && (
                        <p className="text-[11px] text-slate-500">Précisions : {rep.details}</p>
                      )}

                      {rep.status === 'pending' && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {(rep.targetType === 'post' || rep.targetType === 'comment') && (
                            <button
                              type="button"
                              disabled={busyId === rep.id}
                              onClick={() => handleResolveReport(rep, 'delete_target')}
                              className="min-h-[36px] px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Supprimer le contenu</span>
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busyId === rep.id}
                            onClick={() => handleResolveReport(rep, 'resolve_only')}
                            className="min-h-[36px] px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Marquer résolu</span>
                          </button>
                          <button
                            type="button"
                            disabled={busyId === rep.id}
                            onClick={() => handleResolveReport(rep, 'dismiss')}
                            className="min-h-[36px] px-3 py-1.5 bg-[#F0F2F5] hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                          >
                            Ignorer
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. SETTINGS & RULES TAB (Admins Only) */}
      {subTab === 'settings' && isAdmin && (
        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900">
              Identité & Paramètres du cercle
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Nom du cercle
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full text-xs px-3.5 py-2.5 bg-[#F0F2F5] focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Catégorie
                </label>
                <select
                  value={editCat}
                  onChange={(e) => setEditCat(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 bg-[#F0F2F5] focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                >
                  {COMMUNITY_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Description
              </label>
              <textarea
                rows={3}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 bg-[#F0F2F5] focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Cover & Avatar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Photo de couverture
                  </label>
                  <button
                    type="button"
                    disabled={uploadingImage === 'cover'}
                    onClick={() => coverInputRef.current?.click()}
                    className="text-[11px] font-bold text-blue-700 hover:underline flex items-center gap-1"
                  >
                    <Upload className="w-3 h-3" />
                    <span>{uploadingImage === 'cover' ? 'Envoi...' : 'Importer'}</span>
                  </button>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadBrandingImage(f, 'cover');
                    }}
                  />
                </div>
                {editCover && (
                  <img
                    src={editCover}
                    alt="Couverture"
                    className="w-full h-24 object-cover rounded-2xl border border-slate-200"
                  />
                )}
                <div className="flex gap-1.5">
                  {COMMUNITY_COVER_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setEditCover(p.url)}
                      className={`h-8 flex-1 rounded-lg overflow-hidden border-2 transition ${
                        editCover === p.url ? 'border-blue-600' : 'border-transparent'
                      }`}
                      title={p.label}
                    >
                      <img src={p.url} alt={p.label} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Photo de profil du cercle
                  </label>
                  <button
                    type="button"
                    disabled={uploadingImage === 'avatar'}
                    onClick={() => avatarInputRef.current?.click()}
                    className="text-[11px] font-bold text-blue-700 hover:underline flex items-center gap-1"
                  >
                    <Upload className="w-3 h-3" />
                    <span>{uploadingImage === 'avatar' ? 'Envoi...' : 'Importer'}</span>
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadBrandingImage(f, 'avatar');
                    }}
                  />
                </div>
                <div className="flex items-center gap-3">
                  {editAvatar && (
                    <img
                      src={editAvatar}
                      alt="Avatar cercle"
                      className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shrink-0"
                    />
                  )}
                  <div className="flex gap-1.5 flex-1">
                    {COMMUNITY_AVATAR_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setEditAvatar(p.url)}
                        className={`w-10 h-10 rounded-xl overflow-hidden border-2 transition ${
                          editAvatar === p.url ? 'border-blue-600' : 'border-transparent'
                        }`}
                        title={p.label}
                      >
                        <img src={p.url} alt={p.label} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Privacy & Governance */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Confidentialité
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditPrivacy('public')}
                    className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-bold border transition ${
                      editPrivacy === 'public'
                        ? 'bg-blue-50 border-blue-600 text-blue-800'
                        : 'bg-[#F0F2F5] border-transparent text-slate-600'
                    }`}
                  >
                    Public
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditPrivacy('private')}
                    className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 transition ${
                      editPrivacy === 'private'
                        ? 'bg-blue-50 border-blue-600 text-blue-800'
                        : 'bg-[#F0F2F5] border-transparent text-slate-600'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Privé</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Autorisation de publication
                </label>
                <select
                  value={editPostPerm}
                  onChange={(e) =>
                    setEditPostPerm(e.target.value as 'all_members' | 'admins_only')
                  }
                  className="w-full min-h-[42px] text-xs px-3.5 py-2 bg-[#F0F2F5] border border-slate-200 rounded-xl font-semibold focus:outline-none"
                >
                  <option value="all_members">Tous les membres actifs</option>
                  <option value="admins_only">Administrateurs & Modérateurs uniquement</option>
                </select>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label className="flex items-center justify-between p-3 rounded-2xl bg-[#F0F2F5] cursor-pointer">
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    Approbation obligatoire des publications
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Les publications des membres doivent être validées avant affichage
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={editReqPostApproval}
                  onChange={(e) => setEditReqPostApproval(e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-2xl bg-[#F0F2F5] cursor-pointer">
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    Approbation des nouveaux membres
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Valider manuellement chaque nouvelle demande d'adhésion
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={editReqMemberApproval}
                  onChange={(e) => setEditReqMemberApproval(e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-2xl bg-[#F0F2F5] cursor-pointer">
                <div className="flex items-center gap-2">
                  <EyeOff className="w-4 h-4 text-slate-500" />
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      Autoriser les publications anonymes
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Permet aux membres de masquer leur nom dans le fil
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={editAllowAnon}
                  onChange={(e) => setEditAllowAnon(e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
              </label>
            </div>

            {/* Editable Rules */}
            <div className="space-y-2.5 pt-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Règles du cercle ({editRules.length})
              </label>

              <div className="space-y-2">
                {editRules.map((rule, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={rule}
                      onChange={(e) =>
                        setEditRules((prev) =>
                          prev.map((r, i) => (i === idx ? e.target.value : r))
                        )
                      }
                      className="flex-1 text-xs px-3 py-2 bg-[#F0F2F5] rounded-xl border border-transparent focus:border-blue-500 focus:bg-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setEditRules((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="p-2 text-slate-400 hover:text-red-600 rounded-lg"
                      title="Retirer cette règle"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newRuleText}
                  onChange={(e) => setNewRuleText(e.target.value)}
                  placeholder="Ajouter une nouvelle règle..."
                  className="flex-1 text-xs px-3.5 py-2 bg-[#F0F2F5] rounded-xl border border-slate-200 focus:bg-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newRuleText.trim()) return;
                    setEditRules((prev) => [...prev, newRuleText.trim()]);
                    setNewRuleText('');
                  }}
                  className="min-h-[38px] px-3.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter</span>
                </button>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleDeleteCircle}
                className="min-h-[42px] px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
              >
                <Trash2 className="w-4 h-4" />
                <span>Supprimer ce cercle</span>
              </button>

              <button
                type="submit"
                disabled={savingSettings}
                className="min-h-[42px] px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50"
              >
                {savingSettings ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Role & Moderator Permissions Modal */}
      {editingPermsMember &&
        createPortal(
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[90] animate-fadeIn">
            <form
              onSubmit={handleSaveRoleEditor}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Rôle de {editingPermsMember.userName}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingPermsMember(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(['membre', 'moderateur', 'administrateur'] as GroupMemberRole[]).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setDraftRole(role)}
                    className={`min-h-[42px] px-2.5 py-2 rounded-xl text-xs font-bold capitalize border transition ${
                      draftRole === role
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-[#F0F2F5] text-slate-700 border-transparent'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>

              {draftRole === 'moderateur' && (
                <div className="space-y-2 pt-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Permissions accordées au modérateur
                  </p>
                  {(
                    [
                      { key: 'approvePosts', label: 'Approuver / gérer les publications' },
                      { key: 'manageComments', label: 'Modérer / supprimer les commentaires' },
                      { key: 'manageReports', label: 'Traiter les signalements' },
                      { key: 'approveMembers', label: "Accepter / refuser les demandes d'adhésion" }
                    ] as { key: keyof ModeratorPermissions; label: string }[]
                  ).map((item) => (
                    <label
                      key={item.key}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#F0F2F5] cursor-pointer text-xs font-semibold text-slate-800"
                    >
                      <span>{item.label}</span>
                      <input
                        type="checkbox"
                        checked={draftPerms[item.key]}
                        onChange={(e) =>
                          setDraftPerms((prev) => ({ ...prev, [item.key]: e.target.checked }))
                        }
                        className="w-4 h-4 accent-blue-600"
                      />
                    </label>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPermsMember(null)}
                  className="min-h-[40px] px-4 py-2 bg-[#F0F2F5] text-slate-700 text-xs font-bold rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={busyId === editingPermsMember.id}
                  className="min-h-[40px] px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* In-app Confirmation Modal */}
      {confirmModal &&
        createPortal(
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[95] animate-fadeIn">
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl border border-slate-100 space-y-4">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    confirmModal.danger ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                  }`}
                >
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900">{confirmModal.title}</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {confirmModal.message}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={confirmBusy}
                  onClick={() => setConfirmModal(null)}
                  className="min-h-[40px] px-4 py-2 bg-[#F0F2F5] text-slate-700 text-xs font-bold rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={confirmBusy}
                  onClick={async () => {
                    try {
                      setConfirmBusy(true);
                      await confirmModal.onConfirm();
                      setConfirmModal(null);
                    } catch (err: any) {
                      showToast('error', err?.message || 'Action impossible.');
                      setConfirmModal(null);
                    } finally {
                      setConfirmBusy(false);
                    }
                  }}
                  className={`min-h-[40px] px-4 py-2 text-white text-xs font-bold rounded-xl ${
                    confirmModal.danger
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {confirmBusy ? 'Traitement...' : confirmModal.confirmLabel}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default CommunityAdminDashboard;
