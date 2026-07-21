import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  deleteDoc 
} from 'firebase/firestore';
import { UserProfile, Circle, CircleMember, Capsule, Comment, Reaction, Message } from './types';

// Detect Firebase config from import.meta.env or fallback to provided project configuration
const firebaseConfig = {
  apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY || 'AIzaSyDhuMBmcKHsoESsknVacAy5haI6PmK6aw8',
  authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN || 'zaure-com.firebaseapp.com',
  projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID || 'zaure-com',
  storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET || 'zaure-com.firebasestorage.app',
  messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID || '893077823490',
  appId: (import.meta as any).env.VITE_FIREBASE_APP_ID || '1:893077823490:web:af344c02ef2e2ab492071b'
};

export const isFirebaseConfigured = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

export let auth: any = null;
export let dbFirestore: any = null;

if (isFirebaseConfigured) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    dbFirestore = getFirestore(app);
  } catch (error) {
    console.error('Erreur lors de la création du client Firebase:', error);
  }
}

// ----------------------------------------------------
// LOCAL SANDBOX SEED DATA
// ----------------------------------------------------
const SEED_USERS: UserProfile[] = [
  {
    id: 'user-amina',
    nom: 'Dr. Amina Diallo',
    email: 'amina.diallo@zaure.org',
    bio: 'Médecin généraliste à Dakar. Passionnée par la vulgarisation médicale et la formation des jeunes professionnels de santé.',
    avatar_url: 'https://images.unsplash.com/photo-1594824813573-246434de83fb?auto=format&fit=crop&q=80&w=200',
    role: 'verifie',
    langue_preferee: 'fr'
  },
  {
    id: 'user-ousmane',
    nom: 'Ousmane Bello',
    email: 'ousmane.bello@zaure.org',
    bio: 'Enseignant bilingue Français-Haoussa à Maradi, Niger. Je partage des capsules quotidiennes pour apprendre le haoussa.',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
    role: 'mentor',
    langue_preferee: 'ha'
  },
  {
    id: 'user-mahamadou',
    nom: 'Mahamadou Garba',
    email: 'mahamadou.garba@zaure.org',
    bio: 'Étudiant en médecine. Curieux d\'apprendre et d\'échanger au sein de la communauté.',
    avatar_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=200',
    role: 'utilisateur',
    langue_preferee: 'fr'
  }
];

const SEED_CIRCLES: Circle[] = [
  {
    id: 'circle-sante',
    nom: 'Santé & Premiers secours',
    description: 'Gestes de secours, prévention du paludisme, nutrition et conseils de santé vérifiés par des professionnels.',
    categorie: 'Médecine',
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=600'
  },
  {
    id: 'circle-haoussa',
    nom: 'Apprendre le Haoussa (Koyi Hausa)',
    description: 'Espace d\'échange et d\'apprentissage de la langue haoussa : vocabulaire, expressions courantes et culture.',
    categorie: 'Langues',
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=600'
  },
  {
    id: 'circle-medecine',
    nom: 'Étudiants en médecine',
    description: 'Partage de fiches cliniques, entraide sur les cours de sémiologie, pharmacologie et préparation des examens.',
    categorie: 'Médecine',
    image: 'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?auto=format&fit=crop&q=80&w=600'
  },
  {
    id: 'circle-agri',
    nom: 'Agriculture moderne & Sahel',
    description: 'Discussions autour des techniques d\'irrigation, d\'agroécologie et de maraîchage adaptées au climat sahélien.',
    categorie: 'Sciences',
    image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=600'
  }
];

const SEED_MEMBERS: CircleMember[] = [
  { user_id: 'user-amina', circle_id: 'circle-sante', role: 'moderateur', joined_at: '2026-01-10T12:00:00Z' },
  { user_id: 'user-amina', circle_id: 'circle-medecine', role: 'moderateur', joined_at: '2026-01-10T12:00:00Z' },
  { user_id: 'user-ousmane', circle_id: 'circle-haoussa', role: 'moderateur', joined_at: '2026-01-12T12:00:00Z' },
  { user_id: 'user-mahamadou', circle_id: 'circle-sante', role: 'membre', joined_at: '2026-02-01T15:30:00Z' },
  { user_id: 'user-mahamadou', circle_id: 'circle-medecine', role: 'membre', joined_at: '2026-02-01T15:32:00Z' },
  { user_id: 'user-mahamadou', circle_id: 'circle-haoussa', role: 'membre', joined_at: '2026-02-01T15:34:00Z' }
];

