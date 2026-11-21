import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where
} from 'firebase/firestore';
import {
  auth,
  dbFirestore,
  handleFirestoreError,
  normalizePrivacySettings,
  OperationType,
  sanitizeUsername,
  zaureService
} from '../firebaseClient';
import {
  Capsule,
  CommunityGroup,
  CommunityMember,
  DEFAULT_PRIVACY_SETTINGS,
  GroupPost,
  PostComment,
  PostReaction,
  PrivacyAudience,
  UserFollow,
  UserPrivacySettings,
  UserProfile
} from '../types';
import {
  buildDeterministicNotificationId,
  notificationService
} from './notificationService';

export interface ProfileCommunityEntry {
  group: CommunityGroup;
  membership: CommunityMember;
}

export interface ViewerProfileContext {
  isOwnProfile: boolean;
  isFollower: boolean;
  sharesCircleOrGroup: boolean;
  isMentorOrVerified: boolean;
  isBlocked: boolean;
}

export function canViewPrivacySection(
  audience: PrivacyAudience | undefined,
  ctx: ViewerProfileContext,
  privacy: UserPrivacySettings
): boolean {
  if (ctx.isOwnProfile) return true;
  if (ctx.isBlocked) return false;

  // When profileMode is 'private', non-followers only see header + follow button unless explicitly allowed
  if (privacy.profileMode === 'private' && !ctx.isFollower) {
    return false;
  }

  const rule = audience || 'public';
  if (rule === 'public') return true;
  if (rule === 'followers') return ctx.isFollower;
  if (rule === 'cercles') return ctx.sharesCircleOrGroup || ctx.isFollower;
  return false; // 'private'
}

export function canSendDirectMessage(
  privacy: UserPrivacySettings,
  ctx: ViewerProfileContext
): boolean {
  if (ctx.isOwnProfile || ctx.isBlocked) return false;
  switch (privacy.allowMessages) {
    case 'tous':
      return true;
    case 'followers':
      return ctx.isFollower;
    case 'cercles':
      return ctx.sharesCircleOrGroup || ctx.isFollower;
    case 'mentors':
      return ctx.isMentorOrVerified;
    case 'personne':
      return false;
    default:
      return true;
  }
}

export function getPrivacyBlockReason(
  audience: PrivacyAudience | undefined,
  privacy: UserPrivacySettings,
  targetName: string
): string {
  if (privacy.profileMode === 'private') {
    return `Ce profil est privé. Suivez ${targetName} pour découvrir son activité et ses publications.`;
  }
  switch (audience) {
    case 'followers':
      return `Cette section est réservée aux abonnés de ${targetName}.`;
    case 'cercles':
      return `Cette section est visible uniquement par les membres partageant un cercle avec ${targetName}.`;
    case 'private':
      return `${targetName} a choisi de garder ces informations privées.`;
    default:
      return 'Accès restreint par les paramètres de confidentialité.';
  }
}

export function formatMemberHandle(user: Pick<UserProfile, 'username' | 'nom'>): string {
  return `@${sanitizeUsername(user.username, user.nom)}`;
}

