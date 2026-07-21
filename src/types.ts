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

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  // Joins
  sender_nom?: string;
}

export interface Mentorship {
  id: string;
  mentor_id: string;
  apprenti_id: string;
  domaine: string;
  statut: 'en_attente' | 'actif' | 'termine';
  created_at: string;
}
