import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AtSign,
  Bell,
  BellOff,
  BellRing,
  Check,
  CheckCheck,
  ChevronRight,
  ExternalLink,
  Heart,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  ScrollText,
  Settings,
  Share2,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import {
  AppNotificationType,
  UnifiedNotification,
  UserProfile,
  UserSettings
} from '../../types';
import {
  filterNotificationsByTab,
  getPushNotificationPermission,
  groupNotificationsByPeriod,
  isPushNotificationSupported,
  NotificationFilterTab,
  notificationService,
  requestBrowserPushPermission
} from '../../services/notificationService';
import { communityService } from '../../services/communityService';

interface NotificationsCenterProps {
  currentUser: UserProfile;
  notifications: UnifiedNotification[];
  settings: UserSettings;
  onOpenProfile: (userId: string) => void;
  onOpenPost: (postId: string, groupId?: string) => void;
  onOpenCapsule: (capsuleId: string) => void;
  onOpenCommunity: (groupId: string) => void;
  onOpenConversation: (conversationId?: string, actorId?: string) => void;
  onOpenAccountSettings: () => void;
  onBackToFeed?: () => void;
}

const FILTER_TABS: { id: NotificationFilterTab; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'unread', label: 'Non lues' },
  { id: 'mentions', label: 'Mentions' },
  { id: 'interactions', label: 'Interactions' },
  { id: 'communities', label: 'Communautés' },
  { id: 'system', label: 'Système' }
];

function formatNotificationTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    if (diffMins < 1) return `À l'instant · ${timeStr}`;
    if (diffMins < 60) return `Il y a ${diffMins} min · ${timeStr}`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Il y a ${diffHours} h · ${timeStr}`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return `Hier · ${timeStr}`;
    return `${d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    })} · ${timeStr}`;
  } catch {
    return '';
  }
}

function getNotificationIconMeta(type: AppNotificationType): {
  Icon: React.ComponentType<{ className?: string }>;
  badgeBg: string;
  accentBg: string;
  accentText: string;
} {
  switch (type) {
    case 'like':
    case 'reaction':
      return {
        Icon: Heart,
        badgeBg: 'bg-rose-600 text-white',
        accentBg: 'bg-rose-50',
        accentText: 'text-rose-600'
      };
    case 'comment':
    case 'comment_reply':
      return {
        Icon: MessageCircle,
        badgeBg: 'bg-blue-600 text-white',
        accentBg: 'bg-blue-50',
        accentText: 'text-blue-600'
      };
    case 'share':
      return {
        Icon: Share2,
        badgeBg: 'bg-emerald-600 text-white',
        accentBg: 'bg-emerald-50',
        accentText: 'text-emerald-600'
      };
    case 'new_follower':
      return {
        Icon: UserPlus,
        badgeBg: 'bg-indigo-600 text-white',
        accentBg: 'bg-indigo-50',
        accentText: 'text-indigo-600'
      };
    case 'mention':
    case 'group_mention':
      return {
        Icon: AtSign,
        badgeBg: 'bg-amber-600 text-white',
        accentBg: 'bg-amber-50',
        accentText: 'text-amber-700'
      };
    case 'new_message':
      return {
        Icon: MessagesSquare,
        badgeBg: 'bg-blue-600 text-white',
        accentBg: 'bg-blue-50',
        accentText: 'text-blue-600'
      };
    case 'community_invitation':
      return {
        Icon: Users,
        badgeBg: 'bg-blue-700 text-white',
        accentBg: 'bg-blue-50',
        accentText: 'text-blue-700'
      };
    case 'community_approved':
    case 'community_role':
      return {
        Icon: UserCheck,
        badgeBg: 'bg-emerald-600 text-white',
        accentBg: 'bg-emerald-50',
        accentText: 'text-emerald-700'
      };
    case 'community_announcement':
      return {
        Icon: Megaphone,
        badgeBg: 'bg-amber-600 text-white',
        accentBg: 'bg-amber-50',
        accentText: 'text-amber-700'
      };
    case 'community_rules':
      return {
        Icon: ScrollText,
        badgeBg: 'bg-slate-800 text-white',
        accentBg: 'bg-slate-100',
        accentText: 'text-slate-700'
      };
    case 'community_post':
      return {
        Icon: Sparkles,
        badgeBg: 'bg-blue-600 text-white',
        accentBg: 'bg-blue-50',
        accentText: 'text-blue-600'
      };
    case 'security_alert':
      return {
        Icon: ShieldAlert,
        badgeBg: 'bg-red-600 text-white',
        accentBg: 'bg-red-50',
        accentText: 'text-red-600'
      };
    case 'system':
    default:
      return {
        Icon: BellRing,
        badgeBg: 'bg-slate-900 text-white',
        accentBg: 'bg-slate-100',
        accentText: 'text-slate-700'
      };
  }
}

export default function NotificationsCenter({
  currentUser,
  notifications,
  settings,
  onOpenProfile,
  onOpenPost,
  onOpenCapsule,
  onOpenCommunity,
  onOpenConversation,
  onOpenAccountSettings
}: NotificationsCenterProps) {
  const [activeFilter, setActiveFilter] = useState<NotificationFilterTab>('all');
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [invitationFeedback, setInvitationFeedback] = useState<Record<string, 'accepted' | 'declined'>>({});
  const [busyInvitationId, setBusyInvitationId] = useState<string | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);

  const pushSupported = isPushNotificationSupported();
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    getPushNotificationPermission()
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const tabCounts = useMemo(() => {
    return {
      all: notifications.length,
      unread: unreadCount,
      mentions: filterNotificationsByTab(notifications, 'mentions').filter((n) => !n.isRead).length,
      interactions: filterNotificationsByTab(notifications, 'interactions').filter((n) => !n.isRead).length,
      communities: filterNotificationsByTab(notifications, 'communities').filter((n) => !n.isRead).length,
      system: filterNotificationsByTab(notifications, 'system').filter((n) => !n.isRead).length
    };
  }, [notifications, unreadCount]);

  const filteredNotifications = useMemo(
    () => filterNotificationsByTab(notifications, activeFilter),
    [notifications, activeFilter]
  );

  const groupedBuckets = useMemo(
    () => groupNotificationsByPeriod(filteredNotifications),
    [filteredNotifications]
  );

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      await notificationService.markAllAsRead(notifications, currentUser.id);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleOpenNotification = async (notif: UnifiedNotification) => {
    if (!notif.isRead) {
      notificationService.markAsRead(notif, currentUser.id).catch(() => {});
    }

    switch (notif.targetType) {
      case 'profile':
        if (notif.targetId || notif.actorId) {
          onOpenProfile(notif.targetId || notif.actorId);
        }
        break;
      case 'conversation':
        onOpenConversation(notif.targetId, notif.actorId);
        break;
      case 'community':
        if (notif.groupId || notif.targetId) {
          onOpenCommunity(notif.groupId || notif.targetId!);
        }
        break;
      case 'post':
        if (notif.groupId && notif.groupId !== 'public') {
          onOpenCommunity(notif.groupId);
        } else if (notif.targetId) {
          onOpenPost(notif.targetId, notif.groupId);
        }
        break;
      case 'capsule':
        if (notif.targetId) {
          onOpenCapsule(notif.targetId);
        }
        break;
      case 'settings':
        onOpenAccountSettings();
        break;
      default:
        if (notif.groupId && notif.groupId !== 'public') {
          onOpenCommunity(notif.groupId);
        }
        break;
    }
  };

  const handleAcceptInvitation = async (
    e: React.MouseEvent,
    notif: UnifiedNotification
  ) => {
    e.stopPropagation();
    if (!notif.invitation || busyInvitationId) return;
    setBusyInvitationId(notif.id);
    try {
      await communityService.acceptInvitation(notif.invitation, currentUser);
      await notificationService.markAsRead(notif, currentUser.id);
      setInvitationFeedback((prev) => ({ ...prev, [notif.id]: 'accepted' }));
    } catch {
      // ignore
    } finally {
      setBusyInvitationId(null);
    }
  };

  const handleDeclineInvitation = async (
    e: React.MouseEvent,
    notif: UnifiedNotification
  ) => {
    e.stopPropagation();
    if (!notif.invitation || busyInvitationId) return;
    setBusyInvitationId(notif.id);
    try {
      await communityService.declineInvitation(notif.invitation.id);
      await notificationService.markAsRead(notif, currentUser.id);
      setInvitationFeedback((prev) => ({ ...prev, [notif.id]: 'declined' }));
    } catch {
      // ignore
    } finally {
      setBusyInvitationId(null);
    }
  };

  const handleTogglePreference = async (
    key:
      | 'notif_reaction'
      | 'notif_comment'
      | 'notif_follower'
      | 'notif_community'
      | 'notif_mention'
      | 'notif_message'
      | 'notif_system',
    nextValue: boolean
  ) => {
    await notificationService.updateNotificationPreferences(currentUser.id, {
      [key]: nextValue
    });
  };

  const handleTogglePush = async () => {
    if (!pushSupported) return;
    setPushError(null);
    const currentEnabled = Boolean(settings.notif_push_enabled);
    if (currentEnabled) {
      await notificationService.updateNotificationPreferences(currentUser.id, {
        notif_push_enabled: false
      });
      return;
    }

    const perm = await requestBrowserPushPermission();
    setPushPermission(perm);
    if (perm === 'granted') {
      await notificationService.updateNotificationPreferences(currentUser.id, {
        notif_push_enabled: true
      });
    } else if (perm === 'denied') {
      setPushError(
        "L'autorisation de notifications est bloquée dans votre navigateur. Réactivez-la depuis les réglages du site."
      );
      await notificationService.updateNotificationPreferences(currentUser.id, {
        notif_push_enabled: false
      });
    }
  };

  const preferenceRows: {
    key:
      | 'notif_reaction'
      | 'notif_comment'
      | 'notif_follower'
      | 'notif_community'
      | 'notif_mention'
      | 'notif_message'
      | 'notif_system';
    title: string;
    desc: string;
    value: boolean;
  }[] = [
    {
      key: 'notif_reaction',
      title: 'Réactions',
      desc: "Mentions J'aime et réactions sur vos publications et capsules",
      value: settings.notif_reaction !== false
    },
    {
      key: 'notif_comment',
      title: 'Commentaires',
      desc: 'Nouveaux commentaires et réponses à vos échanges',
      value: (settings.notif_comment ?? true) !== false
    },
    {
      key: 'notif_follower',
      title: 'Nouveaux abonnés',
      desc: 'Lorsqu’un membre commence à suivre votre profil',
      value: (settings.notif_follower ?? true) !== false
    },
    {
      key: 'notif_community',
      title: 'Activités des communautés',
      desc: 'Invitations, adhésions, annonces et mises à jour de règles',
      value: (settings.notif_community ?? true) !== false
    },
    {
      key: 'notif_mention',
      title: 'Mentions (@nom)',
      desc: 'Identifications dans les publications, commentaires et groupes',
      value: (settings.notif_mention ?? true) !== false
    },
    {
      key: 'notif_message',
      title: 'Messages privés',
      desc: 'Alertes lors de la réception d’un nouveau message direct',
      value: settings.notif_message !== false
    },
    {
      key: 'notif_system',
      title: 'Notifications système',
      desc: 'Annonces officielles de la plateforme et informations de compte',
      value: (settings.notif_system ?? true) !== false
    }
  ];

  return (
    <div className="space-y-4 pb-8" id="notifications-center-page">
      {/* 1. EN-TÊTE PRINCIPAL + FILTRES */}
      <section className="bg-white border border-slate-200/85 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-950 tracking-tight">
                  Notifications
                </h1>
                {unreadCount > 0 && (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-lg bg-red-50 border border-red-200/80 text-red-700 text-xs font-extrabold tabular-nums"
                    aria-label={`${unreadCount} notifications non lues`}
                  >
                    {unreadCount} non {unreadCount > 1 ? 'lues' : 'lue'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Activités de votre réseau, mentions, communautés et alertes en temps réel
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              disabled={unreadCount === 0 || markingAll}
              onClick={handleMarkAllAsRead}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-45 disabled:hover:bg-slate-100 disabled:hover:text-slate-600 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
            >
              <CheckCheck className="w-4 h-4 shrink-0" />
              <span>{markingAll ? 'Mise à jour...' : 'Tout marquer comme lu'}</span>
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowSettingsDrawer((prev) => !prev)}
              aria-expanded={showSettingsDrawer}
              className={`min-h-[42px] px-3.5 py-2 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
                showSettingsDrawer
                  ? 'bg-slate-950 border-slate-950 text-white'
                  : 'bg-white border-slate-200/90 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span>Paramètres</span>
            </motion.button>
          </div>
        </div>

        {/* BARRE DE FILTRES */}
        <div
          className="mt-4 pt-3.5 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5"
          role="tablist"
          aria-label="Filtres de notifications"
        >
          {FILTER_TABS.map((tab) => {
            const isActive = activeFilter === tab.id;
            const badgeCount =
              tab.id === 'all' ? 0 : tabCounts[tab.id];

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveFilter(tab.id)}
                className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 shrink-0 ${
                  isActive
                    ? 'bg-slate-950 text-white shadow-xs'
                    : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                }`}
              >
                <span>{tab.label}</span>
                {badgeCount > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold tabular-nums ${
                      isActive ? 'bg-blue-600 text-white' : 'bg-white text-blue-700'
                    }`}
                  >
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. MENU PARAMÈTRES DE NOTIFICATIONS (INLINE DRAWER ACCORDÉON) */}
      <AnimatePresence>
        {showSettingsDrawer && (
          <motion.section
            initial={{ opacity: 0, height: 0, y: -6 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-950">
                    Préférences des notifications
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Activez ou désactivez les alertes par catégorie selon vos besoins.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onOpenAccountSettings}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition flex items-center gap-1"
                  >
                    <span>Tous les réglages</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSettingsDrawer(false)}
                    aria-label="Fermer les préférences"
                    className="min-w-[40px] min-h-[40px] rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {preferenceRows.map((row) => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50/90 border border-slate-200/60"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900">{row.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{row.desc}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={row.value}
                      aria-label={row.title}
                      onClick={() => handleTogglePreference(row.key, !row.value)}
                      className={`w-12 h-7 rounded-full transition p-1 flex items-center shrink-0 ${
                        row.value ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full bg-white shadow-xs" />
                    </button>
                  </div>
                ))}

                {pushSupported && (
                  <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-blue-50/50 border border-blue-200/70 md:col-span-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-950">
                          Notifications Push navigateur
                        </p>
                        <span className="text-[10px] font-bold text-blue-700">
                          {pushPermission === 'granted'
                            ? '· Autorisées'
                            : pushPermission === 'denied'
                              ? '· Bloquées'
                              : '· Inactives'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Recevez une alerte sur votre appareil lorsque vous consultez un autre onglet.
                      </p>
                      {pushError && (
                        <p className="text-[11px] text-red-600 font-semibold mt-1">{pushError}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={Boolean(settings.notif_push_enabled && pushPermission === 'granted')}
                      aria-label="Notifications Push navigateur"
                      onClick={handleTogglePush}
                      className={`w-12 h-7 rounded-full transition p-1 flex items-center shrink-0 ${
                        settings.notif_push_enabled && pushPermission === 'granted'
                          ? 'bg-blue-600 justify-end'
                          : 'bg-slate-300 justify-start'
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full bg-white shadow-xs" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* 3. LISTE CHRONOLOGIQUE DES NOTIFICATIONS */}
      {groupedBuckets.length === 0 ? (
        <div className="bg-white border border-slate-200/85 rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
            <BellOff className="w-7 h-7 stroke-[1.75]" />
          </div>
          <h3 className="text-base font-extrabold text-slate-950">
            {activeFilter === 'unread'
              ? 'Vous êtes à jour !'
              : 'Aucune notification dans cette catégorie'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1.5 leading-relaxed">
            {activeFilter === 'unread'
              ? 'Toutes vos notifications ont été lues. Les nouvelles activités apparaîtront ici instantanément.'
              : 'Les réactions, commentaires, mentions, abonnements et annonces de vos communautés s’afficheront ici en temps réel.'}
          </p>
          {activeFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className="mt-4 min-h-[42px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition"
            >
              Afficher toutes les notifications
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {groupedBuckets.map((bucket) => (
            <section
              key={bucket.key}
              className="bg-white border border-slate-200/85 rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
            >
              <div className="px-4 sm:px-5 py-3 bg-slate-50/75 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  {bucket.label}
                </h2>
                <span className="text-[11px] font-bold text-slate-400 tabular-nums">
                  {bucket.items.length}
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                <AnimatePresence initial={false}>
                  {bucket.items.map((notif) => {
                    const iconMeta = getNotificationIconMeta(notif.type);
                    const TypeIcon = iconMeta.Icon;
                    const invStatus = invitationFeedback[notif.id] || notif.invitation?.status;
                    const showInvitationActions =
                      notif.type === 'community_invitation' &&
                      notif.invitation &&
                      invStatus === 'pending';

                    return (
                      <motion.div
                        key={notif.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -16 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        onClick={() => handleOpenNotification(notif)}
                        className={`group relative px-4 sm:px-5 py-3.5 sm:py-4 transition cursor-pointer flex items-start gap-3.5 ${
                          !notif.isRead
                            ? 'bg-blue-50/45 hover:bg-blue-50/75'
                            : 'bg-white hover:bg-slate-50/80'
                        }`}
                      >
                        {/* Avatar + Badge type d'activité */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (
                              notif.actorId &&
                              notif.type !== 'system' &&
                              notif.type !== 'security_alert' &&
                              notif.actorId !== notif.groupId
                            ) {
                              onOpenProfile(notif.actorId);
                            } else {
                              handleOpenNotification(notif);
                            }
                          }}
                          className="relative shrink-0 mt-0.5 focus:outline-none"
                          title={
                            notif.actorName ? `Voir le profil de ${notif.actorName}` : undefined
                          }
                        >
                          {notif.actorAvatar &&
                          notif.type !== 'system' &&
                          notif.type !== 'security_alert' ? (
                            <img
                              src={notif.actorAvatar}
                              alt={notif.actorName}
                              className="w-11 h-11 rounded-full object-cover ring-1 ring-slate-200 bg-slate-100"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div
                              className={`w-11 h-11 rounded-full flex items-center justify-center font-extrabold text-sm ring-1 ring-slate-200/70 ${iconMeta.accentBg} ${iconMeta.accentText}`}
                            >
                              {notif.type === 'system' || notif.type === 'security_alert' ? (
                                <TypeIcon className="w-5 h-5" />
                              ) : (
                                (notif.actorName || 'Z').charAt(0).toUpperCase()
                              )}
                            </div>
                          )}

                          <span
                            className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center shadow-xs ${iconMeta.badgeBg}`}
                          >
                            <TypeIcon className="w-2.5 h-2.5" />
                          </span>
                        </button>

                        {/* Contenu principal */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p
                                className={`text-xs sm:text-[13px] leading-snug ${
                                  !notif.isRead
                                    ? 'font-bold text-slate-950'
                                    : 'font-medium text-slate-800'
                                }`}
                              >
                                {notif.priority === 'urgent' && (
                                  <span className="text-red-600 font-extrabold mr-1.5">
                                    [Urgent]
                                  </span>
                                )}
                                {notif.message}
                              </p>

                              {notif.previewText && (
                                <p className="mt-1.5 pl-2.5 border-l-2 border-slate-200 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                  {notif.previewText}
                                </p>
                              )}

                              <div className="mt-1.5 flex items-center flex-wrap gap-x-2 gap-y-1 text-[11px] text-slate-400">
                                <span className="tabular-nums font-medium">
                                  {formatNotificationTime(notif.createdAt)}
                                </span>
                                {notif.groupName && (
                                  <>
                                    <span>·</span>
                                    <span className="font-semibold text-blue-700 truncate max-w-[200px]">
                                      {notif.groupName}
                                    </span>
                                  </>
                                )}
                                {!notif.isRead && (
                                  <>
                                    <span>·</span>
                                    <span className="font-bold text-blue-600">Non lue</span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Indicateur non lu + Actions rapides */}
                            <div className="flex items-center gap-1 shrink-0">
                              {!notif.isRead && (
                                <span
                                  className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0 mr-1"
                                  title="Non lue"
                                />
                              )}

                              {!notif.isRead && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    notificationService.markAsRead(notif, currentUser.id);
                                  }}
                                  className="min-w-[36px] min-h-[36px] sm:min-w-[34px] sm:min-h-[34px] rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition"
                                  title="Marquer comme lu"
                                  aria-label="Marquer comme lu"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  notificationService.deleteNotification(notif, currentUser.id);
                                }}
                                className="min-w-[36px] min-h-[36px] sm:min-w-[34px] sm:min-h-[34px] rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition"
                                title="Supprimer cette notification"
                                aria-label="Supprimer cette notification"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>

                              <ChevronRight className="w-4 h-4 text-slate-300 hidden sm:block group-hover:text-slate-500 transition" />
                            </div>
                          </div>

                          {/* Actions rapides d'invitation à une communauté */}
                          {showInvitationActions && (
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                type="button"
                                disabled={busyInvitationId === notif.id}
                                onClick={(e) => handleAcceptInvitation(e, notif)}
                                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Accepter</span>
                              </button>
                              <button
                                type="button"
                                disabled={busyInvitationId === notif.id}
                                onClick={(e) => handleDeclineInvitation(e, notif)}
                                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-bold transition"
                              >
                                Refuser
                              </button>
                            </div>
                          )}

                          {invStatus === 'accepted' && notif.type === 'community_invitation' && (
                            <p className="mt-2 text-xs font-bold text-emerald-700">
                              Invitation acceptée · Vous êtes membre de cette communauté.
                            </p>
                          )}
                          {invStatus === 'declined' && notif.type === 'community_invitation' && (
                            <p className="mt-2 text-xs font-semibold text-slate-500">
                              Invitation déclinée.
                            </p>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
