import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BellRing,
  Bookmark,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileText,
  Film,
  Flag,
  Globe,
  Image as ImageIcon,
  Info,
  Link2,
  Lock,
  LogOut,
  MapPin,
  Megaphone,
  MessageSquare,
  MoreVertical,
  Pin,
  Plus,
  Search,
  Share2,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  Video,
  X
} from 'lucide-react';
import {
  CommunityGroup,
  CommunityMember,
  GroupAnnouncement,
  GroupEvent,
  GroupInvitation,
  GroupPost,
  GroupReport,
  PostComment,
  PostReaction,
  UserProfile
} from '../../types';
import { communityService } from '../../services/communityService';
import { formatFileSize, getDocumentBadgeInfo } from '../../utils/fileValidation';
import { getDefaultAvatar, getDefaultCoverByCategory } from './communityAssets';
import CommunityPostComposer from './CommunityPostComposer';
import CommunityPostCard from './CommunityPostCard';
import CommunityAdminDashboard from './CommunityAdminDashboard';

interface CommunityGroupPageProps {
  group: CommunityGroup;
  currentUser: UserProfile;
  allUsers: UserProfile[];
  currentMember?: CommunityMember;
  onBack: () => void;
  onGroupDeleted: () => void;
}

type GroupTab =
  | 'discussion'
  | 'about'
  | 'members'
  | 'photos'
  | 'videos'
  | 'events'
  | 'files'
  | 'announcements'
  | 'admin';

