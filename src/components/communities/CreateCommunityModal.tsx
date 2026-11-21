import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  Camera,
  Check,
  EyeOff,
  Globe,
  Lock,
  MessageSquare,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
  X
} from 'lucide-react';
import { CommunityGroup, UserProfile } from '../../types';
import { communityService } from '../../services/communityService';
import { compressImageFile } from '../../utils/imageCompressor';
import {
  COMMUNITY_AVATAR_PRESETS,
  COMMUNITY_CATEGORIES,
  COMMUNITY_COVER_PRESETS,
  getDefaultAvatar,
  getDefaultCoverByCategory
} from './communityAssets';

interface CreateCommunityModalProps {
  currentUser: UserProfile;
  onClose: () => void;
  onCreated: (group: CommunityGroup) => void;
}

export default function CreateCommunityModal({
  currentUser,
  onClose,
  onCreated
}: CreateCommunityModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(COMMUNITY_CATEGORIES[0]);
  const [coverPhoto, setCoverPhoto] = useState(COMMUNITY_COVER_PRESETS[0].url);
  const [avatarPhoto, setAvatarPhoto] = useState(getDefaultAvatar());
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public');
  const [postPermission, setPostPermission] = useState<'all_members' | 'admins_only'>('all_members');
  const [requirePostApproval, setRequirePostApproval] = useState(false);
  const [requireMemberApproval, setRequireMemberApproval] = useState(false);
  const [allowAnonymousPosts, setAllowAnonymousPosts] = useState(false);
  const [rules, setRules] = useState<string[]>([
    'Respect mutuel et bienveillance envers tous les membres.',
    'Partage de contenus constructifs et vérifiés uniquement.'
  ]);
  const [newRuleText, setNewRuleText] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    const isUsingPresetCover = COMMUNITY_COVER_PRESETS.some((p) => p.url === coverPhoto);
    if (isUsingPresetCover) {
      setCoverPhoto(getDefaultCoverByCategory(cat));
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadingCover(true);
    try {
      const compressed = await compressImageFile(file, 900, 480, 0.8);
      if (compressed.length > 340000) {
        setError('Image de couverture trop lourde après compression.');
      } else {
        setCoverPhoto(compressed);
      }
    } catch {
      setError('Impossible de traiter cette image de couverture.');
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadingAvatar(true);
    try {
      const compressed = await compressImageFile(file, 300, 300, 0.82);
      if (compressed.length > 340000) {
        setError('Photo de profil trop lourde après compression.');
      } else {
        setAvatarPhoto(compressed);
      }
    } catch {
      setError('Impossible de traiter cette photo de profil.');
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleAddRule = () => {
    const trimmed = newRuleText.trim();
    if (!trimmed) return;
    if (rules.length >= 20) {
      setError('Maximum 20 règles autorisées.');
      return;
    }
    setRules((prev) => [...prev, trimmed.slice(0, 300)]);
    setNewRuleText('');
  };

  const handleRemoveRule = (index: number) => {
    setRules((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || isSubmitting) return;
    setError(null);

    if (name.trim().length < 2) {
      setError('Le nom de la communauté doit contenir au moins 2 caractères.');
      return;
    }
    if (description.trim().length < 5) {
      setError('Veuillez rédiger une courte description de la communauté.');
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const created = await communityService.createGroup(
        {
          name,
          description,
          category,
          coverPhoto,
          avatarPhoto,
          privacy,
          postPermission,
          requirePostApproval,
          requireMemberApproval: privacy === 'private' ? true : requireMemberApproval,
          allowAnonymousPosts,
          rules
        },
        currentUser
      );
      onCreated(created);
    } catch (err: any) {
      submittingRef.current = false;
      setError(err?.message || 'Erreur lors de la création de la communauté.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4 z-50"
      onClick={() => !isSubmitting && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white rounded-t-3xl sm:rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle on mobile */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-950">
              Créer une communauté
            </h2>
            <p className="text-xs text-slate-500">
              Vous serez automatiquement désigné créateur et administrateur principal.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-5 sm:p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
              {error}
            </div>
          )}

          {/* Cover & Avatar Visual Preview */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700">
              Identité visuelle (Couverture & Photo de profil)
            </label>
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 h-36 sm:h-44">
              <img
                src={coverPhoto}
                alt="Couverture de la communauté"
                className="w-full h-full object-cover opacity-90"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/15 to-transparent" />

              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={uploadingCover}
                className="min-h-[36px] absolute top-3 right-3 px-3 py-1.5 bg-white/95 hover:bg-white text-slate-900 text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition"
              >
                <Camera className="w-3.5 h-3.5 text-blue-600" />
                <span>{uploadingCover ? 'Chargement...' : 'Couverture'}</span>
              </button>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverUpload}
                className="hidden"
              />

              {/* Avatar Badge Bottom Left */}
              <div className="absolute bottom-3 left-3 flex items-end gap-3">
                <div className="relative">
                  <img
                    src={avatarPhoto}
                    alt="Profil de la communauté"
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md bg-white"
                    referrerPolicy="no-referrer"
                  />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white border-2 border-white flex items-center justify-center shadow-sm transition"
                    title="Changer la photo de profil"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>
                <div className="text-white drop-shadow-sm pb-1">
                  <p className="font-extrabold text-sm leading-tight">
                    {name.trim() || 'Nom de votre communauté'}
                  </p>
                  <p className="text-[11px] text-slate-200">
                    {category} · {privacy === 'public' ? 'Publique' : 'Privée'}
                  </p>
                </div>
              </div>
            </div>

            {/* Cover & Avatar Presets */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-500 mr-1">Couvertures :</span>
                {COMMUNITY_COVER_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setCoverPhoto(preset.url)}
                    className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
                      coverPhoto === preset.url
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-500 mr-1">Avatars :</span>
                {COMMUNITY_AVATAR_PRESETS.map((av) => (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => setAvatarPhoto(av.url)}
                    className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
                      avatarPhoto === av.url
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {av.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Core Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nom de la communauté *
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={120}
                placeholder="Ex : Club Médecine Niamey"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-h-[44px] text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Catégorie *
              </label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full min-h-[44px] text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 text-slate-900 font-medium"
              >
                {COMMUNITY_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Description de la communauté *
            </label>
            <textarea
              required
              rows={3}
              maxLength={2000}
              placeholder="Décrivez la mission, les thématiques et les règles d'échange..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 text-slate-900 resize-none"
            />
          </div>

          {/* Privacy Choice */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Type de confidentialité
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPrivacy('public')}
                className={`p-3.5 rounded-2xl border text-left transition flex items-start gap-3 ${
                  privacy === 'public'
                    ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Globe className={`w-5 h-5 mt-0.5 shrink-0 ${privacy === 'public' ? 'text-blue-600' : 'text-slate-400'}`} />
                <div>
                  <p className="text-xs font-extrabold text-slate-900">Communauté publique</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Tout utilisateur connecté peut découvrir l'espace et consulter les publications.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPrivacy('private');
                  setRequireMemberApproval(true);
                }}
                className={`p-3.5 rounded-2xl border text-left transition flex items-start gap-3 ${
                  privacy === 'private'
                    ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Lock className={`w-5 h-5 mt-0.5 shrink-0 ${privacy === 'private' ? 'text-blue-600' : 'text-slate-400'}`} />
                <div>
                  <p className="text-xs font-extrabold text-slate-900">Communauté privée</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Seuls les membres approuvés voient les publications, médias, membres et événements.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Membership & Governance Controls */}
          <div className="bg-slate-100/80 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-extrabold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Paramètres d'adhésion & de publication</span>
            </p>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                Qui peut publier dans cette communauté ?
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPostPermission('all_members')}
                  className={`min-h-[42px] py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                    postPermission === 'all_members'
                      ? 'bg-white border-blue-600 text-blue-700 shadow-2xs'
                      : 'bg-transparent border-slate-300 text-slate-600'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Tous les membres</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPostPermission('admins_only')}
                  className={`min-h-[42px] py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                    postPermission === 'admins_only'
                      ? 'bg-white border-blue-600 text-blue-700 shadow-2xs'
                      : 'bg-transparent border-slate-300 text-slate-600'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Admins & Modérateurs</span>
                </button>
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/80 cursor-pointer">
              <div className="flex items-center gap-2.5 min-w-0">
                <MessageSquare className="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-900">Validation préalable des publications</p>
                  <p className="text-[11px] text-slate-500">
                    Les publications des membres attendent l'approbation d'un modérateur.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={requirePostApproval}
                onChange={(e) => setRequirePostApproval(e.target.checked)}
                className="w-4 h-4 accent-blue-600 shrink-0"
              />
            </label>

            <label className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/80 cursor-pointer">
              <div className="flex items-center gap-2.5 min-w-0">
                <Users className="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-900">Approbation des nouveaux membres</p>
                  <p className="text-[11px] text-slate-500">
                    Un administrateur ou modérateur autorisé valide chaque adhésion.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={privacy === 'private' ? true : requireMemberApproval}
                disabled={privacy === 'private'}
                onChange={(e) => setRequireMemberApproval(e.target.checked)}
                className="w-4 h-4 accent-blue-600 shrink-0"
              />
            </label>

            <label className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/80 cursor-pointer">
              <div className="flex items-center gap-2.5 min-w-0">
                <EyeOff className="w-4 h-4 text-slate-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-900">Autoriser les publications anonymes</p>
                  <p className="text-[11px] text-slate-500">
                    Permet de poser des questions sensibles sans afficher son identité.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={allowAnonymousPosts}
                onChange={(e) => setAllowAnonymousPosts(e.target.checked)}
                className="w-4 h-4 accent-blue-600 shrink-0"
              />
            </label>
          </div>

          {/* Community Rules Builder */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold text-slate-700">
              Règles de la communauté ({rules.length}/20)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newRuleText}
                onChange={(e) => setNewRuleText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddRule();
                  }
                }}
                placeholder="Ajouter une règle (ex : Pas de publicité non sollicitée)"
                className="flex-1 min-h-[42px] text-xs px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-100/80 focus:bg-white focus:outline-none focus:border-blue-600 text-slate-900"
              />
              <button
                type="button"
                onClick={handleAddRule}
                className="min-h-[42px] px-3.5 py-2 bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter</span>
              </button>
            </div>

            {rules.length > 0 && (
              <ul className="space-y-1.5">
                {rules.map((rule, idx) => (
                  <li
                    key={`${idx}-${rule.slice(0, 12)}`}
                    className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-700"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-blue-600 shrink-0 tabular-nums">{idx + 1}.</span>
                      <span className="truncate">{rule}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRule(idx)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition shrink-0"
                      title="Retirer cette règle"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[44px] px-4 py-2 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || uploadingCover || uploadingAvatar}
              className="min-h-[44px] px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl transition shadow-sm flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Création en cours...' : 'Créer la communauté'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>,
    document.body
  );
}
