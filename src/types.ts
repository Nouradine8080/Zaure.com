export type PrivacyAudience = 'public' | 'followers' | 'cercles' | 'private';
export type MessageAudience = 'tous' | 'followers' | 'cercles' | 'mentors' | 'personne';

export interface UserPrivacySettings {
  profileMode: 'public' | 'private';
  infoVisibility: PrivacyAudience;
  postsVisibility: PrivacyAudience;
  followersVisibility: PrivacyAudience;
  followingVisibility: PrivacyAudience;
  communitiesVisibility: PrivacyAudience;
  allowMessages: MessageAudience;
}

export const DEFAULT_PRIVACY_SETTINGS: UserPrivacySettings = {
  profileMode: 'public',
  infoVisibility: 'public',
  postsVisibility: 'public',
  followersVisibility: 'public',
  followingVisibility: 'public',
  communitiesVisibility: 'public',
  allowMessages: 'tous'
};

export interface UserProfile {
  id: string; // Auth UID
  nom: string;
  username?: string;
  email: string;
  phone?: string;
  bio: string | null;
  avatar_url: string | null;
  cover_url?: string | null;
  profession?: string;
  formation?: string;
  localisation?: string;
  site_web?: string;
  infos_complementaires?: string;
  privacy_settings?: UserPrivacySettings;
  role: 'utilisateur' | 'mentor' | 'verifie';
  langue_preferee: 'fr' | 'ha' | 'en';
  created_at?: string;
  availability?: 'online' | 'busy' | 'offline';
  status_message?: string;
  last_active?: string;
}

export interface UserFollow {
  id: string; // `${followerId}_${followingId}`
  followerId: string;
  followingId: string;
  createdAt: string;
}

export interface UserReport {
  id: string;
  reporter_id: string;
  reporter_nom: string;
  reported_user_id: string;
  reason: 'spam' | 'harcelement' | 'usurpation' | 'contenu_inapproprie' | 'autre';
  details?: string;
  status: 'en_attente' | 'examine' | 'traite';
  created_at: string;
}

export interface Circle {
  id: string;
  nom: string;
  description: string;
  categorie: string;
  image: string;
  created_by?: string;
  created_at?: string;
}

export interface CircleMember {
  user_id: string;
  circle_id: string;
  role: 'membre' | 'moderateur';
  joined_at: string;
}

export interface Capsule {
  id: string;
  auteur_id: string;
  circle_id: string;
  type: 'texte' | 'audio' | 'video' | 'image';
  contenu: string; // text content, or base64 audio data URI
  langue_dorigine: 'fr' | 'ha' | 'en';
  created_at: string;
  // Joins (optional for display)
  auteur_nom?: string;
  auteur_role?: string;
  auteur_avatar?: string;
  circle_nom?: string;
}

export interface CapsuleTranslation {
  capsule_id: string;
  langue: 'fr' | 'ha' | 'en';
  contenu_traduit: string;
}

export interface Reaction {
  capsule_id: string;
  user_id: string;
  type: 'utile' | 'merci' | 'question';
}

export interface Comment {
  id: string;
  capsule_id: string;
  auteur_id: string;
  contenu: string;
  created_at: string;
  // Joins
  auteur_nom?: string;
  auteur_avatar?: string;
}

export interface MessageAttachment {
  type: 'image' | 'video' | 'audio' | 'file';
  url: string;
  name: string;
  size?: number;
  mime_type?: string;
  duration?: number;
}

export interface MessageReplyInfo {
  id: string;
  content: string;
  sender_nom: string;
  type?: string;
}

export interface Message {
  id: string;
  conversation_id?: string;
  sender_id: string;
  receiver_id?: string;
  content: string;
  created_at: string;
  updated_at?: string;
  // Joins & metadata
  sender_nom?: string;
  sender_avatar?: string;
  type?: 'texte' | 'image' | 'video' | 'audio' | 'file' | 'system';
  attachments?: MessageAttachment[];
  reply_to?: MessageReplyInfo | null;
  reactions?: Record<string, string[]>; // e.g. { '❤️': ['uid1'], '👍': ['uid2'] }
  read_by?: string[]; // uids
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  is_edited?: boolean;
  is_deleted?: boolean;
  is_pinned?: boolean;
  pinned_by?: string;
  pinned_at?: string;
}

