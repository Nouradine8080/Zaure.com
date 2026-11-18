import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  writeBatch,
  increment,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL
} from 'firebase/storage';
import {
  auth,
  dbFirestore,
  storage,
  handleFirestoreError,
  OperationType
} from '../firebaseClient';
import {
  CommunityGroup,
  CommunityMember,
  GroupPost,
  PostComment,
  PostReaction,
  GroupReactionType,
  GroupEvent,
  GroupAnnouncement,
  GroupInvitation,
  GroupNotification,
  GroupReport,
  GroupMemberRole,
  ModeratorPermissions,
  GroupPostMediaItem,
  GroupPostType,
  GroupPoll,
  UserProfile
} from '../types';
import { compressImageFile } from '../utils/imageCompressor';

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export const PUBLIC_FEED_GROUP: CommunityGroup = {
  id: 'public',
  name: 'Fil public',
  description: 'Publications libres partagées avec toute la communauté hors cercle.',
  category: 'Général',
  coverPhoto: '',
  avatarPhoto: '',
  privacy: 'public',
  postPermission: 'all_members',
  requirePostApproval: false,
  requireMemberApproval: false,
  allowAnonymousPosts: false,
  rules: [],
  createdBy: 'system',
  createdAt: '',
  updatedAt: '',
  memberCount: 0,
  postCount: 0
};

