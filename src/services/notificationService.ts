import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { auth, dbFirestore } from '../firebaseClient';
import {
  AppNotification,
  AppNotificationCategory,
  AppNotificationTargetType,
  AppNotificationType,
  DEFAULT_USER_SETTINGS,
  GroupInvitation,
  GroupNotification,
  UnifiedNotification,
  UserProfile,
  UserSettings
} from '../types';

interface PlatformNotificationDoc {
  id: string;
  title: string;
  message: string;
  priority: 'info' | 'warning' | 'urgent';
  audience: 'all' | 'mentors' | 'admins';
  isActive: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export type NotificationFilterTab =
  | 'all'
  | 'unread'
  | 'mentions'
  | 'interactions'
  | 'communities'
  | 'system';

export interface NotificationGroupBucket {
  key: 'today' | 'yesterday' | 'week' | 'older';
  label: string;
  items: UnifiedNotification[];
}

const recentEmittedIds = new Set<string>();

function sanitizeIdPart(raw: string): string {
  return (raw || '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 60);
}

export function buildDeterministicNotificationId(parts: string[]): string {
  const joined = parts.map(sanitizeIdPart).filter(Boolean).join('_');
  const trimmed = joined.slice(0, 240);
  return trimmed || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function makeUniqueNotificationId(prefix = 'ntf'): string {
  return `${sanitizeIdPart(prefix)}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function extractMentionedUserIds(content: string, users: Array<{ id: string; nom: string; username?: string }>): string[] {
  if (!content || !content.includes('@') || users.length === 0) return [];
  const lower = content.toLowerCase();
  const matched = new Set<string>();

  for (const u of users) {
    const cleanName = (u.nom || '').trim().toLowerCase();
    const firstWord = cleanName.split(/\s+/)[0];
    const cleanHandle = (u.username || '').trim().toLowerCase();

    if (cleanName && lower.includes(`@${cleanName}`)) {
      matched.add(u.id);
      continue;
    }
    if (cleanHandle && lower.includes(`@${cleanHandle}`)) {
      matched.add(u.id);
      continue;
    }
    if (firstWord && firstWord.length >= 3) {
      const escaped = firstWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|\\s)@${escaped}(\\b|\\s|[.,!?;:])`, 'i');
      if (regex.test(lower)) {
        matched.add(u.id);
      }
    }
  }

  return Array.from(matched);
}

export function isPushNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getPushNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isPushNotificationSupported()) return 'unsupported';
  return window.Notification.permission;
}

export async function requestBrowserPushPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isPushNotificationSupported()) return 'unsupported';
  try {
    return await window.Notification.requestPermission();
  } catch {
    return window.Notification.permission;
  }
}

export function dispatchBrowserPushNotification(notif: UnifiedNotification): void {
  if (!isPushNotificationSupported()) return;
  if (window.Notification.permission !== 'granted') return;
  if (typeof document !== 'undefined' && document.visibilityState === 'visible' && document.hasFocus()) {
    return;
  }
  try {
    new window.Notification(notif.title || 'Zaure', {
      body: notif.message,
      tag: notif.id,
      icon: notif.actorAvatar || '/pwa-192x192.png'
    });
  } catch {
    // Ignore environments where Notification constructor is restricted (e.g. some Android WebViews)
  }
}

function mapGroupTypeToAppType(type: GroupNotification['type']): {
  type: AppNotificationType;
  category: AppNotificationCategory;
  title: string;
} {
  switch (type) {
    case 'invitation':
      return { type: 'community_invitation', category: 'communities', title: 'Invitation de communauté' };
    case 'member_approved':
      return { type: 'community_approved', category: 'communities', title: 'Adhésion approuvée' };
    case 'new_post':
    case 'post_approved':
      return { type: 'community_post', category: 'communities', title: 'Nouvelle publication' };
    case 'comment':
      return { type: 'comment', category: 'interactions', title: 'Nouveau commentaire' };
    case 'mention':
      return { type: 'mention', category: 'mentions', title: 'Vous avez été mentionné(e)' };
    case 'announcement':
      return { type: 'community_announcement', category: 'communities', title: 'Annonce de communauté' };
    case 'event':
      return { type: 'community_post', category: 'communities', title: 'Événement communautaire' };
    case 'role_changed':
      return { type: 'community_role', category: 'communities', title: 'Changement de rôle' };
    case 'rules_updated':
      return { type: 'community_rules', category: 'communities', title: 'Règles de communauté mises à jour' };
    default:
      return { type: 'community_post', category: 'communities', title: 'Activité communautaire' };
  }
}