export interface ConversationParticipant {
  id: string;
  nom: string;
  avatar_url?: string | null;
  role?: string;
  is_online?: boolean;
  last_seen?: string;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  participant_ids: string[];
  participants?: Record<string, ConversationParticipant>;
  group_name?: string;
  group_photo?: string;
  group_description?: string;
  admin_ids?: string[];
  last_message?: {
    content: string;
    sender_id: string;
    sender_nom: string;
    type?: string;
    created_at: string;
  } | null;
  unread_counts?: Record<string, number>; // uid -> count
  typing?: Record<string, boolean>; // uid -> boolean
  created_at: string;
  updated_at: string;
  is_archived_by?: string[];
  is_muted_by?: string[];
  is_favorite_by?: string[];
  deleted_by?: string[];
  cleared_at?: Record<string, string>;
}

export interface Mentorship {
  id: string;
  mentor_id: string;
  apprenti_id: string;
  domaine: string;
  statut: 'en_attente' | 'actif' | 'termine';
  created_at: string;
}

export interface UserSettings {
  // 1. Compte
  nom: string;
  bio: string;
  avatar_url: string;
  langue_preferee: 'fr' | 'ha' | 'en';
  email: string;

  // 2. Confidentialité
  profil_visibilite: 'public' | 'cercles' | 'mentors';
  capsules_visibilite: 'public' | 'cercles' | 'mentors';
  messages_autorises: 'tous' | 'cercles' | 'mentors';
  mentorat_autorise: 'tous' | 'verifies' | 'aucun';
  utilisateurs_bloques: string[];
  privacy_settings?: UserPrivacySettings;

  // 3. Notifications
  notif_capsule: boolean;
  notif_message: boolean;
  notif_mentorat: boolean;
  notif_reaction: boolean;
  notif_comment?: boolean;
  notif_follower?: boolean;
  notif_community?: boolean;
  notif_mention?: boolean;
  notif_system?: boolean;
  notif_push_enabled?: boolean;
  read_platform_notification_ids?: string[];
  dismissed_platform_notification_ids?: string[];
  canal_notif: 'inapp' | 'email' | 'les_deux';

  // 4. Contenu & langue
  langue_interface: 'fr' | 'ha' | 'en';
  traduction_auto: boolean;
  telechargement_hors_ligne: boolean;

  // 5. Cercles
  masquer_suggestions: boolean;

  // 6. Accessibilité / data
  mode_faible_consommation: boolean;
  taille_texte: 'normal' | 'grand' | 'tres_grand';
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  nom: '',
  bio: '',
  avatar_url: '',
  langue_preferee: 'fr',
  email: '',
  profil_visibilite: 'public',
  capsules_visibilite: 'public',
  messages_autorises: 'tous',
  mentorat_autorise: 'tous',
  utilisateurs_bloques: [],
  privacy_settings: DEFAULT_PRIVACY_SETTINGS,
  notif_capsule: true,
  notif_message: true,
  notif_mentorat: true,
  notif_reaction: true,
  notif_comment: true,
  notif_follower: true,
  notif_community: true,
  notif_mention: true,
  notif_system: true,
  notif_push_enabled: false,
  read_platform_notification_ids: [],
  dismissed_platform_notification_ids: [],
  canal_notif: 'les_deux',
  langue_interface: 'fr',
  traduction_auto: true,
  telechargement_hors_ligne: false,
  masquer_suggestions: false,
  mode_faible_consommation: false,
  taille_texte: 'normal'
};

// ============================================================
// MODULE DE COMMUNAUTÉS AVANCÉ (CERCLES COMMUNAUTAIRES)
// ============================================================

export type GroupPrivacy = 'public' | 'private';
export type GroupPostPermission = 'all_members' | 'admins_only';
export type GroupMemberRole = 'administrateur' | 'moderateur' | 'membre';
export type GroupMemberStatus = 'active' | 'pending' | 'suspended';

export interface ModeratorPermissions {
  approvePosts: boolean;
  manageComments: boolean;
  manageReports: boolean;
  approveMembers: boolean;
}

export interface CommunityGroup {
  id: string;
  name: string;
  description: string;
  category: string;
  coverPhoto?: string;
  avatarPhoto?: string;
  privacy: GroupPrivacy;
  postPermission: GroupPostPermission;
  requirePostApproval: boolean;
  requireMemberApproval: boolean;
  allowAnonymousPosts: boolean;
  rules: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  postCount: number;
}

export interface CommunityMember {
  id: string; // `${groupId}_${userId}`
  groupId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  role: GroupMemberRole;
  status: GroupMemberStatus;
  permissions?: ModeratorPermissions;
  inviteCode?: string;
  joinedAt: string;
  updatedAt: string;
}

export type GroupPostType = 'text' | 'image' | 'video' | 'link' | 'document' | 'poll' | 'audio';