const SEED_CAPSULES: Capsule[] = [
  {
    id: 'capsule-1',
    auteur_id: 'user-amina',
    circle_id: 'circle-sante',
    type: 'texte',
    contenu: '💡 PRÉVENTION DU PALUDISME\nLe paludisme reste la première cause de consultation. Pensez à toujours vérifier l\'utilisation systématique de moustiquaires imprégnées pour toute la famille. En cas de fièvre chez un enfant, un TDR (Test de Diagnostic Rapide) doit être effectué dans les 24h. Ne pratiquez pas d\'automédication !',
    langue_dorigine: 'fr',
    created_at: '2026-07-20T10:15:00Z',
    auteur_nom: 'Dr. Amina Diallo',
    auteur_role: 'verifie',
    auteur_avatar: 'https://images.unsplash.com/photo-1594824813573-246434de83fb?auto=format&fit=crop&q=80&w=200',
    circle_nom: 'Santé & Premiers secours'
  },
  {
    id: 'capsule-2',
    auteur_id: 'user-ousmane',
    circle_id: 'circle-haoussa',
    type: 'texte',
    contenu: '🗣️ LEÇON DU JOUR : Salutations fondamentales en Haoussa\n\n- Sannu : Salut / Bonjour (général)\n- Ina kwana ? : Comment s\'est passé ton réveil ? (Bonjour le matin)\n- Ina wuni ? : Comment s\'est passée ta journée ? (Bonjour l\'après-midi)\n- Lafiya lau : Très bien, en paix (réponse standard)\n\nEntraînez-vous à les prononcer avec vos proches aujourd\'hui ! 🇳🇬 🇳🇪',
    langue_dorigine: 'ha',
    created_at: '2026-07-20T14:30:00Z',
    auteur_nom: 'Ousmane Bello',
    auteur_role: 'mentor',
    auteur_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
    circle_nom: 'Apprendre le Haoussa (Koyi Hausa)'
  },
  {
    id: 'capsule-3',
    auteur_id: 'user-amina',
    circle_id: 'circle-medecine',
    type: 'texte',
    contenu: '📚 SÉMIOLOGIE CARDIAQUE\n\nPour les étudiants qui préparent l\'examen clinique : n\'oubliez pas les 4 foyers d\'auscultation principaux :\n1. Foyer aortique (2e espace intercostal droit)\n2. Foyer pulmonaire (2e espace intercostal gauche)\n3. Foyer tricuspide (bas du sternum, xiphoïde)\n4. Foyer mitral (5e espace intercostal gauche, ligne médio-claviculaire).\n\nFaites une fiche de révision, c\'est incontournable !',
    langue_dorigine: 'fr',
    created_at: '2026-07-21T02:05:00Z',
    auteur_nom: 'Dr. Amina Diallo',
    auteur_role: 'verifie',
    auteur_avatar: 'https://images.unsplash.com/photo-1594824813573-246434de83fb?auto=format&fit=crop&q=80&w=200',
    circle_nom: 'Étudiants en médecine'
  }
];

const SEED_COMMENTS: Comment[] = [
  {
    id: 'comment-1',
    capsule_id: 'capsule-1',
    auteur_id: 'user-mahamadou',
    contenu: 'Merci beaucoup Docteur. C\'est un rappel crucial pour les familles, surtout en cette période d\'hivernage.',
    created_at: '2026-07-20T11:00:00Z',
    auteur_nom: 'Mahamadou Garba',
    auteur_avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=200'
  },
  {
    id: 'comment-2',
    capsule_id: 'capsule-2',
    auteur_id: 'user-mahamadou',
    contenu: 'Ina kwana Mallam Ousmane ! Merci pour ces bases de salutations.',
    created_at: '2026-07-20T15:10:00Z',
    auteur_nom: 'Mahamadou Garba',
    auteur_avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=200'
  }
];

