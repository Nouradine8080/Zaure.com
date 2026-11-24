import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Camera,
  Globe,
  Lock,
  Plus,
  Trash2,
  UsersRound,
  ShieldCheck,
  Image as ImageIcon
} from 'lucide-react';
import { CirclePostPermission, CircleVisibility } from '../../types';
import { compressImageFile } from '../../utils/imageCompressor';
import { ALL_CREATE_CIRCLE_CATEGORIES } from './circleHelpers';
import ZaureGeometricBackdrop from '../ui/ZaureGeometricBackdrop';
import { ZAURE_SURFACES } from '../../styles/designSystem';

export interface CreateCircleFormPayload {
  nom: string;
  description: string;
  categorie: string;
  image: string;
  cover_image: string;
  visibility: CircleVisibility;
  rules: string[];
  post_permission: CirclePostPermission;
}

interface CreateCircleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateCircleFormPayload) => Promise<void>;
}

const PRESET_THEMES = [
  {
    name: 'Santé',
    cat: 'Santé',
    logo: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=400',
    cover: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&q=80&w=900'
  },
  {
    name: 'Tech & IA',
    cat: 'Technologie',
    logo: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=400',
    cover: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=900'
  },
  {
    name: 'Éducation',
    cat: 'Éducation',
    logo: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=400',
    cover: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&q=80&w=900'
  },
  {
    name: 'Actualités',
    cat: 'Actualités',
    logo: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=400',
    cover: 'https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&q=80&w=900'
  }
];

