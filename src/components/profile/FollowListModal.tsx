import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  Award,
  Check,
  CheckCircle2,
  ChevronDown,
  Lock,
  Search,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import { UserFollow, UserProfile } from '../../types';
import { formatMemberHandle, profileService } from '../../services/profileService';

interface FollowListModalProps {
  isOpen: boolean;
  initialTab: 'followers' | 'following';
  profileUser: UserProfile;
  currentUser: UserProfile;
  followers: UserFollow[];
  following: UserFollow[];
  allUsers: UserProfile[];
  myFollowingIds: string[];
  canViewFollowers: boolean;
  canViewFollowing: boolean;
  privacyReasonFollowers: string;
  privacyReasonFollowing: string;
  onToggleFollow: (targetUserId: string) => Promise<void>;
  onSelectUser: (user: UserProfile) => void;
  onClose: () => void;
}

export default function FollowListModal({
  isOpen,
  initialTab,
  profileUser,
  currentUser,
  followers,
  following,
  allUsers,
  myFollowingIds,
  canViewFollowers,
  canViewFollowing,
  privacyReasonFollowers,
  privacyReasonFollowing,
  onToggleFollow,
  onSelectUser,
  onClose
}: FollowListModalProps) {
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(12);
  const [hydratedUsers, setHydratedUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setSearchQuery('');
      setVisibleCount(12);
    }
  }, [isOpen, initialTab]);

  const canViewActive = activeTab === 'followers' ? canViewFollowers : canViewFollowing;
  const activeFollowIds = useMemo(() => {
    if (!canViewActive) return [];
    return activeTab === 'followers'
      ? followers.map((f) => f.followerId)
      : following.map((f) => f.followingId);
  }, [activeTab, canViewActive, followers, following]);

  useEffect(() => {
    if (!isOpen || !canViewActive) {
      setHydratedUsers([]);
      return;
    }
    let active = true;
    setLoading(true);
    profileService
      .hydrateFollowUsers(activeFollowIds, allUsers)
      .then((list) => {
        if (active) setHydratedUsers(list);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen, canViewActive, activeFollowIds, allUsers]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return hydratedUsers;
    return hydratedUsers.filter((u) => {
      const handle = formatMemberHandle(u).toLowerCase();
      return (
        u.nom.toLowerCase().includes(q) ||
        handle.includes(q) ||
        (u.profession || '').toLowerCase().includes(q)
      );
    });
  }, [hydratedUsers, searchQuery]);

  if (!isOpen) return null;

  const handleToggle = async (uid: string) => {
    setBusyUserId(uid);
    try {
      await onToggleFollow(uid);
    } finally {
      setBusyUserId(null);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col max-h-[86vh] overflow-hidden"
      >
        {/* Header & Tab Switcher */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-100 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-950 truncate">
                Réseau de {profileUser.nom}
              </h3>
              <p className="text-[11px] text-slate-500 truncate">
                {formatMemberHandle(profileUser)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-full hover:bg-slate-100 text-slate-500 flex items-center justify-center transition shrink-0"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setActiveTab('followers');
                setVisibleCount(12);
              }}
              className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'followers'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Abonnés</span>
              <span className="font-mono tabular-nums text-[11px] text-blue-700">
                {followers.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('following');
                setVisibleCount(12);
              }}
              className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'following'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Abonnements</span>
              <span className="font-mono tabular-nums text-[11px] text-blue-700">
                {following.length}
              </span>
            </button>
          </div>

          {canViewActive && (
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom ou @identifiant..."
                className="w-full min-h-[42px] bg-[#F0F2F5] focus:bg-white border border-transparent focus:border-blue-500 rounded-xl pl-9 pr-9 text-xs text-slate-900 focus:outline-none transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
          {!canViewActive ? (
            <div className="py-10 px-4 text-center space-y-2.5">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-900">Liste restreinte</p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                {activeTab === 'followers' ? privacyReasonFollowers : privacyReasonFollowing}
              </p>
            </div>
          ) : loading && hydratedUsers.length === 0 ? (
            <div className="space-y-2.5 py-2">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-50 animate-pulse">
                  <div className="w-11 h-11 rounded-full bg-slate-200 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 bg-slate-200 rounded w-1/3" />
                    <div className="h-2.5 bg-slate-100 rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-10 px-4 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Users className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-900">
                {searchQuery
                  ? 'Aucun membre correspondant'
                  : activeTab === 'followers'
                  ? 'Aucun abonné pour le moment'
                  : 'Aucun abonnement pour le moment'}
              </p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                {searchQuery
                  ? "Essayez un autre nom ou identifiant d'utilisateur."
                  : activeTab === 'followers'
                  ? 'Les personnes qui suivent ce profil apparaîtront ici.'
                  : 'Les membres suivis par ce profil apparaîtront ici.'}
              </p>
            </div>
          ) : (
            <>
              {filteredUsers.slice(0, visibleCount).map((member) => {
                const isMe = member.id === currentUser.id;
                const isFollowingMember = myFollowingIds.includes(member.id);
                const isBusy = busyUserId === member.id;
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-200/80 transition"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onSelectUser(member);
                      }}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left"
                    >
                      {member.avatar_url ? (
                        <img
                          src={member.avatar_url}
                          alt={member.nom}
                          className="w-11 h-11 rounded-full object-cover ring-1 ring-slate-200 shrink-0 bg-slate-100"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
                          {member.nom.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="text-xs sm:text-sm font-bold text-slate-950 truncate">
                            {member.nom}
                          </span>
                          {member.role === 'verifie' && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          )}
                          {member.role === 'mentor' && (
                            <Award className="w-3.5 h-3.5 text-red-600 shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">
                          {formatMemberHandle(member)}
                          {member.profession ? ` · ${member.profession}` : ''}
                        </p>
                      </div>
                    </button>

                    {!isMe && (
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.94 }}
                        disabled={isBusy}
                        onClick={() => handleToggle(member.id)}
                        className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shrink-0 ${
                          isFollowingMember
                            ? 'bg-slate-100 hover:bg-red-50 text-slate-800 hover:text-red-700 border border-slate-200/80'
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                        }`}
                      >
                        {isFollowingMember ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Abonné</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Suivre</span>
                          </>
                        )}
                      </motion.button>
                    )}
                  </div>
                );
              })}

              {filteredUsers.length > visibleCount && (
                <div className="pt-2 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => prev + 12)}
                    className="min-h-[42px] px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
                  >
                    <ChevronDown className="w-4 h-4 text-blue-600" />
                    <span>Afficher plus ({filteredUsers.length - visibleCount} restants)</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
