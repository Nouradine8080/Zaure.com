import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  BookOpen,
  Briefcase,
  Check,
  CheckCheck,
  Compass,
  Cpu,
  Flame,
  Globe,
  GraduationCap,
  KeyRound,
  Lock,
  MailCheck,
  Plus,
  Search,
  Sparkles,
  Sprout,
  Stethoscope,
  Users,
  UsersRound,
  X
} from 'lucide-react';
import {
  CommunityGroup,
  CommunityMember,
  GroupInvitation,
  GroupNotification,
  UserProfile
} from '../../types';
import { communityService } from '../../services/communityService';
import {
  COMMUNITY_CATEGORIES,
  getDefaultAvatar,
  getDefaultCoverByCategory
} from './communityAssets';
import CreateCommunityModal from './CreateCommunityModal';
import CommunityGroupPage from './CommunityGroupPage';
import ZaureGeometricBackdrop from '../ui/ZaureGeometricBackdrop';
import { ZAURE_GLOWS, ZAURE_ICON_CHIPS, ZAURE_SURFACES } from '../../styles/designSystem';

interface CommunitiesHubProps {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  initialGroupId?: string | null;
  initialInviteCode?: string | null;
  onGroupChange?: (groupId: string | null) => void;
  onClearDeepLink?: () => void;
  onOpenUserProfile?: (userId: string) => void;
}

const CATEGORY_META: Record<string, { icon: React.ElementType; tone: string }> = {
  'Médecine & Santé': { icon: Stethoscope, tone: ZAURE_ICON_CHIPS.rose },
  'Sciences & Tech': { icon: Cpu, tone: ZAURE_ICON_CHIPS.blue },
  'Langues & Culture': { icon: BookOpen, tone: ZAURE_ICON_CHIPS.amber },
  'Éducation & Études': { icon: GraduationCap, tone: ZAURE_ICON_CHIPS.indigo },
  'Agriculture & Écologie': { icon: Sprout, tone: ZAURE_ICON_CHIPS.emerald },
  Entrepreneuriat: { icon: Briefcase, tone: ZAURE_ICON_CHIPS.violet },
  'Vie communautaire': { icon: UsersRound, tone: ZAURE_ICON_CHIPS.sky }
};

