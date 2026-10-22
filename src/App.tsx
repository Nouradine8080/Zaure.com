import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Sparkles, 
  BookOpen, 
  MessageSquare, 
  LogOut, 
  User, 
  Layers, 
  Check, 
  Volume2,
  Settings,
  Languages,
  ArrowLeft,
  Search,
  X,
  Compass,
  Bookmark,
  ShieldCheck,
  Award,
  Users,
  Share2,
  HelpCircle,
  TrendingUp,
  Filter,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  HeartHandshake,
  Lock,
  Eye,
  EyeOff,
  Mail,
  ArrowRight,
  Stethoscope,
  GraduationCap,
  Lightbulb,
  Microscope,
  UserCheck
} from 'lucide-react';
import { zaureService } from './firebaseClient';
import { Circle, Capsule, UserProfile } from './types';
import CircleCard from './components/CircleCard';
import CapsuleCard from './components/CapsuleCard';
import AudioRecorder from './components/AudioRecorder';
import ChatView from './components/ChatView';
import SettingsView from './components/SettingsView';
import CircleGroupPage from './components/CircleGroupPage';
import AuthPortal from './components/AuthPortal';
import { useTranslation } from './context/LanguageContext';

const AVATAR_PRESETS = [
  {
    id: 'med-student-1',
    label: 'Étudiant Santé',
    url: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=200'
  },
  {
    id: 'med-student-2',
    label: 'Étudiante Santé',
    url: 'https://images.unsplash.com/photo-1594824813589-9800e84b2e15?auto=format&fit=crop&q=80&w=200'
  },
  {
    id: 'scholar-1',
    label: 'Apprenant Universitaire',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'
  },
  {
    id: 'mentor-1',
    label: 'Mentor & Enseignant',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200'
  },
  {
    id: 'practitioner-1',
    label: 'Praticienne Spécialiste',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200'
  },
  {
    id: 'tech-1',
    label: 'Innovateur Digital',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200'
  }
];