const SEED_REACTIONS: Reaction[] = [
  { capsule_id: 'capsule-1', user_id: 'user-mahamadou', type: 'utile' },
  { capsule_id: 'capsule-1', user_id: 'user-ousmane', type: 'merci' },
  { capsule_id: 'capsule-2', user_id: 'user-mahamadou', type: 'merci' }
];

const SEED_MESSAGES: Message[] = [
  {
    id: 'msg-1',
    sender_id: 'user-ousmane',
    receiver_id: 'user-mahamadou',
    content: 'Barkama Mahamadou ! Comment vas-tu ? Tu t\'en sors avec ton apprentissage du haoussa ?',
    created_at: '2026-07-20T16:00:00Z',
    sender_nom: 'Ousmane Bello'
  },
  {
    id: 'msg-2',
    sender_id: 'user-mahamadou',
    receiver_id: 'user-ousmane',
    content: 'Lafiya lau Mallam ! Oui, grâce à vos capsules quotidiennes, je commence à bien maîtriser les salutations de base.',
    created_at: '2026-07-20T16:05:00Z',
    sender_nom: 'Mahamadou Garba'
  }
];

// Helper to load/save state from LocalStorage
class LocalDatabase {
  users: UserProfile[] = [];
  circles: Circle[] = [];
  members: CircleMember[] = [];
  capsules: Capsule[] = [];
  comments: Comment[] = [];
  reactions: Reaction[] = [];
  messages: Message[] = [];
  currentUser: UserProfile | null = null;

  constructor() {
    this.load();
  }

  load() {
    const usersData = localStorage.getItem('zaure_local_users');
    const circlesData = localStorage.getItem('zaure_local_circles');
    const membersData = localStorage.getItem('zaure_local_members');
    const capsulesData = localStorage.getItem('zaure_local_capsules');
    const commentsData = localStorage.getItem('zaure_local_comments');
    const reactionsData = localStorage.getItem('zaure_local_reactions');
    const messagesData = localStorage.getItem('zaure_local_messages');
    const currentUserData = localStorage.getItem('zaure_current_user');

    if (usersData) this.users = JSON.parse(usersData);
    else { this.users = SEED_USERS; this.saveUsers(); }

    if (circlesData) this.circles = JSON.parse(circlesData);
    else { this.circles = SEED_CIRCLES; this.saveCircles(); }

    if (membersData) this.members = JSON.parse(membersData);
    else { this.members = SEED_MEMBERS; this.saveMembers(); }

    if (capsulesData) this.capsules = JSON.parse(capsulesData);
    else { this.capsules = SEED_CAPSULES; this.saveCapsules(); }

    if (commentsData) this.comments = JSON.parse(commentsData);
    else { this.comments = SEED_COMMENTS; this.saveComments(); }

    if (reactionsData) this.reactions = JSON.parse(reactionsData);
    else { this.reactions = SEED_REACTIONS; this.saveReactions(); }

    if (messagesData) this.messages = JSON.parse(messagesData);
    else { this.messages = SEED_MESSAGES; this.saveMessages(); }

    if (currentUserData) {
      this.currentUser = JSON.parse(currentUserData);
    } else {
      this.currentUser = null;
    }
  }

  saveUsers() { localStorage.setItem('zaure_local_users', JSON.stringify(this.users)); }
  saveCircles() { localStorage.setItem('zaure_local_circles', JSON.stringify(this.circles)); }
  saveMembers() { localStorage.setItem('zaure_local_members', JSON.stringify(this.members)); }
  saveCapsules() { localStorage.setItem('zaure_local_capsules', JSON.stringify(this.capsules)); }
  saveComments() { localStorage.setItem('zaure_local_comments', JSON.stringify(this.comments)); }
  saveReactions() { localStorage.setItem('zaure_local_reactions', JSON.stringify(this.reactions)); }
  saveMessages() { localStorage.setItem('zaure_local_messages', JSON.stringify(this.messages)); }
}

const db = new LocalDatabase();
let dbHasError = false;