function formatDateFr(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTimeFr(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

const CommunityGroupPage: React.FC<CommunityGroupPageProps> = ({
  group,
  currentUser,
  allUsers,
  currentMember,
  onBack,
  onGroupDeleted
}) => {
  const isActiveMember = currentMember?.status === 'active';
  const isPendingMember = currentMember?.status === 'pending';
  const isSuspendedMember = currentMember?.status === 'suspended';
  const isAdmin =
    Boolean(isActiveMember) &&
    (currentMember?.role === 'administrateur' || group.createdBy === currentUser.id);
  const isModerator = Boolean(isActiveMember) && currentMember?.role === 'moderateur';
  const isStaff = isAdmin || isModerator;
  const canViewContent = group.privacy === 'public' || Boolean(isActiveMember);
  const canPost =
    Boolean(isActiveMember) &&
    (group.postPermission === 'all_members' || isStaff);

  const [activeTab, setActiveTab] = useState<GroupTab>('discussion');

  // Subscriptions state
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [reactions, setReactions] = useState<PostReaction[]>([]);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [events, setEvents] = useState<GroupEvent[]>([]);
  const [announcements, setAnnouncements] = useState<GroupAnnouncement[]>([]);
  const [reports, setReports] = useState<GroupReport[]>([]);

  // Discussion controls & pagination
  const [postFilter, setPostFilter] = useState<
    'all' | 'pinned' | 'polls' | 'saved' | 'pending'
  >('all');
  const [postSearch, setPostSearch] = useState('');
  const [visiblePostCount, setVisiblePostCount] = useState(10);

  // Members search
  const [memberSearch, setMemberSearch] = useState('');
  const [memberRoleFilter, setMemberRoleFilter] = useState<
    'all' | 'administrateur' | 'moderateur' | 'membre'
  >('all');

  // Files search
  const [fileSearch, setFileSearch] = useState('');

  // Photo lightbox
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);

  // Options dropdown & Toast
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [membershipBusy, setMembershipBusy] = useState(false);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteUserSearch, setInviteUserSearch] = useState('');
  const [invitedUserIds, setInvitedUserIds] = useState<string[]>([]);
  const [generatedInvite, setGeneratedInvite] = useState<GroupInvitation | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Event creation modal state
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [evTitle, setEvTitle] = useState('');
  const [evDesc, setEvDesc] = useState('');
  const [evStart, setEvStart] = useState('');
  const [evEnd, setEvEnd] = useState('');
  const [evIsOnline, setEvIsOnline] = useState(false);
  const [evLocation, setEvLocation] = useState('');
  const [evMeetingLink, setEvMeetingLink] = useState('');
  const [evBusy, setEvBusy] = useState(false);

  // Announcement creation modal state
  const [showCreateAnnModal, setShowCreateAnnModal] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annPriority, setAnnPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
  const [annPinned, setAnnPinned] = useState(true);
  const [annBusy, setAnnBusy] = useState(false);

  // Report circle modal state
  const [showReportCircleModal, setShowReportCircleModal] = useState(false);
  const [reportReason, setReportReason] = useState('Contenu inapproprié');
  const [reportDetails, setReportDetails] = useState('');
  const [reportBusy, setReportBusy] = useState(false);

  // In-app confirmation modal (never window.confirm)
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const notify = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    window.setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  // Subscribe only to authorized collections based on privacy/membership
  useEffect(() => {
    if (!canViewContent) {
      setMembers([]);
      setPosts([]);
      setReactions([]);
      setComments([]);
      setEvents([]);
      setAnnouncements([]);
      return;
    }

    const unsubs = [
      communityService.subscribeGroupMembers(group.id, setMembers),
      communityService.subscribeGroupPosts(group.id, setPosts),
      communityService.subscribeGroupReactions(group.id, setReactions),
      communityService.subscribeGroupComments(group.id, setComments),
      communityService.subscribeGroupEvents(group.id, setEvents),
      communityService.subscribeGroupAnnouncements(group.id, setAnnouncements)
    ];

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [group.id, canViewContent]);

  useEffect(() => {
    if (!isStaff) {
      setReports([]);
      return;
    }
    return communityService.subscribeGroupReports(group.id, setReports);
  }, [group.id, isStaff]);

  useEffect(() => {
    setVisiblePostCount(10);
  }, [group.id, postFilter, postSearch]);

  const activeMembers = useMemo(
    () => members.filter((m) => m.status === 'active'),
    [members]
  );

  // Filtered Posts for Discussion tab
  const filteredPosts = useMemo(() => {
    const q = postSearch.trim().toLowerCase();
    return posts.filter((p) => {
      const isAuthor = p.authorId === currentUser.id;
      if (postFilter === 'pending') {
        if (p.status === 'published') return false;
        if (!isStaff && !isAuthor) return false;
      } else {
        if (p.status !== 'published') return false;
        if (postFilter === 'pinned' && !p.isPinned) return false;
        if (postFilter === 'polls' && p.type !== 'poll') return false;
        if (postFilter === 'saved' && !(p.savedBy || []).includes(currentUser.id)) {
          return false;
        }
      }
      if (q) {
        const hay = `${p.content} ${p.authorName} ${p.externalLink || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [posts, postFilter, postSearch, currentUser.id, isStaff]);

  const visiblePosts = useMemo(
    () => filteredPosts.slice(0, visiblePostCount),
    [filteredPosts, visiblePostCount]
  );

  const pendingPostCount = useMemo(
    () =>
      posts.filter(
        (p) =>
          p.status !== 'published' && (isStaff || p.authorId === currentUser.id)
      ).length,
    [posts, isStaff, currentUser.id]
  );

  // Extracted Photos, Videos, Files from published posts
  const photoItems = useMemo(() => {
    const list: { postId: string; url: string; name: string; authorName: string; createdAt: string }[] = [];
    posts
      .filter((p) => p.status === 'published')
      .forEach((p) => {
        p.media
          .filter((m) => m.type === 'image')
          .forEach((m) => {
            list.push({
              postId: p.id,
              url: m.url,
              name: m.name,
              authorName: p.isAnonymous ? 'Membre anonyme' : p.authorName,
              createdAt: p.createdAt
            });
          });
      });
    return list;
  }, [posts]);

  const videoItems = useMemo(() => {
    const list: { postId: string; url: string; name: string; authorName: string; createdAt: string }[] = [];
    posts
      .filter((p) => p.status === 'published')
      .forEach((p) => {
        p.media
          .filter((m) => m.type === 'video')
          .forEach((m) => {
            list.push({
              postId: p.id,
              url: m.url,
              name: m.name,
              authorName: p.isAnonymous ? 'Membre anonyme' : p.authorName,
              createdAt: p.createdAt
            });
          });
      });
    return list;
  }, [posts]);

  const documentItems = useMemo(() => {
    const q = fileSearch.trim().toLowerCase();
    const list: {
      postId: string;
      url: string;
      name: string;
      size?: number;
      mimeType?: string;
      authorName: string;
      createdAt: string;
    }[] = [];
    posts
      .filter((p) => p.status === 'published')
      .forEach((p) => {
        p.media
          .filter((m) => m.type === 'document')
          .forEach((m) => {
            if (q && !m.name.toLowerCase().includes(q)) return;
            list.push({
              postId: p.id,
              url: m.url,
              name: m.name,
              size: m.size,
              mimeType: m.mimeType,
              authorName: p.isAnonymous ? 'Membre anonyme' : p.authorName,
              createdAt: p.createdAt
            });
          });
      });
    return list;
  }, [posts, fileSearch]);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return activeMembers.filter((m) => {
      if (memberRoleFilter !== 'all' && m.role !== memberRoleFilter) return false;
      if (q && !m.userName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [activeMembers, memberSearch, memberRoleFilter]);

  const invitableUsers = useMemo(() => {
    const memberUserIds = new Set(members.map((m) => m.userId));
    const q = inviteUserSearch.trim().toLowerCase();
    return allUsers.filter((u) => {
      if (u.id === currentUser.id) return false;
      if (memberUserIds.has(u.id)) return false;
      if (q && !u.nom.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [allUsers, members, currentUser.id, inviteUserSearch]);

  // Actions
  const handleJoinCircle = async () => {
    try {
      setMembershipBusy(true);
      const res = await communityService.joinGroup(group, currentUser);
      if (res.status === 'pending') {
        notify('success', "Votre demande d'adhésion a été envoyée aux administrateurs.");
      } else {
        notify('success', `Vous avez rejoint le cercle « ${group.name} ».`);
      }
    } catch (err: any) {
      notify('error', err?.message || 'Impossible de rejoindre ce cercle.');
    } finally {
      setMembershipBusy(false);
    }
  };

  const handleLeaveCircle = () => {
    if (group.createdBy === currentUser.id) {
      notify(
        'error',
        'En tant que créateur du cercle, vous pouvez le supprimer depuis le tableau de bord.'
      );
      return;
    }
    setConfirmModal({
      title: isPendingMember ? "Annuler la demande d'adhésion ?" : `Quitter « ${group.name} » ?`,
      message: isPendingMember
        ? 'Votre demande en attente sera retirée.'
        : 'Vous ne recevrez plus les mises à jour de ce cercle.',
      confirmLabel: isPendingMember ? 'Annuler la demande' : 'Quitter le cercle',
      danger: true,
      onConfirm: async () => {
        await communityService.leaveGroup(group.id, currentUser.id, Boolean(isActiveMember));
        notify('success', isPendingMember ? 'Demande annulée.' : 'Vous avez quitté ce cercle.');
      }
    });
  };

  const handleCopyGroupShareLink = async () => {
    const url = `${window.location.origin}/?community=${group.id}`;
    try {
      await navigator.clipboard.writeText(url);
      notify('success', 'Lien de partage du cercle copié.');
    } catch {
      notify('success', `Lien prêt : ${url}`);
    }
    setShowOptionsMenu(false);
  };

  const handleSendDirectInvite = async (targetUser: UserProfile) => {
    try {
      setInviteBusy(true);
      await communityService.sendDirectInvitation(group, currentUser, targetUser.id);
      setInvitedUserIds((prev) => [...prev, targetUser.id]);
      notify('success', `Invitation envoyée à ${targetUser.nom}.`);
    } catch (err: any) {
      notify('error', err?.message || "Impossible d'envoyer l'invitation.");
    } finally {
      setInviteBusy(false);
    }
  };

  const handleGenerateInviteLink = async () => {
    try {
      setInviteBusy(true);
      const inv = await communityService.createInviteLinkCode(group, currentUser);
      setGeneratedInvite(inv);
    } catch (err: any) {
      notify('error', err?.message || "Impossible de générer le lien d'invitation.");
    } finally {
      setInviteBusy(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evTitle.trim() || !evStart) return;
    try {
      setEvBusy(true);
      await communityService.createGroupEvent(group, currentUser, {
        title: evTitle,
        description: evDesc,
        location: evIsOnline ? 'En ligne' : evLocation || 'À préciser',
        isOnline: evIsOnline,
        meetingLink: evIsOnline ? evMeetingLink : undefined,
        startDate: evStart,
        endDate: evEnd || undefined
      });
      setEvTitle('');
      setEvDesc('');
      setEvStart('');
      setEvEnd('');
      setEvLocation('');
      setEvMeetingLink('');
      setShowCreateEventModal(false);
      notify('success', 'Événement communautaire publié.');
    } catch (err: any) {
      notify('error', err?.message || "Impossible de créer l'événement.");
    } finally {
      setEvBusy(false);
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim()) return;
    try {
      setAnnBusy(true);
      await communityService.createAnnouncement(group, currentUser, {
        title: annTitle,
        content: annContent,
        priority: annPriority,
        isPinned: annPinned
      });
      setAnnTitle('');
      setAnnContent('');
      setAnnPriority('normal');
      setShowCreateAnnModal(false);
      notify('success', 'Annonce officielle publiée.');
    } catch (err: any) {
      notify('error', err?.message || "Impossible de publier l'annonce.");
    } finally {
      setAnnBusy(false);
    }
  };

  const handleSubmitCircleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setReportBusy(true);
      await communityService.createReport({
        groupId: group.id,
        targetType: 'member',
        targetId: group.id,
        targetPreview: `Cercle : ${group.name}`,
        reporter: currentUser,
        reason: reportReason,
        details: reportDetails
      });
      setShowReportCircleModal(false);
      setReportDetails('');
      notify('success', 'Signalement enregistré. Merci pour votre vigilance.');
    } catch (err: any) {
      notify('error', err?.message || "Impossible d'envoyer le signalement.");
    } finally {
      setReportBusy(false);
    }
  };

  const coverUrl = group.coverPhoto || getDefaultCoverByCategory(group.category);
  const avatarUrl = group.avatarPhoto || getDefaultAvatar();
  const pinnedAnnouncement = announcements.find((a) => a.isPinned) || announcements[0];

  const navigationTabs: { id: GroupTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'discussion', label: 'Discussion', icon: MessageSquare },
    { id: 'about', label: 'À propos', icon: Info },
    { id: 'members', label: 'Membres', icon: Users, badge: activeMembers.length || group.memberCount },
    { id: 'photos', label: 'Photos', icon: ImageIcon, badge: photoItems.length },
    { id: 'videos', label: 'Vidéos', icon: Film, badge: videoItems.length },
    { id: 'events', label: 'Événements', icon: Calendar, badge: events.length },
    { id: 'files', label: 'Fichiers', icon: FileText, badge: documentItems.length },
    { id: 'announcements', label: 'Annonces', icon: Megaphone, badge: announcements.length },
    ...(isStaff
      ? [
          {
            id: 'admin' as GroupTab,
            label: 'Administration',
            icon: ShieldCheck,
            badge:
              members.filter((m) => m.status === 'pending').length +
              posts.filter((p) => p.status !== 'published').length +
              reports.filter((r) => r.status === 'pending').length
          }
        ]
      : [])
  ];

  return (
    <div className="space-y-4">
      {/* Top Bar: Back + Toast */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[40px] px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-bold text-slate-800 flex items-center gap-2 shadow-xs transition"
        >
          <ArrowLeft className="w-4 h-4 text-blue-600" />
          <span>Communautés</span>
        </button>

        {isStaff && (
          <button
            type="button"
            onClick={() => setActiveTab('admin')}
            className={`min-h-[40px] px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition ${
              activeTab === 'admin'
                ? 'bg-blue-600 text-white'
                : 'bg-white hover:bg-blue-50 text-blue-700 border border-slate-200/80'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Administration</span>
          </button>
        )}
      </div>

      {toast && (
        <div
          className={`px-4 py-3 rounded-2xl text-xs font-semibold flex items-center justify-between gap-2 shadow-xs ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          <span>{toast.text}</span>
          <button type="button" onClick={() => setToast(null)} className="p-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* EN-TÊTE DU CERCLE                                            */}
      {/* ============================================================ */}
      <section className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-xs">
        {/* Large Cover Photo */}
        <div className="relative h-44 sm:h-60 bg-slate-200">
          <img
            src={coverUrl}
            alt={group.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />

          {/* Privacy Badge on Cover */}
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-slate-950/75 backdrop-blur-md text-white text-[11px] font-bold flex items-center gap-1.5">
              {group.privacy === 'private' ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Cercle privé</span>
                </>
              ) : (
                <>
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Cercle public</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Profile Info & Actions */}
        <div className="px-4 sm:px-6 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-10 sm:-mt-12 relative z-10">
            <div className="flex items-end gap-3.5 min-w-0">
              <img
                src={avatarUrl}
                alt={group.name}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl object-cover ring-4 ring-white shadow-md bg-white shrink-0"
              />
              <div className="min-w-0 pb-1">
                <span className="inline-block text-[10px] font-extrabold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg mb-1">
                  {group.category}
                </span>
                <h1 className="text-lg sm:text-2xl font-black text-slate-900 truncate">
                  {group.name}
                </h1>
              </div>
            </div>

            {/* Action Buttons + 3-dot Options Menu */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {!currentMember && (
                <button
                  type="button"
                  disabled={membershipBusy}
                  onClick={handleJoinCircle}
                  className="min-h-[42px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>
                    {membershipBusy
                      ? 'Envoi...'
                      : group.privacy === 'private' || group.requireMemberApproval
                        ? 'Demander à rejoindre'
                        : 'Rejoindre le cercle'}
                  </span>
                </button>
              )}

              {isPendingMember && (
                <button
                  type="button"
                  onClick={handleLeaveCircle}
                  className="min-h-[42px] px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
                >
                  <Clock className="w-4 h-4" />
                  <span>Demande en attente (Annuler)</span>
                </button>
              )}

              {isActiveMember && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(true)}
                    className="min-h-[42px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Inviter</span>
                  </button>
                  {group.createdBy !== currentUser.id && (
                    <button
                      type="button"
                      onClick={handleLeaveCircle}
                      className="min-h-[42px] px-3.5 py-2 bg-[#F0F2F5] hover:bg-red-50 hover:text-red-700 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Quitter</span>
                    </button>
                  )}
                </>
              )}

              {/* 3-dot Menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowOptionsMenu((v) => !v)}
                  className="min-h-[42px] w-[42px] bg-[#F0F2F5] hover:bg-slate-200 text-slate-700 rounded-xl flex items-center justify-center transition"
                  title="Options du cercle"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {showOptionsMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-lg py-1.5 z-30 animate-fadeIn">
                    <button
                      type="button"
                      onClick={handleCopyGroupShareLink}
                      className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                    >
                      <Share2 className="w-4 h-4 text-blue-600" />
                      <span>Partager le lien du cercle</span>
                    </button>
                    {canViewContent && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('discussion');
                          setPostFilter('saved');
                          setShowOptionsMenu(false);
                        }}
                        className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                      >
                        <Bookmark className="w-4 h-4 text-amber-600" />
                        <span>Publications favorites</span>
                      </button>
                    )}
                    {isStaff && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('admin');
                          setShowOptionsMenu(false);
                        }}
                        className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-blue-700 hover:bg-blue-50 flex items-center gap-2.5"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Tableau de bord Admin</span>
                      </button>
                    )}
                    {isActiveMember && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowReportCircleModal(true);
                          setShowOptionsMenu(false);
                        }}
                        className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                      >
                        <Flag className="w-4 h-4 text-red-500" />
                        <span>Signaler ce cercle</span>
                      </button>
                    )}
                    {(isActiveMember || isPendingMember) && group.createdBy !== currentUser.id && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowOptionsMenu(false);
                          handleLeaveCircle();
                        }}
                        className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2.5 border-t border-slate-100 mt-1 pt-2"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Quitter ce cercle</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 mt-3 leading-relaxed">
            {group.description || 'Communauté Zaure dédiée au partage de connaissances et à l’entraide.'}
          </p>

          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-500 font-semibold">
            <span className="flex items-center gap-1.5 text-slate-800 font-bold tabular-nums">
              <Users className="w-4 h-4 text-blue-600" />
              {Math.max(group.memberCount, activeMembers.length)} membre(s)
            </span>
            <span className="flex items-center gap-1.5">
              {group.privacy === 'private' ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Contenu réservé aux membres</span>
                </>
              ) : (
                <>
                  <Globe className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Visible par la communauté</span>
                </>
              )}
            </span>
            <span className="text-slate-400">Créé le {formatDateFr(group.createdAt)}</span>
          </div>
        </div>

        {/* Navigation Tabs (only when authorized to view content) */}
        {canViewContent && (
          <div className="border-t border-slate-100 px-2 sm:px-4 flex items-center gap-1 overflow-x-auto no-scrollbar">
            {navigationTabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-h-[46px] px-3 py-2 text-xs font-bold flex items-center gap-1.5 shrink-0 border-b-2 transition ${
                    active
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {typeof tab.badge === 'number' && tab.badge > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-md tabular-nums ${
                        active ? 'bg-blue-100 text-blue-800' : 'bg-[#F0F2F5] text-slate-600'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Suspended Notice */}
      {isSuspendedMember && (
        <div className="bg-red-50 border border-red-200 rounded-3xl p-5 text-center space-y-2">
          <AlertTriangle className="w-8 h-8 text-red-600 mx-auto" />
          <h3 className="text-sm font-extrabold text-red-900">Accès temporairement suspendu</h3>
          <p className="text-xs text-red-700 max-w-md mx-auto">
            Un administrateur a suspendu votre participation dans ce cercle. Vous ne pouvez plus consulter ou publier de contenus.
          </p>
        </div>
      )}

      {/* PRIVATE GROUP GATE */}
      {!canViewContent && !isSuspendedMember && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-8 text-center shadow-xs space-y-3">
          <div className="w-14 h-14 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-base font-extrabold text-slate-900">Ce cercle est privé</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Les publications, discussions, fichiers et la liste des membres sont protégés et réservés exclusivement aux membres approuvés.
          </p>
          {isPendingMember ? (
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200">
              <Clock className="w-4 h-4" />
              <span>Votre demande d'adhésion est en cours d'examen par les administrateurs.</span>
            </div>
          ) : (
            <button
              type="button"
              disabled={membershipBusy}
              onClick={handleJoinCircle}
              className="min-h-[44px] px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition inline-flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>{membershipBusy ? 'Envoi en cours...' : "Envoyer une demande d'adhésion"}</span>
            </button>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB CONTENT (8+ TABS)                                        */}
      {/* ============================================================ */}
      {canViewContent && (
        <>
          {/* 1. DISCUSSION */}
          {activeTab === 'discussion' && (
            <div className="space-y-4">
              {/* Pinned official announcement callout */}
              {pinnedAnnouncement && (
                <div className="bg-white border border-blue-200/80 rounded-3xl p-4 shadow-xs flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Megaphone className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700">
                          Annonce officielle
                        </span>
                        {pinnedAnnouncement.priority === 'urgent' && (
                          <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-md">
                            Urgent
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-extrabold text-slate-900 mt-0.5">
                        {pinnedAnnouncement.title}
                      </p>
                      <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">
                        {pinnedAnnouncement.content}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('announcements')}
                    className="text-xs font-bold text-blue-700 hover:underline shrink-0"
                  >
                    Voir tout
                  </button>
                </div>
              )}

              {/* Post Composer */}
              {canPost && currentMember && (
                <CommunityPostComposer
                  group={group}
                  currentUser={currentUser}
                  currentMember={currentMember}
                />
              )}

              {!isActiveMember && group.privacy === 'public' && (
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <p className="text-xs text-slate-600 font-medium">
                    Rejoignez ce cercle pour publier, commenter et réagir aux échanges.
                  </p>
                  <button
                    type="button"
                    disabled={membershipBusy}
                    onClick={handleJoinCircle}
                    className="min-h-[38px] px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shrink-0"
                  >
                    Rejoindre le cercle
                  </button>
                </div>
              )}

              {/* Feed Filter & Search */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-3 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: 'all', label: 'Toutes' },
                    { id: 'pinned', label: 'Épinglées' },
                    { id: 'polls', label: 'Sondages' },
                    { id: 'saved', label: 'Favorites' },
                    ...(pendingPostCount > 0
                      ? [{ id: 'pending', label: `En attente (${pendingPostCount})` }]
                      : [])
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() =>
                        setPostFilter(
                          f.id as 'all' | 'pinned' | 'polls' | 'saved' | 'pending'
                        )
                      }
                      className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-bold transition ${
                        postFilter === f.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-[#F0F2F5] text-slate-600 hover:bg-slate-200/80'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="relative sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={postSearch}
                    onChange={(e) => setPostSearch(e.target.value)}
                    placeholder="Rechercher dans le fil..."
                    className="w-full bg-[#F0F2F5] text-xs pl-8 pr-3 py-2 rounded-xl focus:bg-white focus:outline-none border border-transparent focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Posts Feed with Progressive Loading */}
              {visiblePosts.length === 0 ? (
                <div className="bg-white border border-slate-200/80 rounded-3xl p-10 text-center shadow-xs">
                  <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2 stroke-1" />
                  <p className="text-sm font-bold text-slate-800">
                    Aucune publication à afficher
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Soyez le premier à lancer une discussion ou changez vos filtres.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {visiblePosts.map((post) => (
                    <CommunityPostCard
                      key={post.id}
                      group={group}
                      post={post}
                      comments={comments.filter((c) => c.postId === post.id)}
                      reactions={reactions.filter((r) => r.postId === post.id)}
                      members={activeMembers}
                      currentUser={currentUser}
                      currentMember={currentMember}
                    />
                  ))}

                  {filteredPosts.length > visiblePostCount && (
                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={() => setVisiblePostCount((prev) => prev + 10)}
                        className="min-h-[42px] px-6 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-blue-700 text-xs font-bold rounded-2xl shadow-xs transition"
                      >
                        Charger plus de publications ({filteredPosts.length - visiblePostCount}{' '}
                        restante(s))
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 2. À PROPOS */}
          {activeTab === 'about' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-4">
                <h2 className="text-sm font-extrabold text-slate-900">À propos de ce cercle</h2>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {group.description || 'Aucune description détaillée renseignée.'}
                </p>

                <div className="space-y-2.5 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex items-start gap-2.5">
                    {group.privacy === 'private' ? (
                      <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    ) : (
                      <Globe className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-bold text-slate-900">
                        {group.privacy === 'private' ? 'Cercle privé' : 'Cercle public'}
                      </p>
                      <p className="text-slate-500">
                        {group.privacy === 'private'
                          ? 'Seuls les membres approuvés peuvent consulter les publications et la liste des membres.'
                          : 'Tout membre connecté de la plateforme peut découvrir les publications.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-900">Gouvernance & Publications</p>
                      <p className="text-slate-500">
                        {group.postPermission === 'admins_only'
                          ? 'Seuls les administrateurs et modérateurs peuvent publier.'
                          : group.requirePostApproval
                            ? 'Tous les membres peuvent proposer des publications (avec validation).'
                            : 'Publication libre pour tous les membres actifs.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-4">
                <h2 className="text-sm font-extrabold text-slate-900">
                  Règles du cercle ({group.rules.length})
                </h2>
                {group.rules.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Respect mutuel, échanges constructifs et bienveillance sont attendus de tous les membres.
                  </p>
                ) : (
                  <ol className="space-y-2.5">
                    {group.rules.map((rule, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                        <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-700 font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="pt-0.5 leading-relaxed">{rule}</span>
                      </li>
                    ))}
                  </ol>
                )}

                <div className="pt-3 border-t border-slate-100">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Équipe d'administration
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {activeMembers
                      .filter((m) => m.role === 'administrateur' || m.role === 'moderateur')
                      .map((staff) => (
                        <div
                          key={staff.id}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#F0F2F5]"
                        >
                          <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center overflow-hidden">
                            {staff.userAvatar ? (
                              <img
                                src={staff.userAvatar}
                                alt={staff.userName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              staff.userName.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-slate-900">{staff.userName}</p>
                            <p className="text-[10px] text-blue-700 capitalize">{staff.role}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. MEMBRES */}
          {activeTab === 'members' && (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">
                    Membres du cercle ({filteredMembers.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Administrateurs, modérateurs et membres actifs
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Rechercher un membre..."
                      className="bg-[#F0F2F5] text-xs pl-8 pr-3 py-2 rounded-xl focus:bg-white focus:outline-none border border-transparent focus:border-blue-500"
                    />
                  </div>
                  <select
                    value={memberRoleFilter}
                    onChange={(e) =>
                      setMemberRoleFilter(
                        e.target.value as 'all' | 'administrateur' | 'moderateur' | 'membre'
                      )
                    }
                    className="bg-[#F0F2F5] text-xs font-bold text-slate-700 px-3 py-2 rounded-xl focus:outline-none"
                  >
                    <option value="all">Tous les rôles</option>
                    <option value="administrateur">Administrateurs</option>
                    <option value="moderateur">Modérateurs</option>
                    <option value="membre">Membres</option>
                  </select>
                  {isActiveMember && (
                    <button
                      type="button"
                      onClick={() => setShowInviteModal(true)}
                      className="min-h-[36px] px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Inviter</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredMembers.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200/80 bg-[#F0F2F5]/40"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {m.userAvatar ? (
                        <img
                          src={m.userAvatar}
                          alt={m.userName}
                          className="w-11 h-11 rounded-full object-cover shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0">
                          {m.userName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{m.userName}</p>
                        <p className="text-[11px] text-slate-500">
                          Rejoint le {formatDateFr(m.joinedAt)}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg capitalize shrink-0 ${
                        m.role === 'administrateur'
                          ? 'bg-blue-100 text-blue-800'
                          : m.role === 'moderateur'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-200/70 text-slate-700'
                      }`}
                    >
                      {m.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. PHOTOS */}
          {activeTab === 'photos' && (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-4">
              <h2 className="text-sm font-extrabold text-slate-900">
                Galerie Photos ({photoItems.length})
              </h2>
              {photoItems.length === 0 ? (
                <div className="py-10 text-center">
                  <ImageIcon className="w-10 h-10 text-slate-300 mx-auto mb-2 stroke-1" />
                  <p className="text-xs text-slate-500">
                    Aucune photo partagée dans ce cercle pour le moment.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {photoItems.map((item, idx) => (
                    <button
                      key={`${item.postId}_${idx}`}
                      type="button"
                      onClick={() => setLightboxImage({ url: item.url, name: item.name })}
                      className="group relative aspect-square rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/80"
                    >
                      <img
                        src={item.url}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-slate-950/75 to-transparent text-left opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[10px] font-bold text-white truncate">
                          {item.authorName}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 5. VIDÉOS */}
          {activeTab === 'videos' && (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-4">
              <h2 className="text-sm font-extrabold text-slate-900">
                Vidéothèque ({videoItems.length})
              </h2>
              {videoItems.length === 0 ? (
                <div className="py-10 text-center">
                  <Video className="w-10 h-10 text-slate-300 mx-auto mb-2 stroke-1" />
                  <p className="text-xs text-slate-500">
                    Aucune vidéo publiée dans ce cercle pour le moment.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {videoItems.map((vid, idx) => (
                    <div
                      key={`${vid.postId}_${idx}`}
                      className="rounded-2xl overflow-hidden border border-slate-200/80 bg-[#F0F2F5]"
                    >
                      <video
                        src={vid.url}
                        controls
                        preload="metadata"
                        className="w-full max-h-64 bg-slate-950"
                      />
                      <div className="p-3 flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-slate-800 truncate">{vid.name}</p>
                        <span className="text-[11px] text-slate-500 shrink-0">
                          {vid.authorName}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 6. ÉVÉNEMENTS */}
          {activeTab === 'events' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">
                    Événements communautaires ({events.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Conférences, ateliers, séances d'étude et rencontres
                  </p>
                </div>
                {isActiveMember && (
                  <button
                    type="button"
                    onClick={() => setShowCreateEventModal(true)}
                    className="min-h-[40px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Créer un événement</span>
                  </button>
                )}
              </div>

              {events.length === 0 ? (
                <div className="bg-white border border-slate-200/80 rounded-3xl p-10 text-center shadow-xs">
                  <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2 stroke-1" />
                  <p className="text-xs text-slate-500">
                    Aucun événement programmé pour l'instant.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {events.map((ev) => {
                    const isGoing = ev.attendeeIds.includes(currentUser.id);
                    const isInterested = ev.interestedIds.includes(currentUser.id);
                    const canDelete = isStaff || ev.createdBy === currentUser.id;
                    return (
                      <div
                        key={ev.id}
                        className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-3"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
                              {formatDateTimeFr(ev.startDate)}
                            </span>
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmModal({
                                    title: 'Supprimer cet événement ?',
                                    message: `L'événement « ${ev.title} » sera retiré du calendrier du cercle.`,
                                    confirmLabel: 'Supprimer',
                                    danger: true,
                                    onConfirm: async () => {
                                      await communityService.deleteGroupEvent(ev.id);
                                      notify('success', 'Événement supprimé.');
                                    }
                                  })
                                }
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
                                title="Supprimer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          <h3 className="text-sm font-extrabold text-slate-900">{ev.title}</h3>
                          {ev.description && (
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {ev.description}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-red-500" />
                              {ev.isOnline ? 'En ligne (Visio)' : ev.location}
                            </span>
                            <span className="tabular-nums font-semibold text-slate-700">
                              {ev.attendeeIds.length} participant(s) · {ev.interestedIds.length}{' '}
                              intéressé(s)
                            </span>
                          </div>

                          {ev.isOnline && ev.meetingLink && (
                            <a
                              href={ev.meetingLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:underline pt-1"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                              <span>Lien de la visioconférence</span>
                            </a>
                          )}
                        </div>

                        {isActiveMember && (
                          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() =>
                                communityService.rsvpEvent(
                                  ev.id,
                                  currentUser.id,
                                  isGoing ? 'none' : 'going'
                                )
                              }
                              className={`flex-1 min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                                isGoing
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-[#F0F2F5] hover:bg-blue-50 text-slate-700'
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{isGoing ? 'Je participe ✓' : 'Je participe'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                communityService.rsvpEvent(
                                  ev.id,
                                  currentUser.id,
                                  isInterested ? 'none' : 'interested'
                                )
                              }
                              className={`flex-1 min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                                isInterested
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-[#F0F2F5] hover:bg-amber-50 text-slate-700'
                              }`}
                            >
                              <BellRing className="w-3.5 h-3.5" />
                              <span>{isInterested ? 'Intéressé ✓' : 'Intéressé'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 7. FICHIERS */}
          {activeTab === 'files' && (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-sm font-extrabold text-slate-900">
                  Documents partagés ({documentItems.length})
                </h2>
                <div className="relative sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={fileSearch}
                    onChange={(e) => setFileSearch(e.target.value)}
                    placeholder="Filtrer par nom de fichier..."
                    className="w-full bg-[#F0F2F5] text-xs pl-8 pr-3 py-2 rounded-xl focus:bg-white focus:outline-none border border-transparent focus:border-blue-500"
                  />
                </div>
              </div>

              {documentItems.length === 0 ? (
                <div className="py-10 text-center">
                  <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2 stroke-1" />
                  <p className="text-xs text-slate-500">
                    Aucun document trouvé dans ce cercle.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {documentItems.map((docItem, idx) => {
                    const badge = getDocumentBadgeInfo(docItem.name, docItem.mimeType);
                    return (
                      <div
                        key={`${docItem.postId}_${idx}`}
                        className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200/80 hover:bg-slate-50 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black shrink-0 ${badge.badgeBg} ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {docItem.name}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Par {docItem.authorName} · {formatDateFr(docItem.createdAt)}
                              {docItem.size ? ` · ${formatFileSize(docItem.size)}` : ''}
                            </p>
                          </div>
                        </div>

                        <a
                          href={docItem.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={docItem.name}
                          className="min-h-[36px] px-3 py-1.5 bg-[#F0F2F5] hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Ouvrir</span>
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 8. ANNONCES */}
          {activeTab === 'announcements' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">
                    Annonces officielles ({announcements.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Informations importantes publiées par la modération du cercle
                  </p>
                </div>
                {isStaff && (
                  <button
                    type="button"
                    onClick={() => setShowCreateAnnModal(true)}
                    className="min-h-[40px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Publier une annonce</span>
                  </button>
                )}
              </div>

              {announcements.length === 0 ? (
                <div className="bg-white border border-slate-200/80 rounded-3xl p-10 text-center shadow-xs">
                  <Megaphone className="w-10 h-10 text-slate-300 mx-auto mb-2 stroke-1" />
                  <p className="text-xs text-slate-500">
                    Aucune annonce officielle pour le moment.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {announcements.map((ann) => (
                    <div
                      key={ann.id}
                      className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {ann.isPinned && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700">
                              <Pin className="w-3 h-3" />
                              Épinglée
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg ${
                              ann.priority === 'urgent'
                                ? 'bg-red-100 text-red-700'
                                : ann.priority === 'important'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {ann.priority}
                          </span>
                        </div>
                        {isStaff && (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmModal({
                                title: 'Supprimer cette annonce ?',
                                message: `L'annonce « ${ann.title} » sera retirée définitivement.`,
                                confirmLabel: 'Supprimer',
                                danger: true,
                                onConfirm: async () => {
                                  await communityService.deleteAnnouncement(ann.id);
                                  notify('success', 'Annonce supprimée.');
                                }
                              })
                            }
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <h3 className="text-sm font-extrabold text-slate-900">{ann.title}</h3>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {ann.content}
                      </p>
                      <p className="text-[11px] text-slate-400 pt-1">
                        Publié par {ann.authorName} · {formatDateTimeFr(ann.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 9. ADMINISTRATION */}
          {activeTab === 'admin' && isStaff && currentMember && (
            <CommunityAdminDashboard
              group={group}
              members={members}
              posts={posts}
              comments={comments}
              reports={reports}
              events={events}
              announcements={announcements}
              currentUser={currentUser}
              currentMember={currentMember}
              onGroupDeleted={onGroupDeleted}
            />
          )}
        </>
      )}

      {/* ============================================================ */}
      {/* MODALS (INVITE, EVENT, ANNOUNCEMENT, REPORT, LIGHTBOX)       */}
      {/* ============================================================ */}
      {showInviteModal &&
        createPortal(
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[90] animate-fadeIn">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-900">
                  Inviter dans « {group.name} »
                </h3>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Shareable Link / Invite Code */}
              <div className="p-3.5 rounded-2xl bg-[#F0F2F5] space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-slate-900">Lien d'invitation directe</p>
                    <p className="text-[11px] text-slate-500">
                      Permet de rejoindre le cercle immédiatement avec un code
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={inviteBusy}
                    onClick={handleGenerateInviteLink}
                    className="min-h-[34px] px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shrink-0"
                  >
                    Générer
                  </button>
                </div>

                {generatedInvite?.inviteCode && (
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-blue-700">
                        Code : {generatedInvite.inviteCode}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {`${window.location.origin}/?community=${group.id}&invite=${generatedInvite.inviteCode}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const url = `${window.location.origin}/?community=${group.id}&invite=${generatedInvite.inviteCode}`;
                        try {
                          await navigator.clipboard.writeText(url);
                        } catch {
                          // fallback handled below
                        }
                        setCopiedInvite(true);
                        window.setTimeout(() => setCopiedInvite(false), 2500);
                      }}
                      className="min-h-[32px] px-2.5 py-1 bg-slate-900 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 shrink-0"
                    >
                      {copiedInvite ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedInvite ? 'Copié' : 'Copier'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Direct user search */}
              <div className="space-y-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={inviteUserSearch}
                    onChange={(e) => setInviteUserSearch(e.target.value)}
                    placeholder="Rechercher un membre Zaure à inviter..."
                    className="w-full bg-[#F0F2F5] text-xs pl-8 pr-3 py-2.5 rounded-xl focus:bg-white focus:outline-none border border-transparent focus:border-blue-500"
                  />
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {invitableUsers.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">
                      Aucun autre utilisateur disponible pour le moment.
                    </p>
                  ) : (
                    invitableUsers.slice(0, 20).map((u) => {
                      const alreadyInvited = invitedUserIds.includes(u.id);
                      return (
                        <div
                          key={u.id}
                          className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-[#F0F2F5]/60"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {u.avatar_url ? (
                              <img
                                src={u.avatar_url}
                                alt={u.nom}
                                className="w-9 h-9 rounded-full object-cover shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                                {u.nom.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 truncate">{u.nom}</p>
                              <p className="text-[10px] text-slate-500 capitalize">{u.role}</p>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={alreadyInvited || inviteBusy}
                            onClick={() => handleSendDirectInvite(u)}
                            className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-bold shrink-0 ${
                              alreadyInvited
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                          >
                            {alreadyInvited ? 'Invité ✓' : 'Inviter'}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Create Event Modal */}
      {showCreateEventModal &&
        createPortal(
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[90] animate-fadeIn">
            <form
              onSubmit={handleCreateEvent}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-3.5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-900">Nouvel événement</h3>
                <button
                  type="button"
                  onClick={() => setShowCreateEventModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Titre de l'événement
                </label>
                <input
                  type="text"
                  required
                  value={evTitle}
                  onChange={(e) => setEvTitle(e.target.value)}
                  placeholder="Ex : Atelier clinique sur la prévention"
                  className="w-full text-xs px-3.5 py-2.5 bg-[#F0F2F5] rounded-xl focus:bg-white focus:outline-none border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    Début
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={evStart}
                    onChange={(e) => setEvStart(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-[#F0F2F5] rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    Fin (optionnel)
                  </label>
                  <input
                    type="datetime-local"
                    value={evEnd}
                    onChange={(e) => setEvEnd(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-[#F0F2F5] rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <label className="flex items-center justify-between p-3 rounded-2xl bg-[#F0F2F5] cursor-pointer text-xs font-bold text-slate-800">
                <span>Événement en ligne (visioconférence)</span>
                <input
                  type="checkbox"
                  checked={evIsOnline}
                  onChange={(e) => setEvIsOnline(e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
              </label>

              {evIsOnline ? (
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    Lien de réunion
                  </label>
                  <input
                    type="url"
                    value={evMeetingLink}
                    onChange={(e) => setEvMeetingLink(e.target.value)}
                    placeholder="https://meet.google.com/..."
                    className="w-full text-xs px-3.5 py-2.5 bg-[#F0F2F5] rounded-xl border border-slate-200"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    Lieu physique
                  </label>
                  <input
                    type="text"
                    value={evLocation}
                    onChange={(e) => setEvLocation(e.target.value)}
                    placeholder="Ex : Faculté de Médecine, Niamey"
                    className="w-full text-xs px-3.5 py-2.5 bg-[#F0F2F5] rounded-xl border border-slate-200"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={evDesc}
                  onChange={(e) => setEvDesc(e.target.value)}
                  placeholder="Programme, intervenants, prérequis..."
                  className="w-full text-xs px-3.5 py-2.5 bg-[#F0F2F5] rounded-xl border border-slate-200 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateEventModal(false)}
                  className="min-h-[40px] px-4 py-2 bg-[#F0F2F5] text-slate-700 text-xs font-bold rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={evBusy}
                  className="min-h-[40px] px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl"
                >
                  {evBusy ? 'Publication...' : "Publier l'événement"}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* Create Announcement Modal */}
      {showCreateAnnModal &&
        createPortal(
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[90] animate-fadeIn">
            <form
              onSubmit={handleCreateAnnouncement}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-3.5"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-900">Nouvelle annonce</h3>
                <button
                  type="button"
                  onClick={() => setShowCreateAnnModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Titre
                </label>
                <input
                  type="text"
                  required
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="Ex : Rappel des consignes de publication"
                  className="w-full text-xs px-3.5 py-2.5 bg-[#F0F2F5] rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Priorité
                </label>
                <select
                  value={annPriority}
                  onChange={(e) =>
                    setAnnPriority(e.target.value as 'normal' | 'important' | 'urgent')
                  }
                  className="w-full text-xs px-3.5 py-2.5 bg-[#F0F2F5] rounded-xl border border-slate-200 font-semibold"
                >
                  <option value="normal">Normale</option>
                  <option value="important">Importante</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Message
                </label>
                <textarea
                  rows={4}
                  required
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  placeholder="Détails de l'annonce officielle..."
                  className="w-full text-xs px-3.5 py-2.5 bg-[#F0F2F5] rounded-xl border border-slate-200 resize-none"
                />
              </div>

              <label className="flex items-center justify-between p-3 rounded-2xl bg-[#F0F2F5] cursor-pointer text-xs font-bold text-slate-800">
                <span>Épingler en haut du fil de discussion</span>
                <input
                  type="checkbox"
                  checked={annPinned}
                  onChange={(e) => setAnnPinned(e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateAnnModal(false)}
                  className="min-h-[40px] px-4 py-2 bg-[#F0F2F5] text-slate-700 text-xs font-bold rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={annBusy}
                  className="min-h-[40px] px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl"
                >
                  {annBusy ? 'Envoi...' : "Publier l'annonce"}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* Report Circle Modal */}
      {showReportCircleModal &&
        createPortal(
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[90] animate-fadeIn">
            <form
              onSubmit={handleSubmitCircleReport}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-3.5"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-900">Signaler ce cercle</h3>
                <button
                  type="button"
                  onClick={() => setShowReportCircleModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Motif
                </label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 bg-[#F0F2F5] rounded-xl border border-slate-200 font-semibold"
                >
                  <option value="Contenu inapproprié">Contenu inapproprié</option>
                  <option value="Spam ou fraude">Spam ou fraude</option>
                  <option value="Harcèlement">Harcèlement</option>
                  <option value="Désinformation médicale">Désinformation dangereuse</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Précisions
                </label>
                <textarea
                  rows={3}
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Expliquez brièvement le problème constaté..."
                  className="w-full text-xs px-3.5 py-2.5 bg-[#F0F2F5] rounded-xl border border-slate-200 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReportCircleModal(false)}
                  className="min-h-[40px] px-4 py-2 bg-[#F0F2F5] text-slate-700 text-xs font-bold rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={reportBusy}
                  className="min-h-[40px] px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl"
                >
                  {reportBusy ? 'Envoi...' : 'Envoyer le signalement'}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* Photo Lightbox */}
      {lightboxImage &&
        createPortal(
          <div
            className="fixed inset-0 bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-4 z-[95]"
            onClick={() => setLightboxImage(null)}
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 p-2.5 bg-white/15 hover:bg-white/25 text-white rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightboxImage.url}
              alt={lightboxImage.name}
              onClick={(e) => e.stopPropagation()}
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            />
          </div>,
          document.body
        )}

      {/* Confirmation Modal */}
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
                      notify('error', err?.message || 'Action impossible.');
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

export default CommunityGroupPage;
