import React, { useState, useEffect } from 'react';
import { 
  Database, 
  HelpCircle, 
  Plus, 
  Sparkles, 
  BookOpen, 
  MessageSquare, 
  LogOut, 
  Globe, 
  User, 
  PlusCircle, 
  Layers, 
  Info, 
  Check, 
  ArrowRight,
  ChevronDown,
  Volume2,
  Settings
} from 'lucide-react';
import { zaureService } from './firebaseClient';
import { Circle, Capsule, UserProfile } from './types';
import CircleCard from './components/CircleCard';
import CapsuleCard from './components/CapsuleCard';
import AudioRecorder from './components/AudioRecorder';
import ChatView from './components/ChatView';
import SettingsView from './components/SettingsView';

export default function App() {
  const [activeTab, setActiveTab] = useState<'feed' | 'chat' | 'settings'>('feed');
  const [mode, setMode] = useState<'cloud' | 'local'>('local');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [joinedCircleIds, setJoinedCircleIds] = useState<string[]>([]);
  const [selectedCircleId, setSelectedCircleId] = useState<string>('all');
  const [feedFilter, setFeedFilter] = useState<'joined' | 'all'>('joined');
  const [dbErrorState, setDbErrorState] = useState(false);

  // Load state and dropdown toggles
  const [showCreateCircle, setShowCreateCircle] = useState(false);
  const [showCreateCapsule, setShowCreateCapsule] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Form states
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authNom, setAuthNom] = useState('');
  const [authBio, setAuthBio] = useState('');
  const [authRole, setAuthRole] = useState<'utilisateur' | 'mentor' | 'verifie'>('utilisateur');
  const [authLangue, setAuthLangue] = useState<'fr' | 'ha' | 'en'>('fr');
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

  useEffect(() => {
    setMode(zaureService.getMode());
    setCurrentUser(zaureService.getCurrentUser());
    loadInitialData();
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

      const user = zaureService.getCurrentUser();
      if (user) {
        const joined = await zaureService.getJoinedCircleIds(user.id);
        setJoinedCircleIds(joined);
      }
      setDbErrorState(zaureService.hasDbError());
    } catch (e) {
      console.error(e);
      setDbErrorState(true);
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

      // If they filter by joined circles but haven't joined any, getCapsules will return empty
      const list = await zaureService.getCapsules(filteredIds);
      setCapsules(list);
      setDbErrorState(zaureService.hasDbError());
    } catch (e) {
      console.error(e);
      setDbErrorState(true);
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

  // Auth Submit
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (isSignUp) {
      if (!authNom || !authEmail) {
        setAuthError('Veuillez remplir le nom et l\'adresse email.');
        return;
      }
      if (mode === 'cloud' && authPassword && authPassword.length < 6) {
        setAuthError('Le mot de passe doit contenir au moins 6 caractères.');
        return;
      }
      const { user, error } = await zaureService.signUp(
        authNom, 
        authEmail, 
        authBio, 
        authRole, 
        authLangue, 
        mode === 'cloud' ? authPassword : undefined
      );
      if (error) {
        setAuthError(error);
      } else {
        setCurrentUser(user);
        setShowAuthModal(false);
        setAuthPassword('');
        if (user) {
          const joined = await zaureService.getJoinedCircleIds(user.id);
          setJoinedCircleIds(joined);
        }
      }
    } else {
      if (!authEmail) {
        setAuthError('Veuillez saisir votre adresse email.');
        return;
      }
      const { user, error } = await zaureService.signIn(
        authEmail, 
        mode === 'cloud' ? authPassword : undefined
      );
      if (error) {
        setAuthError(error);
      } else {
        setCurrentUser(user);
        setShowAuthModal(false);
        setAuthPassword('');
        if (user) {
          const joined = await zaureService.getJoinedCircleIds(user.id);
          setJoinedCircleIds(joined);
        }
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

    // Use a relevant placeholder image based on category
    const imgMap: { [key: string]: string } = {
      'Médecine': 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&q=80&w=600',
      'Langues': 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&q=80&w=600',
      'Sciences': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=600',
      'Culture': 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&q=80&w=600'
    };

    const imageUrl = newCircleImg || imgMap[newCircleCat] || imgMap['Sciences'];

    try {
      const added = await zaureService.createCircle(newCircleNom, newCircleDesc, newCircleCat, imageUrl);
      setCircles((prev) => [...prev, added]);
      setJoinedCircleIds((prev) => [...prev, added.id]); // Automatically join created circle
      setNewCircleNom('');
      setNewCircleDesc('');
      setNewCircleImg('');
      setShowCreateCircle(false);
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

  // Quick preset suggestions
  const presetImages = [
    { name: 'Médecine', url: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=300' },
    { name: 'Langues', url: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=300' },
    { name: 'Agriculture', url: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=300' },
    { name: 'Entrepreneuriat', url: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&q=80&w=300' }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans" id="main-app-container">
      {/* 1. Header Banner */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-sm" id="header-navbar">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 text-slate-950 p-2 rounded-xl font-black text-xl tracking-wider shadow-inner flex items-center justify-center w-10 h-10">
              Z
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-1.5">
                <span>Zaure</span>
                <span className="text-emerald-400 text-xs font-semibold px-2 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">West Africa</span>
              </h1>
              <p className="text-[10px] text-slate-400">Le réseau social des cercles de savoir et d'entraide communautaire</p>
            </div>
          </div>

          {/* User profile controls & switchers */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {currentUser ? (
              <div className="flex items-center gap-2.5">
                {/* Identity information */}
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className="flex items-center gap-2.5 text-left hover:opacity-85 transition"
                  title="Accéder aux réglages"
                >
                  <div className="text-right">
                    <p className="text-xs font-bold text-white flex items-center gap-1 justify-end">
                      <span>{currentUser.nom}</span>
                      {currentUser.role === 'verifie' && <span className="w-2 h-2 rounded-full bg-emerald-400" title="Vérifié" />}
                      {currentUser.role === 'mentor' && <span className="w-2 h-2 rounded-full bg-amber-400" title="Mentor" />}
                    </p>
                    <p className="text-[9px] text-slate-400 capitalize">
                      {currentUser.role === 'verifie' ? 'Professionnel Vérifié' : currentUser.role === 'mentor' ? 'Mentor' : 'Apprenant'} • {currentUser.langue_preferee.toUpperCase()}
                    </p>
                  </div>

                  {currentUser.avatar_url ? (
                    <img src={currentUser.avatar_url} alt={currentUser.nom} className="w-9 h-9 rounded-full object-cover ring-2 ring-emerald-500" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-9 h-9 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700">
                      <User className="w-4.5 h-4.5 text-slate-400" />
                    </div>
                  )}
                </button>

                <button
                  onClick={handleSignOut}
                  title="Déconnexion"
                  className="p-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-950 text-slate-300 hover:text-white rounded-xl transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setIsSignUp(false);
                  setShowAuthModal(true);
                }}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-sm"
              >
                S'identifier ou S'inscrire
              </button>
            )}

            {/* Session authentication is now fully direct and real */}
          </div>
        </div>
      </header>

      {/* 3. Main Container App Tabs Navigation */}
      <nav className="bg-white border-b border-slate-100 shadow-xs" id="main-navigation-tabs">
        <div className="max-w-7xl mx-auto px-4 flex gap-1 pt-2">
          <button
            onClick={() => {
              setActiveTab('feed');
            }}
            className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'feed'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Cercles & Capsules</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('chat');
            }}
            className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'chat'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Messagerie Directe</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('settings');
            }}
            className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'settings'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-200'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Paramètres</span>
          </button>
        </div>
      </nav>

      {/* 4. Core Body Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4" id="primary-app-layout">

        {/* SETTINGS / PARAMÈTRES SCREEN */}
        {activeTab === 'settings' && (
          <div className="py-4 animate-fadeIn">
            {currentUser ? (
              <SettingsView
                currentUser={currentUser}
                onProfileUpdated={(updated) => setCurrentUser(updated)}
                onSignOut={handleSignOut}
              />
            ) : (
              <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center max-w-md mx-auto my-12">
                <Settings className="w-12 h-12 text-slate-300 mx-auto mb-4 stroke-1" />
                <h3 className="font-bold text-slate-900 text-base">Identifiez-vous pour vos réglages</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Pour gérer votre profil, votre confidentialité, vos notifications et préférences enregistrées dans Firestore, vous devez vous connecter.
                </p>
                <button
                  onClick={() => {
                    setIsSignUp(false);
                    setShowAuthModal(true);
                  }}
                  className="mt-6 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-sm"
                >
                  S'identifier maintenant
                </button>
              </div>
            )}
          </div>
        )}

        {/* CHAT MESSAGERIE SCREEN */}
        {activeTab === 'chat' && (
          <div className="py-4 animate-fadeIn">
            {currentUser ? (
              <ChatView currentUser={currentUser} />
            ) : (
              <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center max-w-md mx-auto my-12">
                <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4 stroke-1" />
                <h3 className="font-bold text-slate-900 text-base">Identifiez-vous pour chatter</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Pour échanger de manière privée avec Mallam Ousmane, le Dr. Amina ou d'autres membres, vous devez posséder un compte actif sur Zaure.
                </p>
                <button
                  onClick={() => {
                    setIsSignUp(false);
                    setShowAuthModal(true);
                  }}
                  className="mt-6 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-sm"
                >
                  S'identifier maintenant
                </button>
              </div>
            )}
          </div>
        )}

        {/* CERCLLES & CAPSULES MAIN FEED SCREEN */}
        {activeTab === 'feed' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 py-4">
            
            {/* Left Sidebar: Circles & Categories Navigation */}
            <section className="lg:col-span-4 space-y-4">
              <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-500" />
                    <span>Cercles de Savoir</span>
                  </h2>
                  
                  {currentUser && (
                    <button
                      onClick={() => setShowCreateCircle(true)}
                      className="p-1.5 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg text-slate-600 transition flex items-center gap-1 border border-slate-100"
                      title="Créer un cercle thématique"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-[10px] font-bold">Nouveau</span>
                    </button>
                  )}
                </div>

                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  Rejoignez des cercles thématiques pour recevoir leurs capsules dans votre fil d'actualité personnalisé.
                </p>

                {/* Circle Filter Quick Selectors */}
                <div className="space-y-1">
                  <button
                    onClick={() => setSelectedCircleId('all')}
                    className={`w-full text-left px-3 py-2 text-xs font-bold rounded-xl flex items-center justify-between transition-all ${
                      selectedCircleId === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span>🎯 Tous les cercles confondus</span>
                    <span className="bg-white/10 px-1.5 py-0.2 text-[9px] rounded-full border border-slate-700">{circles.length}</span>
                  </button>
                </div>
              </div>

              {/* Circle Cards List Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
                {circles.map((circle) => {
                  const isJoined = joinedCircleIds.includes(circle.id);
                  return (
                    <CircleCard
                      key={circle.id}
                      circle={circle}
                      isJoined={isJoined}
                      currentUser={currentUser}
                      onToggleJoin={() => handleToggleJoinCircle(circle.id)}
                      onSelect={() => setSelectedCircleId(circle.id)}
                      isActive={selectedCircleId === circle.id}
                    />
                  );
                })}
              </div>
            </section>

            {/* Middle/Right: Knowledge Capsules Stream */}
            <section className="lg:col-span-8 space-y-4">
              
              {/* Creator of Capsule Box */}
              {currentUser ? (
                <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-50">
                    <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-500" />
                      <span>Publier un savoir sur Zaure</span>
                    </h3>
                    
                    {!showCreateCapsule && (
                      <button
                        onClick={() => setShowCreateCapsule(true)}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl transition flex items-center gap-1 shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Créer une capsule</span>
                      </button>
                    )}
                  </div>

                  {showCreateCapsule ? (
                    <div className="space-y-4 pt-1 animate-fadeIn">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        
                        {/* 1. Circle Selector */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Cercle cible</label>
                          <select
                            value={newCapsuleCircleId}
                            onChange={(e) => setNewCapsuleCircleId(e.target.value)}
                            className="w-full text-xs bg-slate-50 border border-slate-200 p-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 font-medium"
                          >
                            {circles.map(c => (
                              <option key={c.id} value={c.id}>{c.nom}</option>
                            ))}
                          </select>
                        </div>

                        {/* 2. Format Selector */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Format</label>
                          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
                            <button
                              type="button"
                              onClick={() => setNewCapsuleType('texte')}
                              className={`flex-1 text-center py-1 rounded-lg text-xs font-semibold transition ${
                                newCapsuleType === 'texte'
                                  ? 'bg-white shadow-xs text-emerald-600'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              Texte
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewCapsuleType('audio')}
                              className={`flex-1 text-center py-1 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1 ${
                                newCapsuleType === 'audio'
                                  ? 'bg-white shadow-xs text-emerald-600'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                              <span>Audio Vocale</span>
                            </button>
                          </div>
                        </div>

                        {/* 3. Language Selector */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Langue d'origine</label>
                          <select
                            value={newCapsuleLangue}
                            onChange={(e) => setNewCapsuleLangue(e.target.value as any)}
                            className="w-full text-xs bg-slate-50 border border-slate-200 p-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 font-medium"
                          >
                            <option value="fr">Français</option>
                            <option value="ha">Hausa (Haoussa)</option>
                            <option value="en">English (Anglais)</option>
                          </select>
                        </div>
                      </div>

                      {/* Content editor based on format selection */}
                      {newCapsuleType === 'texte' ? (
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Contenu éducatif</label>
                          <textarea
                            placeholder="Rédigez votre leçon ou information précieuse. Qu'allez-vous enseigner aujourd'hui aux membres du cercle ? (Pas de message superflu, valorisons le savoir !)"
                            value={newCapsuleContenu}
                            onChange={(e) => setNewCapsuleContenu(e.target.value)}
                            rows={4}
                            className="w-full text-xs bg-slate-50 border border-slate-200 p-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 leading-relaxed"
                          />
                        </div>
                      ) : (
                        <div className="py-2">
                          <AudioRecorder
                            onAudioReady={(base64) => {
                              setNewCapsuleContenu(base64);
                              // Auto trigger publish
                            }}
                            onCancel={() => {
                              setNewCapsuleType('texte');
                            }}
                          />
                          {newCapsuleContenu.startsWith('data:audio') && (
                            <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
                              <span className="font-semibold flex items-center gap-1.5">
                                <Check className="w-4 h-4 text-emerald-600" />
                                Note vocale prête à être partagée !
                              </span>
                              <span className="font-mono text-[10px] text-emerald-600">Audio Base64</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex justify-end gap-2 pt-1.5 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            setShowCreateCapsule(false);
                            setNewCapsuleContenu('');
                          }}
                          className="px-4 py-2 border border-slate-200 text-slate-500 text-xs rounded-xl hover:bg-slate-50 font-semibold transition"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateCapsuleSubmit}
                          disabled={!newCapsuleContenu}
                          className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-sm disabled:opacity-50 disabled:hover:bg-emerald-500"
                        >
                          Diffuser la capsule
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
                        <PlusCircle className="w-4.5 h-4.5" />
                      </div>
                      <button
                        onClick={() => setShowCreateCapsule(true)}
                        className="flex-1 text-left px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-500 hover:bg-slate-100/70 transition"
                      >
                        Partagez un savoir médical, une leçon de langue ou un conseil sahélien...
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gradient-to-r from-emerald-500/10 to-amber-500/10 border border-emerald-500/10 rounded-2xl p-4 flex items-center justify-between gap-4">
                  <div className="flex gap-3 items-center">
                    <span className="text-xl">💡</span>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Partagez votre propre savoir</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Inscrivez-vous pour publier des capsules de cours, de santé ou de langue.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setIsSignUp(true);
                      setShowAuthModal(true);
                    }}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
                  >
                    Créer un compte
                  </button>
                </div>
              )}

              {/* Feed Filters */}
              <div className="bg-white border border-slate-100 p-3 rounded-2xl shadow-xs flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-xs font-bold text-slate-800">
                    {selectedCircleId !== 'all' 
                      ? `Cercle : ${circles.find(c => c.id === selectedCircleId)?.nom}` 
                      : feedFilter === 'joined' 
                        ? 'Mon flux (Cercles rejoints)' 
                        : 'Flux global (Toutes les capsules)'}
                  </span>
                </div>

                {/* Feed view controllers */}
                {selectedCircleId === 'all' && (
                  <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      onClick={() => setFeedFilter('joined')}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                        feedFilter === 'joined'
                          ? 'bg-white shadow-xs text-emerald-600'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Mes cercles rejoints
                    </button>
                    <button
                      onClick={() => setFeedFilter('all')}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                        feedFilter === 'all'
                          ? 'bg-white shadow-xs text-emerald-600'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Tous les cercles
                    </button>
                  </div>
                )}
              </div>

              {/* Capsules List Container */}
              <div className="space-y-4" id="capsules-stream-list">
                {capsules.length === 0 ? (
                  <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center py-16">
                    <span className="text-4xl">📚</span>
                    <h4 className="font-bold text-slate-900 text-sm mt-4">Aucune capsule dans ce flux</h4>
                    
                    {feedFilter === 'joined' && selectedCircleId === 'all' ? (
                      <div className="max-w-md mx-auto mt-2">
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Zaure n'utilise pas de fil global par défaut pour éviter le scroll addictif. Rejoignez d'abord des cercles thématiques pour composer votre espace d'apprentissage !
                        </p>
                        <div className="mt-5 flex justify-center gap-3">
                          <button
                            onClick={() => setFeedFilter('all')}
                            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition"
                          >
                            Explorer tous les cercles
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 mt-2">Soyez le premier à publier une capsule dans ce cercle de savoir !</p>
                    )}
                  </div>
                ) : (
                  capsules.map((capsule) => (
                    <CapsuleCard
                      key={capsule.id}
                      capsule={capsule}
                      currentUser={currentUser}
                    />
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-100 py-6 text-center text-xs text-slate-400 mt-12" id="footer-section">
        <p>© 2026 Zaure. Tous droits réservés. Développé pour l'apprentissage communautaire en Afrique de l'Ouest.</p>
        <p className="mt-1 text-[10px] text-slate-400">Brisez l'addiction des fils d'actualités infinis — Privilégiez le partage de savoirs utiles.</p>
      </footer>

      {/* 5. MODAL: CREATE CIRCLE */}
      {showCreateCircle && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <h3 className="font-bold text-slate-950 text-base mb-2">Créer un nouveau Cercle de Savoir</h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">Initiez un espace thématique d'apprentissage pour réunir des mentors et apprenants intéressés par votre domaine.</p>

            <form onSubmit={handleCreateCircleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Nom du cercle</label>
                <input
                  type="text"
                  placeholder="Ex : Pédiatrie & Nourrissons, Proverbes Haoussa..."
                  required
                  value={newCircleNom}
                  onChange={(e) => setNewCircleNom(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
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
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Catégorie</label>
                  <select
                    value={newCircleCat}
                    onChange={(e) => setNewCircleCat(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 p-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
                  >
                    <option value="Médecine">Médecine / Santé</option>
                    <option value="Langues">Langues / Culture</option>
                    <option value="Sciences">Sciences / Agriculture</option>
                    <option value="Culture">Éducation générale</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Illustration de fond</label>
                  <input
                    type="text"
                    placeholder="Lien d'image (Optionnel)"
                    value={newCircleImg}
                    onChange={(e) => setNewCircleImg(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
                  />
                </div>
              </div>

              <div>
                <p className="text-[10px] text-slate-400 font-bold mb-1.5">Ou sélectionnez une couverture rapide :</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {presetImages.map((img) => (
                    <button
                      key={img.name}
                      type="button"
                      onClick={() => setNewCircleImg(img.url)}
                      className={`text-[9px] font-semibold p-1 border rounded-lg truncate transition ${
                        newCircleImg === img.url 
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                          : 'border-slate-100 hover:bg-slate-50 text-slate-500'
                      }`}
                    >
                      {img.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateCircle(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 text-xs rounded-xl hover:bg-slate-50 font-semibold transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-sm"
                >
                  Créer le cercle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: AUTHENTICATION */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn" id="auth-modal-screen">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100">
            <h3 className="font-bold text-slate-950 text-base mb-1">
              {isSignUp ? "Créer un compte Zaure" : "Connexion à Zaure"}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {isSignUp ? "Rejoignez le réseau d'entraide et partagez vos savoirs." : "Saisissez vos identifiants pour accéder à vos cercles de savoir."}
            </p>

            {authError && (
              <div className="mb-4 p-2.5 bg-red-500/10 border border-red-500/20 text-[11px] text-red-600 rounded-lg">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {isSignUp && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Nom complet</label>
                    <input
                      type="text"
                      placeholder="Ex: Mahamadou Garba"
                      required
                      value={authNom}
                      onChange={(e) => setAuthNom(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Votre Biographie</label>
                    <input
                      type="text"
                      placeholder="Ex: Étudiant en médecine, Dakar..."
                      value={authBio}
                      onChange={(e) => setAuthBio(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Votre rôle</label>
                      <select
                        value={authRole}
                        onChange={(e) => setAuthRole(e.target.value as any)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 p-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
                      >
                        <option value="utilisateur">Apprenant / Membre</option>
                        <option value="mentor">Enseignant / Mentor</option>
                        <option value="verifie">Professionnel de Santé</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Langue préférée</label>
                      <select
                        value={authLangue}
                        onChange={(e) => setAuthLangue(e.target.value as any)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 p-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
                      >
                        <option value="fr">Français</option>
                        <option value="ha">Hausa</option>
                        <option value="en">English</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Adresse email</label>
                <input
                  type="email"
                  placeholder="Ex: mahamadou@zaure.org"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Mot de passe</label>
                <input
                  type="password"
                  placeholder={mode === 'cloud' ? "Au moins 6 caractères" : "Optionnel en mode démo"}
                  required={mode === 'cloud'}
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
                />
              </div>

              {!isSignUp && mode === 'local' && (
                <p className="text-[10px] text-slate-400 italic">
                  Note : En mode Sandbox, vous pouvez tester la connexion avec n'importe quel email valide, ou utiliser les adresses de démo (ex: <strong>mahamadou.garba@zaure.org</strong>).
                </p>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-sm mt-2"
              >
                {isSignUp ? "S'inscrire et démarrer" : "Se connecter"}
              </button>

              {mode === 'cloud' && (
                <div className="space-y-2 mt-2">
                  <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-slate-200"></div>
                    <span className="flex-shrink mx-4 text-[10px] text-slate-400 uppercase font-bold tracking-wider">OU</span>
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
                </div>
              )}

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setAuthError(null);
                  }}
                  className="text-[11px] text-emerald-600 hover:underline font-bold"
                >
                  {isSignUp ? "Vous avez déjà un compte ? Connectez-vous" : "Pas encore de compte ? S'inscrire"}
                </button>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAuthModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 text-xs rounded-xl hover:bg-slate-50 font-semibold transition"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
