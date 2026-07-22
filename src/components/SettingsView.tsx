import React, { useState, useEffect } from 'react';
import { 
  User, 
  Shield, 
  Bell, 
  Globe, 
  Users, 
  Battery, 
  Info, 
  Check, 
  Lock, 
  Mail, 
  Key, 
  Trash2, 
  ChevronRight, 
  ChevronDown, 
  AlertTriangle, 
  Moon, 
  VolumeX, 
  Download, 
  HelpCircle, 
  LogOut, 
  UserX,
  Sparkles,
  Eye,
  MessageSquare
} from 'lucide-react';
import { UserProfile, UserSettings, DEFAULT_USER_SETTINGS, Circle } from '../types';
import { zaureService } from '../firebaseClient';

interface SettingsViewProps {
  currentUser: UserProfile;
  onProfileUpdated: (updatedUser: UserProfile) => void;
  onSignOut: () => void;
}

export default function SettingsView({ currentUser, onProfileUpdated, onSignOut }: SettingsViewProps) {
  const [activeSection, setActiveSection] = useState<'compte' | 'confidentialite' | 'notifications' | 'contenu' | 'cercles' | 'accessibilite' | 'apropos'>('compte');
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form inputs for Account section
  const [nom, setNom] = useState(currentUser.nom);
  const [bio, setBio] = useState(currentUser.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatar_url || '');
  const [languePreferee, setLanguePreferee] = useState<'fr' | 'ha' | 'en'>(currentUser.langue_preferee || 'fr');

  // Email & Password forms
  const [email, setEmail] = useState(currentUser.email);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Danger zone modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Data lists
  const [allCircles, setAllCircles] = useState<Circle[]>([]);
  const [joinedCircleIds, setJoinedCircleIds] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  // FAQ Accordion state
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  useEffect(() => {
    loadSettingsAndData();
  }, [currentUser.id]);

  const loadSettingsAndData = async () => {
    setLoading(true);
    try {
      const userSettings = await zaureService.getUserSettings(currentUser.id);
      setSettings(userSettings);
      setNom(userSettings.nom || currentUser.nom);
      setBio(userSettings.bio || currentUser.bio || '');
      setAvatarUrl(userSettings.avatar_url || currentUser.avatar_url || '');
      setLanguePreferee(userSettings.langue_preferee || currentUser.langue_preferee || 'fr');
      setEmail(userSettings.email || currentUser.email);

      const circles = await zaureService.getCircles();
      setAllCircles(circles);

      const joined = await zaureService.getJoinedCircleIds(currentUser.id);
      setJoinedCircleIds(joined);

      const users = await zaureService.getAllUsersList();
      setAllUsers(users.filter(u => u.id !== currentUser.id));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const updateSettingField = async <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    await zaureService.saveUserSettings(currentUser.id, { [key]: value });
    showToast('Préférence enregistrée dans Firestore');
  };

  // Account updates
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const { user, error } = await zaureService.updateUserProfile(currentUser.id, {
      nom,
      bio,
      avatar_url: avatarUrl,
      langue_preferee: languePreferee
    });

    if (error) {
      showToast(`Erreur : ${error}`);
    } else if (user) {
      onProfileUpdated(user);
      await updateSettingField('nom', nom);
      await updateSettingField('bio', bio);
      await updateSettingField('avatar_url', avatarUrl);
      await updateSettingField('langue_preferee', languePreferee);
      showToast('Profil mis à jour avec succès');
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailSuccess(null);
    if (!email) {
      setEmailError('L\'adresse email ne peut pas être vide.');
      return;
    }
    const res = await zaureService.changeUserEmail(email);
    if (res.success) {
      setEmailSuccess('Adresse email mise à jour dans Firestore');
      await updateSettingField('email', email);
      showToast('Email mis à jour');
    } else {
      setEmailError(res.error);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);
    if (newPassword.length < 6) {
      setPasswordError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    const res = await zaureService.changeUserPassword(newPassword);
    if (res.success) {
      setPasswordSuccess('Mot de passe changé avec succès');
      setNewPassword('');
      setCurrentPassword('');
      showToast('Mot de passe mis à jour');
    } else {
      setPasswordError(res.error);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.toLowerCase() !== 'supprimer') {
      showToast('Veuillez taper "SUPPRIMER" pour confirmer.');
      return;
    }
    await zaureService.deleteAccount(currentUser.id);
    onSignOut();
  };

  // Circle toggle
  const handleCircleToggle = async (circleId: string) => {
    const isJoined = joinedCircleIds.includes(circleId);
    if (isJoined) {
      await zaureService.leaveCircle(circleId, currentUser.id);
      setJoinedCircleIds(prev => prev.filter(id => id !== circleId));
      showToast('Vous avez quitté le cercle');
    } else {
      await zaureService.joinCircle(circleId, currentUser.id);
      setJoinedCircleIds(prev => [...prev, circleId]);
      showToast('Cercle rejoint avec succès');
    }
  };

  // Blocked user toggle
  const handleToggleBlockUser = async (targetUserId: string) => {
    const currentBlocked = settings.utilisateurs_bloques || [];
    const isBlocked = currentBlocked.includes(targetUserId);
    const newBlocked = isBlocked
      ? currentBlocked.filter(id => id !== targetUserId)
      : [...currentBlocked, targetUserId];

    await updateSettingField('utilisateurs_bloques', newBlocked);
    showToast(isBlocked ? 'Utilisateur débloqué' : 'Utilisateur bloqué');
  };

  const presetAvatars = [
    'https://images.unsplash.com/photo-1594824813573-246434de83fb?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200',
  ];

  const faqItems = [
    {
      q: "Qu'est-ce que Zaure ?",
      a: "Zaure est la plateforme communautaire d'apprentissage et d'entraide pour l'Afrique de l'Ouest. Elle permet de partager des leçons courtes (médicales, linguistiques, agricoles) sous forme de capsules vocales et textuelles au sein de cercles thématiques."
    },
    {
      q: "Comment fonctionne la sauvegarde des données ?",
      a: "Toutes vos préférences et modifications de profil sont directement synchronisées avec Firestore dans la collection sécurisée 'user_settings'. Chaque modification est enregistrée instantanément."
    },
    {
      q: "Comment devenir un Mentor ou un Professionnel Vérifié ?",
      a: "Seuls les professionnels reconnus (médecins, enseignants bilingues) peuvent obtenir le statut de mentor ou membre vérifié après contrôle de leurs qualifications."
    },
    {
      q: "Mes données personnelles sont-elles protégées ?",
      a: "Oui, Zaure garantit la confidentialité de vos informations. Vos capsules et votre visibilité restent entièrement contrôlables depuis cet écran de réglages."
    }
  ];

  const sectionTabs = [
    { id: 'compte', label: 'Compte', icon: User, desc: 'Profil, identifiants & sécurité' },
    { id: 'confidentialite', label: 'Confidentialité', icon: Shield, desc: 'Visibilité & blocage' },
    { id: 'notifications', label: 'Notifications', icon: Bell, desc: 'Alertes & canaux' },
    { id: 'contenu', label: 'Contenu & Langue', icon: Globe, desc: 'Interface & traduction' },
    { id: 'cercles', label: 'Cercles', icon: Users, desc: 'Gestion des cercles rejoints' },
    { id: 'accessibilite', label: 'Data & Confort', icon: Battery, desc: 'Économie & taille du texte' },
    { id: 'apropos', label: 'À propos', icon: Info, desc: 'Aide, conditions & compte' },
  ] as const;

  return (
    <div className="max-w-6xl mx-auto py-4 px-2 sm:px-4" id="settings-view-root">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-emerald-500/30 flex items-center gap-3 animate-slideUp">
          <div className="w-7 h-7 bg-emerald-500 text-slate-950 rounded-full flex items-center justify-center shrink-0 font-bold">
            <Check className="w-4 h-4" />
          </div>
          <p className="text-xs font-semibold">{toastMessage}</p>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 mb-6 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Paramètres & Préférences</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200 uppercase">
              Firestore Sync
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Gérez votre profil, vos règles de confidentialité, vos notifications et vos préférences Zaure.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
          <img
            src={avatarUrl || currentUser.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'}
            alt={nom}
            className="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-500"
            referrerPolicy="no-referrer"
          />
          <div>
            <p className="text-xs font-bold text-slate-900">{nom || currentUser.nom}</p>
            <p className="text-[10px] text-slate-400">{currentUser.email}</p>
          </div>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Mobile & Desktop Section Selector Navigation */}
        <nav className="md:col-span-4 lg:col-span-3 space-y-1">
          <div className="bg-white border border-slate-100 p-2 rounded-2xl shadow-xs overflow-x-auto md:overflow-visible flex md:flex-col gap-1">
            {sectionTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSection === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id)}
                  className={`w-full text-left px-3.5 py-3 rounded-xl transition flex items-center justify-between shrink-0 ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${
                      isActive ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-tight">{tab.label}</p>
                      <p className={`text-[9px] mt-0.5 hidden md:block ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                        {tab.desc}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 hidden md:block ${isActive ? 'text-emerald-400' : 'text-slate-300'}`} />
                </button>
              );
            })}
          </div>
        </nav>

        {/* Content Panel Section */}
        <main className="md:col-span-8 lg:col-span-9 bg-white border border-slate-100 rounded-3xl p-6 shadow-xs">
          
          {/* SECTION 1: COMPTE */}
          {activeSection === 'compte' && (
            <div className="space-y-8 animate-fadeIn">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2 mb-1">
                  <User className="w-4 h-4 text-emerald-500" />
                  <span>Informations de Profil</span>
                </h3>
                <p className="text-xs text-slate-500">Mettez à jour vos informations publiques visibles sur vos capsules.</p>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                {/* Avatar Picker */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Avatar de profil</label>
                  <div className="flex items-center gap-3 mb-3">
                    <img
                      src={avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'}
                      alt="Avatar"
                      className="w-14 h-14 rounded-full object-cover ring-2 ring-emerald-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1">
                      <input
                        type="url"
                        placeholder="Lien URL de votre image (ex: Unsplash)"
                        value={avatarUrl}
                        onChange={(e) => setAvatarUrl(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  
                  {/* Preset Avatar Selection */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Ou choisir :</span>
                    <div className="flex gap-2">
                      {presetAvatars.map((url, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setAvatarUrl(url)}
                          className={`w-7 h-7 rounded-full overflow-hidden border-2 transition ${
                            avatarUrl === url ? 'border-emerald-500 scale-110' : 'border-transparent opacity-70 hover:opacity-100'
                          }`}
                        >
                          <img src={url} alt="preset" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Nom complet</label>
                    <input
                      type="text"
                      required
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Langue préférée</label>
                    <select
                      value={languePreferee}
                      onChange={(e) => setLanguePreferee(e.target.value as any)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold text-slate-800"
                    >
                      <option value="fr">Français</option>
                      <option value="ha">Hausa (Haoussa)</option>
                      <option value="en">English (Anglais)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Biographie / Spécialité</label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Présentez-vous aux membres de vos cercles d'entraide..."
                    className="w-full text-xs bg-slate-50 border border-slate-200 p-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 leading-relaxed"
                  />
                </div>

                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Enregistrer le profil</span>
                </button>
              </form>

              <hr className="border-slate-100" />

              {/* Email & Password */}
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-1">
                    <Mail className="w-4 h-4 text-slate-600" />
                    <span>Modifier l'adresse email</span>
                  </h4>
                  <form onSubmit={handleChangeEmail} className="mt-2 flex flex-col sm:flex-row gap-2">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="flex-1 text-xs bg-slate-50 border border-slate-200 p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition shrink-0"
                    >
                      Mettre à jour l'email
                    </button>
                  </form>
                  {emailError && <p className="text-[11px] text-rose-500 mt-1 font-semibold">{emailError}</p>}
                  {emailSuccess && <p className="text-[11px] text-emerald-600 mt-1 font-semibold">{emailSuccess}</p>}
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-1">
                    <Key className="w-4 h-4 text-slate-600" />
                    <span>Changer le mot de passe</span>
                  </h4>
                  <form onSubmit={handleChangePassword} className="mt-2 space-y-2 max-w-md">
                    <input
                      type="password"
                      placeholder="Nouveau mot de passe (min 6 caractères)"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition"
                    >
                      Mettre à jour le mot de passe
                    </button>
                  </form>
                  {passwordError && <p className="text-[11px] text-rose-500 mt-1 font-semibold">{passwordError}</p>}
                  {passwordSuccess && <p className="text-[11px] text-emerald-600 mt-1 font-semibold">{passwordSuccess}</p>}
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* Danger Zone */}
              <div className="bg-rose-50/50 border border-rose-100 p-4 rounded-2xl">
                <h4 className="text-xs font-bold text-rose-700 flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Zone de danger</span>
                </h4>
                <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                  La suppression de votre compte effacera de façon irréversible votre profil et vos préférences enregistrées dans Firestore.
                </p>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Supprimer définitivement mon compte</span>
                </button>
              </div>
            </div>
          )}

          {/* SECTION 2: CONFIDENTIALITÉ */}
          {activeSection === 'confidentialite' && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2 mb-1">
                  <Shield className="w-4 h-4 text-emerald-500" />
                  <span>Confidentialité & Visibilité</span>
                </h3>
                <p className="text-xs text-slate-500">Contrôlez qui peut consulter vos publications et interagir avec vous.</p>
              </div>

              {/* Visibilité du profil */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-800">Visibilité de mon profil</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'public', label: 'Public', desc: 'Visible par tous les membres Zaure' },
                    { id: 'cercles', label: 'Cercles seulement', desc: 'Membres de vos cercles' },
                    { id: 'mentors', label: 'Mentors seulement', desc: 'Uniquement les mentors vérifiés' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateSettingField('profil_visibilite', opt.id as any)}
                      className={`p-3 text-left border rounded-2xl transition ${
                        settings.profil_visibilite === opt.id
                          ? 'border-emerald-500 bg-emerald-50/50 text-slate-900 ring-1 ring-emerald-500'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/50 text-slate-600'
                      }`}
                    >
                      <p className="text-xs font-bold">{opt.label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Visibilité des capsules */}
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-bold text-slate-800">Visibilité de mes capsules diffusées</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'public', label: 'Tout le réseau', desc: 'Diffusé publiquement' },
                    { id: 'cercles', label: 'Mes cercles', desc: 'Réservé à mes cercles' },
                    { id: 'mentors', label: 'Mentors seulement', desc: 'Validé avant publication' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateSettingField('capsules_visibilite', opt.id as any)}
                      className={`p-3 text-left border rounded-2xl transition ${
                        settings.capsules_visibilite === opt.id
                          ? 'border-emerald-500 bg-emerald-50/50 text-slate-900 ring-1 ring-emerald-500'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/50 text-slate-600'
                      }`}
                    >
                      <p className="text-xs font-bold">{opt.label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Messagerie directe */}
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-bold text-slate-800">Qui peut m'envoyer un message privé ?</label>
                <select
                  value={settings.messages_autorises}
                  onChange={(e) => updateSettingField('messages_autorises', e.target.value as any)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 p-2.5 rounded-xl font-medium text-slate-800"
                >
                  <option value="tous">Tous les membres du réseau</option>
                  <option value="cercles">Membres de mes cercles uniquement</option>
                  <option value="mentors">Mentors vérifiés uniquement</option>
                </select>
              </div>

              {/* Demandes de mentorat */}
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-bold text-slate-800">Qui peut me proposer une demande de mentorat ?</label>
                <select
                  value={settings.mentorat_autorise}
                  onChange={(e) => updateSettingField('mentorat_autorise', e.target.value as any)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 p-2.5 rounded-xl font-medium text-slate-800"
                >
                  <option value="tous">Tous les membres</option>
                  <option value="verifies">Uniquement les comptes certifiés/vérifiés</option>
                  <option value="aucun">Désactiver les demandes de mentorat</option>
                </select>
              </div>

              <hr className="border-slate-100" />

              {/* Utilisateurs bloqués */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-2">
                  <UserX className="w-4 h-4 text-slate-600" />
                  <span>Utilisateurs bloqués</span>
                </h4>
                <p className="text-[11px] text-slate-500 mb-3">
                  Les utilisateurs bloqués ne peuvent ni voir vos capsules ni vous contacter en privé.
                </p>

                {allUsers.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Aucun autre utilisateur dans le réseau pour l'instant.</p>
                ) : (
                  <div className="space-y-2">
                    {allUsers.map(u => {
                      const isBlocked = (settings.utilisateurs_bloques || []).includes(u.id);
                      return (
                        <div key={u.id} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={u.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'}
                              alt={u.nom}
                              className="w-8 h-8 rounded-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <p className="text-xs font-bold text-slate-800">{u.nom}</p>
                              <p className="text-[10px] text-slate-400">{u.email}</p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleBlockUser(u.id)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                              isBlocked
                                ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            }`}
                          >
                            {isBlocked ? 'Bloqué (Débloquer)' : 'Bloquer'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SECTION 3: NOTIFICATIONS */}
          {activeSection === 'notifications' && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2 mb-1">
                  <Bell className="w-4 h-4 text-emerald-500" />
                  <span>Notifications & Alertes</span>
                </h3>
                <p className="text-xs text-slate-500">Choisissez quand et comment Zaure vous informe des activités importantes.</p>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-800">Notifier pour :</label>

                {[
                  { key: 'notif_capsule', title: 'Nouvelles capsules publiées', desc: 'Quand un membre ou mentor publie dans un de vos cercles rejoints' },
                  { key: 'notif_message', title: 'Messages directs reçus', desc: 'Alertes lors de la réception d\'un nouveau message privé' },
                  { key: 'notif_mentorat', title: 'Invitations de mentorat', desc: 'Lorsqu\'un mentor ou un apprenant sollicite votre accompagnement' },
                  { key: 'notif_reaction', title: 'Réactions sur mes capsules', desc: 'Quand quelqu\'un indique votre capsule comme utile ou pose une question' },
                ].map(item => {
                  const val = !!(settings as any)[item.key];
                  return (
                    <div key={item.key} className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                      <div>
                        <p className="text-xs font-bold text-slate-800">{item.title}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{item.desc}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => updateSettingField(item.key as any, !val)}
                        className={`w-12 h-6 rounded-full transition p-1 flex items-center ${
                          val ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <hr className="border-slate-100" />

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-2">Canal d'acheminement des notifications</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'inapp', label: 'In-App uniquement', desc: 'Visible lors de vos sessions Zaure' },
                    { id: 'email', label: 'Email uniquement', desc: 'Envoyé sur votre boîte mail' },
                    { id: 'les_deux', label: 'In-App & Email', desc: 'Canal hybride (recommandé)' },
                  ].map(canal => (
                    <button
                      key={canal.id}
                      type="button"
                      onClick={() => updateSettingField('canal_notif', canal.id as any)}
                      className={`p-3 text-left border rounded-2xl transition ${
                        settings.canal_notif === canal.id
                          ? 'border-emerald-500 bg-emerald-50/50 text-slate-900 ring-1 ring-emerald-500'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/50 text-slate-600'
                      }`}
                    >
                      <p className="text-xs font-bold">{canal.label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{canal.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: CONTENU & LANGUE */}
          {activeSection === 'contenu' && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2 mb-1">
                  <Globe className="w-4 h-4 text-emerald-500" />
                  <span>Contenu & Langue de l'Application</span>
                </h3>
                <p className="text-xs text-slate-500">Personnalisez la langue d'affichage et l'assistance linguistique de Zaure.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Langue de l'interface</label>
                <select
                  value={settings.langue_interface}
                  onChange={(e) => updateSettingField('langue_interface', e.target.value as any)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 p-2.5 rounded-xl font-bold text-slate-800"
                >
                  <option value="fr">🇫🇷 Français</option>
                  <option value="ha">🇳🇬 🇳🇪 Hausa (Koyi Hausa)</option>
                  <option value="en">🇬🇧 English</option>
                </select>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                  <div>
                    <p className="text-xs font-bold text-slate-800">Traduction automatique des capsules</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Affiche instantanément un bouton de traduction bilingue (ex: Haoussa vers Français) sous chaque capsule.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => updateSettingField('traduction_auto', !settings.traduction_auto)}
                    className={`w-12 h-6 rounded-full transition p-1 flex items-center ${
                      settings.traduction_auto ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                  <div>
                    <p className="text-xs font-bold text-slate-800">Téléchargement hors-ligne automatique</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Précharge les capsules vocales pour une réécoute sans connexion Internet active.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => updateSettingField('telechargement_hors_ligne', !settings.telechargement_hors_ligne)}
                    className={`w-12 h-6 rounded-full transition p-1 flex items-center ${
                      settings.telechargement_hors_ligne ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 5: CERCLES */}
          {activeSection === 'cercles' && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-emerald-500" />
                  <span>Gestion des Cercles de Savoir</span>
                </h3>
                <p className="text-xs text-slate-500">Gérez vos abonnements et l'affichage des suggestions dans votre fil d'actualité.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-2">Vos cercles rejoints ({joinedCircleIds.length})</label>
                <div className="space-y-2">
                  {allCircles.map(circle => {
                    const isJoined = joinedCircleIds.includes(circle.id);
                    return (
                      <div key={circle.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                        <div className="flex items-center gap-3">
                          <img src={circle.image} alt={circle.nom} className="w-10 h-10 rounded-xl object-cover shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-slate-900">{circle.nom}</p>
                            <p className="text-[10px] text-slate-400">{circle.categorie}</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCircleToggle(circle.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                            isJoined
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-rose-100 hover:text-rose-700'
                              : 'bg-slate-900 text-white hover:bg-slate-800'
                          }`}
                        >
                          {isJoined ? 'Rejoint (Quitter)' : 'Rejoindre'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <hr className="border-slate-100" />

              <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                <div>
                  <p className="text-xs font-bold text-slate-800">Masquer les suggestions de nouveaux cercles</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Ne présente que vos cercles explicitement suivis sur votre tableau de bord.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => updateSettingField('masquer_suggestions', !settings.masquer_suggestions)}
                  className={`w-12 h-6 rounded-full transition p-1 flex items-center ${
                    settings.masquer_suggestions ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                </button>
              </div>
            </div>
          )}

          {/* SECTION 6: ACCESSIBILITÉ & DATA */}
          {activeSection === 'accessibilite' && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2 mb-1">
                  <Battery className="w-4 h-4 text-emerald-500" />
                  <span>Accessibilité & Consommation de Données</span>
                </h3>
                <p className="text-xs text-slate-500">Options optimisées pour la sobriété numérique et la lisibilité.</p>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                <div>
                  <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Battery className="w-4 h-4 text-emerald-600" />
                    <span>Mode faible consommation de données (Data Saver)</span>
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Désactive la lecture automatique de l'audio vocale et compresse la qualité d'affichage pour préserver votre forfait mobile.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => updateSettingField('mode_faible_consommation', !settings.mode_faible_consommation)}
                  className={`w-12 h-6 rounded-full transition p-1 flex items-center shrink-0 ${
                    settings.mode_faible_consommation ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                </button>
              </div>

              <div className="space-y-3 pt-2">
                <label className="block text-xs font-bold text-slate-800">Taille du texte d'affichage</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'normal', label: 'Taille Standard (100%)', desc: 'Lisibilité équilibrée' },
                    { id: 'grand', label: 'Grand Texte (115%)', desc: 'Texte légèrement agrandi' },
                    { id: 'tres_grand', label: 'Très Grand (130%)', desc: 'Confort visuel maximal' }
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => updateSettingField('taille_texte', t.id as any)}
                      className={`p-3 text-left border rounded-2xl transition ${
                        settings.taille_texte === t.id
                          ? 'border-emerald-500 bg-emerald-50/50 text-slate-900 ring-1 ring-emerald-500'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/50 text-slate-600'
                      }`}
                    >
                      <p className="text-xs font-bold">{t.label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 7: À PROPOS & AIDE */}
          {activeSection === 'apropos' && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2 mb-1">
                  <Info className="w-4 h-4 text-emerald-500" />
                  <span>À Propos & Assistance</span>
                </h3>
                <p className="text-xs text-slate-500">Informations sur la plateforme Zaure et assistance communautaire.</p>
              </div>

              {/* FAQ Accordion */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-2">
                  <HelpCircle className="w-4 h-4 text-emerald-600" />
                  <span>Foire Aux Questions (FAQ)</span>
                </h4>
                <div className="space-y-2">
                  {faqItems.map((item, index) => {
                    const isOpen = openFaqIndex === index;
                    return (
                      <div key={index} className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50">
                        <button
                          type="button"
                          onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                          className="w-full text-left p-3.5 flex items-center justify-between font-bold text-xs text-slate-800 hover:bg-slate-100/50 transition"
                        >
                          <span>{item.q}</span>
                          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isOpen && (
                          <div className="p-3.5 pt-0 text-xs text-slate-600 leading-relaxed border-t border-slate-100 bg-white">
                            {item.a}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <hr className="border-slate-100" />

              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Version de l'application</span>
                  <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">v2.4.0 (Firestore Live)</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <span>Conditions Générales d'Utilisation</span>
                  <span className="text-emerald-600 font-semibold cursor-pointer">Consulter</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Politique de Confidentialité</span>
                  <span className="text-emerald-600 font-semibold cursor-pointer">Consulter</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onSignOut}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-2xl transition flex items-center justify-center gap-2 shadow-xs"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Se déconnecter de Zaure</span>
                </button>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-scaleUp">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900">Confirmer la suppression</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Cette action est irréversible. Votre document dans la collection Firestore <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-600 font-mono">user_settings</code> et votre profil seront définitivement effacés.
            </p>

            <div className="mt-4">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Saisissez "SUPPRIMER" pour valider
              </label>
              <input
                type="text"
                placeholder="SUPPRIMER"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full text-xs border border-slate-200 p-2.5 rounded-xl font-bold uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                }}
                className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold text-xs rounded-xl hover:bg-slate-50 transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition"
              >
                Supprimer mon compte
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