function formatRelative(iso?: string): string {
  if (!iso) return '';
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '';
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Il y a ${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `Il y a ${days} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function getMemberRoleLabel(member: CommunityMember, creatorId: string): string {
  if (member.userId === creatorId) return 'Créateur';
  if (member.role === 'administrateur') return 'Administrateur';
  if (member.role === 'moderateur') return 'Modérateur';
  return 'Membre';
}

export default function CommunitiesHub({
  currentUser,
  allUsers,
  initialGroupId,
  initialInviteCode,
  onGroupChange,
  onClearDeepLink,
  onOpenUserProfile
}: CommunitiesHubProps) {
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [memberships, setMemberships] = useState<CommunityMember[]>([]);
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
  const [notifications, setNotifications] = useState<GroupNotification[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection & modals
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId || null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showInviteCodeBox, setShowInviteCodeBox] = useState(false);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Toutes');
  const [privacyFilter, setPrivacyFilter] = useState<'all' | 'public' | 'private'>('all');

  // Invite code redemption
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [redeemingCode, setRedeemingCode] = useState(false);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handledInviteRef = useRef<string | null>(null);
  const lastNotifCountRef = useRef<number>(0);
  const notifRef = useRef<HTMLDivElement>(null);
  const resultsAnchorRef = useRef<HTMLDivElement>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    window.setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  useEffect(() => {
    if (!showNotifPanel) return;
    const onOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifPanel(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [showNotifPanel]);

  useEffect(() => {
    setLoading(true);
    const unsubGroups = communityService.subscribeGroups(
      (list) => {
        setGroups(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    const unsubMemberships = communityService.subscribeUserMemberships(
      currentUser.id,
      setMemberships
    );
    const unsubInvitations = communityService.subscribeIncomingInvitations(
      currentUser.id,
      setInvitations
    );
    const unsubNotifs = communityService.subscribeUserNotifications(
      currentUser.id,
      (list) => {
        setNotifications(list);
        const unread = list.filter((n) => !n.isRead).length;
        if (unread > lastNotifCountRef.current && lastNotifCountRef.current > 0) {
          const newest = list.find((n) => !n.isRead);
          if (newest) {
            showToast('success', newest.message);
          }
        }
        lastNotifCountRef.current = unread;
      }
    );

    return () => {
      unsubGroups();
      unsubMemberships();
      unsubInvitations();
      unsubNotifs();
    };
  }, [currentUser.id]);

  const selectGroup = (groupId: string | null) => {
    setSelectedGroupId(groupId);
    onGroupChange?.(groupId);
  };

  // Sync deep link groupId if updated externally (URL load, refresh, or browser Back/Forward)
  useEffect(() => {
    setSelectedGroupId(initialGroupId ?? null);
  }, [initialGroupId]);

  // Redeem deep-link invite code automatically once
  useEffect(() => {
    if (!initialInviteCode || handledInviteRef.current === initialInviteCode) return;
    handledInviteRef.current = initialInviteCode;
    (async () => {
      try {
        const joinedGroup = await communityService.redeemInviteCode(
          initialInviteCode,
          currentUser
        );
        if (joinedGroup) {
          selectGroup(joinedGroup.id);
          showToast('success', `Invitation acceptée : bienvenue dans « ${joinedGroup.name} » !`);
        }
      } catch (err: any) {
        showToast('error', err?.message || "Code d'invitation invalide ou expiré.");
      } finally {
        onClearDeepLink?.();
      }
    })();
  }, [initialInviteCode, currentUser, onClearDeepLink]);

  const membershipByGroupId = useMemo(() => {
    const map = new Map<string, CommunityMember>();
    memberships.forEach((m) => map.set(m.groupId, m));
    return map;
  }, [memberships]);

  const pendingInvitations = useMemo(
    () => invitations.filter((inv) => inv.status === 'pending'),
    [invitations]
  );

  const unreadNotifCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    groups.forEach((g) => {
      counts[g.category] = (counts[g.category] || 0) + 1;
    });
    return counts;
  }, [groups]);

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return groups.filter((g) => {
      if (selectedCategory !== 'Toutes' && g.category !== selectedCategory) return false;
      if (privacyFilter !== 'all' && g.privacy !== privacyFilter) return false;
      if (q) {
        const hay = `${g.name} ${g.description} ${g.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [groups, searchQuery, selectedCategory, privacyFilter]);

  const myCommunities = useMemo(
    () =>
      filteredGroups.filter((g) => {
        const m = membershipByGroupId.get(g.id);
        return Boolean(m && (m.status === 'active' || m.status === 'pending'));
      }),
    [filteredGroups, membershipByGroupId]
  );

  const unjoinedCommunities = useMemo(
    () =>
      filteredGroups.filter((g) => {
        const m = membershipByGroupId.get(g.id);
        return !m;
      }),
    [filteredGroups, membershipByGroupId]
  );

  const popularCommunities = useMemo(() => {
    return [...filteredGroups]
      .sort((a, b) => b.memberCount * 2 + b.postCount - (a.memberCount * 2 + a.postCount))
      .slice(0, 6);
  }, [filteredGroups]);

  const recommendedCommunities = useMemo(() => {
    const joinedCategories = new Set(
      groups
        .filter((g) => membershipByGroupId.get(g.id)?.status === 'active')
        .map((g) => g.category)
    );
    return [...unjoinedCommunities]
      .sort((a, b) => {
        const aAffinity =
          (joinedCategories.has(a.category) ? 10 : 0) +
          (currentUser.role === 'verifie' && a.category.toLowerCase().includes('sant') ? 5 : 0);
        const bAffinity =
          (joinedCategories.has(b.category) ? 10 : 0) +
          (currentUser.role === 'verifie' && b.category.toLowerCase().includes('sant') ? 5 : 0);
        if (bAffinity !== aAffinity) return bAffinity - aAffinity;
        return b.memberCount + b.postCount - (a.memberCount + a.postCount);
      })
      .slice(0, 6);
  }, [unjoinedCommunities, groups, membershipByGroupId, currentUser.role]);

  const handleQuickJoin = async (group: CommunityGroup) => {
    try {
      setBusyActionId(group.id);
      const res = await communityService.joinGroup(group, currentUser);
      if (res.status === 'pending') {
        showToast('success', `Demande envoyée pour « ${group.name} ».`);
      } else {
        showToast('success', `Vous avez rejoint la communauté « ${group.name} ».`);
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Impossible de rejoindre cette communauté.');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleAcceptInvitation = async (inv: GroupInvitation) => {
    try {
      setBusyActionId(inv.id);
      await communityService.acceptInvitation(inv, currentUser);
      showToast('success', `Vous avez rejoint « ${inv.groupName} ».`);
      selectGroup(inv.groupId);
    } catch (err: any) {
      showToast('error', err?.message || "Impossible d'accepter l'invitation.");
    } finally {
      setBusyActionId(null);
    }
  };

  const handleDeclineInvitation = async (inv: GroupInvitation) => {
    try {
      setBusyActionId(inv.id);
      await communityService.declineInvitation(inv.id);
      showToast('success', 'Invitation refusée.');
    } catch (err: any) {
      showToast('error', err?.message || "Impossible de refuser l'invitation.");
    } finally {
      setBusyActionId(null);
    }
  };

  const handleRedeemCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCodeInput.trim()) return;
    try {
      setRedeemingCode(true);
      const joined = await communityService.redeemInviteCode(inviteCodeInput, currentUser);
      setInviteCodeInput('');
      setShowInviteCodeBox(false);
      if (joined) {
        showToast('success', `Bienvenue dans la communauté « ${joined.name} » !`);
        selectGroup(joined.id);
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Code introuvable.');
    } finally {
      setRedeemingCode(false);
    }
  };

  const handleSelectCategory = (cat: string) => {
    setSelectedCategory(cat);
    if (cat !== 'Toutes' && resultsAnchorRef.current) {
      resultsAnchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const selectedGroup = useMemo(
    () => (selectedGroupId ? groups.find((g) => g.id === selectedGroupId) || null : null),
    [groups, selectedGroupId]
  );

  // Render Interior Community Page when selected
  if (selectedGroup) {
    return (
      <CommunityGroupPage
        group={selectedGroup}
        currentUser={currentUser}
        allUsers={allUsers}
        currentMember={membershipByGroupId.get(selectedGroup.id)}
        onOpenUserProfile={onOpenUserProfile}
        onBack={() => {
          selectGroup(null);
          onClearDeepLink?.();
        }}
        onGroupDeleted={() => {
          selectGroup(null);
          onClearDeepLink?.();
          showToast('success', 'La communauté a été supprimée.');
        }}
      />
    );
  }

  const renderGroupCard = (group: CommunityGroup, index = 0) => {
    const member = membershipByGroupId.get(group.id);
    const isActive = member?.status === 'active';
    const isPending = member?.status === 'pending';
    const isSuspended = member?.status === 'suspended';
    const cover = group.coverPhoto || getDefaultCoverByCategory(group.category);
    const avatar = group.avatarPhoto || getDefaultAvatar();
    const roleLabel = member ? getMemberRoleLabel(member, group.createdBy) : null;

    return (
      <motion.article
        key={group.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.18), ease: [0.16, 1, 0.3, 1] }}
        className={`${ZAURE_SURFACES.cardInteractive} overflow-hidden flex flex-col justify-between group`}
      >
        <div>
          {/* Cover Photo */}
          <div
            onClick={() => selectGroup(group.id)}
            className="relative h-32 sm:h-36 bg-slate-100 dark:bg-slate-800 cursor-pointer overflow-hidden"
          >
            <img
              src={cover}
              alt={group.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 zaure-grad-scrim" />

            {/* Top-right privacy indicator */}
            <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-xl bg-slate-950/75 backdrop-blur-md text-white text-[11px] font-semibold flex items-center gap-1.5 border border-white/15">
              {group.privacy === 'private' ? (
                <>
                  <Lock className="w-3 h-3 text-amber-400" />
                  <span>Privée</span>
                </>
              ) : (
                <>
                  <Globe className="w-3 h-3 text-emerald-400" />
                  <span>Publique</span>
                </>
              )}
            </div>
          </div>

          {/* Avatar + Identity */}
          <div className="px-4 pb-3.5">
            <div className="flex items-end justify-between gap-2 -mt-7 relative z-10 mb-2.5">
              <img
                src={avatar}
                alt={group.name}
                referrerPolicy="no-referrer"
                onClick={() => selectGroup(group.id)}
                className="w-14 h-14 rounded-2xl object-cover ring-4 ring-white dark:ring-slate-900 shadow-sm bg-white dark:bg-slate-800 cursor-pointer"
              />

              {isActive && roleLabel && (
                <span
                  className={`text-[11px] font-bold ${
                    roleLabel === 'Créateur'
                      ? 'text-indigo-700 dark:text-indigo-400'
                      : roleLabel === 'Administrateur'
                        ? 'text-blue-700 dark:text-blue-400'
                        : roleLabel === 'Modérateur'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {roleLabel}
                </span>
              )}
              {isPending && (
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                  Demande en attente
                </span>
              )}
              {isSuspended && (
                <span className="text-[11px] font-bold text-red-600 dark:text-red-400">
                  Accès suspendu
                </span>
              )}
            </div>

            {/* Zero-pill unboxed metadata */}
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
              <span className="text-blue-700 dark:text-blue-400 font-semibold truncate">{group.category}</span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
              <span className="tabular-nums shrink-0">
                {group.memberCount} {group.memberCount > 1 ? 'membres' : 'membre'}
              </span>
            </div>

            <h3
              onClick={() => selectGroup(group.id)}
              className="text-[15px] font-extrabold text-slate-950 dark:text-white mt-1 truncate cursor-pointer hover:text-blue-700 dark:hover:text-blue-400 transition-colors"
            >
              {group.name}
            </h3>

            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2 min-h-[2.25rem] leading-relaxed">
              {group.description || 'Espace communautaire Zaure dédié au partage et à l’entraide.'}
            </p>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="px-4 pb-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
            <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>
              {group.postCount} {group.postCount > 1 ? 'publications' : 'publication'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isActive || isPending || isSuspended ? (
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => selectGroup(group.id)}
                className="min-h-[40px] px-4 py-2 bg-slate-950 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-950 text-xs font-bold rounded-xl transition whitespace-nowrap"
              >
                Voir la communauté
              </motion.button>
            ) : (
              <>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => selectGroup(group.id)}
                  className="min-h-[40px] px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition whitespace-nowrap"
                >
                  Voir
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  disabled={busyActionId === group.id}
                  onClick={() => handleQuickJoin(group)}
                  className={`min-h-[40px] px-4 py-2 ${ZAURE_SURFACES.gradientButton} text-xs disabled:opacity-50 whitespace-nowrap`}
                >
                  {busyActionId === group.id
                    ? 'Envoi...'
                    : group.privacy === 'private' || group.requireMemberApproval
                      ? 'Demander'
                      : 'Rejoindre'}
                </motion.button>
              </>
            )}
          </div>
        </div>
      </motion.article>
    );
  };

  return (
    <div className="space-y-5 pb-6">
      {/* ============================================================ */}
      {/* 1. EN-TÊTE « COMMUNAUTÉS », RECHERCHE & CRÉATION             */}
      {/* ============================================================ */}
      <section className="space-y-3.5">
        <div className={ZAURE_SURFACES.sectionHeroBanner}>
          <ZaureGeometricBackdrop variant="hero" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/15 backdrop-blur-xs border border-white/25 text-white flex items-center justify-center shrink-0 zaure-shadow-xs">
                <UsersRound className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight truncate">
                  Communautés
                </h1>
                <p className="text-xs sm:text-sm text-blue-50/95 font-medium mt-0.5">
                  {groups.length} {groups.length > 1 ? 'communautés actives' : 'communauté active'} ·{' '}
                  {memberships.filter((m) => m.status === 'active').length} rejointe(s)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
              {/* Code d'invitation toggle */}
              <button
                type="button"
                onClick={() => setShowInviteCodeBox((v) => !v)}
                className={`min-h-[42px] px-3 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap border ${
                  showInviteCodeBox
                    ? 'bg-slate-950/70 border-white/40 text-white'
                    : 'bg-white/15 hover:bg-white/25 border-white/25 text-white backdrop-blur-xs'
                }`}
                title="Utiliser un code d'invitation"
              >
                <KeyRound className="w-4 h-4" />
                <span>Code</span>
              </button>

              {/* Notifications Bell */}
              <div ref={notifRef} className="relative">
                <button
                  type="button"
                  onClick={() => setShowNotifPanel((v) => !v)}
                  className="min-h-[42px] px-3 py-2 bg-white/15 hover:bg-white/25 border border-white/25 text-white backdrop-blur-xs rounded-full flex items-center gap-1.5 text-xs font-bold relative transition whitespace-nowrap"
                  title="Notifications des communautés"
                >
                  <Bell className="w-4 h-4" />
                  <span className="hidden sm:inline">Alertes</span>
                  {unreadNotifCount > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center tabular-nums">
                      {unreadNotifCount}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {showNotifPanel && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className={`absolute right-0 mt-2 w-80 sm:w-96 p-4 z-40 space-y-3 origin-top-right ${ZAURE_SURFACES.popoverMenu}`}
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                        <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                          Notifications communautaires
                        </p>
                        <div className="flex items-center gap-2">
                          {unreadNotifCount > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                communityService.markAllNotificationsRead(
                                  notifications.filter((n) => !n.isRead).map((n) => n.id)
                                )
                              }
                              className="text-[11px] font-bold text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1"
                            >
                              <CheckCheck className="w-3.5 h-3.5" />
                              <span>Tout lire</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowNotifPanel(false)}
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="max-h-72 overflow-y-auto space-y-1.5">
                        {notifications.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-6">
                            Aucune notification pour le moment.
                          </p>
                        ) : (
                          notifications.slice(0, 20).map((n) => (
                            <button
                              key={n.id}
                              type="button"
                              onClick={() => {
                                if (!n.isRead) communityService.markNotificationRead(n.id);
                                setShowNotifPanel(false);
                                selectGroup(n.groupId);
                              }}
                              className={`w-full text-left p-2.5 rounded-2xl transition flex items-start gap-2.5 ${
                                n.isRead ? 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800' : 'bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-50'
                              }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                  n.isRead ? 'bg-slate-300 dark:bg-slate-600' : 'bg-blue-600'
                                }`}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                                  {n.message}
                                </p>
                                <p className="text-[11px] text-slate-400 mt-1">
                                  {n.groupName} · {formatRelative(n.createdAt)}
                                </p>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Primary CTA: Créer une communauté */}
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowCreateModal(true)}
                className="min-h-[42px] px-4 py-2 bg-white hover:bg-blue-50 text-[#1D4ED8] text-xs font-bold rounded-full flex items-center gap-1.5 shadow-md transition whitespace-nowrap flex-1 sm:flex-initial justify-center"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Créer une communauté</span>
              </motion.button>
            </div>
          </div>
        </div>

        {/* Search & Privacy Segmented Filter */}
        <div className={`${ZAURE_SURFACES.card} p-3.5 sm:p-4 space-y-3`}>
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher une communauté par nom, sujet ou description..."
                className="w-full min-h-[42px] bg-[#F3F6FB] dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-xs sm:text-sm pl-10 pr-9 py-2 rounded-full border border-slate-200/80 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-slate-100 focus:outline-none transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1"
                  aria-label="Effacer la recherche"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div
              className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-full shrink-0"
              role="group"
              aria-label="Filtrer par confidentialité"
            >
              {(
                [
                  { id: 'all', label: 'Toutes' },
                  { id: 'public', label: 'Publiques' },
                  { id: 'private', label: 'Privées' }
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPrivacyFilter(opt.id)}
                  className={`min-h-[34px] px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap flex-1 md:flex-initial ${
                    privacyFilter === opt.id
                      ? `zaure-grad-primary text-white ${ZAURE_GLOWS.blue}`
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Collapsible Invite Code Redemption */}
          <AnimatePresence>
            {showInviteCodeBox && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleRedeemCodeSubmit}
                className="overflow-hidden"
              >
                <div className="pt-1 flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={inviteCodeInput}
                      onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                      placeholder="Saisissez un code d'invitation (ex : A7K2M9)..."
                      className="w-full min-h-[42px] bg-[#F3F6FB] dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-xs font-mono pl-10 pr-3 py-2 rounded-full border border-slate-200 dark:border-slate-700 focus:border-blue-500 text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={redeemingCode || !inviteCodeInput.trim()}
                    className={`min-h-[42px] px-5 ${ZAURE_SURFACES.primaryButton} text-xs disabled:opacity-40 shrink-0`}
                  >
                    {redeemingCode ? 'Vérification...' : 'Rejoindre avec le code'}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {toast && (
            <div
              className={`px-4 py-2.5 rounded-2xl text-xs font-semibold flex items-center justify-between gap-2 ${
                toast.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-200 border border-red-200 dark:border-red-800'
              }`}
            >
              <span>{toast.text}</span>
              <button type="button" onClick={() => setToast(null)} className="p-1">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ============================================================ */}
      {/* 2. INVITATIONS EN ATTENTE (SI PRÉSENTES)                     */}
      {/* ============================================================ */}
      {pendingInvitations.length > 0 && (
        <section className={`${ZAURE_SURFACES.card} border-blue-200/80 dark:border-blue-900/60 p-4 sm:p-5 space-y-3`}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-950 dark:text-white flex items-center gap-2">
              <span className={`w-7 h-7 rounded-xl ${ZAURE_ICON_CHIPS.blue} flex items-center justify-center`}>
                <MailCheck className="w-4 h-4" />
              </span>
              <span>Invitations en attente ({pendingInvitations.length})</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingInvitations.map((inv) => (
              <div
                key={inv.id}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={inv.groupAvatar || getDefaultAvatar()}
                    alt={inv.groupName}
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 rounded-2xl object-cover shrink-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                      {inv.groupName}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      Par {inv.inviterName} · {inv.groupPrivacy === 'private' ? 'Privée' : 'Publique'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={busyActionId === inv.id}
                    onClick={() => handleAcceptInvitation(inv)}
                    className={`min-h-[38px] px-3 py-1.5 ${ZAURE_SURFACES.gradientButton} text-xs`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Accepter</span>
                  </button>
                  <button
                    type="button"
                    disabled={busyActionId === inv.id}
                    onClick={() => handleDeclineInvitation(inv)}
                    className="min-h-[38px] px-2.5 py-1.5 bg-white dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl transition"
                    title="Refuser"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ============================================================ */}
      {/* 3. DÉCOUVERTE PAR CATÉGORIES                                 */}
      {/* ============================================================ */}
      <section className={`${ZAURE_SURFACES.card} p-4 sm:p-5 space-y-3`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`w-7 h-7 rounded-xl ${ZAURE_ICON_CHIPS.blue} flex items-center justify-center`}>
              <Compass className="w-4 h-4" />
            </span>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-950 dark:text-white">
              Découvrir par catégories
            </h2>
          </div>

          {selectedCategory !== 'Toutes' && (
            <button
              type="button"
              onClick={() => setSelectedCategory('Toutes')}
              className="text-xs font-bold text-blue-700 dark:text-blue-400 hover:underline whitespace-nowrap"
            >
              Tout afficher ({groups.length})
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => handleSelectCategory('Toutes')}
            className={`min-h-[56px] p-2.5 rounded-2xl border text-left transition flex items-center gap-2.5 ${
              selectedCategory === 'Toutes'
                ? `border-blue-500 bg-blue-50/80 dark:bg-blue-950/50 text-blue-950 dark:text-white ${ZAURE_GLOWS.soft}`
                : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/50 hover:bg-blue-50/40 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
            }`}
          >
            <div className="w-9 h-9 rounded-xl zaure-grad-primary text-white flex items-center justify-center shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold truncate">Toutes</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">{groups.length} au total</p>
            </div>
          </button>

          {COMMUNITY_CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat] || { icon: Compass, tone: ZAURE_ICON_CHIPS.blue };
            const CatIcon = meta.icon;
            const count = categoryCounts[cat] || 0;
            const isSelected = selectedCategory === cat;

            return (
              <button
                key={cat}
                type="button"
                onClick={() => handleSelectCategory(cat)}
                className={`min-h-[56px] p-2.5 rounded-2xl border text-left transition flex items-center gap-2.5 ${
                  isSelected
                    ? `border-blue-500 bg-blue-50/80 dark:bg-blue-950/50 text-blue-950 dark:text-white ${ZAURE_GLOWS.soft}`
                    : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/50 hover:bg-blue-50/40 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl ${meta.tone} flex items-center justify-center shrink-0`}>
                  <CatIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{cat}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {count} {count > 1 ? 'cercles' : 'cercle'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div ref={resultsAnchorRef} />

      {/* ============================================================ */}
      {/* 4. CONTENU PRINCIPAL : MES COMMUNAUTÉS, POPULAIRES, RECOMMANDÉES */}
      {/* ============================================================ */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="zaure-card rounded-3xl h-72 zaure-animate-shimmer"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* A. COMMUNAUTÉS AUXQUELLES L'UTILISATEUR APPARTIENT */}
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-lg ${ZAURE_ICON_CHIPS.blue} flex items-center justify-center`}>
                  <Users className="w-3.5 h-3.5" />
                </span>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-950 dark:text-white">
                  Mes communautés
                </h2>
                <span className="text-xs font-semibold text-slate-400 tabular-nums">
                  ({myCommunities.length})
                </span>
              </div>
            </div>

            {myCommunities.length === 0 ? (
              <div className={`${ZAURE_SURFACES.card} p-6 text-center`}>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                  Vous n'êtes encore membre d'aucune communauté correspondant aux filtres actifs.
                </p>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className={`mt-3 min-h-[42px] px-5 py-2 ${ZAURE_SURFACES.gradientButton} text-xs`}
                >
                  <Plus className="w-4 h-4" />
                  <span>Créer une communauté</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myCommunities.map((g, i) => renderGroupCard(g, i))}
              </div>
            )}
          </section>

          {/* B. COMMUNAUTÉS POPULAIRES */}
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-lg ${ZAURE_ICON_CHIPS.rose} flex items-center justify-center`}>
                  <Flame className="w-3.5 h-3.5" />
                </span>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-950 dark:text-white">
                  Communautés populaires
                </h2>
              </div>
              <span className="text-[11px] font-medium text-slate-400">
                Les plus actives sur Zaure
              </span>
            </div>

            {popularCommunities.length === 0 ? (
              <div className={`${ZAURE_SURFACES.card} p-5 text-xs text-slate-500 dark:text-slate-400`}>
                Aucune communauté populaire ne correspond à votre recherche.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {popularCommunities.map((g, i) => renderGroupCard(g, i))}
              </div>
            )}
          </section>

          {/* C. COMMUNAUTÉS RECOMMANDÉES */}
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-lg ${ZAURE_ICON_CHIPS.amber} flex items-center justify-center`}>
                  <Sparkles className="w-3.5 h-3.5" />
                </span>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-950 dark:text-white">
                  Communautés recommandées pour vous
                </h2>
              </div>
            </div>

            {recommendedCommunities.length === 0 ? (
              <div className={`${ZAURE_SURFACES.card} p-5 text-xs text-slate-500 dark:text-slate-400`}>
                Vous faites déjà partie de toutes les communautés disponibles dans cette sélection.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recommendedCommunities.map((g, i) => renderGroupCard(g, i))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Create Community Modal */}
      {showCreateModal && (
        <CreateCommunityModal
          currentUser={currentUser}
          onClose={() => setShowCreateModal(false)}
          onCreated={(created) => {
            setShowCreateModal(false);
            selectGroup(created.id);
            showToast('success', `Communauté « ${created.name} » créée !`);
          }}
        />
      )}
    </div>
  );
}
