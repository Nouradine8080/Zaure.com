export interface UserProfile {
  id: string; // Auth UID
  nom: string;
  email: string;
  bio: string | null;
  avatar_url: string | null;
  role: 'utilisateur' | 'mentor' | 'verifie';
  langue_preferee: 'fr' | 'ha' | 'en';
  created_at?: string;
}

export interface Circle {
  id: string;
  nom: string;
  description: string;
  categorie: string;
  image: string;
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

  // 3. Notifications
  notif_capsule: boolean;
  notif_message: boolean;
  notif_mentorat: boolean;
  notif_reaction: boolean;
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
  notif_capsule: true,
  notif_message: true,
  notif_mentorat: true,
  notif_reaction: true,
  canal_notif: 'les_deux',
  langue_interface: 'fr',
  traduction_auto: true,
  telechargement_hors_ligne: false,
  masquer_suggestions: false,
  mode_faible_consommation: false,
  taille_texte: 'normal'
};

