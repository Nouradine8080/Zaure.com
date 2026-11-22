import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AtSign,
  Briefcase,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  Globe,
  GraduationCap,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  User
} from 'lucide-react';
import { UserProfile, UserSettings } from '../../types';
import { sanitizeUsername, sanitizeWebsiteUrl, zaureService } from '../../firebaseClient';

const AVATAR_PRESETS = [
  { id: 'av1', label: 'Scientifique', url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200' },
  { id: 'av2', label: 'Médecine', url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200' },
  { id: 'av3', label: 'Mentor', url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=200' },
  { id: 'av4', label: 'Académique', url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=200' },
  { id: 'av5', label: 'Ingénieur', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200' },
  { id: 'av6', label: 'Exploratrice', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200' }
];

interface AccountSectionProps {
  currentUser: UserProfile;
  settings: UserSettings;
  onProfileUpdated: (updated: UserProfile) => void;
  onSettingsChange: (patch: Partial<UserSettings>) => void;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}

export default function AccountSection({
  currentUser,
  settings,
  onProfileUpdated,
  onSettingsChange,
  onNotify
}: AccountSectionProps) {
  const [nom, setNom] = useState(currentUser.nom || '');
  const [username, setUsername] = useState(
    currentUser.username || sanitizeUsername(undefined, currentUser.nom)
  );
  const [phone, setPhone] = useState(currentUser.phone || settings.telephone || '');
  const [dateNaissance, setDateNaissance] = useState(
    currentUser.date_naissance || settings.date_naissance || ''
  );
  const [bio, setBio] = useState(currentUser.bio || '');
  const [profession, setProfession] = useState(currentUser.profession || '');
  const [formation, setFormation] = useState(currentUser.formation || '');
  const [localisation, setLocalisation] = useState(currentUser.localisation || '');
  const [siteWeb, setSiteWeb] = useState(currentUser.site_web || '');
  const [infosComp, setInfosComp] = useState(currentUser.infos_complementaires || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatar_url || '');

  // Email change subform
  const [newEmail, setNewEmail] = useState(currentUser.email || '');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNom(currentUser.nom || '');
    setUsername(currentUser.username || sanitizeUsername(undefined, currentUser.nom));
    setPhone(currentUser.phone || settings.telephone || '');
    setDateNaissance(currentUser.date_naissance || settings.date_naissance || '');
    setBio(currentUser.bio || '');
    setProfession(currentUser.profession || '');
    setFormation(currentUser.formation || '');
    setLocalisation(currentUser.localisation || '');
    setSiteWeb(currentUser.site_web || '');
    setInfosComp(currentUser.infos_complementaires || '');
    setAvatarUrl(currentUser.avatar_url || '');
    setNewEmail(currentUser.email || '');
  }, [currentUser, settings.telephone, settings.date_naissance]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onNotify('Veuillez sélectionner un fichier image valide.', 'error');
      return;
    }
    setUploadingAvatar(true);
    try {
      const res = await zaureService.uploadAndSetAvatar(file);
      if (res.avatarUrl) {
        setAvatarUrl(res.avatarUrl);
        const updated: UserProfile = { ...currentUser, avatar_url: res.avatarUrl };
        onProfileUpdated(updated);
        onSettingsChange({ avatar_url: res.avatarUrl });
        onNotify('Photo de profil mise à jour.');
      } else {
        onNotify(res.error || 'Échec de mise à jour de la photo.', 'error');
      }
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedNom = nom.trim();
    if (trimmedNom.length < 2) {
      setValidationError('Le nom complet doit contenir au moins 2 caractères.');
      return;
    }

    const cleanHandle = sanitizeUsername(username, trimmedNom);
    if (cleanHandle.length < 2) {
      setValidationError("Le nom d'utilisateur doit contenir au moins 2 caractères valides.");
      return;
    }

    const trimmedPhone = phone.trim();
    if (trimmedPhone && !/^[+0-9\s().-]{6,25}$/.test(trimmedPhone)) {
      setValidationError('Format de numéro de téléphone invalide.');
      return;
    }

    if (dateNaissance) {
      const birth = new Date(dateNaissance);
      const now = new Date();
      if (Number.isNaN(birth.getTime()) || birth > now || birth.getFullYear() < 1900) {
        setValidationError('Veuillez saisir une date de naissance valide.');
        return;
      }
    }

    const cleanWeb = siteWeb.trim() ? sanitizeWebsiteUrl(siteWeb) : '';
    if (siteWeb.trim() && !cleanWeb) {
      setValidationError('L’URL du site web semble invalide (utilisez https://...).');
      return;
    }

    setSaving(true);
    try {
      const { user: updated, error } = await zaureService.updateUserProfile(currentUser.id, {
        nom: trimmedNom,
        username: cleanHandle,
        phone: trimmedPhone,
        date_naissance: dateNaissance,
        bio,
        avatar_url: avatarUrl || null,
        profession,
        formation,
        localisation,
        site_web: cleanWeb,
        infos_complementaires: infosComp
      });

      if (error || !updated) {
        setValidationError(error || 'Impossible de sauvegarder vos informations.');
        return;
      }

      await zaureService.saveUserSettings(currentUser.id, {
        nom: trimmedNom,
        username: cleanHandle,
        telephone: trimmedPhone,
        date_naissance: dateNaissance,
        bio: bio.trim(),
        avatar_url: avatarUrl || ''
      });

      onSettingsChange({
        nom: trimmedNom,
        username: cleanHandle,
        telephone: trimmedPhone,
        date_naissance: dateNaissance,
        bio: bio.trim(),
        avatar_url: avatarUrl || ''
      });
      onProfileUpdated(updated);
      onNotify('Informations du compte enregistrées.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newEmail.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      onNotify('Veuillez saisir une adresse e-mail valide.', 'error');
      return;
    }
    if (trimmed.toLowerCase() === (currentUser.email || '').toLowerCase()) {
      onNotify('Cette adresse e-mail est déjà celle de votre compte.', 'error');
      return;
    }
    setEmailLoading(true);
    try {
      const res = await zaureService.changeUserEmail(trimmed, emailPassword || undefined);
      if (res.success) {
        onProfileUpdated({ ...currentUser, email: trimmed });
        onSettingsChange({ email: trimmed });
        setEmailPassword('');
        onNotify('Adresse e-mail mise à jour avec succès.');
      } else {
        onNotify(res.error || 'Impossible de modifier l’adresse e-mail.', 'error');
      }
    } finally {
      setEmailLoading(false);
    }
  };

  const previewHandle = `@${sanitizeUsername(username, nom)}`;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/85 dark:border-slate-800 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-950 dark:text-white">
              Mon compte
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Gérez votre identité, votre photo de profil et vos coordonnées personnelles.
            </p>
          </div>
        </div>

        {/* Avatar Editor */}
        <div className="pt-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="relative shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={nom || currentUser.nom}
                className="w-20 h-20 rounded-full object-cover ring-2 ring-blue-500/30 bg-slate-100 dark:bg-slate-800"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-blue-600 text-white font-extrabold text-2xl flex items-center justify-center">
                {(nom || currentUser.nom || 'M').charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <button
                type="button"
                disabled={uploadingAvatar}
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 transition"
              >
                {uploadingAvatar ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
                <span>{uploadingAvatar ? 'Importation...' : 'Importer une photo'}</span>
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition"
                >
                  Retirer
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Modèles rapides :
              </span>
              {AVATAR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setAvatarUrl(preset.url)}
                  className={`relative w-8 h-8 rounded-full overflow-hidden border-2 transition ${
                    avatarUrl === preset.url
                      ? 'border-blue-600 scale-105'
                      : 'border-transparent opacity-75 hover:opacity-100'
                  }`}
                  title={preset.label}
                >
                  <img src={preset.url} alt={preset.label} className="w-full h-full object-cover" />
                  {avatarUrl === preset.url && (
                    <span className="absolute inset-0 bg-blue-600/30 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-white" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Profile & Identity Form */}
        <form onSubmit={handleSaveAccount} className="mt-6 space-y-4">
          {validationError && (
            <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs font-semibold text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Nom complet *
              </label>
              <input
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                required
                maxLength={120}
                placeholder="Ex: Aïssa Mahamadou"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F0F2F5] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Nom d'utilisateur
              </label>
              <div className="relative">
                <AtSign className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={32}
                  placeholder="identifiant_zaure"
                  className="w-full min-h-[44px] pl-9 pr-3.5 py-2 rounded-xl bg-[#F0F2F5] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Aperçu public : <span className="font-semibold text-blue-600 dark:text-blue-400">{previewHandle}</span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Numéro de téléphone (privé)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={32}
                  placeholder="+227 90 00 00 00"
                  className="w-full min-h-[44px] pl-9 pr-3.5 py-2 rounded-xl bg-[#F0F2F5] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Conservé en privé sur votre compte uniquement.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Date de naissance (privée)
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={dateNaissance}
                  onChange={(e) => setDateNaissance(e.target.value)}
                  className="w-full min-h-[44px] pl-9 pr-3.5 py-2 rounded-xl bg-[#F0F2F5] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Profession / Spécialité
              </label>
              <div className="relative">
                <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                  maxLength={120}
                  placeholder="Ex: Médecin, Enseignant, Chercheur..."
                  className="w-full min-h-[44px] pl-9 pr-3.5 py-2 rounded-xl bg-[#F0F2F5] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Formation / Établissement
              </label>
              <div className="relative">
                <GraduationCap className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={formation}
                  onChange={(e) => setFormation(e.target.value)}
                  maxLength={160}
                  placeholder="Université, faculté ou institut..."
                  className="w-full min-h-[44px] pl-9 pr-3.5 py-2 rounded-xl bg-[#F0F2F5] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Localisation
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={localisation}
                  onChange={(e) => setLocalisation(e.target.value)}
                  maxLength={120}
                  placeholder="Ex: Niamey, Dakar, Paris..."
                  className="w-full min-h-[44px] pl-9 pr-3.5 py-2 rounded-xl bg-[#F0F2F5] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Site web / Lien professionnel
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="url"
                  value={siteWeb}
                  onChange={(e) => setSiteWeb(e.target.value)}
                  maxLength={300}
                  placeholder="https://..."
                  className="w-full min-h-[44px] pl-9 pr-3.5 py-2 rounded-xl bg-[#F0F2F5] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Biographie
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={1000}
              placeholder="Présentez votre parcours, vos centres d’intérêt et vos domaines d’expertise..."
              className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F0F2F5] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Informations complémentaires
            </label>
            <textarea
              rows={2}
              value={infosComp}
              onChange={(e) => setInfosComp(e.target.value)}
              maxLength={1000}
              placeholder="Langues parlées, disponibilités pour le mentorat, projets en cours..."
              className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F0F2F5] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-xs transition"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? 'Enregistrement...' : 'Enregistrer les modifications'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Email Management Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/85 dark:border-slate-800 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-extrabold text-slate-950 dark:text-white">
              Adresse e-mail du compte
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              Actuelle : {currentUser.email || 'Non renseignée'}
            </p>
          </div>
        </div>

        <form onSubmit={handleUpdateEmail} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nouvelle adresse e-mail
              </label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F0F2F5] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Mot de passe actuel (pour confirmation)
              </label>
              <input
                type="password"
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                placeholder="Requis si session ancienne"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F0F2F5] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={emailLoading}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 transition"
            >
              {emailLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>Mettre à jour l’adresse e-mail</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
