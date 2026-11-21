import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
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
  Crown,
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
  Shield,
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
  onOpenUserProfile?: (userId: string) => void;
}

type GroupTab =
  | 'publications'
  | 'about'
  | 'members'
  | 'media'
  | 'events'
  | 'announcements'
  | 'admin';

type MediaSubTab = 'photos' | 'videos' | 'files';
type RoleFilter = 'all' | 'creator' | 'administrateur' | 'moderateur' | 'membre';

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

function getDisplayRole(member: CommunityMember, creatorId: string) {
  if (member.userId === creatorId) {
    return { key: 'creator' as const, label: 'Créateur', accent: 'text-indigo-700 bg-indigo-50' };
  }
  if (member.role === 'administrateur') {
    return { key: 'administrateur' as const, label: 'Administrateur', accent: 'text-blue-700 bg-blue-50' };
  }
  if (member.role === 'moderateur') {
    return { key: 'moderateur' as const, label: 'Modérateur', accent: 'text-emerald-700 bg-emerald-50' };
  }
  return { key: 'membre' as const, label: 'Membre', accent: 'text-slate-600 bg-slate-100' };
}

const CommunityGroupPage: React.FC<CommunityGroupPageProps> = ({
  group,
  currentUser,
  allUsers,
  currentMember,
  onBack,
  onGroupDeleted,
  onOpenUserProfile
}) => {
  const isActiveMember = currentMember?.status === 'active';
  const isPendingMember = currentMember?.status === 'pending';
  const isSuspendedMember = currentMember?.status === 'suspended';
  const isCreator = Boolean(isActiveMember) && group.createdBy === currentUser.id;
  const isAdmin =
    Boolean(isActiveMember) &&
    (currentMember?.role === 'administrateur' || group.createdBy === currentUser.id);
  const isModerator = Boolean(isActiveMember) && currentMember?.role === 'moderateur';
  const isStaff = isAdmin || isModerator;
  const canViewContent = group.privacy === 'public' || Boolean(isActiveMember);
  const canPost =
    Boolean(isActiveMember) &&
    (group.postPermission === 'all_members' || isStaff);

  const [activeTab, setActiveTab] = useState<GroupTab>('publications');
  const [mediaSubTab, setMediaSubTab] = useState<MediaSubTab>('photos');

  // Subscriptions state
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [reactions, setReactions] = useState<PostReaction[]>([]);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [events, setEvents] = useState<GroupEvent[]>([]);
  const [announcements, setAnnouncements] = useState<GroupAnnouncement[]>([]);
  const [reports, setReports] = useState<GroupReport[]>([]);

  // Publications controls & pagination
  const [postFilter, setPostFilter] = useState<
    'all' | 'pinned' | 'polls' | 'saved' | 'pending'
  >('all');
  const [postSearch, setPostSearch] = useState('');
  const [visiblePostCount, setVisiblePostCount] = useState(10);

  // Members search
  const [memberSearch, setMemberSearch] = useState('');
  const [memberRoleFilter, setMemberRoleFilter] = useState<RoleFilter>('all');

  // Files search
  const [fileSearch, setFileSearch] = useState('');

  // Photo lightbox
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);

  // Options dropdown & Toast
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const optionsMenuRef = useRef<HTMLDivElement>(null);
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

  // In-app confirmation modal
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

  useEffect(() => {
    if (!showOptionsMenu) return;
    const close = (e: MouseEvent) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(e.target as Node)) {
        setShowOptionsMenu(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showOptionsMenu]);

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
    () =>
      [...members.filter((m) => m.status === 'active')].sort((a, b) => {
        if (a.userId === group.createdBy) return -1;
        if (b.userId === group.createdBy) return 1;
        return 0;
      }),
    [members, group.createdBy]
  );

  const leadershipTeam = useMemo(() => {
    const creator = activeMembers.filter((m) => m.userId === group.createdBy);
    const admins = activeMembers.filter(
      (m) => m.role === 'administrateur' && m.userId !== group.createdBy
    );
    const moderators = activeMembers.filter((m) => m.role === 'moderateur');
    return { creator, admins, moderators };
  }, [activeMembers, group.createdBy]);

  // Filtered Posts
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
          .filter((m) => m.type === 'document' && !m.mimeType?.startsWith('audio/'))
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

  const totalMediaCount = photoItems.length + videoItems.length + documentItems.length;

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return activeMembers.filter((m) => {
      if (memberRoleFilter === 'creator' && m.userId !== group.createdBy) return false;
      if (
        memberRoleFilter !== 'all' &&
        memberRoleFilter !== 'creator' &&
        m.role !== memberRoleFilter
      ) {
        return false;
      }
      if (q && !m.userName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [activeMembers, memberSearch, memberRoleFilter, group.createdBy]);

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
        notify('success', `Vous avez rejoint la communauté « ${group.name} ».`);
      }
    } catch (err: any) {
      notify('error', err?.message || 'Impossible de rejoindre cette communauté.');
    } finally {
      setMembershipBusy(false);
    }
  };

  const handleLeaveCircle = () => {
    if (group.createdBy === currentUser.id) {
      notify(
        'error',
        'En tant que créateur de la communauté, vous pouvez la supprimer depuis les paramètres.'
      );
      return;
    }
    setConfirmModal({
      title: isPendingMember ? "Annuler la demande d'adhésion ?" : `Quitter « ${group.name} » ?`,
      message: isPendingMember
        ? 'Votre demande en attente sera retirée.'
        : 'Vous ne recevrez plus les mises à jour de cette communauté.',
      confirmLabel: isPendingMember ? 'Annuler la demande' : 'Quitter',
      danger: true,
      onConfirm: async () => {
        await communityService.leaveGroup(group.id, currentUser.id, Boolean(isActiveMember));
        notify('success', isPendingMember ? 'Demande annulée.' : 'Vous avez quitté cette communauté.');
      }
    });
  };

  const handleCopyGroupShareLink = async () => {
    const url = `${window.location.origin}/?community=${group.id}`;
    try {
      await navigator.clipboard.writeText(url);
      notify('success', 'Lien de partage copié.');
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
        targetPreview: `Communauté : ${group.name}`,
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
  const pendingAdminCount =
    members.filter((m) => m.status === 'pending').length +
    posts.filter((p) => p.status !== 'published').length +
    reports.filter((r) => r.status === 'pending').length;

  const navigationTabs: { id: GroupTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'publications', label: 'Publications', icon: MessageSquare },
    { id: 'about', label: 'À propos', icon: Info },
    { id: 'members', label: 'Membres', icon: Users, badge: activeMembers.length || group.memberCount },
    { id: 'media', label: 'Médias', icon: ImageIcon, badge: totalMediaCount },
    { id: 'events', label: 'Événements', icon: Calendar, badge: events.length },
    { id: 'announcements', label: 'Annonces', icon: Megaphone, badge: announcements.length },
    ...(isStaff
      ? [
          {
            id: 'admin' as GroupTab,
            label: 'Administration',
            icon: ShieldCheck,
            badge: pendingAdminCount
          }
        ]
      : [])
  ];

  return (
    <div className="space-y-4 pb-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200/85 rounded-2xl text-xs font-bold text-slate-800 flex items-center gap-2 shadow-xs transition"
        >
          <ArrowLeft className="w-4 h-4 text-blue-600" />
          <span>Communautés</span>
        </button>

        {isStaff && (
          <button
            type="button"
            onClick={() => setActiveTab('admin')}
            className={`min-h-[44px] px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition ${
              activeTab === 'admin'
                ? 'bg-blue-600 text-white'
                : 'bg-white hover:bg-blue-50 text-blue-700 border border-slate-200/85'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isCreator || isAdmin ? 'Administration' : 'Modération'}</span>
            {pendingAdminCount > 0 && (
              <span className="ml-0.5 text-[11px] font-black tabular-nums">({pendingAdminCount})</span>
            )}
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
          <button type="button" onClick={() => setToast(null)} className="p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* EN-TÊTE DE LA COMMUNAUTÉ                                     */}
      {/* ============================================================ */}
      <section className="bg-white border border-slate-200/85 rounded-3xl overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        {/* Cover Photo */}
        <div className="relative h-44 sm:h-60 bg-slate-200">
          <img
            src={coverUrl}
            alt={group.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-slate-950/15 to-transparent" />

          <div className="absolute top-3 right-3 flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-slate-950/75 backdrop-blur-md text-white text-[11px] font-bold flex items-center gap-1.5">
              {group.privacy === 'private' ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Communauté privée</span>
                </>
              ) : (
                <>
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Communauté publique</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Identity & Actions */}
        <div className="px-4 sm:px-6 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-10 sm:-mt-12 relative z-10">
            <div className="flex items-end gap-3.5 min-w-0">
              <img
                src={avatarUrl}
                alt={group.name}
                referrerPolicy="no-referrer"
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl object-cover ring-4 ring-white shadow-md bg-white shrink-0"
              />
              <div className="min-w-0 pb-1">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-700 mb-0.5">
                  <span>{group.category}</span>
                  {currentMember?.status === 'active' && (
                    <>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="text-slate-600">
                        {getDisplayRole(currentMember, group.createdBy).label}
                      </span>
                    </>
                  )}
                </div>
                <h1 className="text-lg sm:text-2xl font-black text-slate-950 truncate">
                  {group.name}
                </h1>
              </div>
            </div>

            {/* Action Buttons + Options */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {!currentMember && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  disabled={membershipBusy}
                  onClick={handleJoinCircle}
                  className="min-h-[44px] px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition disabled:opacity-50 whitespace-nowrap"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>
                    {membershipBusy
                      ? 'Envoi...'
                      : group.privacy === 'private' || group.requireMemberApproval
                        ? 'Demander à rejoindre'
                        : 'Rejoindre'}
                  </span>
                </motion.button>
              )}

              {isPendingMember && (
                <button
                  type="button"
                  onClick={handleLeaveCircle}
                  className="min-h-[44px] px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition whitespace-nowrap"
                >
                  <Clock className="w-4 h-4" />
                  <span>En attente (Annuler)</span>
                </button>
              )}

              {isActiveMember && (
                <>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setShowInviteModal(true)}
                    className="min-h-[44px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition whitespace-nowrap"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Inviter</span>
                  </motion.button>
                  {group.createdBy !== currentUser.id && (
                    <button
                      type="button"
                      onClick={handleLeaveCircle}
                      className="min-h-[44px] px-3.5 py-2 bg-slate-100 hover:bg-red-50 hover:text-red-700 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition whitespace-nowrap"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Quitter</span>
                    </button>
                  )}
                </>
              )}

              {/* 3-dot Menu */}
              <div ref={optionsMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setShowOptionsMenu((v) => !v)}
                  className="min-h-[44px] w-[44px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center justify-center transition"
                  title="Options de la communauté"
                  aria-label="Options de la communauté"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                <AnimatePresence>
                  {showOptionsMenu && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      transition={{ duration: 0.14 }}
                      className="absolute right-0 mt-2 w-60 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-30 origin-top-right"
                    >
                      <button
                        type="button"
                        onClick={handleCopyGroupShareLink}
                        className="w-full min-h-[40px] px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                      >
                        <Share2 className="w-4 h-4 text-blue-600" />
                        <span>Partager le lien</span>
                      </button>
                      {canViewContent && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('publications');
                            setPostFilter('saved');
                            setShowOptionsMenu(false);
                          }}
                          className="w-full min-h-[40px] px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                        >
                          <Bookmark className="w-4 h-4 text-amber-600" />
                          <span>Publications enregistrées</span>
                        </button>
                      )}
                      {isStaff && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('admin');
                            setShowOptionsMenu(false);
                          }}
                          className="w-full min-h-[40px] px-3.5 py-2 text-left text-xs font-semibold text-blue-700 hover:bg-blue-50 flex items-center gap-2.5"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>Administration & modération</span>
                        </button>
                      )}
                      {isActiveMember && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowReportCircleModal(true);
                            setShowOptionsMenu(false);
                          }}
                          className="w-full min-h-[40px] px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                        >
                          <Flag className="w-4 h-4 text-red-500" />
                          <span>Signaler cette communauté</span>
                        </button>
                      )}
                      {(isActiveMember || isPendingMember) && group.createdBy !== currentUser.id && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowOptionsMenu(false);
                            handleLeaveCircle();
                          }}
                          className="w-full min-h-[40px] px-3.5 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2.5 border-t border-slate-100 mt-1 pt-2"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Quitter cette communauté</span>
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 mt-3 leading-relaxed">
            {group.description || 'Communauté Zaure dédiée au partage de connaissances et à l’entraide.'}
          </p>

          {/* Zero-pill metadata */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1.5 text-slate-900 font-bold tabular-nums">
              <Users className="w-4 h-4 text-blue-600" />
              {Math.max(group.memberCount, activeMembers.length)}{' '}
              {Math.max(group.memberCount, activeMembers.length) > 1 ? 'membres' : 'membre'}
            </span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span>
              {group.privacy === 'private'
                ? 'Accès réservé aux membres'
                : 'Ouverte à toute la plateforme'}
            </span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="text-slate-400">Créée le {formatDateFr(group.createdAt)}</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        {canViewContent && (
          <div className="border-t border-slate-100 px-2 sm:px-4 flex items-center gap-1 overflow-x-auto scrollbar-none">
            {navigationTabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-h-[48px] px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 shrink-0 border-b-2 transition whitespace-nowrap ${
                    active
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-slate-500 hover:text-slate-950'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {typeof tab.badge === 'number' && tab.badge > 0 && (
                    <span
                      className={`text-[11px] font-bold tabular-nums ${
                        active ? 'text-blue-700' : 'text-slate-400'
                      }`}
                    >
                      ({tab.badge})
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
            Un administrateur a suspendu votre participation dans cette communauté. Vous ne pouvez plus consulter ou publier de contenus.
          </p>
        </div>
      )}

      {/* PRIVATE COMMUNITY GATE */}
      {!canViewContent && !isSuspendedMember && (
        <div className="bg-white border border-slate-200/85 rounded-3xl p-8 text-center shadow-xs space-y-3">
          <div className="w-14 h-14 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-base font-extrabold text-slate-950">Cette communauté est privée</h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            Les publications, discussions, médias, événements et la liste des membres sont protégés et réservés aux membres approuvés.
          </p>
          {isPendingMember ? (
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200">
              <Clock className="w-4 h-4" />
              <span>Votre demande d'adhésion est en cours d'examen par la modération.</span>
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
      {/* CONTENU DES ONGLETS                                          */}
      {/* ============================================================ */}
      {canViewContent && (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
          >
            {/* 1. PUBLICATIONS */}
            {activeTab === 'publications' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* Main Publications Column */}
                <div className="lg:col-span-8 space-y-4">
                  {/* Pinned official announcement callout */}
                  {pinnedAnnouncement && (
                    <div className="bg-white border border-blue-200/80 rounded-3xl p-4 shadow-xs flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <Megaphone className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-[11px] font-bold">
                            <span className="text-blue-700">Annonce officielle</span>
                            {pinnedAnnouncement.priority === 'urgent' && (
                              <>
                                <span aria-hidden="true" className="text-slate-300">·</span>
                                <span className="text-red-600">Urgent</span>
                              </>
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
                        className="text-xs font-bold text-blue-700 hover:underline shrink-0 whitespace-nowrap"
                      >
                        Voir tout
                      </button>
                    </div>
                  )}

                  {/* Post Composer (Strict permission enforcement) */}
                  {canPost && currentMember ? (
                    <CommunityPostComposer
                      group={group}
                      currentUser={currentUser}
                      currentMember={currentMember}
                    />
                  ) : isActiveMember && group.postPermission === 'admins_only' ? (
                    <div className="bg-white border border-slate-200/85 rounded-2xl p-4 text-xs text-slate-600 flex items-center gap-2.5 shadow-xs">
                      <Shield className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>
                        Seuls les administrateurs et modérateurs sont autorisés à créer de nouvelles publications dans cette communauté.
                      </span>
                    </div>
                  ) : !isActiveMember && group.privacy === 'public' ? (
                    <div className="bg-white border border-slate-200/85 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                      <p className="text-xs text-slate-600 font-medium">
                        Rejoignez cette communauté pour publier, commenter et réagir aux échanges.
                      </p>
                      <button
                        type="button"
                        disabled={membershipBusy}
                        onClick={handleJoinCircle}
                        className="min-h-[40px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shrink-0 whitespace-nowrap"
                      >
                        Rejoindre
                      </button>
                    </div>
                  ) : null}

                  {/* Feed Filter & Search */}
                  <div className="bg-white border border-slate-200/85 rounded-2xl p-3 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[
                        { id: 'all', label: 'Toutes' },
                        { id: 'pinned', label: 'Épinglées' },
                        { id: 'polls', label: 'Sondages' },
                        { id: 'saved', label: 'Enregistrées' },
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
                          className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                            postFilter === f.id
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    <div className="relative sm:w-52">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={postSearch}
                        onChange={(e) => setPostSearch(e.target.value)}
                        placeholder="Rechercher..."
                        className="w-full min-h-[38px] bg-slate-100 text-xs pl-8 pr-3 py-2 rounded-xl focus:bg-white focus:outline-none border border-transparent focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Posts Feed */}
                  {visiblePosts.length === 0 ? (
                    <div className="bg-white border border-slate-200/85 rounded-3xl p-10 text-center shadow-xs">
                      <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2 stroke-1" />
                      <p className="text-sm font-bold text-slate-900">
                        Aucune publication à afficher
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Soyez le premier à lancer une discussion ou modifiez vos filtres.
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
                          onAuthorClick={onOpenUserProfile}
                        />
                      ))}

                      {filteredPosts.length > visiblePostCount && (
                        <div className="text-center pt-1">
                          <button
                            type="button"
                            onClick={() => setVisiblePostCount((prev) => prev + 10)}
                            className="min-h-[44px] px-6 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-blue-700 text-xs font-bold rounded-2xl shadow-xs transition"
                          >
                            Afficher plus de publications ({filteredPosts.length - visiblePostCount} restante(s))
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Desktop Contextual Summary Sidebar (About, Rules, Leadership) */}
                <aside className="hidden lg:block lg:col-span-4 space-y-4 sticky top-20">
                  <div className="bg-white border border-slate-200/85 rounded-3xl p-4 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                        À propos
                      </h3>
                      <button
                        type="button"
                        onClick={() => setActiveTab('about')}
                        className="text-xs font-bold text-blue-700 hover:underline"
                      >
                        Détails
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-4">
                      {group.description || 'Communauté Zaure.'}
                    </p>
                    {group.rules.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 space-y-1.5">
                        <p className="text-[11px] font-bold text-slate-500">
                          Règles ({group.rules.length})
                        </p>
                        <ul className="space-y-1 text-xs text-slate-600">
                          {group.rules.slice(0, 3).map((r, i) => (
                            <li key={i} className="truncate">
                              <span className="font-bold text-blue-600 mr-1.5">{i + 1}.</span>
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Leadership Preview */}
                  <div className="bg-white border border-slate-200/85 rounded-3xl p-4 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                        Équipe dirigeante
                      </h3>
                      <button
                        type="button"
                        onClick={() => setActiveTab('members')}
                        className="text-xs font-bold text-blue-700 hover:underline"
                      >
                        Membres
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {[...leadershipTeam.creator, ...leadershipTeam.admins, ...leadershipTeam.moderators]
                        .slice(0, 5)
                        .map((staff) => {
                          const roleInfo = getDisplayRole(staff, group.createdBy);
                          return (
                            <button
                              key={staff.id}
                              type="button"
                              onClick={() => onOpenUserProfile?.(staff.userId)}
                              className="w-full flex items-center gap-2.5 text-left rounded-xl p-1 -m-1 hover:bg-slate-50 transition"
                            >
                              {staff.userAvatar ? (
                                <img
                                  src={staff.userAvatar}
                                  alt={staff.userName}
                                  referrerPolicy="no-referrer"
                                  className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-slate-200"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                                  {staff.userName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-slate-900 truncate">
                                  {staff.userName}
                                </p>
                                <p className="text-[11px] text-slate-500">{roleInfo.label}</p>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </aside>
              </div>
            )}

            {/* 2. À PROPOS */}
            {activeTab === 'about' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200/85 rounded-3xl p-5 shadow-xs space-y-4">
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-950">
                    Présentation de la communauté
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {group.description || 'Aucune description détaillée renseignée.'}
                  </p>

                  <div className="space-y-3 pt-3 border-t border-slate-100 text-xs">
                    <div className="flex items-start gap-2.5">
                      {group.privacy === 'private' ? (
                        <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      ) : (
                        <Globe className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="font-bold text-slate-900">
                          {group.privacy === 'private' ? 'Communauté privée' : 'Communauté publique'}
                        </p>
                        <p className="text-slate-500 mt-0.5">
                          {group.privacy === 'private'
                            ? 'Seuls les membres approuvés peuvent consulter les publications, médias et la liste des membres.'
                            : 'Tout utilisateur connecté de Zaure peut découvrir et consulter cet espace.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-slate-900">Règles de publication & d'adhésion</p>
                        <p className="text-slate-500 mt-0.5">
                          {group.postPermission === 'admins_only'
                            ? 'Seuls les administrateurs et modérateurs peuvent publier.'
                            : group.requirePostApproval
                              ? 'Tous les membres peuvent soumettre des publications (soumises à validation).'
                              : 'Publication directe autorisée pour tous les membres actifs.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Role Permissions Clarity */}
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <p className="text-xs font-extrabold text-slate-900">
                      Hiérarchie des rôles
                    </p>
                    <div className="grid grid-cols-1 gap-1.5 text-[11px] text-slate-600">
                      <p>
                        <strong className="text-indigo-700">Créateur :</strong> contrôle complet, paramètres, nomination des rôles et suppression.
                      </p>
                      <p>
                        <strong className="text-blue-700">Administrateur :</strong> gestion des membres, paramètres, événements, annonces et modération.
                      </p>
                      <p>
                        <strong className="text-emerald-700">Modérateur :</strong> validation des publications, commentaires, signalements et demandes selon droits accordés.
                      </p>
                      <p>
                        <strong className="text-slate-800">Membre :</strong> consultation, publications (selon paramètres), réactions, commentaires et participation aux événements.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200/85 rounded-3xl p-5 shadow-xs space-y-5">
                  <div className="space-y-3">
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-950">
                      Règles de la communauté ({group.rules.length})
                    </h2>
                    {group.rules.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        Respect mutuel, échanges constructifs et bienveillance sont attendus de tous les membres.
                      </p>
                    ) : (
                      <ol className="space-y-2.5">
                        {group.rules.map((rule, idx) => (
                          <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                            <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-700 font-bold flex items-center justify-center shrink-0 tabular-nums">
                              {idx + 1}
                            </span>
                            <span className="pt-0.5 leading-relaxed">{rule}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>

                  {/* Distinct Leadership Lists */}
                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                      Créateur, Administrateurs & Modérateurs
                    </h3>

                    <div className="space-y-2">
                      {[...leadershipTeam.creator, ...leadershipTeam.admins, ...leadershipTeam.moderators].map((staff) => {
                        const roleInfo = getDisplayRole(staff, group.createdBy);
                        return (
                          <button
                            key={staff.id}
                            type="button"
                            onClick={() => onOpenUserProfile?.(staff.userId)}
                            className="w-full flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/70 text-left transition"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {staff.userAvatar ? (
                                <img
                                  src={staff.userAvatar}
                                  alt={staff.userName}
                                  referrerPolicy="no-referrer"
                                  className="w-9 h-9 rounded-full object-cover shrink-0"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                                  {staff.userName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 truncate flex items-center gap-1.5">
                                  <span>{staff.userName}</span>
                                  {roleInfo.key === 'creator' && (
                                    <Crown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                  )}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  Membre depuis le {formatDateFr(staff.joinedAt)}
                                </p>
                              </div>
                            </div>

                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0 ${roleInfo.accent}`}>
                              {roleInfo.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. MEMBRES */}
            {activeTab === 'members' && (
              <div className="bg-white border border-slate-200/85 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-950">
                      Membres ({filteredMembers.length})
                    </h2>
                    <p className="text-xs text-slate-500">
                      Créateur, administrateurs, modérateurs et membres actifs
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 sm:flex-initial">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        placeholder="Rechercher un membre..."
                        className="w-full min-h-[40px] bg-slate-100 text-xs pl-8 pr-3 py-2 rounded-xl focus:bg-white focus:outline-none border border-transparent focus:border-blue-500"
                      />
                    </div>
                    <select
                      value={memberRoleFilter}
                      onChange={(e) => setMemberRoleFilter(e.target.value as RoleFilter)}
                      className="min-h-[40px] bg-slate-100 text-xs font-bold text-slate-700 px-3 py-2 rounded-xl focus:outline-none"
                    >
                      <option value="all">Tous les rôles</option>
                      <option value="creator">Créateur</option>
                      <option value="administrateur">Administrateurs</option>
                      <option value="moderateur">Modérateurs</option>
                      <option value="membre">Membres</option>
                    </select>
                    {isActiveMember && (
                      <button
                        type="button"
                        onClick={() => setShowInviteModal(true)}
                        className="min-h-[40px] px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Inviter</span>
                      </button>
                    )}
                  </div>
                </div>

                {filteredMembers.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">
                    Aucun membre ne correspond à cette recherche.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredMembers.map((m) => {
                      const roleInfo = getDisplayRole(m, group.createdBy);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => onOpenUserProfile?.(m.userId)}
                          className="w-full flex items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 hover:bg-white hover:border-blue-300 text-left transition"
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
                              <p className="text-xs font-bold text-slate-900 truncate flex items-center gap-1">
                                <span>{m.userName}</span>
                                {roleInfo.key === 'creator' && (
                                  <Crown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                )}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                Rejoint le {formatDateFr(m.joinedAt)}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0 ${roleInfo.accent}`}
                          >
                            {roleInfo.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 4. MÉDIAS (PHOTOS, VIDÉOS, DOCUMENTS UNIFIÉS) */}
            {activeTab === 'media' && (
              <div className="bg-white border border-slate-200/85 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-950">
                    Médias & Ressources ({totalMediaCount})
                  </h2>

                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl">
                    {(
                      [
                        { id: 'photos', label: 'Photos', icon: ImageIcon, count: photoItems.length },
                        { id: 'videos', label: 'Vidéos', icon: Film, count: videoItems.length },
                        { id: 'files', label: 'Documents', icon: FileText, count: documentItems.length }
                      ] as const
                    ).map((sub) => {
                      const SubIcon = sub.icon;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => setMediaSubTab(sub.id)}
                          className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap ${
                            mediaSubTab === sub.id
                              ? 'bg-white text-slate-950 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <SubIcon className="w-3.5 h-3.5" />
                          <span>{sub.label}</span>
                          <span className="text-[11px] opacity-70 tabular-nums">({sub.count})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Photos Sub-tab */}
                {mediaSubTab === 'photos' && (
                  photoItems.length === 0 ? (
                    <div className="py-10 text-center">
                      <ImageIcon className="w-10 h-10 text-slate-300 mx-auto mb-2 stroke-1" />
                      <p className="text-xs text-slate-500">
                        Aucune photo partagée dans cette communauté pour le moment.
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
                            referrerPolicy="no-referrer"
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
                  )
                )}

                {/* Videos Sub-tab */}
                {mediaSubTab === 'videos' && (
                  videoItems.length === 0 ? (
                    <div className="py-10 text-center">
                      <Video className="w-10 h-10 text-slate-300 mx-auto mb-2 stroke-1" />
                      <p className="text-xs text-slate-500">
                        Aucune vidéo publiée dans cette communauté pour le moment.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {videoItems.map((vid, idx) => (
                        <div
                          key={`${vid.postId}_${idx}`}
                          className="rounded-2xl overflow-hidden border border-slate-200/80 bg-slate-50"
                        >
                          <video
                            src={vid.url}
                            controls
                            playsInline
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
                  )
                )}

                {/* Files Sub-tab */}
                {mediaSubTab === 'files' && (
                  <div className="space-y-3">
                    <div className="relative sm:w-72">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={fileSearch}
                        onChange={(e) => setFileSearch(e.target.value)}
                        placeholder="Filtrer par nom de document..."
                        className="w-full min-h-[40px] bg-slate-100 text-xs pl-8 pr-3 py-2 rounded-xl focus:bg-white focus:outline-none border border-transparent focus:border-blue-500"
                      />
                    </div>

                    {documentItems.length === 0 ? (
                      <div className="py-10 text-center">
                        <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2 stroke-1" />
                        <p className="text-xs text-slate-500">
                          Aucun document partagé pour le moment.
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
                                className="min-h-[40px] px-3.5 py-2 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 transition"
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
              </div>
            )}

            {/* 5. ÉVÉNEMENTS */}
            {activeTab === 'events' && (
              <div className="space-y-4">
                <div className="bg-white border border-slate-200/85 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-950">
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
                      className="min-h-[42px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Créer un événement</span>
                    </button>
                  )}
                </div>

                {events.length === 0 ? (
                  <div className="bg-white border border-slate-200/85 rounded-3xl p-10 text-center shadow-xs">
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
                      // Aligned with firestore.rules: creator of event or community admin
                      const canDelete = isAdmin || ev.createdBy === currentUser.id;
                      return (
                        <div
                          key={ev.id}
                          className="bg-white border border-slate-200/85 rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-3"
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-xs font-bold text-blue-700 tabular-nums">
                                {formatDateTimeFr(ev.startDate)}
                              </span>
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmModal({
                                      title: 'Supprimer cet événement ?',
                                      message: `L'événement « ${ev.title} » sera retiré du calendrier.`,
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

                            <h3 className="text-sm font-extrabold text-slate-950">{ev.title}</h3>
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
                                {ev.attendeeIds.length} participant(s) · {ev.interestedIds.length} intéressé(s)
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
                                className={`flex-1 min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                                  isGoing
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 hover:bg-blue-50 text-slate-700'
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
                                className={`flex-1 min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                                  isInterested
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-slate-100 hover:bg-amber-50 text-slate-700'
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

            {/* 6. ANNONCES */}
            {activeTab === 'announcements' && (
              <div className="space-y-4">
                <div className="bg-white border border-slate-200/85 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-950">
                      Annonces officielles ({announcements.length})
                    </h2>
                    <p className="text-xs text-slate-500">
                      Informations importantes publiées par l'équipe de modération
                    </p>
                  </div>
                  {isStaff && (
                    <button
                      type="button"
                      onClick={() => setShowCreateAnnModal(true)}
                      className="min-h-[42px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Publier une annonce</span>
                    </button>
                  )}
                </div>

                {announcements.length === 0 ? (
                  <div className="bg-white border border-slate-200/85 rounded-3xl p-10 text-center shadow-xs">
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
                        className="bg-white border border-slate-200/85 rounded-3xl p-5 shadow-xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                            {ann.isPinned && (
                              <span className="inline-flex items-center gap-1 text-blue-700">
                                <Pin className="w-3 h-3" />
                                Épinglée
                              </span>
                            )}
                            <span
                              className={`uppercase ${
                                ann.priority === 'urgent'
                                  ? 'text-red-600'
                                  : ann.priority === 'important'
                                    ? 'text-amber-700'
                                    : 'text-slate-500'
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
                        <h3 className="text-sm font-extrabold text-slate-950">{ann.title}</h3>
                        <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
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

            {/* 7. ADMINISTRATION (STRICTLY CREATOR, ADMINS & MODERATORS) */}
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
          </motion.div>
        </AnimatePresence>
      )}

      {/* ============================================================ */}
      {/* MODALS (INVITE, EVENT, ANNOUNCEMENT, REPORT, LIGHTBOX)       */}
      {/* ============================================================ */}
      {showInviteModal &&
        createPortal(
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[90]">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-900">
                  Inviter dans « {group.name} »
                </h3>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Shareable Link / Invite Code */}
              <div className="p-3.5 rounded-2xl bg-slate-100/80 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-slate-900">Lien d'invitation directe</p>
                    <p className="text-[11px] text-slate-500">
                      Permet de rejoindre la communauté immédiatement via un code
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={inviteBusy}
                    onClick={handleGenerateInviteLink}
                    className="min-h-[38px] px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shrink-0"
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
                          // fallback
                        }
                        setCopiedInvite(true);
                        window.setTimeout(() => setCopiedInvite(false), 2500);
                      }}
                      className="min-h-[36px] px-3 py-1 bg-slate-950 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 shrink-0"
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
                    className="w-full min-h-[42px] bg-slate-100 text-xs pl-8 pr-3 py-2.5 rounded-xl focus:bg-white focus:outline-none border border-transparent focus:border-blue-500"
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
                          className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-slate-50 border border-slate-200/70"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {u.avatar_url ? (
                              <img
                                src={u.avatar_url}
                                alt={u.nom}
                                referrerPolicy="no-referrer"
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
                            className={`min-h-[38px] px-3 py-1 rounded-xl text-xs font-bold shrink-0 ${
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
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[90]">
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
                  className="w-full min-h-[42px] text-xs px-3.5 py-2.5 bg-slate-100 rounded-xl focus:bg-white focus:outline-none border border-slate-200"
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
                    className="w-full min-h-[42px] text-xs px-3 py-2 bg-slate-100 rounded-xl border border-slate-200"
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
                    className="w-full min-h-[42px] text-xs px-3 py-2 bg-slate-100 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-100 cursor-pointer text-xs font-bold text-slate-800">
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
                    className="w-full min-h-[42px] text-xs px-3.5 py-2.5 bg-slate-100 rounded-xl border border-slate-200"
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
                    className="w-full min-h-[42px] text-xs px-3.5 py-2.5 bg-slate-100 rounded-xl border border-slate-200"
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
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-100 rounded-xl border border-slate-200 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateEventModal(false)}
                  className="min-h-[42px] px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={evBusy}
                  className="min-h-[42px] px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl"
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
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[90]">
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
                  className="w-full min-h-[42px] text-xs px-3.5 py-2.5 bg-slate-100 rounded-xl border border-slate-200"
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
                  className="w-full min-h-[42px] text-xs px-3.5 py-2.5 bg-slate-100 rounded-xl border border-slate-200 font-semibold"
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
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-100 rounded-xl border border-slate-200 resize-none"
                />
              </div>

              <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-100 cursor-pointer text-xs font-bold text-slate-800">
                <span>Épingler en haut des publications</span>
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
                  className="min-h-[42px] px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={annBusy}
                  className="min-h-[42px] px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl"
                >
                  {annBusy ? 'Publication...' : "Publier l'annonce"}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* Report Community Modal */}
      {showReportCircleModal &&
        createPortal(
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[90]">
            <form
              onSubmit={handleSubmitCircleReport}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-3.5"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-900">Signaler cette communauté</h3>
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
                  className="w-full min-h-[42px] text-xs px-3.5 py-2.5 bg-slate-100 rounded-xl border border-slate-200 font-semibold"
                >
                  <option value="Contenu inapproprié">Contenu inapproprié</option>
                  <option value="Spam ou arnaque">Spam ou arnaque</option>
                  <option value="Harcèlement">Harcèlement</option>
                  <option value="Désinformation">Désinformation</option>
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
                  placeholder="Expliquez brièvement la situation..."
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-100 rounded-xl border border-slate-200 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReportCircleModal(false)}
                  className="min-h-[42px] px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={reportBusy}
                  className="min-h-[42px] px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl"
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
            className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 z-[95]"
            onClick={() => setLightboxImage(null)}
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="max-w-4xl max-h-[85vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
              <img
                src={lightboxImage.url}
                alt={lightboxImage.name}
                referrerPolicy="no-referrer"
                className="max-w-full max-h-[78vh] rounded-2xl object-contain"
              />
              <p className="text-xs text-slate-300 mt-3">{lightboxImage.name}</p>
            </div>
          </div>,
          document.body
        )}

      {/* In-App Confirmation Modal */}
      {confirmModal &&
        createPortal(
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[95]">
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
                  className="min-h-[42px] px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
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
                  className={`min-h-[42px] px-4 py-2 text-white text-xs font-bold rounded-xl ${
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