export default function App() {
  const { t, language, setLanguage } = useTranslation();
  
  // Navigation & View tabs
  const [activeTab, setActiveTab] = useState<'feed' | 'chat' | 'settings'>('feed');
  const [feedSection, setFeedSection] = useState<'feed' | 'circles' | 'mentors' | 'bookmarks'>('feed');
  
  // Data state
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [joinedCircleIds, setJoinedCircleIds] = useState<string[]>([]);
  const [selectedCircleId, setSelectedCircleId] = useState<string>('all');
  
  // Feed filters & Search
  const [feedFilter, setFeedFilter] = useState<'all' | 'joined' | 'audio' | 'questions'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  // Bookmarks (saved locally for quick access)
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('zaure_bookmarks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Direct chat contact selection
  const [directChatUser, setDirectChatUser] = useState<UserProfile | null>(null);

  // Modals & form state
  const [showCreateCircle, setShowCreateCircle] = useState(false);
  const [showCreateCapsule, setShowCreateCapsule] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Multi-step Auth form states
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState('');
  const [authNom, setAuthNom] = useState('');
  const [authBio, setAuthBio] = useState('');
  const [authRole, setAuthRole] = useState<'utilisateur' | 'mentor' | 'verifie'>('utilisateur');
  const [authSpecialty, setAuthSpecialty] = useState<'medecine' | 'mentor' | 'etudiant' | 'chercheur'>('medecine');
  const [authLangue, setAuthLangue] = useState<'fr' | 'ha' | 'en'>('fr');
  const [authAvatarUrl, setAuthAvatarUrl] = useState<string>(AVATAR_PRESETS[0].url);
  const [authSelectedCircleIds, setAuthSelectedCircleIds] = useState<string[]>([]);
  const [signupStep, setSignupStep] = useState<number>(1);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Circle form states
  const [newCircleNom, setNewCircleNom] = useState('');
  const [newCircleDesc, setNewCircleDesc] = useState('');
  const [newCircleCat, setNewCircleCat] = useState('Médecine');
  const [newCircleImg, setNewCircleImg] = useState('');

  // Capsule form states
  const [newCapsuleCircleId, setNewCapsuleCircleId] = useState('');
  const [newCapsuleType, setNewCapsuleType] = useState<'texte' | 'audio'>('texte');
  const [newCapsuleContenu, setNewCapsuleContenu] = useState('');
  const [newCapsuleLangue, setNewCapsuleLangue] = useState<'fr' | 'ha' | 'en'>('fr');

  const [isAuthResolving, setIsAuthResolving] = useState<boolean>(true);

  // Persistence of bookmarks
  const toggleBookmark = (id: string) => {
    setBookmarkedIds((prev) => {
      const updated = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      try {
        localStorage.setItem('zaure_bookmarks', JSON.stringify(updated));
      } catch {
        // ignore storage error
      }
      return updated;
    });
  };

  useEffect(() => {
    const unsubscribe = zaureService.onAuthStateChangedListener((user) => {
      setCurrentUser(user);
      setIsAuthResolving(false);
      if (user) {
        zaureService.getJoinedCircleIds(user.id).then(setJoinedCircleIds);
      }
    });

    loadInitialData();

    // Auto-sync circles across user sessions
    const syncInterval = setInterval(async () => {
      try {
        const freshCircles = await zaureService.getCircles();
        setCircles(freshCircles);
      } catch {
        // silent sync
      }
    }, 4000);

    return () => {
      unsubscribe();
      clearInterval(syncInterval);
    };
  }, []);

  // Reload feed whenever filters or joined circles change
  useEffect(() => {
    loadCapsules();
  }, [joinedCircleIds, selectedCircleId, feedFilter]);

  const loadInitialData = async () => {
    try {
      const allCircles = await zaureService.getCircles();
      setCircles(allCircles);

      if (allCircles.length > 0) {
        setNewCapsuleCircleId(allCircles[0].id);
      }

      const users = await zaureService.getAvailableUsers();
      setAllUsers(users);

      const user = zaureService.getCurrentUser();
      if (user) {
        const joined = await zaureService.getJoinedCircleIds(user.id);
        setJoinedCircleIds(joined);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadCapsules = async () => {
    try {
      let filteredIds: string[] = [];

      if (selectedCircleId !== 'all') {
        filteredIds = [selectedCircleId];
      } else if (feedFilter === 'joined') {
        filteredIds = joinedCircleIds;
      }

      const list = await zaureService.getCapsules(filteredIds);
      setCapsules(list);
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleJoinCircle = async (circleId: string) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    const isJoined = joinedCircleIds.includes(circleId);
    if (isJoined) {
      const success = await zaureService.leaveCircle(circleId, currentUser.id);
      if (success) {
        setJoinedCircleIds((prev) => prev.filter((id) => id !== circleId));
      }
    } else {
      const success = await zaureService.joinCircle(circleId, currentUser.id);
      if (success) {
        setJoinedCircleIds((prev) => [...prev, circleId]);
      }
    }
  };

  // Auth Form Helpers & Handlers
  const resetAuthForm = () => {
    setAuthEmail('');
    setAuthPassword('');
    setAuthPasswordConfirm('');
    setAuthNom('');
    setAuthBio('');
    setAuthRole('utilisateur');
    setAuthSpecialty('medecine');
    setAuthLangue('fr');
    setAuthAvatarUrl(AVATAR_PRESETS[0].url);
    setAuthSelectedCircleIds([]);
    setSignupStep(1);
    setShowPassword(false);
    setAuthError(null);
  };

  const handleSpecialtySelect = (spec: 'medecine' | 'mentor' | 'etudiant' | 'chercheur') => {
    setAuthSpecialty(spec);
    if (spec === 'medecine') {
      setAuthRole('verifie');
      if (!authBio || authBio.startsWith('Étudiant') || authBio.startsWith('Mentor') || authBio.startsWith('Chercheur') || authBio.startsWith('Membre') || authBio.startsWith('Apprenant')) {
        setAuthBio('Étudiant en médecine passionné par la clinique, la pharmacologie et l\'entraide médicale.');
      }
    } else if (spec === 'mentor') {
      setAuthRole('mentor');
      if (!authBio || authBio.startsWith('Étudiant') || authBio.startsWith('Mentor') || authBio.startsWith('Chercheur') || authBio.startsWith('Membre') || authBio.startsWith('Apprenant')) {
        setAuthBio('Enseignant & mentor guidant les apprenants dans l\'assimilation des concepts clés.');
      }
    } else if (spec === 'chercheur') {
      setAuthRole('verifie');
      if (!authBio || authBio.startsWith('Étudiant') || authBio.startsWith('Mentor') || authBio.startsWith('Chercheur') || authBio.startsWith('Membre') || authBio.startsWith('Apprenant')) {
        setAuthBio('Chercheur et praticien partageant les avancées scientifiques et méthodologies.');
      }
    } else {
      setAuthRole('utilisateur');
      if (!authBio || authBio.startsWith('Étudiant') || authBio.startsWith('Mentor') || authBio.startsWith('Chercheur') || authBio.startsWith('Membre') || authBio.startsWith('Apprenant')) {
        setAuthBio('Apprenant curieux explorant les savoirs et participant aux cercles thématiques.');
      }
    }
  };

  const toggleAuthCircleSelect = (circleId: string) => {
    setAuthSelectedCircleIds(prev => 
      prev.includes(circleId) ? prev.filter(id => id !== circleId) : [...prev, circleId]
    );
  };

  const handleNextStep = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError(null);

    if (signupStep === 1) {
      if (!authNom.trim()) {
        setAuthError('Veuillez renseigner votre nom complet.');
        return;
      }
      if (!authEmail.trim() || !authEmail.includes('@')) {
        setAuthError('Veuillez saisir une adresse email valide.');
        return;
      }
      if (!authPassword || authPassword.length < 6) {
        setAuthError('Le mot de passe doit comporter au moins 6 caractères.');
        return;
      }
      if (authPasswordConfirm && authPassword !== authPasswordConfirm) {
        setAuthError('Les deux mots de passe ne correspondent pas.');
        return;
      }
      setSignupStep(2);
    } else if (signupStep === 2) {
      if (!authBio.trim()) {
        handleSpecialtySelect(authSpecialty);
      }
      // Auto select appropriate circles if empty
      if (authSelectedCircleIds.length === 0 && circles.length > 0) {
        const medCircles = circles.filter(c => 
          c.categorie === 'Médecine' || 
          c.nom.toLowerCase().includes('santé') || 
          c.nom.toLowerCase().includes('méd')
        );
        if (medCircles.length > 0) {
          setAuthSelectedCircleIds(medCircles.map(c => c.id));
        } else {
          setAuthSelectedCircleIds(circles.slice(0, 2).map(c => c.id));
        }
      }
      setSignupStep(3);
    }
  };

  const handlePrevStep = () => {
    setAuthError(null);
    if (signupStep > 1) {
      setSignupStep(signupStep - 1);
    }
  };

  // Auth Submit
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (isSignUp) {
      if (signupStep < 3) {
        handleNextStep();
        return;
      }

      setAuthLoading(true);
      try {
        const finalBio = authBio.trim() || (
          authSpecialty === 'medecine' 
            ? 'Étudiant en médecine passionné par la clinique et l\'entraide médicale.' 
            : 'Membre actif sur Zaure.'
        );

        const { user, error } = await zaureService.signUp(
          authNom.trim(), 
          authEmail.trim(), 
          finalBio, 
          authRole, 
          authLangue, 
          authPassword,
          authAvatarUrl
        );

        if (error) {
          setAuthError(error);
          setAuthLoading(false);
          return;
        }

        if (user) {
          setCurrentUser(user);
          // Join selected circles automatically
          if (authSelectedCircleIds.length > 0) {
            for (const cId of authSelectedCircleIds) {
              await zaureService.joinCircle(cId, user.id);
            }
          }
          const joined = await zaureService.getJoinedCircleIds(user.id);
          setJoinedCircleIds(joined);
          setShowAuthModal(false);
          resetAuthForm();
        }
      } catch (err: any) {
        setAuthError(err.message || 'Erreur lors de la création du compte.');
      } finally {
        setAuthLoading(false);
      }
    } else {
      if (!authEmail.trim()) {
        setAuthError('Veuillez saisir votre adresse email.');
        return;
      }
      setAuthLoading(true);
      try {
        const { user, error } = await zaureService.signIn(
          authEmail.trim(), 
          authPassword
        );
        if (error) {
          setAuthError(error);
        } else {
          setCurrentUser(user);
          setShowAuthModal(false);
          resetAuthForm();
          if (user) {
            const joined = await zaureService.getJoinedCircleIds(user.id);
            setJoinedCircleIds(joined);
          }
        }
      } catch (err: any) {
        setAuthError(err.message || 'Identifiants invalides ou compte introuvable.');
      } finally {
        setAuthLoading(false);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    const { user, error } = await zaureService.signInWithGoogle();
    if (error) {
      setAuthError(error);
    } else {
      setCurrentUser(user);
      setShowAuthModal(false);
      if (user) {
        const joined = await zaureService.getJoinedCircleIds(user.id);
        setJoinedCircleIds(joined);
      }
    }
  };

  const handleSignOut = async () => {
    await zaureService.signOut();
    setCurrentUser(null);
    setJoinedCircleIds([]);
  };

  // Create Circle Submit
  const handleCreateCircleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCircleNom || !newCircleDesc) return;

    const imgMap: { [key: string]: string } = {
      'Médecine': 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&q=80&w=600',
      'Langues': 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&q=80&w=600',
      'Sciences': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=600',
      'Culture': 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&q=80&w=600'
    };

    const imageUrl = newCircleImg || imgMap[newCircleCat] || imgMap['Sciences'];

    try {
      const added = await zaureService.createCircle(newCircleNom, newCircleDesc, newCircleCat, imageUrl);
      const allCircles = await zaureService.getCircles();
      setCircles(allCircles);
      setJoinedCircleIds((prev) => [...prev, added.id]);
      setSelectedCircleId('all');
      setFeedFilter('all');
      setNewCircleNom('');
      setNewCircleDesc('');
      setNewCircleImg('');
      setShowCreateCircle(false);
      loadCapsules();
    } catch (err) {
      console.error(err);
    }
  };

  // Create Capsule Submit
  const handleCreateCapsuleSubmit = async () => {
    if (!newCapsuleContenu || !newCapsuleCircleId) return;

    try {
      const added = await zaureService.createCapsule(
        newCapsuleCircleId,
        newCapsuleType,
        newCapsuleContenu,
        newCapsuleLangue
      );
      setCapsules((prev) => [added, ...prev]);
      setNewCapsuleContenu('');
      setShowCreateCapsule(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Quick preset suggestions for circle covers
  const presetImages = [
    { name: 'Santé Sahel', url: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=400' },
    { name: 'Langues & Haoussa', url: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=400' },
    { name: 'Agro-écologie', url: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=400' },
    { name: 'Technologies', url: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&q=80&w=400' }
  ];

  // Filtered Capsules based on search and feedFilter/feedSection
  const displayedCapsules = useMemo(() => {
    let result = capsules;

    // Filter by section
    if (feedSection === 'bookmarks') {
      result = result.filter((c) => bookmarkedIds.includes(c.id));
    }

    // Filter by type or criteria
    if (feedFilter === 'audio') {
      result = result.filter((c) => c.type === 'audio');
    } else if (feedFilter === 'questions') {
      result = result.filter((c) => c.contenu.includes('?') || c.contenu.toLowerCase().includes('question'));
    }

    // Global Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((c) => 
        c.contenu.toLowerCase().includes(query) ||
        (c.auteur_nom && c.auteur_nom.toLowerCase().includes(query)) ||
        (c.circle_nom && c.circle_nom.toLowerCase().includes(query))
      );
    }

    return result;
  }, [capsules, feedSection, feedFilter, searchQuery, bookmarkedIds]);

  // Filtered Circles based on search & category
  const displayedCircles = useMemo(() => {
    let list = circles;
    if (categoryFilter !== 'all') {
      list = list.filter((c) => c.categorie.toLowerCase().includes(categoryFilter.toLowerCase()));
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      list = list.filter((c) => 
        c.nom.toLowerCase().includes(query) || 
        c.description.toLowerCase().includes(query) ||
        c.categorie.toLowerCase().includes(query)
      );
    }
    return list;
  }, [circles, categoryFilter, searchQuery]);

  // Verified Mentors
  const mentorsList = useMemo(() => {
    return allUsers.filter((u) => u.role === 'mentor' || u.role === 'verifie');
  }, [allUsers]);

  // Joined Circles List
  const userJoinedCircles = useMemo(() => {
    return circles.filter((c) => joinedCircleIds.includes(c.id));
  }, [circles, joinedCircleIds]);

  // Suggested Circles (not yet joined)
  const suggestedCircles = useMemo(() => {
    return circles.filter((c) => !joinedCircleIds.includes(c.id)).slice(0, 3);
  }, [circles, joinedCircleIds]);

  // Navigate directly to private chat with a selected user
  const handleOpenChatWithUser = (user: UserProfile) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    setDirectChatUser(user);
    setActiveTab('chat');
  };

  // 1. Initial Firebase Auth Resolution Splash
  if (isAuthResolving) {
    return (
      <div className="min-h-screen bg-[#F0F2F5] flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black text-3xl shadow-xl animate-pulse">
          Z
        </div>
        <div className="mt-5 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping"></span>
          <span className="text-xs font-bold text-slate-600 tracking-wider uppercase">Vérification de session Zaure...</span>
        </div>
      </div>
    );
  }

  // 2. Page protection: non-authenticated users land on Facebook-inspired AuthPortal
  if (!currentUser) {
    return (
      <AuthPortal
        circles={circles}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          zaureService.getJoinedCircleIds(user.id).then(setJoinedCircleIds);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900" id="main-app-container">
      
      {/* ============================================================ */}
      {/* 1. TOP NAVBAR (FIXED, FACEBOOK-STYLE ERGONOMIC APP BAR) */}
      {/* ============================================================ */}
      <header className="bg-white border-b border-slate-200/90 sticky top-0 z-40 shadow-xs h-14 sm:h-16 w-full" id="header-navbar">
        <div className="max-w-[1520px] w-full mx-auto px-3 sm:px-4 lg:px-6 h-full flex items-center justify-between gap-2 sm:gap-4">
          
          {/* ZONE GAUCHE : Logo & Search Bar */}
          <div className="flex items-center gap-2 sm:gap-3 flex-1 max-w-xs md:max-w-sm">
            <button 
              type="button"
              onClick={() => {
                setActiveTab('feed');
                setFeedSection('feed');
                setSelectedCircleId('all');
                setFeedFilter('all');
              }}
              className="flex items-center gap-2 group shrink-0"
              title="Accueil Zaure"
            >
              <div className="bg-blue-600 text-white font-black text-lg tracking-wider rounded-xl w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                Z
              </div>
              <div className="hidden sm:block text-left leading-none">
                <span className="text-lg font-black tracking-tight text-slate-950 group-hover:text-blue-600 transition-colors">
                  Zaure
                </span>
                <p className="text-[10px] text-red-600 font-semibold uppercase tracking-wider mt-0.5">
                  Savoirs du Sahel
                </p>
              </div>
            </button>

            {/* Global Search Bar (Facebook style input with instant filter) */}
            <div className="relative flex-1 hidden md:block">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher savoirs, cercles, auteurs..."
                className="w-full bg-[#F0F2F5] hover:bg-slate-200/70 focus:bg-white text-slate-900 text-xs pl-9 pr-8 py-2 rounded-full border border-transparent focus:border-blue-500 focus:outline-none transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                  title="Effacer la recherche"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Mobile Search Toggle */}
            <button
              type="button"
              onClick={() => setShowMobileSearch(!showMobileSearch)}
              className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-full transition"
              title="Rechercher"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>

          {/* ZONE CENTRALE : Onglets de Navigation Principaux (Desktop & Tablette) */}
          <nav className="hidden md:flex items-center justify-center gap-1 sm:gap-2 flex-1 max-w-md h-full">
            {/* 1. Fil d'actualité */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('feed');
                setFeedSection('feed');
                setSelectedCircleId('all');
              }}
              className={`h-full px-4 sm:px-6 flex flex-col items-center justify-center relative transition group ${
                activeTab === 'feed' && feedSection === 'feed' && selectedCircleId === 'all'
                  ? 'text-blue-600 font-bold'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/70 rounded-xl'
              }`}
              title="Fil d'actualité"
            >
              <BookOpen className={`w-5 h-5 ${activeTab === 'feed' && feedSection === 'feed' && selectedCircleId === 'all' ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              <span className="text-[10px] tracking-tight mt-0.5 hidden lg:inline">Accueil</span>
              {activeTab === 'feed' && feedSection === 'feed' && selectedCircleId === 'all' && (
                <span className="absolute bottom-0 inset-x-2 h-1 bg-blue-600 rounded-t-full" />
              )}
            </button>

            {/* 2. Cercles de Savoir */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('feed');
                setFeedSection('circles');
                setSelectedCircleId('all');
              }}
              className={`h-full px-4 sm:px-6 flex flex-col items-center justify-center relative transition group ${
                activeTab === 'feed' && (feedSection === 'circles' || selectedCircleId !== 'all')
                  ? 'text-blue-600 font-bold'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/70 rounded-xl'
              }`}
              title="Cercles de Savoir"
            >
              <Layers className={`w-5 h-5 ${activeTab === 'feed' && (feedSection === 'circles' || selectedCircleId !== 'all') ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              <span className="text-[10px] tracking-tight mt-0.5 hidden lg:inline">Cercles</span>
              {activeTab === 'feed' && (feedSection === 'circles' || selectedCircleId !== 'all') && (
                <span className="absolute bottom-0 inset-x-2 h-1 bg-blue-600 rounded-t-full" />
              )}
            </button>

            {/* 3. Messagerie Directe */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('chat');
              }}
              className={`h-full px-4 sm:px-6 flex flex-col items-center justify-center relative transition group ${
                activeTab === 'chat'
                  ? 'text-blue-600 font-bold'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/70 rounded-xl'
              }`}
              title="Messagerie"
            >
              <MessageSquare className={`w-5 h-5 ${activeTab === 'chat' ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              <span className="text-[10px] tracking-tight mt-0.5 hidden lg:inline">Messages</span>
              {activeTab === 'chat' && (
                <span className="absolute bottom-0 inset-x-2 h-1 bg-blue-600 rounded-t-full" />
              )}
            </button>

            {/* 4. Paramètres */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('settings');
              }}
              className={`h-full px-4 sm:px-6 flex flex-col items-center justify-center relative transition group ${
                activeTab === 'settings'
                  ? 'text-blue-600 font-bold'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/70 rounded-xl'
              }`}
              title="Paramètres"
            >
              <Settings className={`w-5 h-5 ${activeTab === 'settings' ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              <span className="text-[10px] tracking-tight mt-0.5 hidden lg:inline">Réglages</span>
              {activeTab === 'settings' && (
                <span className="absolute bottom-0 inset-x-2 h-1 bg-blue-600 rounded-t-full" />
              )}
            </button>
          </nav>

          {/* ZONE DROITE : Langue + Bouton Créer + Profil Utilisateur */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            
            {/* Language Switcher */}
            <div className="flex items-center gap-1 bg-[#F0F2F5] hover:bg-slate-200/80 px-2 py-1.5 rounded-full text-xs text-slate-700 transition">
              <Languages className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'fr' | 'ha' | 'en')}
                className="bg-transparent font-bold text-xs focus:outline-none cursor-pointer pr-1 text-slate-800"
                aria-label="Sélectionner la langue"
              >
                <option value="fr">FR</option>
                <option value="ha">HA (Hausa)</option>
                <option value="en">EN</option>
              </select>
            </div>

            {/* Quick Action: New Circle (Desktop shortcut) */}
            {currentUser && (
              <button
                type="button"
                onClick={() => setShowCreateCircle(true)}
                className="hidden xl:flex items-center gap-1.5 min-h-[38px] px-3 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-xs rounded-full transition"
                title="Créer un nouveau cercle de savoir"
              >
                <Plus className="w-3.5 h-3.5 text-red-500 stroke-[2.5]" />
                <span>Nouveau Cercle</span>
              </button>
            )}

            {/* User Profile Pill or Login Button */}
            {currentUser ? (
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className="flex items-center gap-2 p-1 hover:bg-[#F0F2F5] rounded-full transition pr-2"
                  title="Mon profil et réglages"
                >
                  <div className="relative">
                    {currentUser.avatar_url ? (
                      <img 
                        src={currentUser.avatar_url} 
                        alt={currentUser.nom} 
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover ring-2 ring-blue-600" 
                        referrerPolicy="no-referrer" 
                      />
                    ) : (
                      <div className="w-8 h-8 sm:w-9 sm:h-9 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xs">
                        {currentUser.nom.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {currentUser.role === 'verifie' && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-blue-600 border-2 border-white rounded-full" title="Professionnel vérifié" />
                    )}
                    {currentUser.role === 'mentor' && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-amber-500 border-2 border-white rounded-full" title="Mentor" />
                    )}
                  </div>
                  
                  <span className="hidden sm:inline font-bold text-xs text-slate-800 max-w-[100px] truncate">
                    {currentUser.nom.split(' ')[0]}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleSignOut}
                  title="Déconnexion"
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-[#F0F2F5] rounded-full transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setShowAuthModal(true);
                }}
                className="min-h-[38px] px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-full transition shadow-xs"
              >
                Connexion
              </button>
            )}
          </div>
        </div>

        {/* Mobile Search Overlay Bar when toggled */}
        {showMobileSearch && (
          <div className="md:hidden bg-white border-t border-slate-200 px-3 py-2 flex items-center gap-2 animate-fadeIn">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher des savoirs, cercles, auteurs..."
              className="flex-1 bg-[#F0F2F5] text-xs px-3 py-1.5 rounded-full outline-none"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowMobileSearch(false)}
              className="text-xs font-bold text-blue-700 px-2"
            >
              Fermer
            </button>
          </div>
        )}
      </header>

      <div 
        className={`flex-1 w-full mx-auto px-2 sm:px-4 lg:px-6 py-3 sm:py-4 pb-20 md:pb-6 flex gap-4 lg:gap-6 justify-center ${
          activeTab === 'chat' ? 'max-w-[1600px] h-[calc(100vh-4.25rem)]' : 'max-w-[1520px]'
        }`} 
        id="main-layout-container"
      >
        
        {/* ======================================================== */}
        {/* COLONNE GAUCHE (NAVIGATION LATÉRALE & RACCOURCIS) */}
        {/* ======================================================== */}
        {activeTab !== 'chat' && (
          <aside className="hidden lg:block w-64 xl:w-72 shrink-0 space-y-3 sticky top-20 self-start max-h-[calc(100vh-5.5rem)] overflow-y-auto scrollbar-thin">
          
          {/* Quick User Identity card */}
          {currentUser ? (
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="w-full bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex items-center gap-3 transition shadow-xs text-left group"
            >
              <div className="relative shrink-0">
                {currentUser.avatar_url ? (
                  <img src={currentUser.avatar_url} alt={currentUser.nom} className="w-10 h-10 rounded-full object-cover ring-2 ring-blue-500" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                    {currentUser.nom.charAt(0).toUpperCase()}
                  </div>
                )}
                {currentUser.role === 'verifie' && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-600 border-2 border-white rounded-full" />
                )}
                {currentUser.role === 'mentor' && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-500 border-2 border-white rounded-full" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 truncate group-hover:text-blue-700 transition-colors">
                  {currentUser.nom}
                </p>
                <p className="text-[11px] text-slate-500 truncate capitalize">
                  {currentUser.role === 'verifie' ? 'Professionnel de santé' : currentUser.role === 'mentor' ? 'Mentor éducatif' : 'Membre apprenant'}
                </p>
                <p className="text-[10px] text-blue-700 font-medium mt-0.5">
                  {joinedCircleIds.length} cercle(s) rejoint(s)
                </p>
              </div>
            </button>
          ) : (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
              <p className="text-xs font-bold text-slate-900">Bienvenue sur Zaure</p>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Le réseau communautaire d'apprentissage et de savoirs partagés au Sahel.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setShowAuthModal(true);
                }}
                className="mt-3 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition"
              >
                Rejoindre la communauté
              </button>
            </div>
          )}

          {/* Navigation Links Menu (Facebook style menu) */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-2 shadow-xs space-y-0.5">
            <button
              type="button"
              onClick={() => {
                setActiveTab('feed');
                setFeedSection('feed');
                setSelectedCircleId('all');
                setFeedFilter('all');
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'feed' && feedSection === 'feed' && feedFilter === 'all' && selectedCircleId === 'all'
                  ? 'bg-blue-50 text-blue-900 font-bold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <BookOpen className="w-4 h-4 text-blue-600" />
              <span>Fil d'actualité</span>
            </button>

            {currentUser && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('feed');
                  setFeedSection('feed');
                  setSelectedCircleId('all');
                  setFeedFilter('joined');
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'feed' && feedSection === 'feed' && feedFilter === 'joined'
                    ? 'bg-blue-50 text-blue-900 font-bold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  <span>Mes Cercles</span>
                </div>
                <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                  {joinedCircleIds.length}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setActiveTab('feed');
                setFeedSection('circles');
                setSelectedCircleId('all');
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'feed' && feedSection === 'circles'
                  ? 'bg-blue-50 text-blue-900 font-bold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Compass className="w-4 h-4 text-blue-600" />
                <span>Explorer les Cercles</span>
              </div>
              <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                {circles.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('feed');
                setFeedSection('feed');
                setSelectedCircleId('all');
                setFeedFilter('audio');
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'feed' && feedSection === 'feed' && feedFilter === 'audio'
                  ? 'bg-blue-50 text-blue-900 font-bold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Volume2 className="w-4 h-4 text-blue-600" />
              <span>Notes Vocales & Audios</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('feed');
                setFeedSection('bookmarks');
                setSelectedCircleId('all');
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'feed' && feedSection === 'bookmarks'
                  ? 'bg-blue-50 text-blue-900 font-bold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Bookmark className="w-4 h-4 text-blue-600" />
                <span>Savoirs Enregistrés</span>
              </div>
              {bookmarkedIds.length > 0 && (
                <span className="font-mono text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                  {bookmarkedIds.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('feed');
                setFeedSection('mentors');
                setSelectedCircleId('all');
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'feed' && feedSection === 'mentors'
                  ? 'bg-blue-50 text-blue-900 font-bold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Award className="w-4 h-4 text-amber-500" />
                <span>Mentors du Sahel</span>
              </div>
              <span className="font-mono text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                {mentorsList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('chat');
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'chat'
                  ? 'bg-blue-50 text-blue-900 font-bold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span>Messagerie directe</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('settings');
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'settings'
                  ? 'bg-blue-50 text-blue-900 font-bold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Settings className="w-4 h-4 text-slate-500" />
              <span>Paramètres du profil</span>
            </button>
          </div>

          {/* Raccourcis vers vos Cercles (Facebook-style Shortcuts) */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3 shadow-xs">
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Vos Cercles de Savoir
              </h3>
              {currentUser && (
                <button
                  type="button"
                  onClick={() => setShowCreateCircle(true)}
                  className="text-blue-700 hover:text-blue-900 p-0.5"
                  title="Créer un nouveau cercle"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="space-y-1">
              {userJoinedCircles.length === 0 ? (
                <div className="p-3 text-center">
                  <p className="text-[11px] text-slate-400">Vous n'avez pas encore rejoint de cercle.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('feed');
                      setFeedSection('circles');
                    }}
                    className="mt-2 text-xs font-bold text-blue-700 hover:underline"
                  >
                    Explorer les cercles →
                  </button>
                </div>
              ) : (
                userJoinedCircles.map((circle) => (
                  <button
                    key={circle.id}
                    type="button"
                    onClick={() => {
                      setActiveTab('feed');
                      setSelectedCircleId(circle.id);
                    }}
                    className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition group ${
                      selectedCircleId === circle.id
                        ? 'bg-blue-50 text-blue-900 font-bold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <img
                      src={circle.image}
                      alt={circle.nom}
                      className="w-7 h-7 rounded-lg object-cover ring-1 ring-slate-200 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate group-hover:text-blue-700">
                        {circle.nom}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {circle.categorie}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Micro Footer links */}
          <div className="px-3 text-[11px] text-slate-400 leading-relaxed">
            <p>© 2026 Zaure · Partage du Savoir en Afrique de l'Ouest</p>
            <p className="mt-1">Français · Hausa · English</p>
          </div>
          </aside>
        )}

        {/* ======================================================== */}
        {/* COLONNE CENTRALE : FIL D'ACTUALITÉ / FEED PRINCIPAL */}
        {/* ======================================================== */}
        <main className={`flex-1 min-w-0 w-full ${activeTab === 'chat' ? 'h-full max-w-full' : 'max-w-2xl space-y-4'}`}>

          {/* 1. VUE SPÉCIFIQUE : PARAMÈTRES */}
          {activeTab === 'settings' && (
            <div className="animate-fadeIn">
              {currentUser ? (
                <SettingsView
                  currentUser={currentUser}
                  onProfileUpdated={(updated) => setCurrentUser(updated)}
                  onSignOut={handleSignOut}
                />
              ) : (
                <div className="bg-white border border-slate-200/80 rounded-3xl p-8 text-center shadow-xs">
                  <Settings className="w-12 h-12 text-slate-300 mx-auto mb-3 stroke-1" />
                  <h3 className="font-bold text-slate-900 text-base">Identifiez-vous pour vos réglages</h3>
                  <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
                    Connectez-vous pour personnaliser votre profil, modifier votre biographie et choisir vos langues préférées.
                  </p>
                  <button
                    onClick={() => {
                      setIsSignUp(false);
                      setShowAuthModal(true);
                    }}
                    className="mt-5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition shadow-xs"
                  >
                    Se connecter maintenant
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 2. VUE SPÉCIFIQUE : MESSAGERIE */}
          {activeTab === 'chat' && (
            <div className="animate-fadeIn">
              {currentUser ? (
                <ChatView 
                  currentUser={currentUser} 
                  initialSelectedUser={directChatUser}
                />
              ) : (
                <div className="bg-white border border-slate-200/80 rounded-3xl p-8 text-center shadow-xs">
                  <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3 stroke-1" />
                  <h3 className="font-bold text-slate-900 text-base">Identifiez-vous pour la messagerie</h3>
                  <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
                    Échangez directement avec des mentors, médecins et autres apprenants de la communauté sahélienne.
                  </p>
                  <button
                    onClick={() => {
                      setIsSignUp(false);
                      setShowAuthModal(true);
                    }}
                    className="mt-5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition shadow-xs"
                  >
                    Se connecter maintenant
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 3. VUE SPÉCIFIQUE : PAGE DE GROUPE DU CERCLE (quand un cercle précis est sélectionné) */}
          {activeTab === 'feed' && selectedCircleId !== 'all' && circles.some((c) => c.id === selectedCircleId) && (
            <div className="animate-fadeIn">
              <CircleGroupPage
                circle={circles.find((c) => c.id === selectedCircleId)!}
                capsules={capsules}
                isJoined={joinedCircleIds.includes(selectedCircleId)}
                currentUser={currentUser}
                onBack={() => setSelectedCircleId('all')}
                onToggleJoin={() => handleToggleJoinCircle(selectedCircleId)}
                onCreateCapsule={async (circleId, type, contenu, langue) => {
                  const added = await zaureService.createCapsule(circleId, type, contenu, langue);
                  setCapsules((prev) => [added, ...prev]);
                }}
                t={t}
                language={language}
              />
            </div>
          )}

          {/* 4. VUE SPÉCIFIQUE : RÉPERTOIRE DES MENTORS DU SAHEL */}
          {activeTab === 'feed' && selectedCircleId === 'all' && feedSection === 'mentors' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
                      <Award className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-extrabold text-slate-900">
                        Mentors & Professionnels de Santé
                      </h2>
                      <p className="text-[11px] text-slate-500">
                        Profils certifiés prêts à transmettre et répondre à vos questions
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFeedSection('feed')}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900"
                  >
                    Retour au fil
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {mentorsList.map((mentor) => (
                  <div key={mentor.id} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
                    <div className="flex items-start gap-3">
                      {mentor.avatar_url ? (
                        <img src={mentor.avatar_url} alt={mentor.nom} className="w-12 h-12 rounded-full object-cover ring-2 ring-amber-400 shrink-0" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center shrink-0">
                          {mentor.nom.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-slate-900 truncate">{mentor.nom}</p>
                          {mentor.role === 'verifie' && <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                        </div>
                        <p className="text-[10px] text-amber-700 font-semibold uppercase mt-0.5">
                          {mentor.role === 'verifie' ? 'Santé certifiée' : 'Mentor éducatif'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          {mentor.bio || "Membre engagé pour l'entraide communautaire."}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-medium">
                        Langue : {mentor.langue_preferee.toUpperCase()}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenChatWithUser(mentor)}
                        className="min-h-[36px] px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Discuter</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. VUE SPÉCIFIQUE : EXPLORATEUR DE TOUS LES CERCLES */}
          {activeTab === 'feed' && selectedCircleId === 'all' && feedSection === 'circles' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                      <Compass className="w-5 h-5 text-blue-600" />
                      <span>Explorer tous les Cercles de Savoir</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Trouvez et rejoignez des communautés d'apprentissage thématiques au Sahel.
                    </p>
                  </div>
                  
                  {currentUser && (
                    <button
                      type="button"
                      onClick={() => setShowCreateCircle(true)}
                      className="min-h-[38px] px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Créer un Cercle</span>
                    </button>
                  )}
                </div>

                {/* Category Pills Filter */}
                <div className="flex items-center gap-1.5 overflow-x-auto pt-4 scrollbar-none">
                  {['all', 'Médecine', 'Langues', 'Sciences', 'Culture'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`min-h-[34px] px-3 py-1 text-xs font-bold rounded-full transition shrink-0 ${
                        categoryFilter === cat
                          ? 'bg-slate-950 text-white shadow-xs'
                          : 'bg-[#F0F2F5] text-slate-600 hover:bg-slate-200/80'
                      }`}
                    >
                      {cat === 'all' ? 'Toutes catégories' : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid of Circles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {displayedCircles.map((circle) => {
                  const isJoined = joinedCircleIds.includes(circle.id);
                  return (
                    <CircleCard
                      key={circle.id}
                      circle={circle}
                      isJoined={isJoined}
                      currentUser={currentUser}
                      onToggleJoin={() => handleToggleJoinCircle(circle.id)}
                      onSelect={() => setSelectedCircleId(circle.id)}
                      isActive={false}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* 6. VUE PRINCIPALE : FIL D'ACTUALITÉ DU SAVOIR (FEED CENTRAL) */}
          {activeTab === 'feed' && selectedCircleId === 'all' && (feedSection === 'feed' || feedSection === 'bookmarks') && (
            <div className="space-y-4 animate-fadeIn">
              
              {/* A. STORIES / REELS DES CERCLES (Horizontal Carousel style Facebook) */}
              <div className="bg-white border border-slate-200/80 rounded-3xl p-3 sm:p-4 shadow-xs">
                <div className="flex items-center justify-between mb-2.5 px-1">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                    <span>Cercles de Savoir du Sahel</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFeedSection('circles')}
                    className="text-xs font-bold text-blue-700 hover:text-blue-800 transition flex items-center gap-0.5"
                  >
                    <span>Voir tout</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
                  
                  {/* Create Circle Card (Story style) */}
                  {currentUser && (
                    <button
                      type="button"
                      onClick={() => setShowCreateCircle(true)}
                      className="min-h-[140px] w-28 sm:w-32 shrink-0 bg-gradient-to-b from-blue-50 via-indigo-50 to-red-50/60 border border-blue-200/80 rounded-2xl p-2.5 flex flex-col items-center justify-between text-center hover:shadow-xs transition active:scale-95 group"
                    >
                      <div className="w-9 h-9 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xs mt-2 group-hover:scale-110 transition-transform">
                        <Plus className="w-5 h-5 stroke-[2.5]" />
                      </div>
                      <div className="mb-1">
                        <p className="text-[11px] font-bold text-slate-950 leading-tight">Créer un Cercle</p>
                        <p className="text-[9px] text-blue-700 mt-0.5">Nouveau savoir</p>
                      </div>
                    </button>
                  )}

                  {/* Circle Cards Carousel */}
                  {circles.map((circle) => {
                    const isJoined = joinedCircleIds.includes(circle.id);
                    return (
                      <div
                        key={circle.id}
                        onClick={() => setSelectedCircleId(circle.id)}
                        className="relative min-h-[140px] w-28 sm:w-32 shrink-0 rounded-2xl overflow-hidden cursor-pointer group shadow-xs border border-slate-200/60 active:scale-95 transition-all"
                      >
                        <img
                          src={circle.image}
                          alt={circle.nom}
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />
                        
                        {/* Top tag */}
                        <div className="absolute top-2 left-2 right-2 flex justify-between items-center">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-900/80 text-white backdrop-blur-xs truncate max-w-[70px]">
                            {circle.categorie}
                          </span>
                          {isJoined && (
                            <span className="w-2 h-2 rounded-full bg-red-500 ring-2 ring-slate-900" title="Rejoint" />
                          )}
                        </div>

                        {/* Bottom Info */}
                        <div className="absolute bottom-2 left-2 right-2">
                          <p className="text-xs font-bold text-white leading-tight line-clamp-2 drop-shadow-xs">
                            {circle.nom}
                          </p>
                          <p className="text-[9px] text-blue-300 font-semibold mt-0.5">
                            {isJoined ? '✓ Membre' : 'Voir le cercle'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* B. BOÎTE DE CRÉATION DE PUBLICATION (STYLE FACEBOOK COMPOSER) */}
              {currentUser ? (
                <div className="bg-white border border-slate-200/80 rounded-3xl p-4 shadow-xs">
                  
                  {/* Top trigger row */}
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center shrink-0">
                      {currentUser.avatar_url ? (
                        <img src={currentUser.avatar_url} alt={currentUser.nom} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        currentUser.nom.charAt(0).toUpperCase()
                      )}
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => setShowCreateCapsule(true)}
                      className="flex-1 text-left px-4 py-2.5 bg-[#F0F2F5] hover:bg-slate-200/70 border border-transparent rounded-full text-xs text-slate-500 font-medium transition"
                    >
                      Que souhaitez-vous transmettre aujourd'hui, {currentUser.nom.split(' ')[0]} ?
                    </button>
                  </div>

                  {/* Horizontal direct action pills (Facebook style) */}
                  {!showCreateCapsule && (
                    <div className="grid grid-cols-3 gap-1 pt-3 mt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setNewCapsuleType('texte');
                          setShowCreateCapsule(true);
                        }}
                        className="min-h-[40px] flex items-center justify-center gap-2 p-1.5 rounded-xl hover:bg-[#F0F2F5] text-slate-700 font-semibold text-xs transition"
                      >
                        <BookOpen className="w-4 h-4 text-blue-600" />
                        <span>Article / Savoir</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setNewCapsuleType('audio');
                          setShowCreateCapsule(true);
                        }}
                        className="min-h-[40px] flex items-center justify-center gap-2 p-1.5 rounded-xl hover:bg-[#F0F2F5] text-slate-700 font-semibold text-xs transition"
                      >
                        <Volume2 className="w-4 h-4 text-blue-600" />
                        <span>Note Vocale 🎙️</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setNewCapsuleType('texte');
                          setNewCapsuleContenu('❓ Question : ');
                          setShowCreateCapsule(true);
                        }}
                        className="min-h-[40px] flex items-center justify-center gap-2 p-1.5 rounded-xl hover:bg-[#F0F2F5] text-slate-700 font-semibold text-xs transition"
                      >
                        <HelpCircle className="w-4 h-4 text-amber-500" />
                        <span>Poser question</span>
                      </button>
                    </div>
                  )}

                  {/* Expanded Capsule Creator */}
                  {showCreateCapsule && (
                    <div className="space-y-4 pt-4 mt-3 border-t border-slate-100 animate-fadeIn">
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* 1. Circle Selector */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                            Cercle de Savoir
                          </label>
                          <select
                            value={newCapsuleCircleId}
                            onChange={(e) => setNewCapsuleCircleId(e.target.value)}
                            className="w-full text-xs bg-[#F0F2F5] border border-slate-200 p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 font-medium"
                          >
                            {circles.map((c) => (
                              <option key={c.id} value={c.id}>{c.nom}</option>
                            ))}
                          </select>
                        </div>

                        {/* 2. Format Selector */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                            Format
                          </label>
                          <div className="flex bg-[#F0F2F5] p-1 rounded-xl">
                            <button
                              type="button"
                              onClick={() => setNewCapsuleType('texte')}
                              className={`flex-1 text-center py-1.5 rounded-lg text-xs font-bold transition ${
                                newCapsuleType === 'texte'
                                  ? 'bg-white shadow-xs text-blue-700'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Texte
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewCapsuleType('audio')}
                              className={`flex-1 text-center py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                                newCapsuleType === 'audio'
                                  ? 'bg-white shadow-xs text-blue-700'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              <Volume2 className="w-3.5 h-3.5 text-blue-600" />
                              <span>Vocal</span>
                            </button>
                          </div>
                        </div>

                        {/* 3. Language Selector */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                            Langue
                          </label>
                          <select
                            value={newCapsuleLangue}
                            onChange={(e) => setNewCapsuleLangue(e.target.value as any)}
                            className="w-full text-xs bg-[#F0F2F5] border border-slate-200 p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 font-medium"
                          >
                            <option value="fr">Français (FR)</option>
                            <option value="ha">Hausa (HA)</option>
                            <option value="en">English (EN)</option>
                          </select>
                        </div>
                      </div>

                      {/* Content editor based on format selection */}
                      {newCapsuleType === 'texte' ? (
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                            Contenu de votre publication
                          </label>
                          <textarea
                            placeholder="Partagez un diagnostic préventif, un remède traditionnel validé, un proverbe ou une technique agricole..."
                            value={newCapsuleContenu}
                            onChange={(e) => setNewCapsuleContenu(e.target.value)}
                            rows={4}
                            className="w-full text-xs bg-[#F0F2F5] focus:bg-white border border-slate-200 p-3.5 rounded-2xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 leading-relaxed resize-none transition"
                          />
                        </div>
                      ) : (
                        <div className="py-2">
                          <AudioRecorder
                            onAudioReady={(base64) => {
                              setNewCapsuleContenu(base64);
                            }}
                            onCancel={() => {
                              setNewCapsuleType('texte');
                            }}
                          />
                          {newCapsuleContenu.startsWith('data:audio') && (
                            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-800 flex items-center justify-between">
                              <span className="font-semibold flex items-center gap-1.5">
                                <Check className="w-4 h-4 text-blue-600" />
                                Note vocale enregistrée avec succès
                              </span>
                              <span className="font-mono text-[10px] text-blue-700">Capsule prête</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            setShowCreateCapsule(false);
                            setNewCapsuleContenu('');
                          }}
                          className="min-h-[38px] px-4 py-2 border border-slate-200 text-slate-600 text-xs rounded-xl hover:bg-slate-50 font-semibold transition"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateCapsuleSubmit}
                          disabled={!newCapsuleContenu}
                          className="min-h-[38px] px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition shadow-xs disabled:opacity-50"
                        >
                          Publier la capsule
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-slate-900 text-white rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
                  <div>
                    <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">
                      Communauté Zaure
                    </span>
                    <h3 className="text-sm sm:text-base font-extrabold text-white mt-0.5">
                      Transmettez votre expérience et vos savoirs
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 max-w-md leading-relaxed">
                      Partagez des capsules vocales ou textuelles avec des milliers d'apprenants et praticiens du Sahel.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(true);
                      setShowAuthModal(true);
                    }}
                    className="min-h-[40px] px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition shadow-xs shrink-0"
                  >
                    Créer un compte
                  </button>
                </div>
              )}

              {/* C. BARRE DE FILTRES DU FLUX (FACEBOOK-STYLE SEGMENTED TABS) */}
              <div className="bg-white border border-slate-200/80 p-2 sm:p-3 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none">
                  
                  {/* Tab : Tous les savoirs */}
                  <button
                    type="button"
                    onClick={() => {
                      setFeedFilter('all');
                      setFeedSection('feed');
                    }}
                    className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                      feedFilter === 'all' && feedSection === 'feed'
                        ? 'bg-slate-950 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>Tous les savoirs</span>
                  </button>

                  {/* Tab : Mes Cercles */}
                  {currentUser && (
                    <button
                      type="button"
                      onClick={() => {
                        setFeedFilter('joined');
                        setFeedSection('feed');
                      }}
                      className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                        feedFilter === 'joined' && feedSection === 'feed'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Mes Cercles</span>
                      <span className="font-mono text-[10px] opacity-80">({joinedCircleIds.length})</span>
                    </button>
                  )}

                  {/* Tab : Audios uniquement */}
                  <button
                    type="button"
                    onClick={() => {
                      setFeedFilter('audio');
                      setFeedSection('feed');
                    }}
                    className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                      feedFilter === 'audio' && feedSection === 'feed'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Audios</span>
                  </button>

                  {/* Tab : Questions */}
                  <button
                    type="button"
                    onClick={() => {
                      setFeedFilter('questions');
                      setFeedSection('feed');
                    }}
                    className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                      feedFilter === 'questions' && feedSection === 'feed'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Questions</span>
                  </button>
                </div>

                {/* Total count badge */}
                <div className="text-[11px] font-medium text-slate-400 px-2 shrink-0">
                  <span className="font-bold text-slate-700">{displayedCapsules.length}</span> publications
                </div>
              </div>

              {/* D. BANDEAU DE RECHERCHE ACTIVE (SI RECHERCHE EN COURS) */}
              {searchQuery && (
                <div className="bg-blue-50 border border-blue-200/80 rounded-2xl p-3 flex items-center justify-between text-xs text-blue-900 animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-blue-700" />
                    <span>
                      Résultats pour <strong>« {searchQuery} »</strong> ({displayedCapsules.length} trouvés)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="font-bold text-blue-800 hover:underline flex items-center gap-1"
                  >
                    <span>Effacer</span>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* E. LISTE DES PUBLICATIONS (CAPSULE CARDS FEED) */}
              <div className="space-y-4" id="capsules-stream-list">
                {displayedCapsules.length === 0 ? (
                  <div className="bg-white border border-slate-200/80 rounded-3xl p-8 sm:p-12 text-center shadow-xs">
                    <BookOpen className="w-12 h-12 text-slate-300 mx-auto stroke-1 mb-3" />
                    <h4 className="font-bold text-slate-900 text-base">Aucune publication dans ce flux</h4>
                    
                    {feedFilter === 'joined' ? (
                      <div className="max-w-md mx-auto mt-2">
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Vous n'avez pas encore de publications de vos cercles. Rejoignez des cercles de savoir pour composer votre fil !
                        </p>
                        <div className="mt-4 flex justify-center">
                          <button
                            type="button"
                            onClick={() => setFeedSection('circles')}
                            className="min-h-[38px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition shadow-xs"
                          >
                            Explorer les cercles de savoir
                          </button>
                        </div>
                      </div>
                    ) : feedSection === 'bookmarks' ? (
                      <div className="max-w-md mx-auto mt-2">
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Vous n'avez encore enregistré aucune capsule. Cliquez sur l'icône de signet d'une publication pour la retrouver ici !
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 mt-2">Soyez le premier à partager une capsule dans ce domaine !</p>
                    )}
                  </div>
                ) : (
                  displayedCapsules.map((capsule) => (
                    <CapsuleCard
                      key={capsule.id}
                      capsule={capsule}
                      currentUser={currentUser}
                      isBookmarked={bookmarkedIds.includes(capsule.id)}
                      onToggleBookmark={() => toggleBookmark(capsule.id)}
                    />
                  ))
                )}
              </div>

            </div>
          )}
        </main>

        {/* ======================================================== */}
        {/* COLONNE DROITE CONTEXTUELLE (DESKTOP XL >= 1280px) */}
        {/* ======================================================== */}
        {activeTab !== 'chat' && (
          <aside className="hidden xl:block w-72 2xl:w-80 shrink-0 space-y-4 sticky top-20 self-start max-h-[calc(100vh-5.5rem)] overflow-y-auto scrollbar-thin">
          
          {/* 1. Cercles recommandés (Suggested Circles) */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-xs">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                <span>Cercles Recommandés</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('feed');
                  setFeedSection('circles');
                }}
                className="text-xs font-bold text-blue-700 hover:underline"
              >
                Tout voir
              </button>
            </div>

            <div className="space-y-3">
              {suggestedCircles.length === 0 ? (
                <p className="text-xs text-slate-400 p-2 text-center">Tous les cercles rejoints !</p>
              ) : (
                suggestedCircles.map((circle) => (
                  <div key={circle.id} className="flex items-start gap-2.5 p-1">
                    <img
                      src={circle.image}
                      alt={circle.nom}
                      className="w-10 h-10 rounded-xl object-cover ring-1 ring-slate-200 shrink-0 cursor-pointer"
                      onClick={() => {
                        setActiveTab('feed');
                        setSelectedCircleId(circle.id);
                      }}
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0 flex-1">
                      <p 
                        className="text-xs font-bold text-slate-900 truncate hover:text-blue-700 cursor-pointer"
                        onClick={() => {
                          setActiveTab('feed');
                          setSelectedCircleId(circle.id);
                        }}
                      >
                        {circle.nom}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {circle.categorie}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleToggleJoinCircle(circle.id)}
                        className="mt-1.5 min-h-[28px] px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 text-[11px] font-bold rounded-lg transition flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3 text-blue-700" />
                        <span>Rejoindre</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2. Mentors en ligne & contacts disponibles */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-xs">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-amber-500" />
                <span>Mentors & Experts</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('feed');
                  setFeedSection('mentors');
                }}
                className="text-xs font-bold text-amber-700 hover:underline"
              >
                Annuaire
              </button>
            </div>

            <div className="space-y-2.5">
              {mentorsList.slice(0, 4).map((mentor) => (
                <div key={mentor.id} className="flex items-center justify-between gap-2 p-1 group">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0">
                      {mentor.avatar_url ? (
                        <img src={mentor.avatar_url} alt={mentor.nom} className="w-8 h-8 rounded-full object-cover ring-1 ring-amber-400" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center">
                          {mentor.nom.charAt(0)}
                        </div>
                      )}
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-blue-600 border-2 border-white rounded-full" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate flex items-center gap-1">
                        <span>{mentor.nom}</span>
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {mentor.role === 'verifie' ? 'Santé' : 'Mentor'} · {mentor.langue_preferee.toUpperCase()}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenChatWithUser(mentor)}
                    className="p-1.5 text-blue-700 hover:bg-blue-50 rounded-lg transition shrink-0"
                    title={`Discuter avec ${mentor.nom}`}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Charte d'engagement & Règles d'or de la communauté */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-xs">
            <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2 px-1">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Charte du Savoir</span>
            </h3>

            <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
              <div className="flex items-start gap-2">
                <span className="font-bold text-blue-600 shrink-0">1.</span>
                <p>Savoirs vérifiés et basés sur des pratiques réelles.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-blue-600 shrink-0">2.</span>
                <p>Respect mutuel et bienveillance inter-communautaire.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-blue-600 shrink-0">3.</span>
                <p>Priorité à l'audio pour une accessibilité maximale.</p>
              </div>
            </div>
          </div>

          {/* 4. Statistiques de la plateforme */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl p-4 shadow-xs">
            <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Impact Communautaire</p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <p className="font-mono text-xl font-black text-white">{capsules.length}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Savoirs partagés</p>
              </div>
              <div>
                <p className="font-mono text-xl font-black text-white">{circles.length}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Cercles actifs</p>
              </div>
            </div>
          </div>

          </aside>
        )}

      </div>

      {/* ============================================================ */}
      {/* 3. FIXED MOBILE BOTTOM NAVIGATION BAR (< 768px) */}
      {/* ============================================================ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-lg z-50 px-2 py-1 flex justify-around items-center pb-safe" id="mobile-bottom-navigation">
        
        {/* Fil */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('feed');
            setFeedSection('feed');
            setSelectedCircleId('all');
          }}
          className={`min-h-[48px] flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition active:scale-95 ${
            activeTab === 'feed' && feedSection === 'feed' && selectedCircleId === 'all'
              ? 'text-blue-700 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className={`w-5 h-5 ${activeTab === 'feed' && feedSection === 'feed' && selectedCircleId === 'all' ? 'stroke-[2.5px] text-blue-600' : 'stroke-2'}`} />
          <span className="text-[11px] font-semibold tracking-tight mt-0.5">Fil</span>
        </button>

        {/* Cercles */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('feed');
            setFeedSection('circles');
            setSelectedCircleId('all');
          }}
          className={`min-h-[48px] flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition active:scale-95 ${
            activeTab === 'feed' && (feedSection === 'circles' || selectedCircleId !== 'all')
              ? 'text-blue-700 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className={`w-5 h-5 ${activeTab === 'feed' && (feedSection === 'circles' || selectedCircleId !== 'all') ? 'stroke-[2.5px] text-blue-600' : 'stroke-2'}`} />
          <span className="text-[11px] font-semibold tracking-tight mt-0.5">Cercles</span>
        </button>

        {/* Messages */}
        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`min-h-[48px] flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition active:scale-95 ${
            activeTab === 'chat'
              ? 'text-blue-700 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <MessageSquare className={`w-5 h-5 ${activeTab === 'chat' ? 'stroke-[2.5px] text-blue-600' : 'stroke-2'}`} />
          <span className="text-[11px] font-semibold tracking-tight mt-0.5">Messages</span>
        </button>

        {/* Paramètres */}
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`min-h-[48px] flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition active:scale-95 ${
            activeTab === 'settings'
              ? 'text-blue-700 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Settings className={`w-5 h-5 ${activeTab === 'settings' ? 'stroke-[2.5px] text-blue-600' : 'stroke-2'}`} />
          <span className="text-[11px] font-semibold tracking-tight mt-0.5">Profil</span>
        </button>
      </nav>

      {/* ============================================================ */}
      {/* 4. MODAL : CRÉER UN CERCLE DE SAVOIR */}
      {/* ============================================================ */}
      {showCreateCircle && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-950 text-base">Créer un Cercle de Savoir</h3>
              <button
                type="button"
                onClick={() => setShowCreateCircle(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 my-3 leading-relaxed">
              Fédérez des praticiens, apprenants et enseignants autour d'une thématique au Sahel.
            </p>

            <form onSubmit={handleCreateCircleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Nom du cercle</label>
                <input
                  type="text"
                  placeholder="Ex : Pédiatrie & Nourrissons, Proverbes Haoussa..."
                  required
                  value={newCircleNom}
                  onChange={(e) => setNewCircleNom(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 bg-[#F0F2F5] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Description d'apprentissage</label>
                <textarea
                  placeholder="Expliquez clairement ce que les membres apprendront et partageront dans ce cercle."
                  required
                  value={newCircleDesc}
                  onChange={(e) => setNewCircleDesc(e.target.value)}
                  rows={3}
                  className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 bg-[#F0F2F5] focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Catégorie</label>
                  <select
                    value={newCircleCat}
                    onChange={(e) => setNewCircleCat(e.target.value)}
                    className="w-full text-xs bg-[#F0F2F5] border border-slate-200 p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
                  >
                    <option value="Médecine">Médecine / Santé</option>
                    <option value="Langues">Langues / Culture</option>
                    <option value="Sciences">Sciences / Agriculture</option>
                    <option value="Culture">Éducation générale</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Image de couverture</label>
                  <input
                    type="text"
                    placeholder="URL (optionnelle)"
                    value={newCircleImg}
                    onChange={(e) => setNewCircleImg(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 bg-[#F0F2F5] focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <p className="text-[10px] text-slate-400 font-bold mb-1.5">Ou choisissez un thème prédéfini :</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {presetImages.map((img) => (
                    <button
                      key={img.name}
                      type="button"
                      onClick={() => setNewCircleImg(img.url)}
                      className={`text-[9px] font-semibold p-1.5 border rounded-xl truncate transition ${
                        newCircleImg === img.url 
                          ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold' 
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      {img.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateCircle(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 text-xs rounded-xl hover:bg-slate-50 font-semibold transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition shadow-xs"
                >
                  Créer le cercle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 5. MODAL : AUTHENTIFICATION AVEC INSCRIPTION EN 3 ÉTAPES     */}
      {/* ============================================================ */}
      {showAuthModal && (
        <div 
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn overflow-y-auto" 
          id="auth-modal-screen"
        >
          <div className={`bg-white rounded-3xl ${isSignUp ? 'max-w-xl' : 'max-w-md'} w-full p-5 sm:p-7 shadow-2xl border border-slate-100 my-auto transition-all`}>
            {/* Modal Top Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-sm shadow-xs">
                  Z
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-slate-900 text-sm tracking-tight">Zaure</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md">Plateforme du Savoir</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {isSignUp ? "Création de compte guidée" : "Espace de connexion membre"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAuthModal(false);
                  resetAuthForm();
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex p-1 bg-slate-100 rounded-2xl my-3 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setAuthError(null);
                }}
                className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
                  !isSignUp 
                    ? 'bg-white text-blue-700 shadow-xs font-extrabold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Se connecter</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setAuthError(null);
                }}
                className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
                  isSignUp 
                    ? 'bg-blue-600 text-white shadow-xs font-extrabold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Créer un compte (3 étapes)</span>
              </button>
            </div>

            {/* Inscription Stepper Bar */}
            {isSignUp && (
              <div className="mb-4 pt-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-2 px-1">
                  <button
                    type="button"
                    onClick={() => setSignupStep(1)}
                    className={`flex items-center gap-1.5 transition ${
                      signupStep === 1 
                        ? 'text-blue-700 font-extrabold' 
                        : signupStep > 1 
                          ? 'text-emerald-700' 
                          : 'text-slate-400'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                      signupStep === 1 
                        ? 'bg-blue-600 text-white shadow-xs' 
                        : signupStep > 1 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-slate-200 text-slate-600'
                    }`}>
                      {signupStep > 1 ? <Check className="w-3 h-3" /> : '1'}
                    </span>
                    <span>1. Identité</span>
                  </button>

                  <div className={`flex-1 h-0.5 mx-2 ${signupStep > 1 ? 'bg-blue-600' : 'bg-slate-200'} transition-colors`}></div>

                  <button
                    type="button"
                    onClick={() => {
                      if (authNom && authEmail && authPassword) setSignupStep(2);
                    }}
                    className={`flex items-center gap-1.5 transition ${
                      signupStep === 2 
                        ? 'text-blue-700 font-extrabold' 
                        : signupStep > 2 
                          ? 'text-emerald-700' 
                          : 'text-slate-400'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                      signupStep === 2 
                        ? 'bg-blue-600 text-white shadow-xs' 
                        : signupStep > 2 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-slate-200 text-slate-600'
                    }`}>
                      {signupStep > 2 ? <Check className="w-3 h-3" /> : '2'}
                    </span>
                    <span>2. Vocation</span>
                  </button>

                  <div className={`flex-1 h-0.5 mx-2 ${signupStep > 2 ? 'bg-blue-600' : 'bg-slate-200'} transition-colors`}></div>

                  <button
                    type="button"
                    onClick={() => {
                      if (authNom && authEmail && authPassword) setSignupStep(3);
                    }}
                    className={`flex items-center gap-1.5 transition ${
                      signupStep === 3 
                        ? 'text-blue-700 font-extrabold' 
                        : 'text-slate-400'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                      signupStep === 3 
                        ? 'bg-blue-600 text-white shadow-xs' 
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      3
                    </span>
                    <span>3. Cercles & Avatar</span>
                  </button>
                </div>

                {/* Progress track */}
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-600 via-blue-700 to-red-600 transition-all duration-300 rounded-full"
                    style={{ width: signupStep === 1 ? '33.3%' : signupStep === 2 ? '66.6%' : '100%' }}
                  />
                </div>
              </div>
            )}

            {/* Error Message */}
            {authError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-2xl flex items-start gap-2 animate-fadeIn">
                <span className="font-bold text-red-600">!</span>
                <span className="flex-1 font-medium">{authError}</span>
              </div>
            )}

            {/* ========================================= */}
            {/* FORMULAIRE PRINCIPAL                      */}
            {/* ========================================= */}
            <form onSubmit={handleAuthSubmit} className="space-y-3.5">
              
              {/* --- CAS 1 : CONNEXION DIRECTE --- */}
              {!isSignUp && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Adresse email
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        placeholder="Ex: mahamadou@zaure.org"
                        required
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 bg-[#F0F2F5] focus:bg-white transition"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-slate-600">
                        Mot de passe
                      </label>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Votre mot de passe"
                        required
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        className="w-full text-xs pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 bg-[#F0F2F5] focus:bg-white transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {authLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        Connexion en cours...
                      </span>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4" />
                        <span>Se connecter</span>
                      </>
                    )}
                  </button>

                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-slate-200"></div>
                    <span className="flex-shrink mx-3 text-[10px] text-slate-400 uppercase font-bold tracking-wider">OU</span>
                    <div className="flex-grow border-t border-slate-200"></div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    className="w-full py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-200 rounded-xl transition shadow-xs flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#EA4335" d="M12 5.04c1.5 0 2.85.51 3.9 1.5l2.9-2.9C17.05 1.9 14.7 1 12 1 7.35 1 3.4 3.65 1.5 7.5l3.5 2.7C5.85 6.95 8.7 5.04 12 5.04z" />
                      <path fill="#4285F4" d="M23.49 12.27c0-.82-.07-1.61-.21-2.38H12v4.51h6.44c-.28 1.46-1.1 2.69-2.34 3.52l3.63 2.82c2.13-1.97 3.36-4.87 3.36-8.47z" />
                      <path fill="#FBBC05" d="M5 14.8c-.25-.75-.39-1.55-.39-2.38s.14-1.63.39-2.38L1.5 7.34C.55 9.24 0 11.36 0 13.6s.55 4.36 1.5 6.26l3.5-2.06z" />
                      <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.63-2.82c-1.01.68-2.3 1.09-3.9 1.09-3.3 0-6.15-1.91-7.15-4.78l-3.5 2.7C3.4 20.35 7.35 23 12 23z" />
                    </svg>
                    <span>Continuer avec Google</span>
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUp(true);
                        setSignupStep(1);
                        setAuthError(null);
                      }}
                      className="text-xs text-blue-700 hover:text-blue-800 font-bold hover:underline"
                    >
                      Pas encore de compte ? S'inscrire en 3 étapes
                    </button>
                  </div>
                </>
              )}

              {/* --- CAS 2 : INSCRIPTION ÉTAPE 1 : IDENTIFIANTS --- */}
              {isSignUp && signupStep === 1 && (
                <div className="space-y-3 animate-fadeIn">
                  <div className="bg-blue-50/60 border border-blue-100 p-3 rounded-2xl">
                    <p className="text-xs font-bold text-blue-900">Étape 1 sur 3 : Identité & Sécurité</p>
                    <p className="text-[11px] text-blue-700 mt-0.5">Renseignez votre nom et définissez vos identifiants d'accès.</p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Nom complet <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        placeholder="Ex: Mahamadou Garba"
                        required
                        value={authNom}
                        onChange={(e) => setAuthNom(e.target.value)}
                        className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 bg-[#F0F2F5] focus:bg-white transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Adresse email <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        placeholder="Ex: mahamadou@zaure.org"
                        required
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 bg-[#F0F2F5] focus:bg-white transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Mot de passe <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Min. 6 caractères"
                          required
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          className="w-full text-xs pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 bg-[#F0F2F5] focus:bg-white transition"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Confirmer mot de passe
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Répétez le mot de passe"
                          value={authPasswordConfirm}
                          onChange={(e) => setAuthPasswordConfirm(e.target.value)}
                          className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 bg-[#F0F2F5] focus:bg-white transition"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => handleNextStep()}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-2"
                    >
                      <span>Continuer vers l'Étape 2 (Profil & Rôle)</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-slate-200"></div>
                    <span className="flex-shrink mx-3 text-[10px] text-slate-400 uppercase font-bold tracking-wider">OU</span>
                    <div className="flex-grow border-t border-slate-200"></div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    className="w-full py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-200 rounded-xl transition shadow-xs flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#EA4335" d="M12 5.04c1.5 0 2.85.51 3.9 1.5l2.9-2.9C17.05 1.9 14.7 1 12 1 7.35 1 3.4 3.65 1.5 7.5l3.5 2.7C5.85 6.95 8.7 5.04 12 5.04z" />
                      <path fill="#4285F4" d="M23.49 12.27c0-.82-.07-1.61-.21-2.38H12v4.51h6.44c-.28 1.46-1.1 2.69-2.34 3.52l3.63 2.82c2.13-1.97 3.36-4.87 3.36-8.47z" />
                      <path fill="#FBBC05" d="M5 14.8c-.25-.75-.39-1.55-.39-2.38s.14-1.63.39-2.38L1.5 7.34C.55 9.24 0 11.36 0 13.6s.55 4.36 1.5 6.26l3.5-2.06z" />
                      <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.63-2.82c-1.01.68-2.3 1.09-3.9 1.09-3.3 0-6.15-1.91-7.15-4.78l-3.5 2.7C3.4 20.35 7.35 23 12 23z" />
                    </svg>
                    <span>Inscription rapide avec Google</span>
                  </button>
                </div>
              )}

              {/* --- CAS 2 : INSCRIPTION ÉTAPE 2 : VOCATION & PROFIL --- */}
              {isSignUp && signupStep === 2 && (
                <div className="space-y-3.5 animate-fadeIn">
                  <div className="bg-blue-50/60 border border-blue-100 p-3 rounded-2xl">
                    <p className="text-xs font-bold text-blue-900">Étape 2 sur 3 : Vocation & Profil Académique</p>
                    <p className="text-[11px] text-blue-700 mt-0.5">Choisissez votre statut sur la plateforme pour adapter vos cercles et vos échanges.</p>
                  </div>

                  {/* Specialty Selection Cards */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                      Quel est votre profil principal ?
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {/* Option 1: Étudiant Médecine / Santé */}
                      <button
                        type="button"
                        onClick={() => handleSpecialtySelect('medecine')}
                        className={`p-3 rounded-2xl border text-left transition flex items-start gap-2.5 ${
                          authSpecialty === 'medecine'
                            ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/30'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className={`p-2 rounded-xl ${authSpecialty === 'medecine' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          <Stethoscope className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900">Étudiant Santé</span>
                            <span className="text-[9px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full">Praticien</span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                            Médecine, pharmacie, biologie clinique & fiches d'étude.
                          </p>
                        </div>
                      </button>

                      {/* Option 2: Enseignant / Mentor */}
                      <button
                        type="button"
                        onClick={() => handleSpecialtySelect('mentor')}
                        className={`p-3 rounded-2xl border text-left transition flex items-start gap-2.5 ${
                          authSpecialty === 'mentor'
                            ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/30'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className={`p-2 rounded-xl ${authSpecialty === 'mentor' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          <GraduationCap className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900">Enseignant / Mentor</span>
                            <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full">Mentor</span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                            Transmission pédagogique, cours magistraux & méthodes.
                          </p>
                        </div>
                      </button>

                      {/* Option 3: Curieux & Apprenant */}
                      <button
                        type="button"
                        onClick={() => handleSpecialtySelect('etudiant')}
                        className={`p-3 rounded-2xl border text-left transition flex items-start gap-2.5 ${
                          authSpecialty === 'etudiant'
                            ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/30'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className={`p-2 rounded-xl ${authSpecialty === 'etudiant' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          <Lightbulb className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900">Curieux & Apprenant</span>
                            <span className="text-[9px] font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full">Membre</span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                            Apprentissage général, questions & entraide partagée.
                          </p>
                        </div>
                      </button>

                      {/* Option 4: Chercheur / Praticien */}
                      <button
                        type="button"
                        onClick={() => handleSpecialtySelect('chercheur')}
                        className={`p-3 rounded-2xl border text-left transition flex items-start gap-2.5 ${
                          authSpecialty === 'chercheur'
                            ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/30'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className={`p-2 rounded-xl ${authSpecialty === 'chercheur' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          <Microscope className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900">Chercheur / Spécialiste</span>
                            <span className="text-[9px] font-bold bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded-full">Expert</span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                            Veille scientifique, revues cliniques et protocoles.
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Bio Field with preset suggestions */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-slate-700">
                        Votre biographie ou domaine d'étude
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthBio("Étudiant en médecine passionné par la clinique, la cardiologie et l'accès universel au savoir.");
                        }}
                        className="text-[10px] font-bold text-blue-700 hover:underline"
                      >
                        + Exemple médical
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      placeholder="Ex: Étudiant en médecine, passionné par la sémiologie et les cas pratiques..."
                      value={authBio}
                      onChange={(e) => setAuthBio(e.target.value)}
                      className="w-full text-xs px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 bg-[#F0F2F5] focus:bg-white transition"
                    />
                  </div>

                  {/* Language selection */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Langue préférée pour les savoirs
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setAuthLangue('fr')}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                          authLangue === 'fr'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-[#F0F2F5] text-slate-700 border-slate-200 hover:bg-slate-200/70'
                        }`}
                      >
                        <span>🇫🇷 Français</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuthLangue('ha')}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                          authLangue === 'ha'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-[#F0F2F5] text-slate-700 border-slate-200 hover:bg-slate-200/70'
                        }`}
                      >
                        <span>🌍 Hausa</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuthLangue('en')}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                          authLangue === 'en'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-[#F0F2F5] text-slate-700 border-slate-200 hover:bg-slate-200/70'
                        }`}
                      >
                        <span>🇬🇧 English</span>
                      </button>
                    </div>
                  </div>

                  {/* Navigation Buttons */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="px-4 py-2.5 border border-slate-200 text-slate-600 text-xs rounded-xl hover:bg-slate-50 font-bold transition"
                    >
                      ← Précédent
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNextStep()}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-2"
                    >
                      <span>Continuer vers l'Étape 3 (Cercles)</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* --- CAS 2 : INSCRIPTION ÉTAPE 3 : CERCLES & AVATAR --- */}
              {isSignUp && signupStep === 3 && (
                <div className="space-y-3.5 animate-fadeIn">
                  <div className="bg-blue-50/60 border border-blue-100 p-3 rounded-2xl">
                    <p className="text-xs font-bold text-blue-900">Étape 3 sur 3 : Avatar & Vos Premiers Cercles</p>
                    <p className="text-[11px] text-blue-700 mt-0.5">Personnalisez votre photo de profil et rejoignez les communautés qui vous intéressent.</p>
                  </div>

                  {/* Avatar Picker */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                      Choisissez votre avatar de profil
                    </label>
                    <div className="grid grid-cols-6 gap-2">
                      {AVATAR_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setAuthAvatarUrl(preset.url)}
                          className={`relative rounded-2xl overflow-hidden aspect-square border-2 transition-all group ${
                            authAvatarUrl === preset.url
                              ? 'border-blue-600 ring-2 ring-blue-500/40 scale-105 shadow-sm'
                              : 'border-transparent opacity-70 hover:opacity-100 hover:border-slate-300'
                          }`}
                        >
                          <img
                            src={preset.url}
                            alt={preset.label}
                            className="w-full h-full object-cover"
                          />
                          {authAvatarUrl === preset.url && (
                            <div className="absolute inset-0 bg-blue-600/30 flex items-center justify-center">
                              <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
                                <Check className="w-2.5 h-2.5" />
                              </div>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Recommended Circles */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                      Rejoindre automatiquement des cercles clés :
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                      {circles.map((c) => {
                        const isSelected = authSelectedCircleIds.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggleAuthCircleSelect(c.id)}
                            className={`p-2 rounded-xl border text-left transition flex items-center gap-2.5 ${
                              isSelected
                                ? 'border-blue-600 bg-blue-50 text-blue-950 font-bold shadow-xs'
                                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <img
                              src={c.image}
                              alt={c.nom}
                              className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold truncate">{c.nom}</p>
                              <span className="text-[10px] text-slate-500 truncate block">{c.categorie}</span>
                            </div>
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 text-xs transition ${
                              isSelected 
                                ? 'bg-blue-600 text-white' 
                                : 'border border-slate-300 text-transparent'
                            }`}>
                              ✓
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Summary Box */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex items-center gap-3">
                    <img
                      src={authAvatarUrl}
                      alt="Avatar"
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-xs flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-extrabold text-slate-900 truncate">{authNom || 'Nouvel Utilisateur'}</p>
                      <p className="text-[11px] text-slate-500 truncate">{authEmail} • {authLangue.toUpperCase()}</p>
                      <p className="text-[10px] font-bold text-blue-700 mt-0.5">
                        {authSelectedCircleIds.length} cercle(s) sélectionné(s)
                      </p>
                    </div>
                  </div>

                  {/* Final Navigation Buttons */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="px-4 py-2.5 border border-slate-200 text-slate-600 text-xs rounded-xl hover:bg-slate-50 font-bold transition"
                    >
                      ← Précédent
                    </button>
                    <button
                      type="submit"
                      disabled={authLoading}
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-2 disabled:opacity-50"
                    >
                      {authLoading ? (
                        <span className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                          Création en cours...
                        </span>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-amber-300" />
                          <span>Finaliser et créer mon compte</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Bottom footer link */}
              <div className="text-center pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setSignupStep(1);
                    setAuthError(null);
                  }}
                  className="text-xs text-blue-700 hover:text-blue-800 font-bold hover:underline"
                >
                  {isSignUp 
                    ? "Vous avez déjà un compte ? Se connecter directement" 
                    : "Pas encore membre ? Rejoindre Zaure en 3 étapes"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
