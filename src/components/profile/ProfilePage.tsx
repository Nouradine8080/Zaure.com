import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Briefcase,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  FileText,
  Film,
  Flag,
  Globe,
  GraduationCap,
  Image as ImageIcon,
  Info,
  Languages,
  Link2,
  Lock,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Settings,
  Share2,
  Shield,
  ShieldAlert,
  UserCheck,
  UserPlus,
  Users,
  UsersRound,
  UserX,
  X
} from 'lucide-react';
import {
  Capsule,
  Circle,
  CommunityGroup,
  DEFAULT_PRIVACY_SETTINGS,
  GroupPost,
  PostComment,
  PostReaction,
  UserFollow,
  UserProfile
} from '../../types';
import {
  normalizePrivacySettings,
  sanitizeWebsiteUrl,
  zaureService
} from '../../firebaseClient';
import { PUBLIC_FEED_GROUP } from '../../services/communityService';
import {
  canSendDirectMessage,
  canViewPrivacySection,
  formatMemberHandle,
  getPrivacyBlockReason,
  ProfileCommunityEntry,
  profileService,
  ViewerProfileContext
} from '../../services/profileService';
import { getDefaultAvatar, getDefaultCoverByCategory } from '../communities/communityAssets';
import CommunityPostCard from '../communities/CommunityPostCard';
import CapsuleCard from '../CapsuleCard';
import ProfileMediaGallery from './ProfileMediaGallery';
import FollowListModal from './FollowListModal';
import EditProfileModal from './EditProfileModal';
import ProfilePrivacyModal from './ProfilePrivacyModal';

export type ProfileTabId = 'publications' | 'about' | 'photos' | 'videos' | 'communities';

interface ProfilePageProps {
  profileUser: UserProfile;
  currentUser: UserProfile;
  allUsers: UserProfile[];
  circles: Circle[];
  joinedCircleIds: string[];
  bookmarkedIds: string[];
  onToggleBookmark: (id: string) => void;
  onBack: () => void;
  onNavigateProfile: (user: UserProfile) => void;
  onOpenChat: (user: UserProfile) => void;
  onOpenSettings: () => void;
  onOpenCommunityGroup: (groupId: string) => void;
  onOpenCircle: (circleId: string) => void;
  onProfileUpdated: (updated: UserProfile) => void;
}

