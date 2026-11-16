import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Compass,
  Flame,
  Globe,
  KeyRound,
  Lock,
  MailCheck,
  Plus,
  Search,
  Sparkles,
  Users,
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
}

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

export default function CommunitiesHub({
  currentUser,
  allUsers,
  initialGroupId,
  initialInviteCode,
  onClearDeepLink
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

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    window.setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

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

  // 5 Required Sections
  const myCircles = useMemo(
    () =>
      filteredGroups.filter((g) => {
        const m = membershipByGroupId.get(g.id);
        return Boolean(m && (m.status === 'active' || m.status === 'pending'));
      }),
    [filteredGroups, membershipByGroupId]
  );

  const unjoinedCircles = useMemo(
    () =>
      filteredGroups.filter((g) => {
        const m = membershipByGroupId.get(g.id);
        return !m;
      }),
    [filteredGroups, membershipByGroupId]
  );

  const recommendedCircles = useMemo(() => {
    const joinedCategories = new Set(
      groups
        .filter((g) => membershipByGroupId.get(g.id)?.status === 'active')
        .map((g) => g.category)
    );
    return [...unjoinedCircles]
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
  }, [unjoinedCircles, groups, membershipByGroupId, currentUser.role]);

  const popularCircles = useMemo(
    () =>
      [...filteredGroups]
        .sort((a, b) => b.memberCount + b.postCount - (a.memberCount + a.postCount))
        .slice(0, 6),
    [filteredGroups]
  );

  const newCircles = useMemo(
    () =>
      [...filteredGroups]
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
        .slice(0, 6),
    [filteredGroups]
  );

  const handleQuickJoin = async (group: CommunityGroup) => {
    try {
      setBusyActionId(group.id);
      const res = await communityService.joinGroup(group, currentUser);
      if (res.status === 'pending') {
        showToast('success', `Demande envoyée pour « ${group.name} ».`);
      } else {
        showToast('success', `Vous avez rejoint le cercle « ${group.name} ».`);
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Impossible de rejoindre ce cercle.');
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
      if (joined) {
        showToast('success', `Bienvenue dans le cercle « ${joined.name} » !`);
        setSelectedGroupId(joined.id);
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Code introuvable.');
    } finally {
      setRedeemingCode(false);
    }
  };

  const selectedGroup = useMemo(
    () => (selectedGroupId ? groups.find((g) => g.id === selectedGroupId) || null : null),
    [groups, selectedGroupId]
  );

  // Render Interior Circle Page when a circle is selected
  if (selectedGroup) {
    return (
      <CommunityGroupPage
        group={selectedGroup}
        currentUser={currentUser}
        allUsers={allUsers}
        currentMember={membershipByGroupId.get(selectedGroup.id)}
        onBack={() => {
          setSelectedGroupId(null);
          onClearDeepLink?.();
        }}
        onGroupDeleted={() => {
          setSelectedGroupId(null);
          onClearDeepLink?.();
          showToast('success', 'Le cercle a été supprimé.');
        }}
      />
    );
  }

  const renderGroupCard = (group: CommunityGroup) => {
    const member = membershipByGroupId.get(group.id);
    const isActive = member?.status === 'active';
    const isPending = member?.status === 'pending';
    const cover = group.coverPhoto || getDefaultCoverByCategory(group.category);
    const avatar = group.avatarPhoto || getDefaultAvatar();

    return (
      <article
        key={group.id}
        className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
      >
        <div>
          {/* Cover Photo */}
          <div
            onClick={() => setSelectedGroupId(group.id)}
            className="relative h-28 bg-slate-200 cursor-pointer overflow-hidden group"
          >
            <img
              src={cover}
              alt={group.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/55 via-transparent to-transparent" />
            <span className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-xl bg-slate-950/75 backdrop-blur-md text-white text-[10px] font-bold flex items-center gap-1">
              {group.privacy === 'private' ? (
                <>
                  <Lock className="w-3 h-3 text-amber-400" />
                  <span>Privé</span>
                </>
              ) : (
                <>
                  <Globe className="w-3 h-3 text-emerald-400" />
                  <span>Public</span>
                </>
              )}
            </span>
          </div>

          {/* Avatar + Meta */}
          <div className="px-4 pb-3">
            <div className="flex items-end justify-between gap-2 -mt-7 relative z-10 mb-2">
              <img
                src={avatar}
                alt={group.name}
                onClick={() => setSelectedGroupId(group.id)}
                className="w-14 h-14 rounded-2xl object-cover ring-4 ring-white shadow-sm bg-white cursor-pointer"
              />
              {isActive && member && (
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 capitalize">
                  {member.role}
                </span>
              )}
              {isPending && (
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800">
                  En attente
                </span>
              )}
            </div>

            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
              {group.category}
            </span>
            <h3
              onClick={() => setSelectedGroupId(group.id)}
              className="text-sm font-extrabold text-slate-900 mt-0.5 truncate cursor-pointer hover:text-blue-700 transition-colors"
            >
              {group.name}
            </h3>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2 min-h-[2rem] leading-relaxed">
              {group.description || 'Cercle communautaire Zaure.'}
            </p>
          </div>
        </div>

        {/* Footer stats + CTA */}
        <div className="px-4 pb-4 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 tabular-nums">
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <span>{group.memberCount} membre(s)</span>
          </div>

          <div className="flex items-center gap-1.5">
            {isActive ? (
              <button
                type="button"
                onClick={() => setSelectedGroupId(group.id)}
                className="min-h-[36px] px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition"
              >
                Consulter
              </button>
            ) : isPending ? (
              <button
                type="button"
                onClick={() => setSelectedGroupId(group.id)}
                className="min-h-[36px] px-3 py-1.5 bg-amber-50 text-amber-800 text-xs font-bold rounded-xl transition"
              >
                Consulter
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedGroupId(group.id)}
                  className="min-h-[36px] px-2.5 py-1.5 bg-[#F0F2F5] hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  Consulter
                </button>
                <button
                  type="button"
                  disabled={busyActionId === group.id}
                  onClick={() => handleQuickJoin(group)}
                  className="min-h-[36px] px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition disabled:opacity-50"
                >
                  {busyActionId === group.id
                    ? '...'
                    : group.privacy === 'private' || group.requireMemberApproval
                      ? 'Demander'
                      : 'Rejoindre'}
                </button>
              </>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* ============================================================ */}
      {/* TOP HUB HEADER : TITRE « COMMUNAUTÉS », NOTIFS, CRÉER        */}
      {/* ============================================================ */}
      <section className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-slate-950 tracking-tight">
                Communautés
              </h1>
              <p className="text-xs text-slate-500">
                Découvrez, créez et animez vos cercles communautaires sur Zaure
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Notifications Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifPanel((v) => !v)}
                className="min-h-[42px] px-3 py-2 bg-[#F0F2F5] hover:bg-slate-200/80 text-slate-800 rounded-xl flex items-center gap-1.5 text-xs font-bold relative transition"
                title="Notifications des cercles"
              >
                <Bell className="w-4 h-4 text-blue-600" />
                <span className="hidden sm:inline">Notifications</span>
                {unreadNotifCount > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center tabular-nums">
                    {unreadNotifCount}
                  </span>
                )}
              </button>

              {showNotifPanel && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-3xl shadow-xl p-4 z-40 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <p className="text-xs font-extrabold text-slate-900">
                      Notifications des cercles
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

                  <div className="max-h-72 overflow-y-auto space-y-2">
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
                            <p className="text-[10px] text-slate-400 mt-1">
                              {n.groupName} · {formatRelative(n.createdAt)}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Primary Create Circle CTA */}
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="min-h-[42px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Créer un cercle</span>
            </button>
          </div>
        </div>

        {/* Search + Privacy Filter + Redeem Invite Code */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
          <div className="lg:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un cercle par nom, thème ou description..."
              className="w-full min-h-[42px] bg-[#F0F2F5] focus:bg-white text-xs pl-10 pr-8 py-2 rounded-2xl border border-transparent focus:border-blue-500 focus:outline-none transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="lg:col-span-2">
            <select
              value={privacyFilter}
              onChange={(e) =>
                setPrivacyFilter(e.target.value as 'all' | 'public' | 'private')
              }
              className="w-full min-h-[42px] bg-[#F0F2F5] text-xs font-bold text-slate-700 px-3 py-2 rounded-2xl focus:outline-none"
              aria-label="Filtrer par confidentialité"
            >
              <option value="all">Tous (Public & Privé)</option>
              <option value="public">Cercles publics</option>
              <option value="private">Cercles privés</option>
            </select>
          </div>

          <form onSubmit={handleRedeemCodeSubmit} className="lg:col-span-4 flex gap-2">
            <div className="relative flex-1">
              <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={inviteCodeInput}
                onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                placeholder="Code d'invitation..."
                className="w-full min-h-[42px] bg-[#F0F2F5] focus:bg-white text-xs font-mono pl-8 pr-3 py-2 rounded-2xl border border-transparent focus:border-blue-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={redeemingCode || !inviteCodeInput.trim()}
              className="min-h-[42px] px-3.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-2xl disabled:opacity-40 transition shrink-0"
            >
              {redeemingCode ? '...' : 'Valider'}
            </button>
          </form>
        </div>

        {/* Category Filter Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {['Toutes', ...COMMUNITY_CATEGORIES].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-bold shrink-0 transition ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-[#F0F2F5] text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {toast && (
          <div
            className={`px-4 py-2.5 rounded-2xl text-xs font-semibold flex items-center justify-between gap-2 ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            <span>{toast.text}</span>
            <button type="button" onClick={() => setToast(null)}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </section>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white border border-slate-200/80 rounded-3xl h-64 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* 1. INVITATIONS REÇUES */}
          <section className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <MailCheck className="w-4 h-4 text-blue-600" />
                <span>Invitations reçues ({pendingInvitations.length})</span>
              </h2>
            </div>

            {pendingInvitations.length === 0 ? (
              <p className="text-xs text-slate-400">
                Aucune invitation en attente. Utilisez un code d'invitation ci-dessus si un membre vous a partagé un lien privé.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingInvitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-3.5 rounded-2xl bg-[#F0F2F5] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={inv.groupAvatar || getDefaultAvatar()}
                        alt={inv.groupName}
                        className="w-11 h-11 rounded-2xl object-cover shrink-0 bg-white"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-slate-900 truncate">
                          {inv.groupName}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          Invité(e) par {inv.inviterName} ·{' '}
                          {inv.groupPrivacy === 'private' ? 'Privé' : 'Public'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={busyActionId === inv.id}
                        onClick={() => handleAcceptInvitation(inv)}
                        className="min-h-[36px] px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Accepter</span>
                      </button>
                      <button
                        type="button"
                        disabled={busyActionId === inv.id}
                        onClick={() => handleDeclineInvitation(inv)}
                        className="min-h-[36px] px-2.5 py-1.5 bg-white hover:bg-red-50 text-red-600 border border-slate-200 text-xs font-bold rounded-xl"
                        title="Refuser"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 2. MES CERCLES */}
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Mes cercles ({myCircles.length})</span>
              </h2>
            </div>

            {myCircles.length === 0 ? (
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 text-center shadow-xs">
                <p className="text-xs text-slate-500">
                  Vous n'avez encore rejoint aucun cercle correspondant à ces filtres.
                </p>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="mt-3 min-h-[38px] px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Créer mon premier cercle</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myCircles.map(renderGroupCard)}
              </div>
            )}
          </section>

          {/* 3. CERCLES RECOMMANDÉS */}
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Cercles recommandés</span>
              </h2>
            </div>

            {recommendedCircles.length === 0 ? (
              <div className="bg-white border border-slate-200/80 rounded-3xl p-5 text-xs text-slate-500">
                Vous faites déjà partie de tous les cercles disponibles dans cette catégorie, ou aucun nouveau cercle ne correspond à votre recherche.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recommendedCircles.map(renderGroupCard)}
              </div>
            )}
          </section>

          {/* 4. CERCLES POPULAIRES */}
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Flame className="w-4 h-4 text-red-500" />
                <span>Cercles populaires</span>
              </h2>
            </div>

            {popularCircles.length === 0 ? (
              <div className="bg-white border border-slate-200/80 rounded-3xl p-5 text-xs text-slate-500">
                Aucun cercle trouvé.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {popularCircles.map(renderGroupCard)}
              </div>
            )}
          </section>

          {/* 5. NOUVEAUX CERCLES */}
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Compass className="w-4 h-4 text-emerald-600" />
                <span>Nouveaux cercles</span>
              </h2>
            </div>

            {newCircles.length === 0 ? (
              <div className="bg-white border border-slate-200/80 rounded-3xl p-5 text-xs text-slate-500">
                Aucun nouveau cercle pour le moment.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {newCircles.map(renderGroupCard)}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Create Community Circle Modal */}
      {showCreateModal && (
        <CreateCommunityModal
          currentUser={currentUser}
          onClose={() => setShowCreateModal(false)}
          onCreated={(created) => {
            setShowCreateModal(false);
            setSelectedGroupId(created.id);
            showToast('success', `Cercle « ${created.name} » créé !`);
          }}
        />
      )}
    </div>
  );
}