export function shouldDisplayNotificationBySettings(
  notif: UnifiedNotification,
  settings: UserSettings
): boolean {
  switch (notif.type) {
    case 'like':
    case 'reaction':
      return settings.notif_reaction !== false;
    case 'comment':
    case 'comment_reply':
      return (settings.notif_comment ?? true) !== false;
    case 'new_follower':
      return (settings.notif_follower ?? true) !== false;
    case 'new_message':
      return settings.notif_message !== false;
    case 'mention':
    case 'group_mention':
      return (settings.notif_mention ?? true) !== false;
    case 'community_invitation':
    case 'community_approved':
    case 'community_post':
    case 'community_announcement':
    case 'community_rules':
    case 'community_role':
      return (settings.notif_community ?? true) !== false;
    case 'security_alert':
      return true;
    case 'system':
      return (settings.notif_system ?? true) !== false;
    default:
      return true;
  }
}

export function filterNotificationsByTab(
  notifs: UnifiedNotification[],
  tab: NotificationFilterTab
): UnifiedNotification[] {
  switch (tab) {
    case 'unread':
      return notifs.filter((n) => !n.isRead);
    case 'mentions':
      return notifs.filter(
        (n) => n.category === 'mentions' || n.type === 'mention' || n.type === 'group_mention'
      );
    case 'interactions':
      return notifs.filter(
        (n) =>
          n.category === 'interactions' ||
          n.type === 'like' ||
          n.type === 'reaction' ||
          n.type === 'comment' ||
          n.type === 'comment_reply' ||
          n.type === 'share' ||
          n.type === 'new_follower' ||
          n.type === 'new_message'
      );
    case 'communities':
      return notifs.filter((n) => n.category === 'communities' || Boolean(n.groupId));
    case 'system':
      return notifs.filter((n) => n.category === 'system' || n.type === 'system' || n.type === 'security_alert');
    case 'all':
    default:
      return notifs;
  }
}

export function groupNotificationsByPeriod(notifs: UnifiedNotification[]): NotificationGroupBucket[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOfWeek = startOfToday - 6 * 24 * 60 * 60 * 1000;

  const today: UnifiedNotification[] = [];
  const yesterday: UnifiedNotification[] = [];
  const week: UnifiedNotification[] = [];
  const older: UnifiedNotification[] = [];

  for (const item of notifs) {
    const ms = new Date(item.createdAt).getTime();
    if (!Number.isFinite(ms) || ms >= startOfToday) {
      today.push(item);
    } else if (ms >= startOfYesterday) {
      yesterday.push(item);
    } else if (ms >= startOfWeek) {
      week.push(item);
    } else {
      older.push(item);
    }
  }

  const buckets: NotificationGroupBucket[] = [];
  if (today.length > 0) buckets.push({ key: 'today', label: "Aujourd'hui", items: today });
  if (yesterday.length > 0) buckets.push({ key: 'yesterday', label: 'Hier', items: yesterday });
  if (week.length > 0) buckets.push({ key: 'week', label: 'Cette semaine', items: week });
  if (older.length > 0) buckets.push({ key: 'older', label: 'Plus anciennes', items: older });
  return buckets;
}

