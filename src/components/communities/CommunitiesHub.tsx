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

interface CommunitiesHubProps {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  initialGroupId?: string | null;
  initialInviteCode?: string | null;
  onClearDeepLink?: () => void;
  onOpenUserProfile?: (userId: string) => void;
}

const CATEGORY_META: Record<string, { icon: React.ElementType; tone: string }> = {
  'Médecine & Santé': { icon: Stethoscope, tone: 'text-rose-600 bg-rose-50' },
  'Sciences & Tech': { icon: Cpu, tone: 'text-blue-600 bg-blue-50' },
  'Langues & Culture': { icon: BookOpen, tone: 'text-amber-600 bg-amber-50' },
  'Éducation & Études': { icon: GraduationCap, tone: 'text-indigo-600 bg-indigo-50' },
  'Agriculture & Écologie': { icon: Sprout, tone: 'text-emerald-600 bg-emerald-50' },
  Entrepreneuriat: { icon: Briefcase, tone: 'text-slate-700 bg-slate-100' },
  'Vie communautaire': { icon: UsersRound, tone: 'text-cyan-600 bg-cyan-50' }
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

  // Sync deep link groupId if updated externally
  useEffect(() => {
    if (initialGroupId) {
      setSelectedGroupId(initialGroupId);
    }
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
          setSelectedGroupId(joinedGroup.id);
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
      setSelectedGroupId(inv.groupId);
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
        setSelectedGroupId(joined.id);
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
          setSelectedGroupId(null);
          onClearDeepLink?.();
        }}
        onGroupDeleted={() => {
          setSelectedGroupId(null);
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
        whileHover={{ y: -2 }}
        className="bg-white border border-slate-200/85 rounded-3xl overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:shadow-[0_12px_28px_-10px_rgba(15,23,42,0.12)] transition-shadow duration-200 flex flex-col justify-between"
      >
        <div>
          {/* Cover Photo */}
          <div
            onClick={() => setSelectedGroupId(group.id)}
            className="relative h-32 sm:h-36 bg-slate-100 cursor-pointer overflow-hidden group"
          >
            <img
              src={cover}
              alt={group.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-slate-950/15 to-transparent" />

            {/* Top-right privacy indicator */}
            <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-xl bg-slate-950/75 backdrop-blur-md text-white text-[11px] font-semibold flex items-center gap-1.5">
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
                onClick={() => setSelectedGroupId(group.id)}
                className="w-14 h-14 rounded-2xl object-cover ring-4 ring-white shadow-sm bg-white cursor-pointer"
              />

              {isActive && roleLabel && (
                <span
                  className={`text-[11px] font-bold ${
                    roleLabel === 'Créateur'
                      ? 'text-indigo-700'
                      : roleLabel === 'Administrateur'
                        ? 'text-blue-700'
                        : roleLabel === 'Modérateur'
                          ? 'text-emerald-700'
                          : 'text-slate-600'
                  }`}
                >
                  {roleLabel}
                </span>
              )}
              {isPending && (
                <span className="text-[11px] font-bold text-amber-700">
                  Demande en attente
                </span>
              )}
              {isSuspended && (
                <span className="text-[11px] font-bold text-red-600">
                  Accès suspendu
                </span>
              )}
            </div>

            {/* Zero-pill unboxed metadata */}
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium truncate">
              <span className="text-blue-700 font-semibold truncate">{group.category}</span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="tabular-nums shrink-0">
                {group.memberCount} {group.memberCount > 1 ? 'membres' : 'membre'}
              </span>
            </div>

            <h3
              onClick={() => setSelectedGroupId(group.id)}
              className="text-[15px] font-extrabold text-slate-950 mt-1 truncate cursor-pointer hover:text-blue-700 transition-colors"
            >
              {group.name}
            </h3>

            <p className="text-xs text-slate-600 mt-1 line-clamp-2 min-h-[2.25rem] leading-relaxed">
              {group.description || 'Espace communautaire Zaure dédié au partage et à l’entraide.'}
            </p>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="px-4 pb-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 tabular-nums">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {group.postCount} {group.postCount > 1 ? 'publications' : 'publication'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isActive || isPending || isSuspended ? (
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => setSelectedGroupId(group.id)}
                className="min-h-[40px] px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition whitespace-nowrap"
              >
                Voir la communauté
              </motion.button>
            ) : (
              <>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setSelectedGroupId(group.id)}
                  className="min-h-[40px] px-3 py-2 bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-bold rounded-xl transition whitespace-nowrap"
                >
                  Voir
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  disabled={busyActionId === group.id}
                  onClick={() => handleQuickJoin(group)}
                  className="min-h-[40px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition disabled:opacity-50 whitespace-nowrap shadow-xs"
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
      <section className="bg-white border border-slate-200/85 rounded-3xl p-4 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-sm shrink-0">
              <UsersRound className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-950 tracking-tight truncate">
                Communautés
              </h1>
              <p className="text-xs sm:text-[13px] text-slate-500 mt-0.5">
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
              className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap ${
                showInviteCodeBox
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
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
                className="min-h-[44px] px-3 py-2 bg-slate-100 hover:bg-slate-200/80 text-slate-800 rounded-xl flex items-center gap-1.5 text-xs font-bold relative transition whitespace-nowrap"
                title="Notifications des communautés"
              >
                <Bell className="w-4 h-4 text-blue-600" />
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
                    className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-3xl shadow-xl p-4 z-40 space-y-3 origin-top-right"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <p className="text-xs font-extrabold text-slate-900">
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
                            className="text-[11px] font-bold text-blue-700 hover:underline flex items-center gap-1"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span>Tout lire</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowNotifPanel(false)}
                          className="p-1 text-slate-400 hover:text-slate-700"
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
                              setSelectedGroupId(n.groupId);
                            }}
                            className={`w-full text-left p-2.5 rounded-2xl transition flex items-start gap-2.5 ${
                              n.isRead ? 'bg-white hover:bg-slate-50' : 'bg-blue-50/80 hover:bg-blue-50'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                n.isRead ? 'bg-slate-300' : 'bg-blue-600'
                              }`}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-slate-800 leading-snug">
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
              className="min-h-[44px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition whitespace-nowrap flex-1 sm:flex-initial justify-center"
            >
              <Plus className="w-4 h-4" />
              <span>Créer une communauté</span>
            </motion.button>
          </div>
        </div>

        {/* Search & Privacy Segmented Filter */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une communauté par nom, sujet ou description..."
              className="w-full min-h-[44px] bg-slate-100/90 focus:bg-white text-xs sm:text-sm pl-10 pr-9 py-2 rounded-2xl border border-transparent focus:border-blue-500 focus:outline-none transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                aria-label="Effacer la recherche"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl shrink-0"
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
                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex-1 md:flex-initial ${
                  privacyFilter === opt.id
                    ? 'bg-white text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
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
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={inviteCodeInput}
                    onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                    placeholder="Saisissez un code d'invitation (ex : A7K2M9)..."
                    className="w-full min-h-[44px] bg-slate-100 focus:bg-white text-xs font-mono pl-10 pr-3 py-2 rounded-2xl border border-transparent focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={redeemingCode || !inviteCodeInput.trim()}
                  className="min-h-[44px] px-5 bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold rounded-2xl disabled:opacity-40 transition shrink-0"
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
      </section>

      {/* ============================================================ */}
      {/* 2. INVITATIONS EN ATTENTE (SI PRÉSENTES)                     */}
      {/* ============================================================ */}
      {pendingInvitations.length > 0 && (
        <section className="bg-white border border-blue-200/80 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-950 flex items-center gap-2">
              <MailCheck className="w-4 h-4 text-blue-600" />
              <span>Invitations en attente ({pendingInvitations.length})</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingInvitations.map((inv) => (
              <div
                key={inv.id}
                className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={inv.groupAvatar || getDefaultAvatar()}
                    alt={inv.groupName}
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 rounded-2xl object-cover shrink-0 bg-white border border-slate-200"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-slate-900 truncate">
                      {inv.groupName}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      Par {inv.inviterName} · {inv.groupPrivacy === 'private' ? 'Privée' : 'Publique'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={busyActionId === inv.id}
                    onClick={() => handleAcceptInvitation(inv)}
                    className="min-h-[38px] px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Accepter</span>
                  </button>
                  <button
                    type="button"
                    disabled={busyActionId === inv.id}
                    onClick={() => handleDeclineInvitation(inv)}
                    className="min-h-[38px] px-2.5 py-1.5 bg-white hover:bg-red-50 text-red-600 border border-slate-200 text-xs font-bold rounded-xl transition"
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
      <section className="bg-white border border-slate-200/85 rounded-3xl p-4 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm sm:text-base font-extrabold text-slate-950">
              Découvrir par catégories
            </h2>
          </div>

          {selectedCategory !== 'Toutes' && (
            <button
              type="button"
              onClick={() => setSelectedCategory('Toutes')}
              className="text-xs font-bold text-blue-700 hover:underline whitespace-nowrap"
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
                ? 'border-blue-600 bg-blue-50/70 text-blue-950 shadow-2xs'
                : 'border-slate-200/80 bg-slate-50/60 hover:bg-slate-100/70 text-slate-800'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold truncate">Toutes</p>
              <p className="text-[11px] text-slate-500 tabular-nums">{groups.length} au total</p>
            </div>
          </button>

          {COMMUNITY_CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat] || { icon: Compass, tone: 'text-slate-600 bg-slate-100' };
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
                    ? 'border-blue-600 bg-blue-50/70 text-blue-950 shadow-2xs'
                    : 'border-slate-200/80 bg-slate-50/60 hover:bg-slate-100/70 text-slate-800'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl ${meta.tone} flex items-center justify-center shrink-0`}>
                  <CatIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{cat}</p>
                  <p className="text-[11px] text-slate-500 tabular-nums">
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
              className="bg-white border border-slate-200/80 rounded-3xl h-72 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* A. COMMUNAUTÉS AUXQUELLES L'UTILISATEUR APPARTIENT */}
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm sm:text-base font-extrabold text-slate-950">
                  Mes communautés
                </h2>
                <span className="text-xs font-semibold text-slate-400 tabular-nums">
                  ({myCommunities.length})
                </span>
              </div>
            </div>

            {myCommunities.length === 0 ? (
              <div className="bg-white border border-slate-200/85 rounded-3xl p-6 text-center shadow-xs">
                <p className="text-xs sm:text-sm text-slate-600">
                  Vous n'êtes encore membre d'aucune communauté correspondant aux filtres actifs.
                </p>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="mt-3 min-h-[42px] px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition"
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
                <Flame className="w-4 h-4 text-red-500" />
                <h2 className="text-sm sm:text-base font-extrabold text-slate-950">
                  Communautés populaires
                </h2>
              </div>
              <span className="text-[11px] font-medium text-slate-400">
                Les plus actives sur Zaure
              </span>
            </div>

            {popularCommunities.length === 0 ? (
              <div className="bg-white border border-slate-200/85 rounded-3xl p-5 text-xs text-slate-500">
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
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm sm:text-base font-extrabold text-slate-950">
                  Communautés recommandées pour vous
                </h2>
              </div>
            </div>

            {recommendedCommunities.length === 0 ? (
              <div className="bg-white border border-slate-200/85 rounded-3xl p-5 text-xs text-slate-500">
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
            setSelectedGroupId(created.id);
            showToast('success', `Communauté « ${created.name} » créée !`);
          }}
        />
      )}
    </div>
  );
}