// ----------------------------------------------------
// UNIFIED ZAURE SERVICE (WORKS IN BOTH LOCAL & CLOUD FIREBASE)
// ----------------------------------------------------
export const zaureService = {
  getMode: (): 'cloud' | 'local' => {
    return isFirebaseConfigured ? 'cloud' : 'local';
  },

  getCurrentUser: (): UserProfile | null => {
    return db.currentUser;
  },

  hasDbError: (): boolean => {
    return dbHasError;
  },

  setDbError: (value: boolean) => {
    dbHasError = value;
  },

  // --- AUTHENTICATION ---
  signUp: async (
    nom: string, 
    email: string, 
    bio: string, 
    role: 'utilisateur' | 'mentor' | 'verifie' = 'utilisateur', 
    langue: 'fr' | 'ha' | 'en' = 'fr',
    password?: string
  ): Promise<{ user: UserProfile | null, error: string | null }> => {
    if (isFirebaseConfigured && auth && dbFirestore) {
      try {
        const securePassword = password || 'Password123!';
        const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, email, securePassword);
        if (firebaseUser) {
          const profile: UserProfile = {
            id: firebaseUser.uid,
            nom,
            email,
            bio: bio || null,
            avatar_url: `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 1000000)}?auto=format&fit=crop&q=80&w=200`,
            role,
            langue_preferee: langue,
            created_at: new Date().toISOString()
          };
          
          await setDoc(doc(dbFirestore, 'users', firebaseUser.uid), profile);
          
          db.currentUser = profile;
          localStorage.setItem('zaure_current_user', JSON.stringify(profile));
          return { user: profile, error: null };
        }
        return { user: null, error: 'Sign up failed.' };
      } catch (err: any) {
        return { user: null, error: err.message };
      }
    } else {
      // Local Sandbox mode
      const existing = db.users.find(u => u.email === email);
      if (existing) {
        db.currentUser = existing;
        localStorage.setItem('zaure_current_user', JSON.stringify(existing));
        return { user: existing, error: null };
      }
      const newUser: UserProfile = {
        id: `user-${Date.now()}`,
        nom,
        email,
        bio: bio || null,
        avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
        role,
        langue_preferee: langue,
        created_at: new Date().toISOString()
      };
      db.users.push(newUser);
      db.saveUsers();
      db.currentUser = newUser;
      localStorage.setItem('zaure_current_user', JSON.stringify(newUser));
      return { user: newUser, error: null };
    }
  },

  signIn: async (email: string, password?: string): Promise<{ user: UserProfile | null, error: string | null }> => {
    if (isFirebaseConfigured && auth && dbFirestore) {
      try {
        const securePassword = password || 'Password123!';
        const { user: firebaseUser } = await signInWithEmailAndPassword(auth, email, securePassword);
        if (firebaseUser) {
          const userDoc = await getDoc(doc(dbFirestore, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const profile = userDoc.data() as UserProfile;
            db.currentUser = profile;
            localStorage.setItem('zaure_current_user', JSON.stringify(profile));
            return { user: profile, error: null };
          }
          // If Firestore profile doesn't exist, create one
          const profile: UserProfile = {
            id: firebaseUser.uid,
            nom: firebaseUser.displayName || email.split('@')[0],
            email: firebaseUser.email || email,
            bio: 'Inscrit via email',
            avatar_url: firebaseUser.photoURL || `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 1000000)}?auto=format&fit=crop&q=80&w=200`,
            role: 'utilisateur',
            langue_preferee: 'fr',
            created_at: new Date().toISOString()
          };
          await setDoc(doc(dbFirestore, 'users', firebaseUser.uid), profile);
          db.currentUser = profile;
          localStorage.setItem('zaure_current_user', JSON.stringify(profile));
          return { user: profile, error: null };
        }
        return { user: null, error: 'La connexion a échoué.' };
      } catch (err: any) {
        return { user: null, error: err.message };
      }
    } else {
      // Local Sandbox Sign In
      const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (user) {
        db.currentUser = user;
        localStorage.setItem('zaure_current_user', JSON.stringify(user));
        return { user, error: null };
      }
      return { user: null, error: 'Cet email n\'existe pas dans le Sandbox. Créez un compte ou utilisez un email de démonstration (ex: mahamadou.garba@zaure.org).' };
    }
  },

  signInWithGoogle: async (): Promise<{ user: UserProfile | null, error: string | null }> => {
    if (isFirebaseConfigured && auth && dbFirestore) {
      try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const firebaseUser = result.user;
        if (firebaseUser) {
          const userDoc = await getDoc(doc(dbFirestore, 'users', firebaseUser.uid));
          let profile: UserProfile;
          if (userDoc.exists()) {
            profile = userDoc.data() as UserProfile;
          } else {
            profile = {
              id: firebaseUser.uid,
              nom: firebaseUser.displayName || 'Utilisateur Google',
              email: firebaseUser.email || '',
              bio: 'Inscrit via Google',
              avatar_url: firebaseUser.photoURL || `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 1000000)}?auto=format&fit=crop&q=80&w=200`,
              role: 'utilisateur',
              langue_preferee: 'fr',
              created_at: new Date().toISOString()
            };
            await setDoc(doc(dbFirestore, 'users', firebaseUser.uid), profile);
          }
          db.currentUser = profile;
          localStorage.setItem('zaure_current_user', JSON.stringify(profile));
          return { user: profile, error: null };
        }
        return { user: null, error: 'La connexion Google a échoué.' };
      } catch (err: any) {
        return { user: null, error: err.message };
      }
    } else {
      // Local Sandbox Mock Google Sign In
      const defaultUser = db.users[2] || SEED_USERS[2];
      db.currentUser = defaultUser;
      localStorage.setItem('zaure_current_user', JSON.stringify(defaultUser));
      return { user: defaultUser, error: null };
    }
  },

  signOut: async () => {
    if (isFirebaseConfigured && auth) {
      try {
        await firebaseSignOut(auth);
      } catch (e) {
        console.error('Erreur déconnexion Firebase:', e);
      }
    }
    db.currentUser = null;
    localStorage.removeItem('zaure_current_user');
  },

  switchSandboxUser: (userId: string): UserProfile => {
    const user = db.users.find(u => u.id === userId) || db.users[2];
    db.currentUser = user;
    localStorage.setItem('zaure_current_user', JSON.stringify(user));
    return user;
  },

  getAvailableUsers: (): UserProfile[] => {
    return db.users;
  },

  // --- CIRCLES ---
  getCircles: async (): Promise<Circle[]> => {
    if (isFirebaseConfigured && dbFirestore) {
      try {
        const querySnapshot = await getDocs(collection(dbFirestore, 'circles'));
        const cloudCircles: Circle[] = [];
        querySnapshot.forEach((doc) => {
          cloudCircles.push(doc.data() as Circle);
        });
        
        // Seed if empty in Cloud
        if (cloudCircles.length === 0) {
          for (const c of db.circles) {
            await setDoc(doc(dbFirestore, 'circles', c.id), c);
            cloudCircles.push(c);
          }
        }
        return cloudCircles.sort((a, b) => a.nom.localeCompare(b.nom));
      } catch (error) {
        console.warn('Info - fetching circles from Firebase:', error);
        dbHasError = true;
        return db.circles;
      }
    } else {
      return [...db.circles];
    }
  },

  createCircle: async (nom: string, description: string, categorie: string, image: string): Promise<Circle> => {
    const newCircle: Circle = {
      id: `circle-${Date.now()}`,
      nom,
      description,
      categorie,
      image: image || 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&q=80&w=600',
      created_at: new Date().toISOString()
    };

    if (isFirebaseConfigured && dbFirestore) {
      try {
        await setDoc(doc(dbFirestore, 'circles', newCircle.id), newCircle);
        if (db.currentUser) {
          const member: CircleMember = {
            user_id: db.currentUser.id,
            circle_id: newCircle.id,
            role: 'moderateur',
            joined_at: new Date().toISOString()
          };
          await setDoc(doc(dbFirestore, 'circle_members', `${db.currentUser.id}_${newCircle.id}`), member);
        }
        return newCircle;
      } catch (error) {
        console.warn('Info - creating circle in Firebase:', error);
      }
    }

    // Local / Sandbox Mode
    db.circles.push(newCircle);
    db.saveCircles();
    if (db.currentUser) {
      const member: CircleMember = {
        user_id: db.currentUser.id,
        circle_id: newCircle.id,
        role: 'moderateur',
        joined_at: new Date().toISOString()
      };
      db.members.push(member);
      db.saveMembers();
    }
    return newCircle;
  },

  // --- CIRCLE MEMBERSHIP ---
  getJoinedCircleIds: async (userId: string): Promise<string[]> => {
    if (isFirebaseConfigured && dbFirestore) {
      try {
        const q = query(collection(dbFirestore, 'circle_members'), where('user_id', '==', userId));
        const querySnapshot = await getDocs(q);
        const joined: string[] = [];
        querySnapshot.forEach((doc) => {
          const m = doc.data() as CircleMember;
          joined.push(m.circle_id);
        });
        return joined;
      } catch (error) {
        console.warn('Info - fetching joined circles:', error);
        dbHasError = true;
        return db.members.filter(m => m.user_id === userId).map(m => m.circle_id);
      }
    } else {
      return db.members.filter(m => m.user_id === userId).map(m => m.circle_id);
    }
  },

  joinCircle: async (circleId: string, userId: string): Promise<boolean> => {
    const newMember: CircleMember = {
      user_id: userId,
      circle_id: circleId,
      role: 'membre',
      joined_at: new Date().toISOString()
    };

    if (isFirebaseConfigured && dbFirestore) {
      try {
        await setDoc(doc(dbFirestore, 'circle_members', `${userId}_${circleId}`), newMember);
        return true;
      } catch (error) {
        console.warn('Info - joining circle in Firebase:', error);
        return false;
      }
    } else {
      const exists = db.members.some(m => m.user_id === userId && m.circle_id === circleId);
      if (!exists) {
        db.members.push(newMember);
        db.saveMembers();
      }
      return true;
    }
  },

  leaveCircle: async (circleId: string, userId: string): Promise<boolean> => {
    if (isFirebaseConfigured && dbFirestore) {
      try {
        await deleteDoc(doc(dbFirestore, 'circle_members', `${userId}_${circleId}`));
        return true;
      } catch (error) {
        console.warn('Info - leaving circle in Firebase:', error);
        return false;
      }
    } else {
      db.members = db.members.filter(m => !(m.user_id === userId && m.circle_id === circleId));
      db.saveMembers();
      return true;
    }
  },

  // --- CAPSULES ---
  getCapsules: async (circleIds?: string[]): Promise<Capsule[]> => {
    if (isFirebaseConfigured && dbFirestore) {
      try {
        let q = collection(dbFirestore, 'capsules') as any;
        
        const querySnapshot = await getDocs(q);
        let capsulesData: Capsule[] = [];
        querySnapshot.forEach((doc) => {
          capsulesData.push(doc.data() as Capsule);
        });

        // Filter by circleIds in memory or via query
        if (circleIds && circleIds.length > 0) {
          capsulesData = capsulesData.filter(c => circleIds.includes(c.circle_id));
        }

        // Client-side Join for authors and circles
        const circlesData = await zaureService.getCircles();
        const finalCapsules: Capsule[] = [];
        
        for (const c of capsulesData) {
          let auteurNom = 'Auteur inconnu';
          let auteurRole = 'utilisateur';
          let auteurAvatar = '';
          
          const uDoc = await getDoc(doc(dbFirestore, 'users', c.auteur_id));
          if (uDoc.exists()) {
            const profile = uDoc.data() as UserProfile;
            auteurNom = profile.nom;
            auteurRole = profile.role;
            auteurAvatar = profile.avatar_url || '';
          } else {
            // Fallback to seed users
            const sUser = SEED_USERS.find(u => u.id === c.auteur_id);
            if (sUser) {
              auteurNom = sUser.nom;
              auteurRole = sUser.role;
              auteurAvatar = sUser.avatar_url || '';
            }
          }

          finalCapsules.push({
            ...c,
            auteur_nom: auteurNom,
            auteur_role: auteurRole,
            auteur_avatar: auteurAvatar,
            circle_nom: circlesData.find(circ => circ.id === c.circle_id)?.nom || 'Cercle'
          });
        }

        // Sort descending by created_at
        return finalCapsules.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      } catch (e) {
        console.warn('Info - Fallback to local storage fetching due to Firebase state:', e);
        dbHasError = true;
      }
    }

    // Local / Sandbox Mode
    let list = [...db.capsules];
    if (circleIds && circleIds.length > 0) {
      list = list.filter(c => circleIds.includes(c.circle_id));
    }
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  createCapsule: async (
    circleId: string, 
    type: 'texte' | 'audio', 
    contenu: string, 
    langue: 'fr' | 'ha' | 'en' = 'fr'
  ): Promise<Capsule> => {
    const user = db.currentUser;
    if (!user) throw new Error('Utilisateur non connecté.');

    const newCapsule: Capsule = {
      id: `capsule-${Date.now()}`,
      auteur_id: user.id,
      circle_id: circleId,
      type,
      contenu,
      langue_dorigine: langue,
      created_at: new Date().toISOString(),
      auteur_nom: user.nom,
      auteur_role: user.role,
      auteur_avatar: user.avatar_url || '',
      circle_nom: db.circles.find(c => c.id === circleId)?.nom || 'Cercle'
    };

    if (isFirebaseConfigured && dbFirestore) {
      try {
        await setDoc(doc(dbFirestore, 'capsules', newCapsule.id), {
          id: newCapsule.id,
          auteur_id: newCapsule.auteur_id,
          circle_id: newCapsule.circle_id,
          type: newCapsule.type,
          contenu: newCapsule.contenu,
          langue_dorigine: newCapsule.langue_dorigine,
          created_at: newCapsule.created_at
        });
      } catch (error) {
        console.warn('Info - inserting capsule in Firebase:', error);
      }
    }

    // Keep Local updated
    db.capsules.unshift(newCapsule);
    db.saveCapsules();
    return newCapsule;
  },

  // --- REACTIONS ---
  getReactions: async (capsuleId: string): Promise<Reaction[]> => {
    if (isFirebaseConfigured && dbFirestore) {
      try {
        const q = query(collection(dbFirestore, 'reactions'), where('capsule_id', '==', capsuleId));
        const querySnapshot = await getDocs(q);
        const list: Reaction[] = [];
        querySnapshot.forEach((doc) => {
          list.push(doc.data() as Reaction);
        });
        return list;
      } catch (error) {
        console.warn('Info - fetching reactions from Firebase:', error);
        dbHasError = true;
        return db.reactions.filter(r => r.capsule_id === capsuleId);
      }
    } else {
      return db.reactions.filter(r => r.capsule_id === capsuleId);
    }
  },

  toggleReaction: async (capsuleId: string, type: 'utile' | 'merci' | 'question'): Promise<Reaction[]> => {
    const user = db.currentUser;
    if (!user) return [];

    const key = `${capsuleId}_${user.id}_${type}`;

    if (isFirebaseConfigured && dbFirestore) {
      try {
        const docRef = doc(dbFirestore, 'reactions', key);
        const existing = await getDoc(docRef);
        if (existing.exists()) {
          await deleteDoc(docRef);
        } else {
          const react: Reaction = { capsule_id: capsuleId, user_id: user.id, type };
          await setDoc(docRef, react);
        }

        // Return refreshed reactions
        return await zaureService.getReactions(capsuleId);
      } catch (error) {
        console.warn('Info - toggling reaction in Firebase:', error);
      }
    }

    // Local Toggle
    const index = db.reactions.findIndex(r => r.capsule_id === capsuleId && r.user_id === user.id && r.type === type);
    if (index > -1) {
      db.reactions.splice(index, 1);
    } else {
      db.reactions.push({
        capsule_id: capsuleId,
        user_id: user.id,
        type
      });
    }
    db.saveReactions();
    return db.reactions.filter(r => r.capsule_id === capsuleId);
  },

  // --- COMMENTS ---
  getComments: async (capsuleId: string): Promise<Comment[]> => {
    if (isFirebaseConfigured && dbFirestore) {
      try {
        const q = query(collection(dbFirestore, 'comments'), where('capsule_id', '==', capsuleId));
        const querySnapshot = await getDocs(q);
        const commentsData: Comment[] = [];
        querySnapshot.forEach((doc) => {
          commentsData.push(doc.data() as Comment);
        });

        const finalComments: Comment[] = [];
        for (const c of commentsData) {
          let auteurNom = 'Utilisateur';
          let auteurAvatar = '';

          const uDoc = await getDoc(doc(dbFirestore, 'users', c.auteur_id));
          if (uDoc.exists()) {
            const profile = uDoc.data() as UserProfile;
            auteurNom = profile.nom;
            auteurAvatar = profile.avatar_url || '';
          } else {
            const sUser = SEED_USERS.find(u => u.id === c.auteur_id);
            if (sUser) {
              auteurNom = sUser.nom;
              auteurAvatar = sUser.avatar_url || '';
            }
          }

          finalComments.push({
            ...c,
            auteur_nom: auteurNom,
            auteur_avatar: auteurAvatar
          });
        }

        return finalComments.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      } catch (error) {
        console.warn('Info - fetching comments:', error);
        dbHasError = true;
        return db.comments.filter(c => c.capsule_id === capsuleId);
      }
    } else {
      return db.comments
        .filter(c => c.capsule_id === capsuleId)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
  },

  addComment: async (capsuleId: string, contenu: string): Promise<Comment> => {
    const user = db.currentUser;
    if (!user) throw new Error('Utilisateur non connecté.');

    const newComment: Comment = {
      id: `comment-${Date.now()}`,
      capsule_id: capsuleId,
      auteur_id: user.id,
      contenu,
      created_at: new Date().toISOString(),
      auteur_nom: user.nom,
      auteur_avatar: user.avatar_url || ''
    };

    if (isFirebaseConfigured && dbFirestore) {
      try {
        await setDoc(doc(dbFirestore, 'comments', newComment.id), {
          id: newComment.id,
          capsule_id: newComment.capsule_id,
          auteur_id: newComment.auteur_id,
          contenu: newComment.contenu,
          created_at: newComment.created_at
        });
      } catch (error) {
        console.warn('Info - inserting comment in Firebase:', error);
      }
    }

    db.comments.push(newComment);
    db.saveComments();
    return newComment;
  },

  // --- PRIVATE MESSAGES ---
  getPrivateMessages: async (otherUserId: string): Promise<Message[]> => {
    const user = db.currentUser;
    if (!user) return [];

    if (isFirebaseConfigured && dbFirestore) {
      try {
        // Query both directions in Firestore
        const q1 = query(
          collection(dbFirestore, 'messages'), 
          where('sender_id', '==', user.id), 
          where('receiver_id', '==', otherUserId)
        );
        const q2 = query(
          collection(dbFirestore, 'messages'), 
          where('sender_id', '==', otherUserId), 
          where('receiver_id', '==', user.id)
        );

        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
        const combined: Message[] = [];
        
        snap1.forEach((doc) => { combined.push(doc.data() as Message); });
        snap2.forEach((doc) => { combined.push(doc.data() as Message); });

        const finalMessages: Message[] = [];
        for (const m of combined) {
          let senderNom = 'Utilisateur';
          const uDoc = await getDoc(doc(dbFirestore, 'users', m.sender_id));
          if (uDoc.exists()) {
            senderNom = (uDoc.data() as UserProfile).nom;
          } else {
            const sUser = SEED_USERS.find(u => u.id === m.sender_id);
            if (sUser) senderNom = sUser.nom;
          }

          finalMessages.push({
            ...m,
            sender_nom: senderNom
          });
        }

        return finalMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      } catch (error) {
        console.warn('Info - fetching messages from Firebase:', error);
        dbHasError = true;
      }
    }

    // Local / Sandbox Mode
    return db.messages
      .filter(m => 
        (m.sender_id === user.id && m.receiver_id === otherUserId) ||
        (m.sender_id === otherUserId && m.receiver_id === user.id)
      )
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  },

  sendPrivateMessage: async (receiverId: string, content: string): Promise<Message> => {
    const user = db.currentUser;
    if (!user) throw new Error('Utilisateur non connecté.');

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      sender_id: user.id,
      receiver_id: receiverId,
      content,
      created_at: new Date().toISOString(),
      sender_nom: user.nom
    };

    if (isFirebaseConfigured && dbFirestore) {
      try {
        await setDoc(doc(dbFirestore, 'messages', newMessage.id), {
          id: newMessage.id,
          sender_id: newMessage.sender_id,
          receiver_id: newMessage.receiver_id,
          content: newMessage.content,
          created_at: newMessage.created_at
        });
      } catch (error) {
        console.warn('Info - inserting message in Firebase:', error);
      }
    }

    db.messages.push(newMessage);
    db.saveMessages();
    return newMessage;
  }
};