export const communityService = {
  // ---------------------------------------------------------------------------
  // 1. STORAGE MEDIA UPLOAD FOR COMMUNITY POSTS, COVERS, AVATARS & DOCUMENTS
  // ---------------------------------------------------------------------------
  uploadCommunityMedia: async (
    groupId: string,
    file: File,
    folder: 'images' | 'videos' | 'documents' | 'branding',
    onProgress?: (pct: number) => void
  ): Promise<GroupPostMediaItem> => {
    const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `community_media/${groupId}/${folder}/${Date.now()}_${cleanName}`;

    let itemType: 'image' | 'video' | 'document' = 'document';
    if (file.type.startsWith('image/')) itemType = 'image';
    else if (file.type.startsWith('video/')) itemType = 'video';

    if (storage) {
      try {
        const ref = storageRef(storage, storagePath);
        const task = uploadBytesResumable(ref, file, {
          contentType: file.type || undefined
        });

        const url = await new Promise<string>((resolve, reject) => {
          task.on(
            'state_changed',
            (snap) => {
              if (onProgress && snap.totalBytes > 0) {
                onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
              }
            },
            (err) => reject(err),
            async () => {
              const dlUrl = await getDownloadURL(task.snapshot.ref);
              resolve(dlUrl);
            }
          );
        });

        return {
          type: itemType,
          url,
          name: file.name,
          size: file.size,
          mimeType: file.type || undefined
        };
      } catch (err) {
        console.warn('Info - Storage upload fallback:', err);
      }
    }

    // Fallback for images using compression so document stays under Firestore bounds
    if (itemType === 'image') {
      const compressed = await compressImageFile(file, 960, 720, 0.8);
      if (compressed.length > 340000) {
        throw new Error("L'image est trop lourde et Firebase Storage est indisponible. Réduisez sa taille.");
      }
      if (onProgress) onProgress(100);
      return {
        type: 'image',
        url: compressed,
        name: file.name,
        size: compressed.length,
        mimeType: 'image/jpeg'
      };
    }

    throw new Error('Firebase Storage est requis pour téléverser des vidéos ou documents volumineux.');
  },

  // ---------------------------------------------------------------------------
  // 2. COMMUNITY GROUPS (CERCLES) CRUD & DISCOVERY
  // ---------------------------------------------------------------------------
  subscribeGroups: (
    onData: (groups: CommunityGroup[]) => void,
    onError?: (err: Error) => void
  ): (() => void) => {
    if (!dbFirestore || !auth?.currentUser) {
      onData([]);
      return () => {};
    }
    return onSnapshot(
      collection(dbFirestore, 'groups'),
      (snap) => {
        const byId = new Map<string, CommunityGroup>();
        snap.forEach((d) => {
          const item = d.data() as CommunityGroup;
          if (item?.id) byId.set(item.id, item);
        });
        const list = Array.from(byId.values());
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        onData(list);
      },
      (error) => {
        if (onError) onError(error);
        else console.warn('Info - subscribeGroups:', error);
      }
    );
  },

  createGroup: async (
    input: {
      name: string;
      description: string;
      category: string;
      coverPhoto?: string;
      avatarPhoto?: string;
      privacy: 'public' | 'private';
      postPermission: 'all_members' | 'admins_only';
      requirePostApproval: boolean;
      requireMemberApproval: boolean;
      allowAnonymousPosts: boolean;
      rules: string[];
    },
    creator: UserProfile
  ): Promise<CommunityGroup> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Vous devez être connecté.');
    const groupId = makeId('grp');
    const ts = nowIso();

    const newGroup: CommunityGroup = {
      id: groupId,
      name: input.name.trim().slice(0, 120),
      description: input.description.trim().slice(0, 2000),
      category: input.category.trim().slice(0, 60) || 'Vie communautaire',
      coverPhoto: input.coverPhoto || '',
      avatarPhoto: input.avatarPhoto || '',
      privacy: input.privacy,
      postPermission: input.postPermission,
      requirePostApproval: input.requirePostApproval,
      requireMemberApproval: input.requireMemberApproval,
      allowAnonymousPosts: input.allowAnonymousPosts,
      rules: input.rules.map((r) => r.trim().slice(0, 300)).filter(Boolean).slice(0, 20),
      createdBy: creator.id,
      createdAt: ts,
      updatedAt: ts,
      memberCount: 1,
      postCount: 0
    };

    const memberId = `${groupId}_${creator.id}`;
    const adminMembership: CommunityMember = {
      id: memberId,
      groupId,
      userId: creator.id,
      userName: creator.nom.slice(0, 120),
      userAvatar: creator.avatar_url || '',
      role: 'administrateur',
      status: 'active',
      permissions: {
        approvePosts: true,
        manageComments: true,
        manageReports: true,
        approveMembers: true
      },
      joinedAt: ts,
      updatedAt: ts
    };

    try {
      await setDoc(doc(dbFirestore, 'groups', groupId), newGroup);
      await setDoc(doc(dbFirestore, 'group_members', memberId), adminMembership);
      return newGroup;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `groups/${groupId}`);
    }
  },

  updateGroupSettings: async (
    groupId: string,
    updates: Partial<
      Pick<
        CommunityGroup,
        | 'name'
        | 'description'
        | 'category'
        | 'coverPhoto'
        | 'avatarPhoto'
        | 'privacy'
        | 'postPermission'
        | 'requirePostApproval'
        | 'requireMemberApproval'
        | 'allowAnonymousPosts'
        | 'rules'
      >
    >
  ): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Non connecté.');
    const payload: Record<string, unknown> = { updatedAt: nowIso() };
    if (typeof updates.name === 'string') payload.name = updates.name.trim().slice(0, 120);
    if (typeof updates.description === 'string') payload.description = updates.description.trim().slice(0, 2000);
    if (typeof updates.category === 'string') payload.category = updates.category.trim().slice(0, 60);
    if (typeof updates.coverPhoto === 'string') payload.coverPhoto = updates.coverPhoto.slice(0, 350000);
    if (typeof updates.avatarPhoto === 'string') payload.avatarPhoto = updates.avatarPhoto.slice(0, 350000);
    if (updates.privacy) payload.privacy = updates.privacy;
    if (updates.postPermission) payload.postPermission = updates.postPermission;
    if (typeof updates.requirePostApproval === 'boolean') payload.requirePostApproval = updates.requirePostApproval;
    if (typeof updates.requireMemberApproval === 'boolean') payload.requireMemberApproval = updates.requireMemberApproval;
    if (typeof updates.allowAnonymousPosts === 'boolean') payload.allowAnonymousPosts = updates.allowAnonymousPosts;
    if (Array.isArray(updates.rules)) {
      payload.rules = updates.rules.map((r) => r.trim().slice(0, 300)).filter(Boolean).slice(0, 20);
    }

    try {
      await updateDoc(doc(dbFirestore, 'groups', groupId), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `groups/${groupId}`);
    }
  },

  deleteGroup: async (groupId: string): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Non connecté.');
    try {
      await deleteDoc(doc(dbFirestore, 'groups', groupId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `groups/${groupId}`);
    }
  },

  // ---------------------------------------------------------------------------
  // 3. MEMBERSHIPS, ROLES, APPROVALS, SUSPENSIONS & EXCLUSIONS
  // ---------------------------------------------------------------------------
  subscribeUserMemberships: (
    userId: string,
    onData: (memberships: CommunityMember[]) => void
  ): (() => void) => {
    if (!dbFirestore || !auth?.currentUser || !userId) {
      onData([]);
      return () => {};
    }
    const q = query(collection(dbFirestore, 'group_members'), where('userId', '==', userId));
    return onSnapshot(
      q,
      (snap) => {
        const list: CommunityMember[] = [];
        snap.forEach((d) => list.push(d.data() as CommunityMember));
        onData(list);
      },
      (err) => console.warn('Info - subscribeUserMemberships:', err)
    );
  },

  subscribeGroupMembers: (
    groupId: string,
    onData: (members: CommunityMember[]) => void
  ): (() => void) => {
    if (!dbFirestore || !auth?.currentUser || !groupId) {
      onData([]);
      return () => {};
    }
    const q = query(collection(dbFirestore, 'group_members'), where('groupId', '==', groupId));
    return onSnapshot(
      q,
      (snap) => {
        const list: CommunityMember[] = [];
        snap.forEach((d) => list.push(d.data() as CommunityMember));
        list.sort((a, b) => {
          const rank: Record<GroupMemberRole, number> = {
            administrateur: 0,
            moderateur: 1,
            membre: 2
          };
          const diff = rank[a.role] - rank[b.role];
          if (diff !== 0) return diff;
          return (b.joinedAt || '').localeCompare(a.joinedAt || '');
        });
        onData(list);
      },
      (err) => console.warn('Info - subscribeGroupMembers:', err)
    );
  },

  joinGroup: async (
    group: CommunityGroup,
    user: UserProfile,
    inviteCode?: string
  ): Promise<CommunityMember> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Vous devez être connecté.');
    const memberId = `${group.id}_${user.id}`;
    const ts = nowIso();
    const needsApproval = !inviteCode && (group.privacy === 'private' || group.requireMemberApproval);
    const status = needsApproval ? 'pending' : 'active';

    const memberDoc: CommunityMember = {
      id: memberId,
      groupId: group.id,
      userId: user.id,
      userName: user.nom.slice(0, 120),
      userAvatar: user.avatar_url || '',
      role: 'membre',
      status,
      ...(inviteCode ? { inviteCode } : {}),
      joinedAt: ts,
      updatedAt: ts
    };

    try {
      const batch = writeBatch(dbFirestore);
      batch.set(doc(dbFirestore, 'group_members', memberId), memberDoc);
      if (status === 'active') {
        batch.update(doc(dbFirestore, 'groups', group.id), {
          memberCount: increment(1),
          updatedAt: ts
        });
      }
      await batch.commit();
      return memberDoc;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `group_members/${memberId}`);
    }
  },

  leaveGroup: async (groupId: string, userId: string, wasActive: boolean): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Non connecté.');
    const memberId = `${groupId}_${userId}`;
    try {
      const batch = writeBatch(dbFirestore);
      batch.delete(doc(dbFirestore, 'group_members', memberId));
      if (wasActive) {
        batch.update(doc(dbFirestore, 'groups', groupId), {
          memberCount: increment(-1),
          updatedAt: nowIso()
        });
      }
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `group_members/${memberId}`);
    }
  },

  approveMemberRequest: async (
    group: CommunityGroup,
    targetUserId: string,
    actorName: string
  ): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Non connecté.');
    const memberId = `${group.id}_${targetUserId}`;
    const ts = nowIso();
    try {
      const batch = writeBatch(dbFirestore);
      batch.update(doc(dbFirestore, 'group_members', memberId), {
        status: 'active',
        updatedAt: ts
      });
      batch.update(doc(dbFirestore, 'groups', group.id), {
        memberCount: increment(1),
        updatedAt: ts
      });
      await batch.commit();

      await communityService.createNotification({
        userId: targetUserId,
        groupId: group.id,
        groupName: group.name,
        type: 'member_approved',
        message: `Votre demande pour rejoindre « ${group.name} » a été acceptée.`,
        actorName
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `group_members/${memberId}`);
    }
  },

  rejectOrRemoveMember: async (
    groupId: string,
    targetUserId: string,
    wasActive: boolean
  ): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Non connecté.');
    const memberId = `${groupId}_${targetUserId}`;
    try {
      const batch = writeBatch(dbFirestore);
      batch.delete(doc(dbFirestore, 'group_members', memberId));
      if (wasActive) {
        batch.update(doc(dbFirestore, 'groups', groupId), {
          memberCount: increment(-1),
          updatedAt: nowIso()
        });
      }
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `group_members/${memberId}`);
    }
  },

  suspendMember: async (groupId: string, targetUserId: string, suspend: boolean): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Non connecté.');
    const memberId = `${groupId}_${targetUserId}`;
    try {
      await updateDoc(doc(dbFirestore, 'group_members', memberId), {
        status: suspend ? 'suspended' : 'active',
        updatedAt: nowIso()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `group_members/${memberId}`);
    }
  },

  updateMemberRole: async (
    group: CommunityGroup,
    targetUserId: string,
    role: GroupMemberRole,
    actorName: string,
    permissions?: ModeratorPermissions
  ): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Non connecté.');
    const memberId = `${group.id}_${targetUserId}`;
    const defaultPerms: ModeratorPermissions = permissions || {
      approvePosts: role !== 'membre',
      manageComments: role !== 'membre',
      manageReports: role !== 'membre',
      approveMembers: role === 'administrateur'
    };

    try {
      await updateDoc(doc(dbFirestore, 'group_members', memberId), {
        role,
        permissions: role === 'membre' ? null : defaultPerms,
        updatedAt: nowIso()
      });

      const roleLabel =
        role === 'administrateur' ? 'Administrateur' : role === 'moderateur' ? 'Modérateur' : 'Membre';
      await communityService.createNotification({
        userId: targetUserId,
        groupId: group.id,
        groupName: group.name,
        type: 'role_changed',
        message: `Votre rôle dans « ${group.name} » est désormais : ${roleLabel}.`,
        actorName
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `group_members/${memberId}`);
    }
  },

  // ---------------------------------------------------------------------------
  // 4. GROUP POSTS (TEXT, MEDIA, LINKS, DOCS, POLLS, SCHEDULED, ANONYMOUS)
  // ---------------------------------------------------------------------------
  subscribeGroupPosts: (
    groupId: string,
    onData: (posts: GroupPost[]) => void
  ): (() => void) => {
    if (!dbFirestore || !auth?.currentUser || !groupId) {
      onData([]);
      return () => {};
    }
    const q = query(collection(dbFirestore, 'group_posts'), where('groupId', '==', groupId));
    return onSnapshot(
      q,
      (snap) => {
        const list: GroupPost[] = [];
        snap.forEach((d) => list.push(d.data() as GroupPost));
        list.sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        });
        onData(list);
      },
      (err) => console.warn('Info - subscribeGroupPosts:', err)
    );
  },

  createGroupPost: async (
    group: CommunityGroup,
    author: UserProfile,
    memberRole: GroupMemberRole,
    input: {
      type: GroupPostType;
      content: string;
      media: GroupPostMediaItem[];
      externalLink?: string;
      poll?: GroupPoll | null;
      isAnonymous: boolean;
      scheduledFor?: string;
    }
  ): Promise<GroupPost> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Vous devez être connecté.');
    const postId = makeId('gpost');
    const ts = nowIso();
    const isStaff = memberRole === 'administrateur' || memberRole === 'moderateur';

    let status: 'published' | 'pending' | 'scheduled' = 'published';
    if (group.requirePostApproval && !isStaff) {
      status = 'pending';
    } else if (input.scheduledFor && new Date(input.scheduledFor).getTime() > Date.now() + 30000) {
      status = 'scheduled';
    }

    const useAnon = Boolean(input.isAnonymous && group.allowAnonymousPosts);

    const post: GroupPost = {
      id: postId,
      groupId: group.id,
      authorId: author.id,
      authorName: author.nom.slice(0, 120),
      authorAvatar: author.avatar_url || '',
      isAnonymous: useAnon,
      type: input.type,
      content: input.content.trim().slice(0, 10000),
      media: input.media.slice(0, 10),
      externalLink: input.externalLink ? input.externalLink.trim().slice(0, 1000) : '',
      poll: input.poll || null,
      status,
      scheduledFor: input.scheduledFor || '',
      isPinned: false,
      reactionCount: 0,
      commentCount: 0,
      shareCount: 0,
      savedBy: [],
      createdAt: ts,
      updatedAt: ts
    };

    try {
      if (group.id === 'public') {
        await setDoc(doc(dbFirestore, 'group_posts', postId), post);
      } else {
        const batch = writeBatch(dbFirestore);
        batch.set(doc(dbFirestore, 'group_posts', postId), post);
        batch.update(doc(dbFirestore, 'groups', group.id), {
          postCount: increment(1),
          updatedAt: ts
        });
        await batch.commit();
      }
      return post;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `group_posts/${postId}`);
    }
  },

  updateGroupPost: async (
    postId: string,
    updates: Partial<
      Pick<
        GroupPost,
        'content' | 'media' | 'externalLink' | 'poll' | 'status' | 'isPinned' | 'scheduledFor'
      >
    >
  ): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Non connecté.');
    const payload: Record<string, unknown> = { updatedAt: nowIso() };
    if (typeof updates.content === 'string') payload.content = updates.content.trim().slice(0, 10000);
    if (Array.isArray(updates.media)) payload.media = updates.media.slice(0, 10);
    if (typeof updates.externalLink === 'string') payload.externalLink = updates.externalLink.trim().slice(0, 1000);
    if (updates.poll !== undefined) payload.poll = updates.poll;
    if (updates.status) payload.status = updates.status;
    if (typeof updates.isPinned === 'boolean') payload.isPinned = updates.isPinned;
    if (typeof updates.scheduledFor === 'string') payload.scheduledFor = updates.scheduledFor;

    try {
      await updateDoc(doc(dbFirestore, 'group_posts', postId), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `group_posts/${postId}`);
    }
  },

  toggleSavePost: async (postId: string, userId: string, isSaved: boolean): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Non connecté.');
    try {
      await updateDoc(doc(dbFirestore, 'group_posts', postId), {
        savedBy: isSaved ? arrayRemove(userId) : arrayUnion(userId),
        updatedAt: nowIso()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `group_posts/${postId}`);
    }
  },

  incrementPostShare: async (postId: string): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser) return;
    try {
      await updateDoc(doc(dbFirestore, 'group_posts', postId), {
        shareCount: increment(1),
        updatedAt: nowIso()
      });
    } catch (error) {
      console.warn('Info - shareCount:', error);
    }
  },

  votePoll: async (post: GroupPost, optionId: string, userId: string): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser || !post.poll) return;
    const updatedOptions = post.poll.options.map((opt) => {
      const hasVoted = opt.voterIds.includes(userId);
      if (opt.id === optionId) {
        return {
          ...opt,
          voterIds: hasVoted
            ? opt.voterIds.filter((id) => id !== userId)
            : [...opt.voterIds, userId]
        };
      }
      if (!post.poll!.allowMultiple && hasVoted) {
        return {
          ...opt,
          voterIds: opt.voterIds.filter((id) => id !== userId)
        };
      }
      return opt;
    });

    try {
      await updateDoc(doc(dbFirestore, 'group_posts', post.id), {
        poll: {
          ...post.poll,
          options: updatedOptions
        },
        updatedAt: nowIso()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `group_posts/${post.id}`);
    }
  },

  deleteGroupPost: async (postId: string, groupId: string): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Non connecté.');
    try {
      if (groupId === 'public') {
        await deleteDoc(doc(dbFirestore, 'group_posts', postId));
      } else {
        const batch = writeBatch(dbFirestore);
        batch.delete(doc(dbFirestore, 'group_posts', postId));
        batch.update(doc(dbFirestore, 'groups', groupId), {
          postCount: increment(-1),
          updatedAt: nowIso()
        });
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `group_posts/${postId}`);
    }
  },

  // ---------------------------------------------------------------------------
  // 5. POST REACTIONS & COMMENTS
  // ---------------------------------------------------------------------------
  subscribeGroupReactions: (
    groupId: string,
    onData: (reactions: PostReaction[]) => void
  ): (() => void) => {
    if (!dbFirestore || !auth?.currentUser || !groupId) {
      onData([]);
      return () => {};
    }
    const q = query(collection(dbFirestore, 'post_reactions'), where('groupId', '==', groupId));
    return onSnapshot(
      q,
      (snap) => {
        const list: PostReaction[] = [];
        snap.forEach((d) => list.push(d.data() as PostReaction));
        onData(list);
      },
      (err) => console.warn('Info - subscribeGroupReactions:', err)
    );
  },

  togglePostReaction: async (
    post: GroupPost,
    user: UserProfile,
    type: GroupReactionType,
    existingReaction?: PostReaction
  ): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Non connecté.');
    const reactionId = `${post.id}_${user.id}`;
    const ts = nowIso();

    try {
      const batch = writeBatch(dbFirestore);
      if (existingReaction && existingReaction.type === type) {
        batch.delete(doc(dbFirestore, 'post_reactions', reactionId));
        batch.update(doc(dbFirestore, 'group_posts', post.id), {
          reactionCount: increment(-1),
          updatedAt: ts
        });
      } else if (existingReaction) {
        batch.update(doc(dbFirestore, 'post_reactions', reactionId), {
          type,
          createdAt: ts
        });
      } else {
        const newReaction: PostReaction = {
          id: reactionId,
          postId: post.id,
          groupId: post.groupId,
          userId: user.id,
          userName: user.nom.slice(0, 120),
          type,
          createdAt: ts
        };
        batch.set(doc(dbFirestore, 'post_reactions', reactionId), newReaction);
        batch.update(doc(dbFirestore, 'group_posts', post.id), {
          reactionCount: increment(1),
          updatedAt: ts
        });
      }
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `post_reactions/${reactionId}`);
    }
  },

  subscribeGroupComments: (
    groupId: string,
    onData: (comments: PostComment[]) => void
  ): (() => void) => {
    if (!dbFirestore || !auth?.currentUser || !groupId) {
      onData([]);
      return () => {};
    }
    const q = query(collection(dbFirestore, 'post_comments'), where('groupId', '==', groupId));
    return onSnapshot(
      q,
      (snap) => {
        const list: PostComment[] = [];
        snap.forEach((d) => list.push(d.data() as PostComment));
        list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
        onData(list);
      },
      (err) => console.warn('Info - subscribeGroupComments:', err)
    );
  },

  addPostComment: async (
    group: CommunityGroup,
    post: GroupPost,
    author: UserProfile,
    content: string,
    parentId?: string | null,
    mentions: string[] = []
  ): Promise<PostComment> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Non connecté.');
    const commentId = makeId('gcom');
    const ts = nowIso();
    const comment: PostComment = {
      id: commentId,
      postId: post.id,
      groupId: group.id,
      parentId: parentId || '',
      authorId: author.id,
      authorName: author.nom.slice(0, 120),
      authorAvatar: author.avatar_url || '',
      content: content.trim().slice(0, 3000),
      mentions: mentions.slice(0, 20),
      likedBy: [],
      isEdited: false,
      createdAt: ts,
      updatedAt: ts
    };

    try {
      const batch = writeBatch(dbFirestore);
      batch.set(doc(dbFirestore, 'post_comments', commentId), comment);
      batch.update(doc(dbFirestore, 'group_posts', post.id), {
        commentCount: increment(1),
        updatedAt: ts
      });
      await batch.commit();

      if (post.authorId !== author.id) {
        await communityService.createNotification({
          userId: post.authorId,
          groupId: group.id,
          groupName: group.name,
          type: 'comment',
          message: `${author.nom} a commenté votre publication dans « ${group.name} ».`,
          actorName: author.nom
        });
      }

      for (const mentionedUid of mentions) {
        if (mentionedUid && mentionedUid !== author.id && mentionedUid !== post.authorId) {
          await communityService.createNotification({
            userId: mentionedUid,
            groupId: group.id,
            groupName: group.name,
            type: 'mention',
            message: `${author.nom} vous a mentionné dans un commentaire (« ${group.name} »).`,
            actorName: author.nom
          });
        }
      }

      return comment;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `post_comments/${commentId}`);
    }
  },

  updatePostComment: async (commentId: string, content: string, mentions: string[] = []): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Non connecté.');
    try {
      await updateDoc(doc(dbFirestore, 'post_comments', commentId), {
        content: content.trim().slice(0, 3000),
        mentions: mentions.slice(0, 20),
        isEdited: true,
        updatedAt: nowIso()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `post_comments/${commentId}`);
    }
  },

  toggleLikeComment: async (commentId: string, userId: string, isLiked: boolean): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Non connecté.');
    try {
      await updateDoc(doc(dbFirestore, 'post_comments', commentId), {
        likedBy: isLiked ? arrayRemove(userId) : arrayUnion(userId),
        updatedAt: nowIso()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `post_comments/${commentId}`);
    }
  },

  deletePostComment: async (commentId: string, postId: string): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Non connecté.');
    try {
      const batch = writeBatch(dbFirestore);
      batch.delete(doc(dbFirestore, 'post_comments', commentId));
      batch.update(doc(dbFirestore, 'group_posts', postId), {
        commentCount: increment(-1),
        updatedAt: nowIso()
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `post_comments/${commentId}`);
    }
  },

  // ---------------------------------------------------------------------------
  // 6. EVENTS & RSVP
  // ---------------------------------------------------------------------------
  subscribeGroupEvents: (
    groupId: string,
    onData: (events: GroupEvent[]) => void
  ): (() => void) => {
    if (!dbFirestore || !auth?.currentUser || !groupId) {
      onData([]);
      return () => {};
    }
    const q = query(collection(dbFirestore, 'group_events'), where('groupId', '==', groupId));
    return onSnapshot(
      q,
      (snap) => {
        const list: GroupEvent[] = [];
        snap.forEach((d) => list.push(d.data() as GroupEvent));
        list.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
        onData(list);
      },
      (err) => console.warn('Info - subscribeGroupEvents:', err)
    );
  },

  createGroupEvent: async (
    group: CommunityGroup,
    creator: UserProfile,
    input: {
      title: string;
      description: string;
      location: string;
      isOnline: boolean;
      meetingLink?: string;
      startDate: string;
      endDate?: string;
      coverPhoto?: string;
    }
  ): Promise<GroupEvent> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Non connecté.');
    const eventId = makeId('gevt');
    const ev: GroupEvent = {
      id: eventId,
      groupId: group.id,
      title: input.title.trim().slice(0, 160),
      description: input.description.trim().slice(0, 2000),
      location: input.location.trim().slice(0, 250),
      isOnline: input.isOnline,
      meetingLink: input.meetingLink?.trim().slice(0, 500) || '',
      startDate: input.startDate,
      endDate: input.endDate || '',
      coverPhoto: input.coverPhoto || '',
      createdBy: creator.id,
      createdByName: creator.nom.slice(0, 120),
      attendeeIds: [creator.id],
      interestedIds: [],
      createdAt: nowIso()
    };

    try {
      await setDoc(doc(dbFirestore, 'group_events', eventId), ev);
      return ev;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `group_events/${eventId}`);
    }
  },

  rsvpEvent: async (
    eventId: string,
    userId: string,
    choice: 'going' | 'interested' | 'none'
  ): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Non connecté.');
    try {
      const ref = doc(dbFirestore, 'group_events', eventId);
      if (choice === 'going') {
        await updateDoc(ref, {
          attendeeIds: arrayUnion(userId),
          interestedIds: arrayRemove(userId)
        });
      } else if (choice === 'interested') {
        await updateDoc(ref, {
          interestedIds: arrayUnion(userId),
          attendeeIds: arrayRemove(userId)
        });
      } else {
        await updateDoc(ref, {
          attendeeIds: arrayRemove(userId),
          interestedIds: arrayRemove(userId)
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `group_events/${eventId}`);
    }
  },

  deleteGroupEvent: async (eventId: string): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Non connecté.');
    try {
      await deleteDoc(doc(dbFirestore, 'group_events', eventId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `group_events/${eventId}`);
    }
  },

  // ---------------------------------------------------------------------------
  // 7. ANNOUNCEMENTS
  // ---------------------------------------------------------------------------
  subscribeGroupAnnouncements: (
    groupId: string,
    onData: (announcements: GroupAnnouncement[]) => void
  ): (() => void) => {
    if (!dbFirestore || !auth?.currentUser || !groupId) {
      onData([]);
      return () => {};
    }
    const q = query(collection(dbFirestore, 'group_announcements'), where('groupId', '==', groupId));
    return onSnapshot(
      q,
      (snap) => {
        const list: GroupAnnouncement[] = [];
        snap.forEach((d) => list.push(d.data() as GroupAnnouncement));
        list.sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        });
        onData(list);
      },
      (err) => console.warn('Info - subscribeGroupAnnouncements:', err)
    );
  },

  createAnnouncement: async (
    group: CommunityGroup,
    author: UserProfile,
    input: { title: string; content: string; priority: 'normal' | 'important' | 'urgent'; isPinned: boolean }
  ): Promise<GroupAnnouncement> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Non connecté.');
    const annId = makeId('gann');
    const ann: GroupAnnouncement = {
      id: annId,
      groupId: group.id,
      title: input.title.trim().slice(0, 160),
      content: input.content.trim().slice(0, 4000),
      priority: input.priority,
      authorId: author.id,
      authorName: author.nom.slice(0, 120),
      isPinned: input.isPinned,
      createdAt: nowIso()
    };

    try {
      await setDoc(doc(dbFirestore, 'group_announcements', annId), ann);
      return ann;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `group_announcements/${annId}`);
    }
  },

  deleteAnnouncement: async (annId: string): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Non connecté.');
    try {
      await deleteDoc(doc(dbFirestore, 'group_announcements', annId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `group_announcements/${annId}`);
    }
  },

  // ---------------------------------------------------------------------------
  // 8. INVITATIONS (DIRECT & SHAREABLE LINK CODE)
  // ---------------------------------------------------------------------------
  subscribeIncomingInvitations: (
    userId: string,
    onData: (invs: GroupInvitation[]) => void
  ): (() => void) => {
    if (!dbFirestore || !auth?.currentUser || !userId) {
      onData([]);
      return () => {};
    }
    const q = query(collection(dbFirestore, 'group_invitations'), where('inviteeId', '==', userId));
    return onSnapshot(
      q,
      (snap) => {
        const list: GroupInvitation[] = [];
        snap.forEach((d) => list.push(d.data() as GroupInvitation));
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        onData(list);
      },
      (err) => console.warn('Info - subscribeIncomingInvitations:', err)
    );
  },

  sendDirectInvitation: async (
    group: CommunityGroup,
    inviter: UserProfile,
    inviteeId: string
  ): Promise<GroupInvitation> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Non connecté.');
    const invId = `${group.id}_${inviteeId}`;
    const inv: GroupInvitation = {
      id: invId,
      groupId: group.id,
      groupName: group.name.slice(0, 120),
      groupAvatar: group.avatarPhoto || '',
      groupPrivacy: group.privacy,
      inviterId: inviter.id,
      inviterName: inviter.nom.slice(0, 120),
      inviteeId,
      status: 'pending',
      createdAt: nowIso()
    };

    try {
      await setDoc(doc(dbFirestore, 'group_invitations', invId), inv);
      await communityService.createNotification({
        userId: inviteeId,
        groupId: group.id,
        groupName: group.name,
        type: 'invitation',
        message: `${inviter.nom} vous a invité(e) à rejoindre le cercle « ${group.name} ».`,
        actorName: inviter.nom
      });
      return inv;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `group_invitations/${invId}`);
    }
  },

  createInviteLinkCode: async (group: CommunityGroup, inviter: UserProfile): Promise<GroupInvitation> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Non connecté.');
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const invId = `${group.id}_${code}`;
    const inv: GroupInvitation = {
      id: invId,
      groupId: group.id,
      groupName: group.name.slice(0, 120),
      groupAvatar: group.avatarPhoto || '',
      groupPrivacy: group.privacy,
      inviterId: inviter.id,
      inviterName: inviter.nom.slice(0, 120),
      inviteeId: 'LINK',
      inviteCode: code,
      status: 'pending',
      createdAt: nowIso()
    };

    try {
      await setDoc(doc(dbFirestore, 'group_invitations', invId), inv);
      return inv;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `group_invitations/${invId}`);
    }
  },

  acceptInvitation: async (
    invitation: GroupInvitation,
    user: UserProfile
  ): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Non connecté.');
    const memberId = `${invitation.groupId}_${user.id}`;
    const ts = nowIso();
    const memberDoc: CommunityMember = {
      id: memberId,
      groupId: invitation.groupId,
      userId: user.id,
      userName: user.nom.slice(0, 120),
      userAvatar: user.avatar_url || '',
      role: 'membre',
      status: 'active',
      ...(invitation.inviteCode ? { inviteCode: invitation.inviteCode } : {}),
      joinedAt: ts,
      updatedAt: ts
    };

    try {
      const batch = writeBatch(dbFirestore);
      batch.set(doc(dbFirestore, 'group_members', memberId), memberDoc);
      batch.update(doc(dbFirestore, 'groups', invitation.groupId), {
        memberCount: increment(1),
        updatedAt: ts
      });
      if (invitation.inviteeId === user.id) {
        batch.update(doc(dbFirestore, 'group_invitations', invitation.id), {
          status: 'accepted'
        });
      }
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `group_invitations/${invitation.id}`);
    }
  },

  declineInvitation: async (invitationId: string): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Non connecté.');
    try {
      await updateDoc(doc(dbFirestore, 'group_invitations', invitationId), {
        status: 'declined'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `group_invitations/${invitationId}`);
    }
  },

  redeemInviteCode: async (code: string, user: UserProfile): Promise<CommunityGroup | null> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Non connecté.');
    const normalized = code.trim().toUpperCase();
    if (!normalized) return null;

    const q = query(
      collection(dbFirestore, 'group_invitations'),
      where('inviteCode', '==', normalized)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      throw new Error("Code d'invitation introuvable ou expiré.");
    }
    const inv = snap.docs[0].data() as GroupInvitation;
    if (inv.status !== 'pending') {
      throw new Error("Cette invitation n'est plus active.");
    }

    const existingMemberSnap = await getDoc(
      doc(dbFirestore, 'group_members', `${inv.groupId}_${user.id}`)
    );
    if (!existingMemberSnap.exists()) {
      await communityService.acceptInvitation(inv, user);
    }

    const groupSnap = await getDoc(doc(dbFirestore, 'groups', inv.groupId));
    return groupSnap.exists() ? (groupSnap.data() as CommunityGroup) : null;
  },

  // ---------------------------------------------------------------------------
  // 9. REAL-TIME NOTIFICATIONS
  // ---------------------------------------------------------------------------
  subscribeUserNotifications: (
    userId: string,
    onData: (notifs: GroupNotification[]) => void
  ): (() => void) => {
    if (!dbFirestore || !auth?.currentUser || !userId) {
      onData([]);
      return () => {};
    }
    const q = query(collection(dbFirestore, 'group_notifications'), where('userId', '==', userId));
    return onSnapshot(
      q,
      (snap) => {
        const list: GroupNotification[] = [];
        snap.forEach((d) => list.push(d.data() as GroupNotification));
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        onData(list);
      },
      (err) => console.warn('Info - subscribeUserNotifications:', err)
    );
  },

  createNotification: async (input: {
    userId: string;
    groupId: string;
    groupName: string;
    type: GroupNotification['type'];
    message: string;
    actorName: string;
  }): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser) return;
    const notifId = makeId('gnotif');
    const notif: GroupNotification = {
      id: notifId,
      userId: input.userId,
      groupId: input.groupId,
      groupName: input.groupName.slice(0, 120),
      type: input.type,
      message: input.message.slice(0, 500),
      actorName: input.actorName.slice(0, 120),
      isRead: false,
      createdAt: nowIso()
    };
    try {
      await setDoc(doc(dbFirestore, 'group_notifications', notifId), notif);
    } catch (err) {
      console.warn('Info - createNotification:', err);
    }
  },

  markNotificationRead: async (notifId: string): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser) return;
    try {
      await updateDoc(doc(dbFirestore, 'group_notifications', notifId), { isRead: true });
    } catch (err) {
      console.warn('Info - markNotificationRead:', err);
    }
  },

  markAllNotificationsRead: async (notifIds: string[]): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser || notifIds.length === 0) return;
    try {
      const batch = writeBatch(dbFirestore);
      for (const id of notifIds.slice(0, 100)) {
        batch.update(doc(dbFirestore, 'group_notifications', id), { isRead: true });
      }
      await batch.commit();
    } catch (err) {
      console.warn('Info - markAllNotificationsRead:', err);
    }
  },

  // ---------------------------------------------------------------------------
  // 10. MODERATION REPORTS
  // ---------------------------------------------------------------------------
  subscribeGroupReports: (
    groupId: string,
    onData: (reports: GroupReport[]) => void
  ): (() => void) => {
    if (!dbFirestore || !auth?.currentUser || !groupId) {
      onData([]);
      return () => {};
    }
    const q = query(collection(dbFirestore, 'group_reports'), where('groupId', '==', groupId));
    return onSnapshot(
      q,
      (snap) => {
        const list: GroupReport[] = [];
        snap.forEach((d) => list.push(d.data() as GroupReport));
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        onData(list);
      },
      (err) => console.warn('Info - subscribeGroupReports:', err)
    );
  },

  createReport: async (input: {
    groupId: string;
    targetType: 'post' | 'comment' | 'member';
    targetId: string;
    targetPreview: string;
    reporter: UserProfile;
    reason: string;
    details?: string;
  }): Promise<GroupReport> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Non connecté.');
    const reportId = makeId('grep');
    const report: GroupReport = {
      id: reportId,
      groupId: input.groupId,
      targetType: input.targetType,
      targetId: input.targetId,
      targetPreview: input.targetPreview.slice(0, 300),
      reporterId: input.reporter.id,
      reporterName: input.reporter.nom.slice(0, 120),
      reason: input.reason.slice(0, 120),
      details: input.details?.slice(0, 2000) || '',
      status: 'pending',
      createdAt: nowIso()
    };

    try {
      await setDoc(doc(dbFirestore, 'group_reports', reportId), report);
      return report;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `group_reports/${reportId}`);
    }
  },

  resolveReport: async (
    reportId: string,
    status: 'resolved' | 'dismissed',
    resolverId: string
  ): Promise<void> => {
    if (!dbFirestore || !auth?.currentUser) throw new Error('Non connecté.');
    try {
      await updateDoc(doc(dbFirestore, 'group_reports', reportId), {
        status,
        resolvedBy: resolverId
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `group_reports/${reportId}`);
    }
  }
};