export const profileService = {
  // ---------------------------------------------------------------------------
  // 1. SOCIAL FOLLOW SYSTEM (ABONNÉS / ABONNEMENTS)
  // ---------------------------------------------------------------------------
  followUser: async (followerId: string, followingId: string): Promise<UserFollow> => {
    if (!dbFirestore || !auth?.currentUser || auth.currentUser.uid !== followerId) {
      throw new Error('Vous devez être connecté pour suivre ce membre.');
    }
    if (!followerId || !followingId || followerId === followingId) {
      throw new Error('Action invalide.');
    }
    const followId = `${followerId}_${followingId}`;
    const followDoc: UserFollow = {
      id: followId,
      followerId,
      followingId,
      createdAt: new Date().toISOString()
    };
    try {
      await setDoc(doc(dbFirestore, 'user_follows', followId), followDoc);

      // Émettre une notification temps réel de nouvel abonnement (dédupliquée)
      try {
        const followerSnap = await getDoc(doc(dbFirestore, 'public_profiles', followerId));
        const followerData = followerSnap.exists() ? (followerSnap.data() as Partial<UserProfile>) : null;
        const actorName = followerData?.nom || auth.currentUser.displayName || 'Un membre Zaure';
        await notificationService.createAppNotification({
          id: buildDeterministicNotificationId(['follow', followerId, followingId]),
          userId: followingId,
          actorId: followerId,
          actorName,
          actorAvatar: followerData?.avatar_url || auth.currentUser.photoURL || undefined,
          type: 'new_follower',
          category: 'interactions',
          title: 'Nouvel abonné',
          message: `${actorName} a commencé à vous suivre.`,
          targetType: 'profile',
          targetId: followerId
        });
      } catch {
        // Non-fatal notification emission
      }

      return followDoc;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `user_follows/${followId}`);
    }
  },

  unfollowUser: async (followerId: string, followingId: string): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser || auth.currentUser.uid !== followerId) {
      throw new Error('Vous devez être connecté.');
    }
    const followId = `${followerId}_${followingId}`;
    try {
      await deleteDoc(doc(dbFirestore, 'user_follows', followId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `user_follows/${followId}`);
    }
  },

  subscribeFollowers: (
    userId: string,
    onData: (follows: UserFollow[]) => void
  ): (() => void) => {
    if (!dbFirestore || !auth?.currentUser || !userId) {
      onData([]);
      return () => {};
    }
    const q = query(collection(dbFirestore, 'user_follows'), where('followingId', '==', userId));
    return onSnapshot(
      q,
      (snap) => {
        const list: UserFollow[] = [];
        snap.forEach((d) => list.push(d.data() as UserFollow));
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        onData(list);
      },
      (err) => console.warn('Info - subscribeFollowers:', err)
    );
  },

  subscribeFollowing: (
    userId: string,
    onData: (follows: UserFollow[]) => void
  ): (() => void) => {
    if (!dbFirestore || !auth?.currentUser || !userId) {
      onData([]);
      return () => {};
    }
    const q = query(collection(dbFirestore, 'user_follows'), where('followerId', '==', userId));
    return onSnapshot(
      q,
      (snap) => {
        const list: UserFollow[] = [];
        snap.forEach((d) => list.push(d.data() as UserFollow));
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        onData(list);
      },
      (err) => console.warn('Info - subscribeFollowing:', err)
    );
  },

  hydrateFollowUsers: async (
    userIds: string[],
    knownUsers: UserProfile[]
  ): Promise<UserProfile[]> => {
    const knownMap = new Map<string, UserProfile>();
    knownUsers.forEach((u) => knownMap.set(u.id, u));

    const results: UserProfile[] = [];
    const missingIds: string[] = [];

    userIds.forEach((uid) => {
      const found = knownMap.get(uid);
      if (found) results.push(found);
      else if (uid) missingIds.push(uid);
    });

    if (missingIds.length > 0 && dbFirestore && auth?.currentUser) {
      const fetched = await Promise.all(
        missingIds.map((uid) => zaureService.getUserPublicProfile(uid).catch(() => null))
      );
      fetched.forEach((u) => {
        if (u) results.push(u);
      });
    }

    // Preserve follow order
    const orderMap = new Map<string, UserProfile>();
    results.forEach((u) => orderMap.set(u.id, u));
    return userIds.map((id) => orderMap.get(id)).filter((u): u is UserProfile => Boolean(u));
  },

  // ---------------------------------------------------------------------------
  // 2. USER PROFILE PUBLICATIONS, REACTIONS, COMMENTS & MEDIA
  // ---------------------------------------------------------------------------
  fetchProfilePublications: async (
    targetUserId: string,
    viewerId: string
  ): Promise<{
    posts: GroupPost[];
    capsules: Capsule[];
    reactionsByPost: Record<string, PostReaction[]>;
    commentsByPost: Record<string, PostComment[]>;
    groupsMap: Record<string, CommunityGroup>;
  }> => {
    if (!dbFirestore || !auth?.currentUser || !targetUserId) {
      return { posts: [], capsules: [], reactionsByPost: {}, commentsByPost: {}, groupsMap: {} };
    }

    const isOwn = targetUserId === viewerId;
    const groupsMap: Record<string, CommunityGroup> = {};
    const accessibleGroupIds = new Set<string>(['public']);

    try {
      // Load all groups metadata + viewer's own memberships to avoid permission violations on private groups
      const [groupsSnap, viewerMemSnap] = await Promise.all([
        getDocs(collection(dbFirestore, 'groups')),
        getDocs(query(collection(dbFirestore, 'group_members'), where('userId', '==', viewerId)))
      ]);

      const viewerActiveGroups = new Set<string>();
      viewerMemSnap.forEach((d) => {
        const m = d.data() as CommunityMember;
        if (m.status === 'active') viewerActiveGroups.add(m.groupId);
      });

      groupsSnap.forEach((d) => {
        const g = d.data() as CommunityGroup;
        if (g?.id) {
          groupsMap[g.id] = g;
          if (g.privacy === 'public' || viewerActiveGroups.has(g.id)) {
            accessibleGroupIds.add(g.id);
          }
        }
      });

      // Fetch GroupPosts safely
      const postsById = new Map<string, GroupPost>();

      if (isOwn) {
        const ownQ = query(collection(dbFirestore, 'group_posts'), where('authorId', '==', viewerId));
        const ownSnap = await getDocs(ownQ);
        ownSnap.forEach((d) => {
          const p = d.data() as GroupPost;
          if (p?.id) postsById.set(p.id, p);
        });
      } else {
        const groupIdList = Array.from(accessibleGroupIds);
        // Firestore 'in' queries support max 30 values at a time
        for (let i = 0; i < groupIdList.length; i += 30) {
          const chunk = groupIdList.slice(i, i + 30);
          const q = query(
            collection(dbFirestore, 'group_posts'),
            where('groupId', 'in', chunk),
            where('authorId', '==', targetUserId)
          );
          try {
            const snap = await getDocs(q);
            snap.forEach((d) => {
              const p = d.data() as GroupPost;
              if (p?.id && p.status === 'published' && !p.isAnonymous) {
                postsById.set(p.id, p);
              }
            });
          } catch {
            // Fallback per-group query if composite index is absent
            for (const gid of chunk) {
              try {
                const gq = query(collection(dbFirestore, 'group_posts'), where('groupId', '==', gid));
                const gSnap = await getDocs(gq);
                gSnap.forEach((d) => {
                  const p = d.data() as GroupPost;
                  if (
                    p?.id &&
                    p.authorId === targetUserId &&
                    p.status === 'published' &&
                    !p.isAnonymous
                  ) {
                    postsById.set(p.id, p);
                  }
                });
              } catch {
                // skip inaccessible group
              }
            }
          }
        }
      }

      const posts = Array.from(postsById.values()).sort((a, b) =>
        (b.createdAt || '').localeCompare(a.createdAt || '')
      );

      // Fetch reactions & comments for the distinct groupIds of these posts
      const distinctGroupIds = Array.from(new Set(posts.map((p) => p.groupId)));
      const reactionsByPost: Record<string, PostReaction[]> = {};
      const commentsByPost: Record<string, PostComment[]> = {};

      await Promise.all(
        distinctGroupIds.map(async (gid) => {
          try {
            const [rSnap, cSnap] = await Promise.all([
              getDocs(query(collection(dbFirestore, 'post_reactions'), where('groupId', '==', gid))),
              getDocs(query(collection(dbFirestore, 'post_comments'), where('groupId', '==', gid)))
            ]);
            rSnap.forEach((d) => {
              const r = d.data() as PostReaction;
              if (!reactionsByPost[r.postId]) reactionsByPost[r.postId] = [];
              reactionsByPost[r.postId].push(r);
            });
            cSnap.forEach((d) => {
              const c = d.data() as PostComment;
              if (!commentsByPost[c.postId]) commentsByPost[c.postId] = [];
              commentsByPost[c.postId].push(c);
            });
          } catch {
            // ignore
          }
        })
      );

      // Also load author's legacy Capsules cleanly
      const allCapsules = await zaureService.getCapsules();
      const userCapsules = allCapsules.filter((c) => c.auteur_id === targetUserId);

      return { posts, capsules: userCapsules, reactionsByPost, commentsByPost, groupsMap };
    } catch (err) {
      console.warn('Info - fetchProfilePublications:', err);
      return { posts: [], capsules: [], reactionsByPost: {}, commentsByPost: {}, groupsMap: {} };
    }
  },

  // ---------------------------------------------------------------------------
  // 3. USER COMMUNITIES (RESPECTING PRIVATE GROUP ISOLATION)
  // ---------------------------------------------------------------------------
  fetchProfileCommunities: async (
    targetUserId: string,
    viewerId: string
  ): Promise<{
    communities: ProfileCommunityEntry[];
    viewerSharesGroup: boolean;
  }> => {
    if (!dbFirestore || !auth?.currentUser || !targetUserId) {
      return { communities: [], viewerSharesGroup: false };
    }

    const isOwn = targetUserId === viewerId;
    try {
      const [groupsSnap, viewerMemSnap] = await Promise.all([
        getDocs(collection(dbFirestore, 'groups')),
        getDocs(query(collection(dbFirestore, 'group_members'), where('userId', '==', viewerId)))
      ]);

      const groupsById = new Map<string, CommunityGroup>();
      const viewerActiveGroups = new Set<string>();

      viewerMemSnap.forEach((d) => {
        const m = d.data() as CommunityMember;
        if (m.status === 'active') viewerActiveGroups.add(m.groupId);
      });

      groupsSnap.forEach((d) => {
        const g = d.data() as CommunityGroup;
        if (g?.id) groupsById.set(g.id, g);
      });

      const entries: ProfileCommunityEntry[] = [];
      let viewerSharesGroup = false;

      if (isOwn) {
        viewerMemSnap.forEach((d) => {
          const m = d.data() as CommunityMember;
          const grp = groupsById.get(m.groupId);
          if (grp && m.status === 'active') {
            entries.push({ group: grp, membership: m });
          }
        });
      } else {
        const visibleGroupIds = Array.from(groupsById.values())
          .filter((g) => g.privacy === 'public' || viewerActiveGroups.has(g.id))
          .map((g) => g.id);

        for (let i = 0; i < visibleGroupIds.length; i += 30) {
          const chunk = visibleGroupIds.slice(i, i + 30);
          try {
            const q = query(
              collection(dbFirestore, 'group_members'),
              where('groupId', 'in', chunk),
              where('userId', '==', targetUserId)
            );
            const snap = await getDocs(q);
            snap.forEach((d) => {
              const m = d.data() as CommunityMember;
              const grp = groupsById.get(m.groupId);
              if (grp && m.status === 'active') {
                if (viewerActiveGroups.has(grp.id)) viewerSharesGroup = true;
                entries.push({ group: grp, membership: m });
              }
            });
          } catch {
            // Fallback per-group lookup if needed
            for (const gid of chunk) {
              try {
                const memSnap = await getDoc(doc(dbFirestore, 'group_members', `${gid}_${targetUserId}`));
                if (memSnap.exists()) {
                  const m = memSnap.data() as CommunityMember;
                  const grp = groupsById.get(gid);
                  if (grp && m.status === 'active') {
                    if (viewerActiveGroups.has(gid)) viewerSharesGroup = true;
                    entries.push({ group: grp, membership: m });
                  }
                }
              } catch {
                // ignore
              }
            }
          }
        }
      }

      entries.sort((a, b) => (b.group.memberCount || 0) - (a.group.memberCount || 0));
      return { communities: entries, viewerSharesGroup };
    } catch (err) {
      console.warn('Info - fetchProfileCommunities:', err);
      return { communities: [], viewerSharesGroup: false };
    }
  },

  syncUserPrivacyFromSettings: async (userId: string): Promise<UserPrivacySettings> => {
    try {
      const settings = await zaureService.getUserSettings(userId);
      if (settings.privacy_settings) {
        return normalizePrivacySettings(settings.privacy_settings);
      }
      // Map legacy settings into modern UserPrivacySettings smoothly
      return {
        ...DEFAULT_PRIVACY_SETTINGS,
        infoVisibility: settings.profil_visibilite === 'cercles' ? 'cercles' : 'public',
        postsVisibility: settings.capsules_visibilite === 'cercles' ? 'cercles' : 'public',
        allowMessages:
          settings.messages_autorises === 'cercles'
            ? 'cercles'
            : settings.messages_autorises === 'mentors'
            ? 'mentors'
            : 'tous'
      };
    } catch {
      return { ...DEFAULT_PRIVACY_SETTINGS };
    }
  }
};