export default function CreateCircleModal({
  isOpen,
  onClose,
  onSubmit
}: CreateCircleModalProps) {
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [categorie, setCategorie] = useState<string>('Santé');
  const [visibility, setVisibility] = useState<CircleVisibility>('public');
  const [postPermission, setPostPermission] = useState<CirclePostPermission>('all_members');
  const [coverImage, setCoverImage] = useState(PRESET_THEMES[0].cover);
  const [logoImage, setLogoImage] = useState(PRESET_THEMES[0].logo);
  const [rules, setRules] = useState<string[]>([
    'Respect mutuel et bienveillance entre membres.',
    'Partage de connaissances, ressources et expériences constructives.'
  ]);
  const [newRuleInput, setNewRuleInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const compressed = await compressImageFile(file, 840, 420, 0.78);
      if (compressed.length > 340000) {
        setError('Image de couverture trop volumineuse après compression.');
        return;
      }
      setCoverImage(compressed);
    } catch {
      setError("Impossible de charger l'image de couverture.");
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const compressed = await compressImageFile(file, 320, 320, 0.8);
      if (compressed.length > 340000) {
        setError('Logo trop volumineux après compression.');
        return;
      }
      setLogoImage(compressed);
    } catch {
      setError('Impossible de charger le logo du cercle.');
    }
  };

  const handleAddRule = () => {
    const clean = newRuleInput.trim().slice(0, 220);
    if (!clean) return;
    if (rules.length >= 20) return;
    setRules((prev) => [...prev, clean]);
    setNewRuleInput('');
  };

  const handleRemoveRule = (index: number) => {
    setRules((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (nom.trim().length < 2) {
      setError('Le nom du cercle doit contenir au moins 2 caractères.');
      return;
    }
    if (!description.trim()) {
      setError('Veuillez décrire la vocation et les échanges du cercle.');
      return;
    }

    setIsSubmitting(true);
    try {
      const finalRules = newRuleInput.trim()
        ? [...rules, newRuleInput.trim().slice(0, 220)].slice(0, 20)
        : rules;

      await onSubmit({
        nom: nom.trim(),
        description: description.trim(),
        categorie: categorie.trim() || 'Technologie',
        image: logoImage || coverImage,
        cover_image: coverImage || logoImage,
        visibility,
        rules: finalRules,
        post_permission: postPermission
      });

      setNom('');
      setDescription('');
      setNewRuleInput('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la création du cercle.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn overflow-y-auto"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        className={`${ZAURE_SURFACES.modalPanel} max-w-xl w-full my-auto overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative overflow-hidden zaure-grad-hero px-5 py-4 flex items-center justify-between text-white">
          <ZaureGeometricBackdrop variant="hero" />
          <div className="relative flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/20 border border-white/20 flex items-center justify-center shrink-0">
              <UsersRound className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-base leading-tight">Créer un cercle</h3>
              <p className="text-[11px] text-blue-100 truncate">
                Rassemblez une communauté autour d&apos;un sujet commun
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="relative w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="p-5 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs font-semibold text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Cover & Circular Logo */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Image de couverture & Logo du cercle
            </label>
            <div className="relative h-28 sm:h-32 rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-700">
              <img
                src={coverImage}
                alt="Couverture du cercle"
                className="w-full h-full object-cover opacity-85"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />

              {/* Logo overlap bottom-left */}
              <div className="absolute bottom-2.5 left-3 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  title="Changer la photo / logo du cercle"
                  className="relative w-14 h-14 rounded-full border-2 border-white shadow-md overflow-hidden bg-white group"
                >
                  <img
                    src={logoImage}
                    alt="Logo du cercle"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute inset-0 bg-slate-950/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                    <Camera className="w-4 h-4 text-white" />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="px-2.5 py-1 rounded-full bg-slate-950/70 hover:bg-slate-950/90 text-white text-[10.5px] font-bold border border-white/20 transition"
                >
                  Logo
                </button>
              </div>

              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="absolute bottom-2.5 right-3 px-3 py-1.5 bg-white/95 hover:bg-white text-slate-900 text-[11px] font-bold rounded-full shadow-sm flex items-center gap-1.5 transition"
              >
                <ImageIcon className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Couverture</span>
              </button>

              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverUpload}
                className="hidden"
              />
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </div>

            {/* Quick Theme Presets */}
            <div className="grid grid-cols-4 gap-1.5 mt-2">
              {PRESET_THEMES.map((theme) => (
                <button
                  key={theme.name}
                  type="button"
                  onClick={() => {
                    setLogoImage(theme.logo);
                    setCoverImage(theme.cover);
                    if (!nom) setCategorie(theme.cat);
                  }}
                  className={`text-[10px] font-semibold p-1.5 border rounded-xl truncate transition ${
                    logoImage === theme.logo
                      ? 'border-[#2563EB] bg-blue-50 dark:bg-blue-950/60 text-[#2563EB] dark:text-blue-300 font-bold'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {theme.name}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Nom du cercle *
            </label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={120}
              placeholder="Ex : Médecine Générale, Tech & Innovation, Études & Réussite..."
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-[#2563EB] text-slate-800 dark:text-slate-100 bg-[#F3F6FB] dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Description *
            </label>
            <textarea
              required
              maxLength={1000}
              rows={3}
              placeholder="Décrivez l'objectif du cercle, les sujets abordés et ce que les membres y trouveront."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-[#2563EB] text-slate-800 dark:text-slate-100 bg-[#F3F6FB] dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 resize-none"
            />
          </div>

          {/* Category & Post Permission */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Catégorie
              </label>
              <select
                value={categorie}
                onChange={(e) => setCategorie(e.target.value)}
                className="w-full text-xs bg-[#F3F6FB] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl focus:outline-none focus:border-[#2563EB] text-slate-800 dark:text-slate-100 font-medium"
              >
                {ALL_CREATE_CIRCLE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Autorisations de publication
              </label>
              <select
                value={postPermission}
                onChange={(e) => setPostPermission(e.target.value as CirclePostPermission)}
                className="w-full text-xs bg-[#F3F6FB] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl focus:outline-none focus:border-[#2563EB] text-slate-800 dark:text-slate-100 font-medium"
              >
                <option value="all_members">Tous les membres</option>
                <option value="admins_only">Admins & Modérateurs uniquement</option>
              </select>
            </div>
          </div>

          {/* Visibility Public vs Private */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Visibilité du cercle
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={`p-3 rounded-2xl border text-left transition flex items-start gap-2.5 ${
                  visibility === 'public'
                    ? 'border-[#2563EB] bg-blue-50/70 dark:bg-blue-950/40 ring-1 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Globe className={`w-4 h-4 mt-0.5 shrink-0 ${visibility === 'public' ? 'text-[#2563EB]' : 'text-slate-400'}`} />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Public</p>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                    Tout le monde peut rejoindre librement
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`p-3 rounded-2xl border text-left transition flex items-start gap-2.5 ${
                  visibility === 'private'
                    ? 'border-[#2563EB] bg-blue-50/70 dark:bg-blue-950/40 ring-1 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Lock className={`w-4 h-4 mt-0.5 shrink-0 ${visibility === 'private' ? 'text-[#2563EB]' : 'text-slate-400'}`} />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Privé</p>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                    Demande d&apos;adhésion validée par un admin
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Circle Rules */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Règles du cercle</span>
            </label>
            <div className="space-y-1.5 mb-2">
              {rules.map((rule, idx) => (
                <div
                  key={`${idx}-${rule.slice(0, 12)}`}
                  className="flex items-center justify-between gap-2 bg-[#F3F6FB] dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                >
                  <span className="text-slate-700 dark:text-slate-200 truncate">
                    {idx + 1}. {rule}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveRule(idx)}
                    aria-label="Supprimer cette règle"
                    className="p-1 text-slate-400 hover:text-red-600 rounded-lg shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Ajouter une règle (ex : Pas de spam)..."
                value={newRuleInput}
                onChange={(e) => setNewRuleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddRule();
                  }
                }}
                className="flex-1 text-xs px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-[#F3F6FB] dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#2563EB]"
              />
              <button
                type="button"
                onClick={handleAddRule}
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter</span>
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[42px] px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`min-h-[42px] px-6 py-2 ${ZAURE_SURFACES.primaryButton} disabled:opacity-50 text-xs`}
            >
              {isSubmitting ? 'Création...' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