export interface GroupPostMediaItem {
  type: 'image' | 'video' | 'document' | 'audio';
  url: string;
  name: string;
  size?: number;
  mimeType?: string;
}

export interface GroupPollOption {
  id: string;
  text: string;
  voterIds: string[];
}

export interface GroupPoll {
  question: string;
  allowMultiple: boolean;
  options: GroupPollOption[];
  endsAt?: string;
}

export interface GroupPost {
  id: string;
  groupId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  isAnonymous: boolean;
  type: GroupPostType;
  content: string;
  media: GroupPostMediaItem[];
  externalLink?: string;
  poll?: GroupPoll | null;
  status: 'published' | 'pending' | 'scheduled';
  scheduledFor?: string;
  isPinned: boolean;
  reactionCount: number;
  commentCount: number;
  shareCount: number;
  savedBy?: string[];
  createdAt: string;
  updatedAt: string;
}

export type GroupReactionType = 'like' | 'love' | 'useful' | 'celebrate' | 'insightful';

export interface PostReaction {
  id: string; // `${postId}_${userId}`
  postId: string;
  groupId: string;
  userId: string;
  userName: string;
  type: GroupReactionType;
  createdAt: string;
}

export interface PostComment {
  id: string;
  postId: string;
  groupId: string;
  parentId?: string | null;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  mentions?: string[];
  likedBy?: string[];
  isEdited?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GroupEvent {
  id: string;
  groupId: string;
  title: string;
  description: string;
  location: string;
  isOnline: boolean;
  meetingLink?: string;
  startDate: string;
  endDate?: string;
  coverPhoto?: string;
  createdBy: string;
  createdByName: string;
  attendeeIds: string[];
  interestedIds: string[];
  createdAt: string;
}

export interface GroupAnnouncement {
  id: string;
  groupId: string;
  title: string;
  content: string;
  priority: 'normal' | 'important' | 'urgent';
  authorId: string;
  authorName: string;
  isPinned: boolean;
  createdAt: string;
}

export interface GroupInvitation {
  id: string;
  groupId: string;
  groupName: string;
  groupAvatar?: string;
  groupPrivacy: GroupPrivacy;
  inviterId: string;
  inviterName: string;
  inviteeId: string; // userId or 'LINK'
  inviteCode?: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export interface GroupNotification {
  id: string;
  userId: string;
  groupId: string;
  groupName: string;
  type: 'invitation' | 'member_approved' | 'new_post' | 'post_approved' | 'comment' | 'mention' | 'announcement' | 'event' | 'role_changed' | 'rules_updated';
  message: string;
  actorName: string;
  isRead: boolean;
  createdAt: string;
}

export interface GroupReport {
  id: string;
  groupId: string;
  targetType: 'post' | 'comment' | 'member';
  targetId: string;
  targetPreview: string;
  reporterId: string;
  reporterName: string;
  reason: string;
  details?: string;
  status: 'pending' | 'resolved' | 'dismissed';
  resolvedBy?: string;
  createdAt: string;
}

// ============================================================
// CENTRE DE NOTIFICATIONS UNIFIÉ TEMPS RÉEL (ZAURE)
// ============================================================

export type AppNotificationType =
  | 'like'
  | 'reaction'
  | 'comment'
  | 'comment_reply'
  | 'share'
  | 'new_follower'
  | 'mention'
  | 'new_message'
  | 'group_mention'
  | 'community_invitation'
  | 'community_approved'
  | 'community_post'
  | 'community_announcement'
  | 'community_rules'
  | 'community_role'
  | 'security_alert'
  | 'system';

export type AppNotificationCategory = 'interactions' | 'mentions' | 'communities' | 'system';

export type AppNotificationTargetType =
  | 'post'
  | 'capsule'
  | 'comment'
  | 'community'
  | 'conversation'
  | 'profile'
  | 'settings'
  | 'system';

export interface AppNotification {
  id: string;
  userId: string;
  actorId: string;
  actorName: string;
  actorAvatar?: string;
  type: AppNotificationType;
  category: AppNotificationCategory;
  title: string;
  message: string;
  previewText?: string;
  targetType?: AppNotificationTargetType;
  targetId?: string;
  groupId?: string;
  groupName?: string;
  isRead: boolean;
  createdAt: string;
}

export interface UnifiedNotification extends AppNotification {
  source: 'notifications' | 'group_notifications' | 'platform_notifications';
  sourceId: string;
  priority?: 'info' | 'warning' | 'urgent';
  invitation?: GroupInvitation | null;
}