function formatJoinedDate(iso?: string): string {
  if (!iso) return 'Récemment';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Récemment';
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function formatLanguageLabel(lang?: string): string {
  if (lang === 'ha') return 'Hausa';
  if (lang === 'en') return 'English';
  return 'Français';
}

export default function ProfilePage({
  profileUser: initialProfileUser,
  currentUser,
  allUsers,
  circles,
  joinedCircleIds,
  bookmarkedIds,
  onToggleBookmark,
  onBack,
  onNavigateProfile,
  onOpenChat,
  onOpenSettings,
  onOpenCommunityGroup,
  onOpenCircle,
  onProfileUpdated
}: ProfilePageProps) {
  const [profile, setProfile] = useState<UserProfile>(initialProfileUser);
  const [activeTab, setActiveTab] = useState<ProfileTabId>('publications');

  // Social follow graph state
  const [followers, setFollowers] = useState<UserFollow[]>([]);
  const [following, setFollowing] = useState<UserFollow[]>([]);
  const [myFollowing, setMyFollowing] = useState<UserFollow[]>([]);
  const [followBusy, setFollowBusy] = useState(false);

  // Content state
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [reactionsByPost, setReactionsByPost] = useState<Record<string, PostReaction[]>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, PostComment[]>>({});
  const [groupsMap, setGroupsMap] = useState<Record<string, CommunityGroup>>({});
  const [communities, setCommunities] = useState<ProfileCommunityEntry[]>([]);
  const [viewerSharesGroup, setViewerSharesGroup] = useState(false);
  const [loadingContent, setLoadingContent] = useState(true);

  // Block & report state
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState<
    'spam' | 'harcelement' | 'usurpation' | 'contenu_inapproprie' | 'autre'
  >('contenu_inapproprie');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSent, setReportSent] = useState(false);

  // Sub-modals
  const [followModalTab, setFollowModalTab] = useState<'followers' | 'following' | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [toastText, setToastText] = useState<string | null>(null);

  const optionsMenuRef = useRef<HTMLDivElement>(null);
  const isOwnProfile = profile.id === currentUser.id;

  const notify = (msg: string) => {
    setToastText(msg);
    window.setTimeout(() => {
      setToastText((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  // Sync profile prop & hydrate full public_profile doc from Firestore
  useEffect(() => {
    setProfile(initialProfileUser);
    setActiveTab('publications');
    setShowOptionsMenu(false);

    let active = true;
    zaureService
      .getUserPublicProfile(initialProfileUser.id)
      .then((fresh) => {
        if (active && fresh) {
          setProfile((prev) => ({
            ...prev,
            ...fresh,
            email: isOwnProfile ? currentUser.email : ''
          }));
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [initialProfileUser.id, isOwnProfile, currentUser.email]);

  // Real-time subscriptions to followers/following
  useEffect(() => {
    const unsubFollowers = profileService.subscribeFollowers(profile.id, setFollowers);
    const unsubFollowing = profileService.subscribeFollowing(profile.id, setFollowing);
    const unsubMyFollowing = profileService.subscribeFollowing(currentUser.id, setMyFollowing);
    return () => {
      unsubFollowers();
      unsubFollowing();
      unsubMyFollowing();
    };
  }, [profile.id, currentUser.id]);

  // Load viewer blocked list + profile publications + communities
  useEffect(() => {
    let active = true;
    setLoadingContent(true);

    Promise.all([
      zaureService.getBlockedUserIds().catch(() => [] as string[]),
      profileService.fetchProfilePublications(profile.id, currentUser.id),
      profileService.fetchProfileCommunities(profile.id, currentUser.id)
    ])
      .then(([blocked, pubData, commData]) => {
        if (!active) return;
        setBlockedIds(blocked);
        setPosts(pubData.posts);
        setCapsules(pubData.capsules);
        setReactionsByPost(pubData.reactionsByPost);
        setCommentsByPost(pubData.commentsByPost);
        setGroupsMap(pubData.groupsMap);
        setCommunities(commData.communities);
        setViewerSharesGroup(commData.viewerSharesGroup);
      })
      .finally(() => {
        if (active) setLoadingContent(false);
      });

    return () => {
      active = false;
    };
  }, [profile.id, currentUser.id]);

  useEffect(() => {
    if (!showOptionsMenu) return;
    const onDocClick = (e: MouseEvent) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(e.target as Node)) {
        setShowOptionsMenu(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showOptionsMenu]);

  const privacy = useMemo(
    () => normalizePrivacySettings(profile.privacy_settings || DEFAULT_PRIVACY_SETTINGS),
    [profile.privacy_settings]
  );

  const isFollower = useMemo(
    () => followers.some((f) => f.followerId === currentUser.id),
    [followers, currentUser.id]
  );

  const myFollowingIds = useMemo(
    () => myFollowing.map((f) => f.followingId),
    [myFollowing]
  );

  const isBlocked = blockedIds.includes(profile.id);

  const viewerCtx: ViewerProfileContext = useMemo(
    () => ({
      isOwnProfile,
      isFollower,
      sharesCircleOrGroup: viewerSharesGroup,
      isMentorOrVerified:
        currentUser.role === 'mentor' || currentUser.role === 'verifie',
      isBlocked
    }),
    [isOwnProfile, isFollower, viewerSharesGroup, currentUser.role, isBlocked]
  );

  const canViewInfo = canViewPrivacySection(privacy.infoVisibility, viewerCtx, privacy);
  const canViewPosts = canViewPrivacySection(privacy.postsVisibility, viewerCtx, privacy);
  const canViewFollowers = canViewPrivacySection(privacy.followersVisibility, viewerCtx, privacy);
  const canViewFollowing = canViewPrivacySection(privacy.followingVisibility, viewerCtx, privacy);
  const canViewCommunities = canViewPrivacySection(privacy.communitiesVisibility, viewerCtx, privacy);
  const allowDirectMsg = canSendDirectMessage(privacy, viewerCtx);

  const handleToggleFollow = async (targetUserId: string) => {
    if (targetUserId === currentUser.id) return;
    const currentlyFollowing =
      targetUserId === profile.id ? isFollower : myFollowingIds.includes(targetUserId);

    if (targetUserId === profile.id) setFollowBusy(true);
    try {
      if (currentlyFollowing) {
        await profileService.unfollowUser(currentUser.id, targetUserId);
        if (targetUserId === profile.id) notify(`Vous ne suivez plus ${profile.nom}.`);
      } else {
        await profileService.followUser(currentUser.id, targetUserId);
        if (targetUserId === profile.id) notify(`Vous suivez maintenant ${profile.nom}.`);
      }
    } catch (err: any) {
      notify(err?.message || 'Action impossible pour le moment.');
    } finally {
      if (targetUserId === profile.id) setFollowBusy(false);
    }
  };

  const handleShareProfile = async () => {
    const shareUrl = `${window.location.origin}/?profile=${encodeURIComponent(profile.id)}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${profile.nom} (${formatMemberHandle(profile)}) sur Zaure`,
          text: profile.bio || `Découvrez le profil de ${profile.nom} sur Zaure.`,
          url: shareUrl
        });
      } else {
        await navigator.clipboard?.writeText?.(shareUrl);
      }
      notify('Lien du profil copié !');
    } catch {
      try {
        await navigator.clipboard?.writeText?.(shareUrl);
        notify('Lien du profil copié !');
      } catch {
        // ignore
      }
    }
  };

  const handleCopyUserId = async () => {
    try {
      await navigator.clipboard?.writeText?.(profile.id);
      notify('Identifiant utilisateur copié.');
    } catch {
      // ignore
    }
    setShowOptionsMenu(false);
  };

  const handleToggleBlock = async () => {
    setShowOptionsMenu(false);
    if (isBlocked) {
      const ok = await zaureService.unblockUser(profile.id);
      if (ok) {
        setBlockedIds((prev) => prev.filter((id) => id !== profile.id));
        notify(`${profile.nom} a été débloqué(e).`);
      }
    } else {
      const ok = await zaureService.blockUser(profile.id);
      if (ok) {
        setBlockedIds((prev) => [...prev, profile.id]);
        notify(`${profile.nom} a été bloqué(e).`);
      }
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await zaureService.reportUser({
      targetUserId: profile.id,
      targetUserNom: profile.nom,
      reason: reportReason,
      details: reportDetails.trim()
    });
    if (res.success) {
      setReportSent(true);
      setTimeout(() => {
        setShowReportModal(false);
        setReportSent(false);
        setReportDetails('');
      }, 1500);
    }
  };

  const mergedPublications = useMemo(() => {
    const items: (
      | { kind: 'post'; id: string; createdAt: string; data: GroupPost }
      | { kind: 'capsule'; id: string; createdAt: string; data: Capsule }
    )[] = [];

    posts.forEach((p) =>
      items.push({ kind: 'post', id: p.id, createdAt: p.createdAt || '', data: p })
    );
    capsules.forEach((c) =>
      items.push({ kind: 'capsule', id: c.id, createdAt: c.created_at || '', data: c })
    );
    items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return items;
  }, [posts, capsules]);

  const photosCount = useMemo(
    () =>
      posts.reduce(
        (acc, p) => acc + (p.media || []).filter((m) => m.type === 'image').length,
        0
      ),
    [posts]
  );

  const videosCount = useMemo(
    () =>
      posts.reduce(
        (acc, p) => acc + (p.media || []).filter((m) => m.type === 'video').length,
        0
      ),
    [posts]
  );

  const ownLegacyCircles = useMemo(() => {
    if (!isOwnProfile) return [];
    return circles.filter((c) => joinedCircleIds.includes(c.id));
  }, [isOwnProfile, circles, joinedCircleIds]);

  const totalPublicationsCount = canViewPosts ? mergedPublications.length : 0;
  const totalCommunitiesCount = canViewCommunities
    ? communities.length + ownLegacyCircles.length
    : 0;

  const cleanWebsite = sanitizeWebsiteUrl(profile.site_web);

  const tabs: { id: ProfileTabId; label: string; count?: number; icon: React.ElementType }[] = [
    { id: 'publications', label: 'Publications', count: totalPublicationsCount, icon: FileText },
    { id: 'about', label: 'À propos', icon: Info },
    { id: 'photos', label: 'Photos', count: canViewPosts ? photosCount : undefined, icon: ImageIcon },
    { id: 'videos', label: 'Vidéos', count: canViewPosts ? videosCount : undefined, icon: Film },
    {
      id: 'communities',
      label: 'Communautés',
      count: canViewCommunities ? totalCommunitiesCount : undefined,
      icon: UsersRound
    }
  ];

  const renderPrivacyGateCard = (reason: string, title = 'Contenu protégé') => (
    <div className="bg-white border border-slate-200/85 rounded-2xl sm:rounded-3xl p-8 sm:p-10 text-center shadow-xs space-y-3">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center">
        <Lock className="w-7 h-7" />
      </div>
      <h4 className="text-sm sm:text-base font-extrabold text-slate-950">{title}</h4>
      <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">{reason}</p>
      {!isOwnProfile && !isFollower && !isBlocked && (
        <div className="pt-1">
          <button
            type="button"
            disabled={followBusy}
            onClick={() => handleToggleFollow(profile.id)}
            className="min-h-[42px] px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-2 shadow-xs transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>Suivre {profile.nom}</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4 pb-6 animate-fadeIn" id="zaure-profile-page">
      {/* Toast Feedback */}
      <AnimatePresence>
        {toastText && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 bg-slate-950 text-white px-4 py-3 rounded-2xl shadow-xl border border-blue-500/30 flex items-center gap-2.5 text-xs font-bold"
          >
            <Check className="w-4 h-4 text-blue-400 shrink-0" />
            <span>{toastText}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Back Bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/85 text-slate-700 text-xs font-bold inline-flex items-center gap-2 shadow-2xs transition"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500" />
          <span>Retour au fil</span>
        </button>

        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
          {privacy.profileMode === 'private' && (
            <span className="inline-flex items-center gap-1 text-amber-700">
              <Lock className="w-3.5 h-3.5" />
              <span>Profil privé</span>
            </span>
          )}
          <span className="hidden sm:inline font-mono text-slate-400">
            {formatMemberHandle(profile)}
          </span>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 1. EN-TÊTE DU PROFIL                                                 */}
      {/* ==================================================================== */}
      <section className="bg-white border border-slate-200/85 rounded-3xl shadow-[0_2px_10px_-3px_rgba(15,23,42,0.06)] overflow-hidden">
        {/* Large Cover Photo */}
        <div className="relative h-40 sm:h-56 md:h-64 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 overflow-hidden">
          {profile.cover_url ? (
            <img
              src={profile.cover_url}
              alt={`Couverture de ${profile.nom}`}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-600 via-indigo-700 to-slate-950 relative">
              <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute left-12 -bottom-20 w-56 h-56 rounded-full bg-red-500/20 blur-2xl" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/35 via-transparent to-transparent" />

          {isOwnProfile && (
            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              className="absolute bottom-3 right-3 min-h-[38px] px-3.5 py-1.5 rounded-xl bg-slate-950/65 hover:bg-slate-950/85 text-white text-xs font-bold backdrop-blur-xs flex items-center gap-1.5 transition"
            >
              <Camera className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Modifier la couverture</span>
            </button>
          )}
        </div>

        {/* Overlapping Avatar + Primary Actions */}
        <div className="px-4 sm:px-6 pb-5 sm:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-16 relative z-10">
            {/* Avatar */}
            <div className="relative w-fit">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.nom}
                  className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover ring-4 ring-white shadow-lg bg-white"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-blue-600 text-white text-3xl sm:text-4xl font-black flex items-center justify-center ring-4 ring-white shadow-lg">
                  {profile.nom.charAt(0).toUpperCase()}
                </div>
              )}

              {/* Live Availability Dot */}
              <span
                className={`absolute bottom-1.5 right-1.5 w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 border-white shadow-xs ${
                  profile.availability === 'busy'
                    ? 'bg-amber-500'
                    : profile.availability === 'offline'
                    ? 'bg-slate-400'
                    : 'bg-emerald-500'
                }`}
                title={
                  profile.availability === 'busy'
                    ? 'Occupé'
                    : profile.availability === 'offline'
                    ? 'Hors ligne'
                    : 'Disponible'
                }
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {isOwnProfile ? (
                <>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setShowEditModal(true)}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Modifier le profil</span>
                  </motion.button>

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setShowPrivacyModal(true)}
                    className="min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <Shield className="w-3.5 h-3.5 text-blue-600" />
                    <span>Confidentialité</span>
                  </motion.button>

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={onOpenSettings}
                    className="min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-600" />
                    <span className="hidden xs:inline">Paramètres du profil</span>
                    <span className="xs:hidden">Paramètres</span>
                  </motion.button>

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    onClick={handleShareProfile}
                    className="min-h-[42px] w-10 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center justify-center transition"
                    title="Partager mon profil"
                    aria-label="Partager mon profil"
                  >
                    <Share2 className="w-4 h-4" />
                  </motion.button>
                </>
              ) : (
                <>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    disabled={followBusy || isBlocked}
                    onClick={() => handleToggleFollow(profile.id)}
                    className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                      isFollower
                        ? 'bg-slate-100 hover:bg-red-50 text-slate-900 hover:text-red-700 border border-slate-200/80'
                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs disabled:opacity-45'
                    }`}
                  >
                    {isFollower ? (
                      <>
                        <UserCheck className="w-4 h-4 text-blue-600" />
                        <span>Abonné · Ne plus suivre</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>Suivre</span>
                      </>
                    )}
                  </motion.button>

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    disabled={!allowDirectMsg}
                    onClick={() => onOpenChat(profile)}
                    title={
                      allowDirectMsg
                        ? `Envoyer un message à ${profile.nom}`
                        : "Ce membre limite la réception de messages directs."
                    }
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Envoyer un message</span>
                  </motion.button>

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    onClick={handleShareProfile}
                    className="min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
                    title="Partager le profil"
                  >
                    <Share2 className="w-4 h-4" />
                    <span className="hidden md:inline">Partager</span>
                  </motion.button>

                  {/* 3-Dot Options Menu */}
                  <div ref={optionsMenuRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setShowOptionsMenu((prev) => !prev)}
                      className="min-h-[42px] w-10 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 flex items-center justify-center transition"
                      title="Menu des options"
                      aria-label="Menu des options"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </button>

                    <AnimatePresence>
                      {showOptionsMenu && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -4 }}
                          transition={{ duration: 0.14 }}
                          className="absolute right-0 mt-1.5 w-56 bg-white border border-slate-200/90 rounded-2xl shadow-xl z-30 p-1.5 space-y-0.5 origin-top-right"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setShowOptionsMenu(false);
                              handleShareProfile();
                            }}
                            className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-800 hover:bg-slate-50 flex items-center gap-2.5 transition"
                          >
                            <Link2 className="w-4 h-4 text-slate-500" />
                            <span>Copier le lien du profil</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleCopyUserId}
                            className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-800 hover:bg-slate-50 flex items-center gap-2.5 transition"
                          >
                            <Copy className="w-4 h-4 text-slate-500" />
                            <span>Copier l'identifiant</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleToggleBlock}
                            className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition ${
                              isBlocked
                                ? 'text-blue-700 hover:bg-blue-50'
                                : 'text-red-600 hover:bg-red-50'
                            }`}
                          >
                            <UserX className="w-4 h-4" />
                            <span>{isBlocked ? 'Débloquer ce membre' : 'Bloquer ce membre'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowOptionsMenu(false);
                              setShowReportModal(true);
                            }}
                            className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-amber-700 hover:bg-amber-50 flex items-center gap-2.5 transition"
                          >
                            <Flag className="w-4 h-4" />
                            <span>Signaler le profil</span>
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Identity Block */}
          <div className="mt-4 space-y-2.5">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                  {profile.nom}
                </h1>
                {profile.role === 'verifie' && (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-700"
                    title="Professionnel vérifié"
                  >
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <span className="hidden sm:inline">Vérifié</span>
                  </span>
                )}
                {profile.role === 'mentor' && (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-bold text-red-700"
                    title="Mentor certifié Zaure"
                  >
                    <Award className="w-4 h-4 text-red-600" />
                    <span className="hidden sm:inline">Mentor</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 mt-0.5">
                <span className="font-semibold text-slate-600">{formatMemberHandle(profile)}</span>
                {canViewInfo && profile.profession && (
                  <>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span className="font-semibold text-slate-800">{profile.profession}</span>
                  </>
                )}
              </div>
            </div>

            {/* Bio */}
            {isBlocked ? (
              <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                <span>Vous avez bloqué ce membre. Débloquez-le pour interagir.</span>
              </p>
            ) : canViewInfo && profile.bio ? (
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed max-w-2xl whitespace-pre-line">
                {profile.bio}
              </p>
            ) : !canViewInfo ? (
              <p className="text-xs text-slate-500 italic flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Profil protégé par des paramètres de confidentialité.</span>
              </p>
            ) : null}

            {/* Zero-Pill Metadata Strip */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 pt-0.5">
              {canViewInfo && profile.localisation && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{profile.localisation}</span>
                </span>
              )}

              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Inscrit depuis {formatJoinedDate(profile.created_at)}</span>
              </span>

              {canViewInfo && cleanWebsite && (
                <a
                  href={cleanWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-700 hover:underline font-semibold"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>{cleanWebsite.replace(/^https?:\/\//, '')}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* Interactive Metrics Row (Abonnés / Abonnements / Publications) */}
            <div className="flex flex-wrap items-center gap-5 sm:gap-7 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setFollowModalTab('followers')}
                className="group text-left min-h-[36px] flex items-baseline gap-1.5 hover:opacity-80 transition"
              >
                <span className="font-mono text-base sm:text-lg font-black text-slate-950 tabular-nums group-hover:text-blue-700 transition-colors">
                  {followers.length}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  Abonné{followers.length > 1 ? 's' : ''}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFollowModalTab('following')}
                className="group text-left min-h-[36px] flex items-baseline gap-1.5 hover:opacity-80 transition"
              >
                <span className="font-mono text-base sm:text-lg font-black text-slate-950 tabular-nums group-hover:text-blue-700 transition-colors">
                  {following.length}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  Abonnement{following.length > 1 ? 's' : ''}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('publications')}
                className="group text-left min-h-[36px] flex items-baseline gap-1.5 hover:opacity-80 transition"
              >
                <span className="font-mono text-base sm:text-lg font-black text-slate-950 tabular-nums group-hover:text-blue-700 transition-colors">
                  {totalPublicationsCount}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  Publication{totalPublicationsCount > 1 ? 's' : ''}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* 2. SYSTÈME D'ONGLETS                                                 */}
        {/* ==================================================================== */}
        <div className="border-t border-slate-100 px-2 sm:px-4 flex items-center gap-1 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative min-h-[46px] px-3 sm:px-4 py-2.5 text-xs sm:text-[13px] font-bold flex items-center gap-1.5 shrink-0 transition whitespace-nowrap ${
                  isActive ? 'text-blue-700' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span
                    className={`font-mono text-[11px] tabular-nums ${
                      isActive ? 'text-blue-600' : 'text-slate-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
                {isActive && (
                  <motion.span
                    layoutId="zaure-profile-tab-indicator"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute bottom-0 inset-x-2 h-[3px] bg-blue-600 rounded-t-full"
                  />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 3. CONTENU DE L'ONGLET SÉLECTIONNÉ                                   */}
      {/* ==================================================================== */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${profile.id}-${activeTab}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* TAB 1: PUBLICATIONS */}
          {activeTab === 'publications' && (
            <div className="space-y-3.5">
              {!canViewPosts ? (
                renderPrivacyGateCard(
                  getPrivacyBlockReason(privacy.postsVisibility, privacy, profile.nom),
                  'Publications privées'
                )
              ) : loadingContent ? (
                <div className="space-y-3.5">
                  {[1, 2].map((n) => (
                    <div
                      key={n}
                      className="bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xs animate-pulse space-y-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-200" />
                        <div className="space-y-1.5 flex-1">
                          <div className="h-3.5 bg-slate-200 rounded w-1/3" />
                          <div className="h-2.5 bg-slate-100 rounded w-1/4" />
                        </div>
                      </div>
                      <div className="h-16 bg-slate-100 rounded-2xl w-full" />
                    </div>
                  ))}
                </div>
              ) : mergedPublications.length === 0 ? (
                <div className="bg-white border border-slate-200/85 rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center shadow-xs space-y-2.5">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <FileText className="w-8 h-8" />
                  </div>
                  <h4 className="text-sm sm:text-base font-extrabold text-slate-950">
                    Aucune publication pour l'instant
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                    {isOwnProfile
                      ? "Partagez vos réflexions, photos, vidéos ou notes vocales depuis le fil d'actualité pour enrichir votre profil."
                      : `${profile.nom} n'a pas encore publié de contenu public visible.`}
                  </p>
                </div>
              ) : (
                mergedPublications.map((item) =>
                  item.kind === 'post' ? (
                    <CommunityPostCard
                      key={`prof_post_${item.id}`}
                      group={groupsMap[item.data.groupId] || PUBLIC_FEED_GROUP}
                      post={item.data}
                      comments={commentsByPost[item.id] || []}
                      reactions={reactionsByPost[item.id] || []}
                      members={[]}
                      currentUser={currentUser}
                    />
                  ) : (
                    <CapsuleCard
                      key={`prof_cap_${item.id}`}
                      capsule={item.data}
                      currentUser={currentUser}
                      isBookmarked={bookmarkedIds.includes(item.id)}
                      onToggleBookmark={() => onToggleBookmark(item.id)}
                    />
                  )
                )
              )}
            </div>
          )}

          {/* TAB 2: À PROPOS */}
          {activeTab === 'about' && (
            <>
              {!canViewInfo ? (
                renderPrivacyGateCard(
                  getPrivacyBlockReason(privacy.infoVisibility, privacy, profile.nom),
                  'Informations personnelles restreintes'
                )
              ) : (
                <div className="bg-white border border-slate-200/85 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs space-y-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-950 flex items-center gap-2">
                      <Info className="w-4 h-4 text-blue-600" />
                      <span>À propos de {profile.nom}</span>
                    </h3>
                    {isOwnProfile && (
                      <button
                        type="button"
                        onClick={() => setShowEditModal(true)}
                        className="text-xs font-bold text-blue-700 hover:underline flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Modifier</span>
                      </button>
                    )}
                  </div>

                  {profile.bio && (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/75">
                      <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                        Biographie
                      </p>
                      <p className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                        {profile.bio}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-2xl border border-slate-200/80 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Briefcase className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Profession
                        </p>
                        <p className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 break-words">
                          {profile.profession || 'Non renseignée'}
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl border border-slate-200/80 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <GraduationCap className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Formation / Parcours
                        </p>
                        <p className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 break-words">
                          {profile.formation || 'Non renseignée'}
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl border border-slate-200/80 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Localisation
                        </p>
                        <p className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 break-words">
                          {profile.localisation || 'Non renseignée'}
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl border border-slate-200/80 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                        <Languages className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Langue principale
                        </p>
                        <p className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5">
                          {formatLanguageLabel(profile.langue_preferee)}
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl border border-slate-200/80 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Date d'inscription
                        </p>
                        <p className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5">
                          {formatJoinedDate(profile.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl border border-slate-200/80 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Globe className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Site web
                        </p>
                        {cleanWebsite ? (
                          <a
                            href={cleanWebsite}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs sm:text-sm font-bold text-blue-700 hover:underline mt-0.5 inline-flex items-center gap-1 break-all"
                          >
                            <span>{cleanWebsite.replace(/^https?:\/\//, '')}</span>
                            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                          </a>
                        ) : (
                          <p className="text-xs sm:text-sm font-bold text-slate-400 mt-0.5">
                            Non renseigné
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {profile.infos_complementaires && (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/75">
                      <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                        Informations complémentaires
                      </p>
                      <p className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                        {profile.infos_complementaires}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* TAB 3: PHOTOS */}
          {activeTab === 'photos' && (
            <>
              {!canViewPosts ? (
                renderPrivacyGateCard(
                  getPrivacyBlockReason(privacy.postsVisibility, privacy, profile.nom),
                  'Galerie photos restreinte'
                )
              ) : (
                <ProfileMediaGallery
                  mode="photos"
                  posts={posts}
                  groupsMap={groupsMap}
                  profileUser={profile}
                />
              )}
            </>
          )}

          {/* TAB 4: VIDÉOS */}
          {activeTab === 'videos' && (
            <>
              {!canViewPosts ? (
                renderPrivacyGateCard(
                  getPrivacyBlockReason(privacy.postsVisibility, privacy, profile.nom),
                  'Galerie vidéos restreinte'
                )
              ) : (
                <ProfileMediaGallery
                  mode="videos"
                  posts={posts}
                  groupsMap={groupsMap}
                  profileUser={profile}
                />
              )}
            </>
          )}

          {/* TAB 5: COMMUNAUTÉS */}
          {activeTab === 'communities' && (
            <>
              {!canViewCommunities ? (
                renderPrivacyGateCard(
                  getPrivacyBlockReason(privacy.communitiesVisibility, privacy, profile.nom),
                  'Communautés masquées'
                )
              ) : loadingContent ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[1, 2].map((n) => (
                    <div
                      key={n}
                      className="h-44 bg-white border border-slate-200/80 rounded-2xl animate-pulse"
                    />
                  ))}
                </div>
              ) : totalCommunitiesCount === 0 ? (
                <div className="bg-white border border-slate-200/85 rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center shadow-xs space-y-2.5">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                    <Users className="w-8 h-8" />
                  </div>
                  <h4 className="text-sm sm:text-base font-extrabold text-slate-950">
                    Aucune communauté visible
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                    {isOwnProfile
                      ? 'Rejoignez des communautés et cercles de savoir pour échanger avec des pairs.'
                      : `${profile.nom} ne participe à aucune communauté publique pour le moment.`}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {communities.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {communities.map(({ group, membership }) => {
                        const coverSrc =
                          group.coverPhoto || getDefaultCoverByCategory(group.category);
                        const avatarSrc =
                          group.avatarPhoto || getDefaultAvatar();
                        const roleLabel =
                          group.createdBy === profile.id
                            ? 'Créateur'
                            : membership.role === 'administrateur'
                            ? 'Administrateur'
                            : membership.role === 'moderateur'
                            ? 'Modérateur'
                            : 'Membre';
                        return (
                          <motion.div
                            key={group.id}
                            whileHover={{ y: -2 }}
                            className="bg-white border border-slate-200/85 rounded-2xl sm:rounded-3xl overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between"
                          >
                            <div>
                              <div className="relative h-24 bg-slate-900 overflow-hidden">
                                <img
                                  src={coverSrc}
                                  alt={group.name}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent" />
                                <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-slate-950/65 text-white text-[10px] font-bold backdrop-blur-xs flex items-center gap-1">
                                  {group.privacy === 'private' ? (
                                    <Lock className="w-3 h-3" />
                                  ) : (
                                    <Globe className="w-3 h-3" />
                                  )}
                                  <span>{group.privacy === 'private' ? 'Privée' : 'Publique'}</span>
                                </span>
                              </div>

                              <div className="px-4 pb-3">
                                <div className="-mt-7 relative z-10 flex items-end justify-between gap-2">
                                  <img
                                    src={avatarSrc}
                                    alt={group.name}
                                    className="w-14 h-14 rounded-2xl object-cover ring-4 ring-white shadow-sm bg-white"
                                    referrerPolicy="no-referrer"
                                  />
                                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
                                    {roleLabel}
                                  </span>
                                </div>

                                <h4 className="text-sm font-extrabold text-slate-950 mt-2.5 truncate">
                                  {group.name}
                                </h4>
                                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                                  {group.description}
                                </p>
                              </div>
                            </div>

                            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                                {Math.max(1, group.memberCount || 1)} membre
                                {(group.memberCount || 1) > 1 ? 's' : ''}
                              </span>
                              <button
                                type="button"
                                onClick={() => onOpenCommunityGroup(group.id)}
                                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold transition"
                              >
                                Voir la communauté
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}

                  {ownLegacyCircles.length > 0 && (
                    <div className="bg-white border border-slate-200/85 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xs space-y-3">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                        Cercles de savoir rejoints ({ownLegacyCircles.length})
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {ownLegacyCircles.map((circle) => (
                          <button
                            key={circle.id}
                            type="button"
                            onClick={() => onOpenCircle(circle.id)}
                            className="flex items-center gap-3 p-2.5 rounded-2xl border border-slate-200/80 hover:border-blue-300 hover:bg-blue-50/40 text-left transition"
                          >
                            <img
                              src={circle.image}
                              alt={circle.nom}
                              className="w-11 h-11 rounded-xl object-cover shrink-0 bg-slate-100"
                              referrerPolicy="no-referrer"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-900 truncate">
                                {circle.nom}
                              </p>
                              <p className="text-[10px] text-slate-500 truncate">
                                {circle.categorie}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ==================================================================== */}
      {/* 4. MODALES INTERACTIVES (ABONNÉS, ÉDITION, CONFIDENTIALITÉ, SIGNALER) */}
      {/* ==================================================================== */}
      <FollowListModal
        isOpen={followModalTab !== null}
        initialTab={followModalTab || 'followers'}
        profileUser={profile}
        currentUser={currentUser}
        followers={followers}
        following={following}
        allUsers={allUsers}
        myFollowingIds={myFollowingIds}
        canViewFollowers={canViewFollowers}
        canViewFollowing={canViewFollowing}
        privacyReasonFollowers={getPrivacyBlockReason(
          privacy.followersVisibility,
          privacy,
          profile.nom
        )}
        privacyReasonFollowing={getPrivacyBlockReason(
          privacy.followingVisibility,
          privacy,
          profile.nom
        )}
        onToggleFollow={handleToggleFollow}
        onSelectUser={onNavigateProfile}
        onClose={() => setFollowModalTab(null)}
      />

      {isOwnProfile && (
        <>
          <EditProfileModal
            isOpen={showEditModal}
            user={profile}
            onClose={() => setShowEditModal(false)}
            onSaved={(updated) => {
              setProfile(updated);
              onProfileUpdated(updated);
              notify('Votre profil a été mis à jour !');
            }}
          />

          <ProfilePrivacyModal
            isOpen={showPrivacyModal}
            user={profile}
            onClose={() => setShowPrivacyModal(false)}
            onSaved={(updated) => {
              setProfile(updated);
              onProfileUpdated(updated);
              notify('Paramètres de confidentialité enregistrés.');
            }}
            onOpenFullSettings={onOpenSettings}
          />
        </>
      )}

      {/* Report User Modal */}
      {showReportModal &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
            onClick={() => setShowReportModal(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <h3 className="text-base font-extrabold text-slate-950">
                    Signaler {profile.nom}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {reportSent ? (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>Signalement envoyé de manière confidentielle.</span>
                </div>
              ) : (
                <form onSubmit={handleReportSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                      Motif du signalement
                    </label>
                    <select
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value as any)}
                      className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#F0F2F5] border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
                    >
                      <option value="contenu_inapproprie">Contenu inapproprié</option>
                      <option value="spam">Spam ou sollicitation abusive</option>
                      <option value="harcelement">Harcèlement ou intimidation</option>
                      <option value="usurpation">Usurpation d'identité</option>
                      <option value="autre">Autre motif</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                      Précisions (optionnel)
                    </label>
                    <textarea
                      rows={3}
                      maxLength={500}
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                      placeholder="Décrivez brièvement la situation..."
                      className="w-full p-3 rounded-xl bg-[#F0F2F5] border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-500 resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowReportModal(false)}
                      className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="min-h-[42px] px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs"
                    >
                      Envoyer le signalement
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
