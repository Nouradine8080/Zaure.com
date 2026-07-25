import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  updateEmail,
  updatePassword,
  deleteUser
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
  deleteDoc,
  updateDoc,
  onSnapshot
} from 'firebase/firestore';
import { UserProfile, Circle, CircleMember, Capsule, Comment, Reaction, Message, UserSettings, DEFAULT_USER_SETTINGS } from './types';

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
// LOCAL SANDBOX SEED DATA (Empty by default - no demo data)
// ----------------------------------------------------
const SEED_USERS: UserProfile[] = [];
const SEED_CIRCLES: Circle[] = [];
const SEED_MEMBERS: CircleMember[] = [];
const SEED_CAPSULES: Capsule[] = [];
const SEED_COMMENTS: Comment[] = [];
const SEED_REACTIONS: Reaction[] = [];
const SEED_MESSAGES: Message[] = [];

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

    const demoUserIds = ['user-amina', 'user-ousmane', 'user-mahamadou'];
    const demoCircleIds = ['circle-sante', 'circle-haoussa', 'circle-medecine', 'circle-agri'];

    if (usersData) {
      this.users = (JSON.parse(usersData) as UserProfile[]).filter(u => !demoUserIds.includes(u.id));
    } else {
      this.users = [];
      this.saveUsers();
    }

    if (circlesData) {
      this.circles = (JSON.parse(circlesData) as Circle[]).filter(c => !demoCircleIds.includes(c.id));
    } else {
      this.circles = [];
      this.saveCircles();
    }

    if (membersData) {
      this.members = (JSON.parse(membersData) as CircleMember[]).filter(m => !demoCircleIds.includes(m.circle_id) && !demoUserIds.includes(m.user_id));
    } else {
      this.members = [];
      this.saveMembers();
    }

    if (capsulesData) {
      this.capsules = (JSON.parse(capsulesData) as Capsule[]).filter(c => !demoCircleIds.includes(c.circle_id) && !demoUserIds.includes(c.auteur_id));
    } else {
      this.capsules = [];
      this.saveCapsules();
    }

    if (commentsData) {
      this.comments = (JSON.parse(commentsData) as Comment[]).filter(c => !demoUserIds.includes(c.auteur_id));
    } else {
      this.comments = [];
      this.saveComments();
    }

    if (reactionsData) {
      this.reactions = (JSON.parse(reactionsData) as Reaction[]).filter(r => !demoUserIds.includes(r.user_id));
    } else {
      this.reactions = [];
      this.saveReactions();
    }

    if (messagesData) {
      this.messages = (JSON.parse(messagesData) as Message[]).filter(m => !demoUserIds.includes(m.sender_id) && !demoUserIds.includes(m.receiver_id));
    } else {
      this.messages = [];
      this.saveMessages();
    }

    if (currentUserData) {
      const parsedUser = JSON.parse(currentUserData);
      if (parsedUser && demoUserIds.includes(parsedUser.id)) {
        this.currentUser = null;
        localStorage.removeItem('zaure_current_user');
      } else {
        this.currentUser = parsedUser;
      }
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
      return { user: null, error: 'Cet email n\'existe pas dans le Sandbox. Veuillez créer un compte.' };
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
      const defaultUser = db.users[0] || null;
      if (!defaultUser) {
        return { user: null, error: 'Aucun compte disponible dans le Sandbox. Veuillez créer un compte.' };
      }
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

  switchSandboxUser: (userId: string): UserProfile | null => {
    const user = db.users.find(u => u.id === userId) || db.users[0] || null;
    if (user) {
      db.currentUser = user;
      localStorage.setItem('zaure_current_user', JSON.stringify(user));
    }
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

  // Helper for deterministic conversation ID
  getConversationId: (uid1: string, uid2: string): string => {
    return [uid1, uid2].sort().join('_');
  },

  // --- PRIVATE MESSAGES ---
  subscribePrivateMessages: (otherUserId: string, callback: (messages: Message[]) => void): (() => void) => {
    const user = db.currentUser;
    if (!user) {
      callback([]);
      return () => {};
    }

    const convId = [user.id, otherUserId].sort().join('_');

    if (isFirebaseConfigured && dbFirestore) {
      try {
        const messagesRef = collection(dbFirestore, 'conversations', convId, 'messages');
        const q = query(messagesRef, orderBy('created_at', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const list: Message[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            list.push({
              id: docSnap.id || data.id,
              sender_id: data.sender_id || data.senderId || '',
              receiver_id: data.receiver_id || data.receiverId || '',
              content: data.content || '',
              created_at: data.created_at || data.createdAt || new Date().toISOString(),
              sender_nom: data.sender_nom || data.senderNom || 'Membre'
            });
          });

          callback(list);
        }, (error) => {
          console.warn('Firestore onSnapshot error, fallback to local query:', error);
          const localMsgs = db.messages
            .filter(m => (m.sender_id === user.id && m.receiver_id === otherUserId) || (m.sender_id === otherUserId && m.receiver_id === user.id))
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          callback(localMsgs);
        });

        return unsubscribe;
      } catch (e) {
        console.warn('Error setting up onSnapshot listener:', e);
      }
    }

    // Local / Sandbox Fallback Mode
    const localMsgs = db.messages
      .filter(m => (m.sender_id === user.id && m.receiver_id === otherUserId) || (m.sender_id === otherUserId && m.receiver_id === user.id))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    callback(localMsgs);

    const interval = setInterval(() => {
      const updatedMsgs = db.messages
        .filter(m => (m.sender_id === user.id && m.receiver_id === otherUserId) || (m.sender_id === otherUserId && m.receiver_id === user.id))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      callback(updatedMsgs);
    }, 2000);

    return () => clearInterval(interval);
  },

  getPrivateMessages: async (otherUserId: string): Promise<Message[]> => {
    const user = db.currentUser;
    if (!user) return [];

    const convId = [user.id, otherUserId].sort().join('_');

    if (isFirebaseConfigured && dbFirestore) {
      try {
        const messagesRef = collection(dbFirestore, 'conversations', convId, 'messages');
        const q = query(messagesRef, orderBy('created_at', 'asc'));
        const snapshot = await getDocs(q);

        const list: Message[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id || data.id,
            sender_id: data.sender_id || data.senderId || '',
            receiver_id: data.receiver_id || data.receiverId || '',
            content: data.content || '',
            created_at: data.created_at || data.createdAt || new Date().toISOString(),
            sender_nom: data.sender_nom || data.senderNom || 'Membre'
          });
        });

        if (list.length > 0) return list;
      } catch (error) {
        console.warn('Info - fetching messages from Firebase:', error);
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

    const convId = [user.id, receiverId].sort().join('_');
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const newMessage: Message = {
      id: messageId,
      sender_id: user.id,
      receiver_id: receiverId,
      content,
      created_at: nowIso,
      sender_nom: user.nom
    };

    if (isFirebaseConfigured && dbFirestore) {
      try {
        const docRef = doc(dbFirestore, 'conversations', convId, 'messages', messageId);
        await setDoc(docRef, {
          id: messageId,
          conversation_id: convId,
          sender_id: user.id,
          senderId: user.id,
          receiver_id: receiverId,
          receiverId: receiverId,
          content: content,
          created_at: nowIso,
          createdAt: nowIso,
          sender_nom: user.nom,
          senderNom: user.nom
        });

        await setDoc(doc(dbFirestore, 'messages', messageId), {
          id: messageId,
          conversation_id: convId,
          sender_id: user.id,
          receiver_id: receiverId,
          content: content,
          created_at: nowIso
        }).catch(() => {});
      } catch (error) {
        console.warn('Info - inserting message in Firebase:', error);
      }
    }

    db.messages.push(newMessage);
    db.saveMessages();
    return newMessage;
  },

  // ----------------------------------------------------
  // USER SETTINGS & PREFERENCES MANAGEMENT
  // ----------------------------------------------------
  getUserSettings: async (userId: string): Promise<UserSettings> => {
    const user = db.currentUser;
    const baseSettings: UserSettings = {
      ...DEFAULT_USER_SETTINGS,
      nom: user?.nom || '',
      email: user?.email || '',
      bio: user?.bio || '',
      avatar_url: user?.avatar_url || '',
      langue_preferee: user?.langue_preferee || 'fr',
      langue_interface: user?.langue_preferee || 'fr'
    };

    if (isFirebaseConfigured && dbFirestore) {
      try {
        const settingsDoc = await getDoc(doc(dbFirestore, 'user_settings', userId));
        if (settingsDoc.exists()) {
          return { ...baseSettings, ...settingsDoc.data() as UserSettings };
        }
      } catch (error) {
        console.warn('Info - fetching user_settings from Firestore:', error);
      }
    }

    // Local storage fallback
    const local = localStorage.getItem(`zaure_settings_${userId}`);
    if (local) {
      try {
        return { ...baseSettings, ...JSON.parse(local) };
      } catch (e) {
        // fallback
      }
    }
    return baseSettings;
  },

  saveUserSettings: async (userId: string, newSettings: Partial<UserSettings>): Promise<boolean> => {
    if (isFirebaseConfigured && dbFirestore) {
      try {
        await setDoc(doc(dbFirestore, 'user_settings', userId), newSettings, { merge: true });
      } catch (error) {
        console.warn('Info - saving user_settings to Firestore:', error);
      }
    }

    // Also persist in local storage for fast client sync & offline support
    const local = localStorage.getItem(`zaure_settings_${userId}`);
    const existing = local ? JSON.parse(local) : {};
    const merged = { ...existing, ...newSettings };
    localStorage.setItem(`zaure_settings_${userId}`, JSON.stringify(merged));
    return true;
  },

  updateUserProfile: async (
    userId: string, 
    updates: { nom?: string; bio?: string; avatar_url?: string; langue_preferee?: 'fr' | 'ha' | 'en' }
  ): Promise<{ user: UserProfile | null, error: string | null }> => {
    if (isFirebaseConfigured && dbFirestore) {
      try {
        await updateDoc(doc(dbFirestore, 'users', userId), updates);
      } catch (error) {
        console.warn('Info - updating user profile in Firestore:', error);
      }
    }

    if (db.currentUser && db.currentUser.id === userId) {
      db.currentUser = { ...db.currentUser, ...updates };
      localStorage.setItem('zaure_current_user', JSON.stringify(db.currentUser));
      const idx = db.users.findIndex(u => u.id === userId);
      if (idx !== -1) {
        db.users[idx] = { ...db.users[idx], ...updates };
        db.saveUsers();
      }
      return { user: db.currentUser, error: null };
    }
    return { user: null, error: 'Utilisateur non trouvé' };
  },

  changeUserEmail: async (newEmail: string): Promise<{ success: boolean; error: string | null }> => {
    const user = db.currentUser;
    if (!user) return { success: false, error: 'Utilisateur non connecté' };

    if (isFirebaseConfigured && auth && auth.currentUser) {
      try {
        await updateEmail(auth.currentUser, newEmail);
        if (dbFirestore) {
          await updateDoc(doc(dbFirestore, 'users', user.id), { email: newEmail });
        }
      } catch (err: any) {
        return { success: false, error: err.message || 'Erreur lors de la mise à jour de l\'email' };
      }
    }

    user.email = newEmail;
    db.currentUser = user;
    localStorage.setItem('zaure_current_user', JSON.stringify(user));
    return { success: true, error: null };
  },

  changeUserPassword: async (newPassword: string): Promise<{ success: boolean; error: string | null }> => {
    if (isFirebaseConfigured && auth && auth.currentUser) {
      try {
        await updatePassword(auth.currentUser, newPassword);
        return { success: true, error: null };
      } catch (err: any) {
        return { success: false, error: err.message || 'Erreur lors du changement de mot de passe.' };
      }
    }
    // Sandbox mock password change
    return { success: true, error: null };
  },

  deleteAccount: async (userId: string): Promise<{ success: boolean; error: string | null }> => {
    if (isFirebaseConfigured && dbFirestore) {
      try {
        await deleteDoc(doc(dbFirestore, 'users', userId));
        await deleteDoc(doc(dbFirestore, 'user_settings', userId));
        if (auth && auth.currentUser) {
          await deleteUser(auth.currentUser);
        }
      } catch (err: any) {
        console.warn('Error deleting account:', err);
      }
    }
    db.currentUser = null;
    localStorage.removeItem('zaure_current_user');
    localStorage.removeItem(`zaure_settings_${userId}`);
    return { success: true, error: null };
  },

  getAllUsersList: async (): Promise<UserProfile[]> => {
    if (isFirebaseConfigured && dbFirestore) {
      try {
        const snap = await getDocs(collection(dbFirestore, 'users'));
        const list: UserProfile[] = [];
        snap.forEach(d => list.push(d.data() as UserProfile));
        if (list.length > 0) return list;
      } catch (e) {
        console.warn(e);
      }
    }
    return db.users;
  }
};

