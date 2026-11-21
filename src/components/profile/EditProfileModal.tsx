import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  Award,
  Briefcase,
  Camera,
  Check,
  CheckCircle2,
  Eye,
  Globe,
  GraduationCap,
  Image as ImageIcon,
  Info,
  Loader2,
  MapPin,
  PenLine,
  Trash2,
  Upload,
  User,
  X
} from 'lucide-react';
import { UserProfile } from '../../types';
import { sanitizeUsername, sanitizeWebsiteUrl, zaureService } from '../../firebaseClient';
import { compressImageFile } from '../../utils/imageCompressor';

interface EditProfileModalProps {
  isOpen: boolean;
  user: UserProfile;
  onClose: () => void;
  onSaved: (updated: UserProfile) => void;
}

const COVER_PRESETS = [
  {
    id: 'sahel-horizon',
    label: 'Horizon Sahel',
    url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'library-study',
    label: 'Savoirs & Étude',
    url: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'medical-team',
    label: 'Santé & Entraide',
    url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'botanical-green',
    label: 'Terre & Écologie',
    url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80&w=1200'
  }
];

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1594824813589-9800e84b2e15?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200'
];

export default function EditProfileModal({
  isOpen,
  user,
  onClose,
  onSaved
}: EditProfileModalProps) {
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [nom, setNom] = useState(user.nom || '');
  const [username, setUsername] = useState(user.username || sanitizeUsername(undefined, user.nom));
  const [bio, setBio] = useState(user.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url || '');
  const [coverUrl, setCoverUrl] = useState(user.cover_url || '');
  const [profession, setProfession] = useState(user.profession || '');
  const [formation, setFormation] = useState(user.formation || '');
  const [localisation, setLocalisation] = useState(user.localisation || '');
  const [siteWeb, setSiteWeb] = useState(user.site_web || '');
  const [infosComplementaires, setInfosComplementaires] = useState(
    user.infos_complementaires || ''
  );

  const [compressingAvatar, setCompressingAvatar] = useState(false);
  const [compressingCover, setCompressingCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setViewMode('edit');
      setNom(user.nom || '');
      setUsername(user.username || sanitizeUsername(undefined, user.nom));
      setBio(user.bio || '');
      setAvatarUrl(user.avatar_url || '');
      setCoverUrl(user.cover_url || '');
      setProfession(user.profession || '');
      setFormation(user.formation || '');
      setLocalisation(user.localisation || '');
      setSiteWeb(user.site_web || '');
      setInfosComplementaires(user.infos_complementaires || '');
      setError(null);
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setCompressingAvatar(true);
    try {
      const dataUrl = await compressImageFile(file, 250, 250, 0.8);
      if (dataUrl.length > 340000) {
        throw new Error('La photo de profil est trop lourde. Choisissez une image plus légère.');
      }
      setAvatarUrl(dataUrl);
    } catch (err: any) {
      setError(err.message || 'Impossible de traiter cette image.');
    } finally {
      setCompressingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setCompressingCover(true);
    try {
      let dataUrl = await compressImageFile(file, 1100, 420, 0.78);
      if (dataUrl.length > 340000) {
        dataUrl = await compressImageFile(file, 880, 340, 0.65);
      }
      if (dataUrl.length > 340000) {
        throw new Error('La photo de couverture dépasse la taille maximale autorisée.');
      }
      setCoverUrl(dataUrl);
    } catch (err: any) {
      setError(err.message || 'Impossible de traiter cette photo de couverture.');
    } finally {
      setCompressingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  const cleanHandle = sanitizeUsername(username, nom);
  const cleanSite = sanitizeWebsiteUrl(siteWeb);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim()) {
      setError('Veuillez renseigner votre nom complet.');
      setViewMode('edit');
      return;
    }
    if (siteWeb.trim() && !cleanSite) {
      setError('Le lien du site web doit être une URL valide (ex: https://exemple.org).');
      setViewMode('edit');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { user: updated, error: updateErr } = await zaureService.updateUserProfile(user.id, {
        nom: nom.trim(),
        username: cleanHandle,
        bio: bio.trim(),
        avatar_url: avatarUrl || null,
        cover_url: coverUrl || null,
        profession: profession.trim(),
        formation: formation.trim(),
        localisation: localisation.trim(),
        site_web: cleanSite,
        infos_complementaires: infosComplementaires.trim()
      });

      if (updateErr || !updated) {
        throw new Error(updateErr || 'Erreur lors de la sauvegarde.');
      }

      // Sync core identity into user_settings as well
      await zaureService
        .saveUserSettings(user.id, {
          nom: updated.nom,
          bio: updated.bio || '',
          avatar_url: updated.avatar_url || ''
        })
        .catch(() => {});

      onSaved(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise à jour du profil.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-slate-950">
              Modifier le profil
            </h3>
            <p className="text-[11px] text-slate-500">
              Personnalisez votre identité et prévisualisez le rendu avant de publier.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-slate-100 text-slate-500 flex items-center justify-center transition"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher: Edit vs Live Preview */}
        <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="grid grid-cols-2 gap-1.5 bg-slate-200/70 p-1 rounded-2xl max-w-sm">
            <button
              type="button"
              onClick={() => setViewMode('edit')}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                viewMode === 'edit'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PenLine className="w-3.5 h-3.5 text-blue-600" />
              <span>Éditer les infos</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                viewMode === 'preview'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-blue-600" />
              <span>Aperçu en direct</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {error && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                {error}
              </div>
            )}

            {viewMode === 'preview' ? (
              <div className="space-y-4">
                <div className="rounded-3xl border border-slate-200/90 overflow-hidden bg-white shadow-sm">
                  {/* Cover Preview */}
                  <div className="relative h-36 sm:h-44 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 overflow-hidden">
                    {coverUrl ? (
                      <img
                        src={coverUrl}
                        alt="Aperçu couverture"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-600 via-indigo-700 to-slate-900 opacity-95" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/35 to-transparent" />
                  </div>

                  {/* Overlapping Avatar + Info */}
                  <div className="px-5 pb-5">
                    <div className="-mt-12 relative z-10 flex items-end justify-between gap-3">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={nom || 'Avatar'}
                          className="w-24 h-24 rounded-full object-cover ring-4 ring-white shadow-md bg-white"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-24 h-24 rounded-full bg-blue-600 text-white text-2xl font-black flex items-center justify-center ring-4 ring-white shadow-md">
                          {(nom || 'M').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full">
                        Aperçu public
                      </span>
                    </div>

                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-lg font-extrabold text-slate-950">
                          {nom.trim() || 'Votre nom complet'}
                        </h4>
                        {user.role === 'verifie' && (
                          <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        )}
                        {user.role === 'mentor' && (
                          <Award className="w-4 h-4 text-red-600" />
                        )}
                      </div>
                      <p className="text-xs font-semibold text-slate-500">@{cleanHandle}</p>
                      {profession.trim() && (
                        <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5 pt-0.5">
                          <Briefcase className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>{profession.trim()}</span>
                        </p>
                      )}
                      {bio.trim() ? (
                        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed pt-1 whitespace-pre-line">
                          {bio.trim()}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 italic pt-1">
                          Aucune biographie renseignée.
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-2 text-[11px] text-slate-500">
                        {localisation.trim() && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>{localisation.trim()}</span>
                          </span>
                        )}
                        {formation.trim() && (
                          <span className="inline-flex items-center gap-1">
                            <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                            <span>{formation.trim()}</span>
                          </span>
                        )}
                        {cleanSite && (
                          <span className="inline-flex items-center gap-1 text-blue-700 font-semibold">
                            <Globe className="w-3.5 h-3.5" />
                            <span>{cleanSite.replace(/^https?:\/\//, '')}</span>
                          </span>
                        )}
                      </div>

                      {infosComplementaires.trim() && (
                        <div className="mt-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/70 text-xs text-slate-700 leading-relaxed">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                            Informations complémentaires
                          </p>
                          {infosComplementaires.trim()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Cover Photo Section */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                      <span>Photo de couverture</span>
                    </label>
                    {coverUrl && (
                      <button
                        type="button"
                        onClick={() => setCoverUrl('')}
                        className="text-[11px] font-bold text-red-600 hover:underline flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Retirer</span>
                      </button>
                    )}
                  </div>

                  <div className="relative h-32 sm:h-40 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-700 to-slate-900 border border-slate-200 group">
                    {coverUrl && (
                      <img
                        src={coverUrl}
                        alt="Couverture"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="absolute inset-0 bg-slate-950/30 flex items-center justify-center">
                      <input
                        ref={coverInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleCoverUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        disabled={compressingCover}
                        onClick={() => coverInputRef.current?.click()}
                        className="min-h-[40px] px-4 py-2 rounded-xl bg-white/95 hover:bg-white text-slate-950 font-bold text-xs shadow-md flex items-center gap-2 transition"
                      >
                        {compressingCover ? (
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                        ) : (
                          <Camera className="w-4 h-4 text-blue-600" />
                        )}
                        <span>
                          {compressingCover ? 'Optimisation...' : 'Changer la couverture'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {COVER_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setCoverUrl(preset.url)}
                        className={`relative w-24 h-12 rounded-xl overflow-hidden shrink-0 border-2 transition ${
                          coverUrl === preset.url
                            ? 'border-blue-600 ring-2 ring-blue-500/30'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                        title={preset.label}
                      >
                        <img
                          src={preset.url}
                          alt={preset.label}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <span className="absolute inset-x-0 bottom-0 bg-slate-950/60 text-white text-[9px] font-bold px-1 py-0.5 truncate">
                          {preset.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Avatar Section */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <div className="flex items-center gap-3.5">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={nom || 'Avatar'}
                        className="w-16 h-16 rounded-full object-cover ring-2 ring-blue-600 bg-white shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-blue-600 text-white font-black text-xl flex items-center justify-center shrink-0">
                        {(nom || 'M').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        disabled={compressingAvatar}
                        onClick={() => avatarInputRef.current?.click()}
                        className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-900 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition"
                      >
                        {compressingAvatar ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                        ) : (
                          <Upload className="w-3.5 h-3.5 text-blue-600" />
                        )}
                        <span>{compressingAvatar ? 'Compression...' : 'Photo de profil'}</span>
                      </button>
                      <p className="text-[10px] text-slate-400 mt-1">
                        JPG, PNG ou WebP · Optimisée automatiquement
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 sm:ml-auto">
                    {AVATAR_PRESETS.map((presetUrl, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setAvatarUrl(presetUrl)}
                        className={`w-9 h-9 rounded-full overflow-hidden border-2 transition ${
                          avatarUrl === presetUrl
                            ? 'border-blue-600 scale-105'
                            : 'border-white hover:border-slate-300'
                        }`}
                      >
                        <img
                          src={presetUrl}
                          alt={`Avatar ${i + 1}`}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Identity Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                      Nom complet *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        maxLength={120}
                        value={nom}
                        onChange={(e) => setNom(e.target.value)}
                        placeholder="Ex : Dr. Aminata Diallo"
                        className="w-full min-h-[42px] pl-9 pr-3 py-2 text-xs sm:text-sm bg-[#F0F2F5] focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-slate-900 focus:outline-none transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                      Nom d'utilisateur (@username)
                    </label>
                    <div className="relative">
                      <span className="text-xs font-bold text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">
                        @
                      </span>
                      <input
                        type="text"
                        maxLength={32}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="aminata_diallo"
                        className="w-full min-h-[42px] pl-7 pr-3 py-2 text-xs sm:text-sm bg-[#F0F2F5] focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-slate-900 focus:outline-none transition"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Aperçu : <span className="font-semibold text-blue-700">@{cleanHandle}</span>
                    </p>
                  </div>
                </div>

                {/* Bio */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                      Biographie
                    </label>
                    <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                      {bio.length} / 1000
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Présentez votre parcours, vos centres d'intérêt ou vos domaines d'expertise..."
                    className="w-full p-3 text-xs sm:text-sm bg-[#F0F2F5] focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-slate-900 focus:outline-none resize-none leading-relaxed transition"
                  />
                </div>

                {/* Profession & Formation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                      Profession / Rôle
                    </label>
                    <div className="relative">
                      <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        maxLength={120}
                        value={profession}
                        onChange={(e) => setProfession(e.target.value)}
                        placeholder="Ex : Pédiatre, Enseignant, Agronome..."
                        className="w-full min-h-[42px] pl-9 pr-3 py-2 text-xs sm:text-sm bg-[#F0F2F5] focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-slate-900 focus:outline-none transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                      Formation / Études
                    </label>
                    <div className="relative">
                      <GraduationCap className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        maxLength={160}
                        value={formation}
                        onChange={(e) => setFormation(e.target.value)}
                        placeholder="Ex : Université Abdou Moumouni"
                        className="w-full min-h-[42px] pl-9 pr-3 py-2 text-xs sm:text-sm bg-[#F0F2F5] focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-slate-900 focus:outline-none transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Localisation & Site Web */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                      Localisation
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        maxLength={120}
                        value={localisation}
                        onChange={(e) => setLocalisation(e.target.value)}
                        placeholder="Ex : Niamey, Niger"
                        className="w-full min-h-[42px] pl-9 pr-3 py-2 text-xs sm:text-sm bg-[#F0F2F5] focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-slate-900 focus:outline-none transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                      Site web / Lien professionnel
                    </label>
                    <div className="relative">
                      <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        maxLength={300}
                        value={siteWeb}
                        onChange={(e) => setSiteWeb(e.target.value)}
                        placeholder="https://votre-site.org"
                        className="w-full min-h-[42px] pl-9 pr-3 py-2 text-xs sm:text-sm bg-[#F0F2F5] focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-slate-900 focus:outline-none transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Informations complémentaires */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-slate-400" />
                      <span>Informations complémentaires</span>
                    </label>
                    <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                      {infosComplementaires.length} / 1000
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={infosComplementaires}
                    onChange={(e) => setInfosComplementaires(e.target.value)}
                    placeholder="Langues parlées, disponibilités pour le mentorat, projets en cours..."
                    className="w-full p-3 text-xs sm:text-sm bg-[#F0F2F5] focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-slate-900 focus:outline-none resize-none leading-relaxed transition"
                  />
                </div>
              </>
            )}
          </div>

          {/* Sticky Footer */}
          <div className="px-4 sm:px-6 py-3.5 border-t border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition"
            >
              Annuler
            </button>

            <div className="flex items-center gap-2">
              {viewMode === 'edit' && (
                <button
                  type="button"
                  onClick={() => setViewMode('preview')}
                  className="hidden sm:inline-flex min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold items-center gap-1.5 transition"
                >
                  <Eye className="w-4 h-4 text-blue-600" />
                  <span>Aperçu</span>
                </button>
              )}

              <button
                type="submit"
                disabled={saving || compressingAvatar || compressingCover}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>{saving ? 'Enregistrement...' : 'Enregistrer le profil'}</span>
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body
  );
}