export const notificationService = {
  createAppNotification: async (input: {
    id?: string;
    userId: string;
    actorId: string;
    actorName: string;
    actorAvatar?: string | null;
    type: AppNotificationType;
    category: AppNotificationCategory;
    title: string;
    message: string;
    previewText?: string;
    targetType?: AppNotificationTargetType;
    targetId?: string;
    groupId?: string;
    groupName?: string;
    dedupSessionOnly?: boolean;
  }): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser) return;
    if (!input.userId || !input.actorId) return;
    if (input.userId === input.actorId && input.type !== 'security_alert' && input.type !== 'system') {
      return;
    }

    const notifId = input.id
      ? sanitizeIdPart(input.id).slice(0, 250) || makeUniqueNotificationId('ntf')
      : makeUniqueNotificationId('ntf');

    if (recentEmittedIds.has(notifId)) return;
    recentEmittedIds.add(notifId);
    if (recentEmittedIds.size > 500) {
      const first = recentEmittedIds.values().next().value;
      if (first) recentEmittedIds.delete(first);
    }

    const payload: AppNotification = {
      id: notifId,
      userId: input.userId,
      actorId: input.actorId,
      actorName: (input.actorName || 'Membre Zaure').trim().slice(0, 120) || 'Membre Zaure',
      ...(input.actorAvatar ? { actorAvatar: input.actorAvatar.slice(0, 350000) } : {}),
      type: input.type,
      category: input.category,
      title: (input.title || 'Notification').trim().slice(0, 160),
      message: (input.message || 'Nouvelle activité sur Zaure').trim().slice(0, 500),
      ...(input.previewText ? { previewText: input.previewText.trim().slice(0, 300) } : {}),
      ...(input.targetType ? { targetType: input.targetType } : {}),
      ...(input.targetId ? { targetId: input.targetId.slice(0, 260) } : {}),
      ...(input.groupId ? { groupId: input.groupId.slice(0, 128) } : {}),
      ...(input.groupName ? { groupName: input.groupName.trim().slice(0, 120) } : {}),
      isRead: false,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(dbFirestore, 'notifications', notifId), payload);
    } catch {
      // Non-fatal: deterministic IDs reject duplicates via rules cleanly without impacting UX
    }
  },

  subscribeUnifiedNotifications: (
    user: UserProfile,
    allUsers: UserProfile[],
    onUpdate: (data: {
      notifications: UnifiedNotification[];
      settings: UserSettings;
      newArrivals: UnifiedNotification[];
    }) => void
  ): (() => void) => {
    if (!dbFirestore || !auth?.currentUser || !user?.id) {
      onUpdate({ notifications: [], settings: DEFAULT_USER_SETTINGS, newArrivals: [] });
      return () => {};
    }

    let directDocs: AppNotification[] = [];
    let groupDocs: GroupNotification[] = [];
    let platformDocs: PlatformNotificationDoc[] = [];
    let invitations: GroupInvitation[] = [];
    let userSettings: UserSettings = { ...DEFAULT_USER_SETTINGS };

    let hydratedDirect = false;
    let hydratedGroup = false;
    let hydratedPlatform = false;
    const seenIds = new Set<string>();
    let initialEmissionDone = false;

    const usersByName = new Map<string, UserProfile>();
    allUsers.forEach((u) => {
      if (u.nom) usersByName.set(u.nom.trim().toLowerCase(), u);
    });

    const emit = () => {
      const readPlatformIds = new Set(userSettings.read_platform_notification_ids || []);
      const dismissedPlatformIds = new Set(userSettings.dismissed_platform_notification_ids || []);
      const pendingInvitationByGroup = new Map<string, GroupInvitation>();
      invitations.forEach((inv) => {
        if (inv.status === 'pending' && !pendingInvitationByGroup.has(inv.groupId)) {
          pendingInvitationByGroup.set(inv.groupId, inv);
        }
      });

      const merged: UnifiedNotification[] = [];
      const dedupKeys = new Set<string>();

      for (const n of directDocs) {
        const key = `n_${n.id}`;
        if (dedupKeys.has(key)) continue;
        dedupKeys.add(key);
        merged.push({
          ...n,
          source: 'notifications',
          sourceId: n.id
        });
      }

      for (const gn of groupDocs) {
        const mapped = mapGroupTypeToAppType(gn.type);
        const actorMatch = usersByName.get((gn.actorName || '').trim().toLowerCase());
        const key = `g_${gn.id}`;
        if (dedupKeys.has(key)) continue;
        dedupKeys.add(key);

        merged.push({
          id: `grp_${gn.id}`,
          source: 'group_notifications',
          sourceId: gn.id,
          userId: gn.userId,
          actorId: actorMatch?.id || gn.groupId,
          actorName: gn.actorName || 'Communauté Zaure',
          actorAvatar: actorMatch?.avatar_url || undefined,
          type: mapped.type,
          category: mapped.category,
          title: mapped.title,
          message: gn.message,
          targetType: 'community',
          targetId: gn.groupId,
          groupId: gn.groupId,
          groupName: gn.groupName,
          isRead: Boolean(gn.isRead),
          createdAt: gn.createdAt,
          invitation: gn.type === 'invitation' ? pendingInvitationByGroup.get(gn.groupId) || null : null
        });
      }

      for (const pn of platformDocs) {
        if (!pn.isActive || dismissedPlatformIds.has(pn.id)) continue;
        if (pn.audience === 'mentors' && user.role !== 'mentor' && user.role !== 'verifie') continue;
        if (pn.audience === 'admins' && user.email?.toLowerCase() !== 'mahamadougarbamoussa8080@gmail.com') {
          continue;
        }
        const key = `p_${pn.id}`;
        if (dedupKeys.has(key)) continue;
        dedupKeys.add(key);

        merged.push({
          id: `plt_${pn.id}`,
          source: 'platform_notifications',
          sourceId: pn.id,
          userId: user.id,
          actorId: pn.createdBy,
          actorName: pn.createdByName || 'Équipe Zaure',
          type: 'system',
          category: 'system',
          title: pn.title,
          message: pn.message,
          priority: pn.priority,
          targetType: 'system',
          targetId: pn.id,
          isRead: readPlatformIds.has(pn.id),
          createdAt: pn.createdAt
        });
      }

      merged.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

      const visible = merged.filter((item) => shouldDisplayNotificationBySettings(item, userSettings));

      const newArrivals: UnifiedNotification[] = [];
      if (hydratedDirect && hydratedGroup && hydratedPlatform) {
        if (!initialEmissionDone) {
          visible.forEach((n) => seenIds.add(n.id));
          initialEmissionDone = true;
        } else {
          visible.forEach((n) => {
            if (!seenIds.has(n.id)) {
              seenIds.add(n.id);
              if (!n.isRead) {
                newArrivals.push(n);
                if (userSettings.notif_push_enabled) {
                  dispatchBrowserPushNotification(n);
                }
              }
            }
          });
        }
      }

      onUpdate({
        notifications: visible,
        settings: userSettings,
        newArrivals
      });
    };

    const unsubDirect = onSnapshot(
      query(collection(dbFirestore, 'notifications'), where('userId', '==', user.id)),
      (snap) => {
        const list: AppNotification[] = [];
        snap.forEach((d) => list.push(d.data() as AppNotification));
        directDocs = list;
        hydratedDirect = true;
        emit();
      },
      (err) => {
        console.warn('Info - subscribe notifications:', err);
        hydratedDirect = true;
        emit();
      }
    );

    const unsubGroup = onSnapshot(
      query(collection(dbFirestore, 'group_notifications'), where('userId', '==', user.id)),
      (snap) => {
        const list: GroupNotification[] = [];
        snap.forEach((d) => list.push(d.data() as GroupNotification));
        groupDocs = list;
        hydratedGroup = true;
        emit();
      },
      (err) => {
        console.warn('Info - subscribe group_notifications:', err);
        hydratedGroup = true;
        emit();
      }
    );

    const unsubPlatform = onSnapshot(
      query(collection(dbFirestore, 'platform_notifications'), where('isActive', '==', true)),
      (snap) => {
        const list: PlatformNotificationDoc[] = [];
        snap.forEach((d) => list.push(d.data() as PlatformNotificationDoc));
        platformDocs = list;
        hydratedPlatform = true;
        emit();
      },
      (err) => {
        console.warn('Info - subscribe platform_notifications:', err);
        hydratedPlatform = true;
        emit();
      }
    );

    const unsubInvitations = onSnapshot(
      query(collection(dbFirestore, 'group_invitations'), where('inviteeId', '==', user.id)),
      (snap) => {
        const list: GroupInvitation[] = [];
        snap.forEach((d) => list.push(d.data() as GroupInvitation));
        invitations = list;
        emit();
      },
      () => {}
    );

    const unsubSettings = onSnapshot(
      doc(dbFirestore, 'user_settings', user.id),
      (snap) => {
        if (snap.exists()) {
          userSettings = { ...DEFAULT_USER_SETTINGS, ...(snap.data() as Partial<UserSettings>) };
        } else {
          userSettings = { ...DEFAULT_USER_SETTINGS };
        }
        emit();
      },
      () => {
        emit();
      }
    );

    return () => {
      unsubDirect();
      unsubGroup();
      unsubPlatform();
      unsubInvitations();
      unsubSettings();
    };
  },

  markAsRead: async (notif: UnifiedNotification, userId: string): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser || notif.isRead) return;
    try {
      if (notif.source === 'notifications') {
        await updateDoc(doc(dbFirestore, 'notifications', notif.sourceId), { isRead: true });
      } else if (notif.source === 'group_notifications') {
        await updateDoc(doc(dbFirestore, 'group_notifications', notif.sourceId), { isRead: true });
      } else if (notif.source === 'platform_notifications') {
        await setDoc(
          doc(dbFirestore, 'user_settings', userId),
          { read_platform_notification_ids: arrayUnion(notif.sourceId) },
          { merge: true }
        );
      }
    } catch (err) {
      console.warn('Info - markAsRead:', err);
    }
  },

  markAllAsRead: async (notifs: UnifiedNotification[], userId: string): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser) return;
    const unread = notifs.filter((n) => !n.isRead);
    if (unread.length === 0) return;

    const directAndGroup = unread.filter(
      (n) => n.source === 'notifications' || n.source === 'group_notifications'
    );
    const platformIds = unread
      .filter((n) => n.source === 'platform_notifications')
      .map((n) => n.sourceId);

    try {
      for (let i = 0; i < directAndGroup.length; i += 400) {
        const chunk = directAndGroup.slice(i, i + 400);
        const batch = writeBatch(dbFirestore);
        for (const item of chunk) {
          const colName = item.source === 'notifications' ? 'notifications' : 'group_notifications';
          batch.update(doc(dbFirestore, colName, item.sourceId), { isRead: true });
        }
        await batch.commit();
      }

      if (platformIds.length > 0) {
        await setDoc(
          doc(dbFirestore, 'user_settings', userId),
          { read_platform_notification_ids: arrayUnion(...platformIds.slice(0, 100)) },
          { merge: true }
        );
      }
    } catch (err) {
      console.warn('Info - markAllAsRead:', err);
    }
  },

  deleteNotification: async (notif: UnifiedNotification, userId: string): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser) return;
    try {
      if (notif.source === 'notifications') {
        await deleteDoc(doc(dbFirestore, 'notifications', notif.sourceId));
      } else if (notif.source === 'group_notifications') {
        await deleteDoc(doc(dbFirestore, 'group_notifications', notif.sourceId));
      } else if (notif.source === 'platform_notifications') {
        await setDoc(
          doc(dbFirestore, 'user_settings', userId),
          { dismissed_platform_notification_ids: arrayUnion(notif.sourceId) },
          { merge: true }
        );
      }
    } catch (err) {
      console.warn('Info - deleteNotification:', err);
    }
  },

  updateNotificationPreferences: async (
    userId: string,
    patch: Partial<
      Pick<
        UserSettings,
        | 'notif_capsule'
        | 'notif_message'
        | 'notif_mentorat'
        | 'notif_reaction'
        | 'notif_comment'
        | 'notif_follower'
        | 'notif_community'
        | 'notif_mention'
        | 'notif_system'
        | 'notif_push_enabled'
        | 'canal_notif'
      >
    >
  ): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser || auth.currentUser.uid !== userId) return;
    try {
      await setDoc(doc(dbFirestore, 'user_settings', userId), patch, { merge: true });
    } catch (err) {
      console.warn('Info - updateNotificationPreferences:', err);
    }
  }
};
