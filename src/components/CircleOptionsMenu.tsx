import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  MoreVertical,
  Share2,
  Check,
  Bell,
  BellOff,
  Bookmark,
  Settings2,
  Trash2,
  LogIn,
  LogOut,
  Info,
  ShieldCheck,
  Plus,
  ArrowRight,
  X,
  Camera,
  AlertTriangle,
  Globe,
  Lock,
  Image as ImageIcon,
  Calendar,
  Clock
} from 'lucide-react';
import { Circle, CirclePostPermission, CircleVisibility, UserProfile } from '../types';
import { compressImageFile } from '../utils/imageCompressor';
import { ALL_CREATE_CIRCLE_CATEGORIES } from './circles/circleHelpers';

export interface CircleLocalPrefs {
  muted: boolean;
  pinned: boolean;
}

const PREFS_EVENT = 'zaure-circle-prefs-updated';

const getStorageKey = (userId?: string) => `zaure_circle_prefs_${userId || 'guest'}`;

export function readCirclePrefs(circleId: string, userId?: string): CircleLocalPrefs {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return { muted: false, pinned: false };
    const parsed = JSON.parse(raw) as Record<string, Partial<CircleLocalPrefs>>;
    const entry = parsed?.[circleId];
    return {
      muted: Boolean(entry?.muted),
      pinned: Boolean(entry?.pinned)
    };
  } catch {
    return { muted: false, pinned: false };
  }
}

export function writeCirclePrefs(circleId: string, prefs: CircleLocalPrefs, userId?: string) {
  try {
    const key = getStorageKey(userId);
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as Record<string, CircleLocalPrefs>) : {};
    parsed[circleId] = prefs;
    localStorage.setItem(key, JSON.stringify(parsed));
    window.dispatchEvent(new CustomEvent(PREFS_EVENT, { detail: { circleId, prefs } }));
  } catch {
    // ignore storage errors
  }
}

const PRESET_COVERS = [
  {
    name: 'Santé Sahel',
    url: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=600'
  },
  {
    name: 'Langues & Haoussa',
    url: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=600'
  },
  {
    name: 'Agro-écologie',
    url: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=600'
  },
  {
    name: 'Sciences',
    url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=600'
  }
];

interface CircleOptionsMenuProps {
  circle: Circle;
  isJoined: boolean;
  isPending?: boolean;
  currentUser: UserProfile | null;
  variant?: 'header' | 'card';
  onOpenCircle?: () => void;
  onOpenPublish?: () => void;
  onSelectTab?: (tab: 'feed' | 'about' | 'members' | 'media' | 'events') => void;
  onToggleJoin: () => Promise<void> | void;
  onUpdateCircle?: (
    circleId: string,
    updates: {
      nom: string;
      description: string;
      categorie: string;
      image: string;
      cover_image?: string;
      visibility?: CircleVisibility;
      post_permission?: CirclePostPermission;
      rules?: string[];
    }
  ) => Promise<void>;
  onDeleteCircle?: (circleId: string) => Promise<void>;
}

export default function CircleOptionsMenu({
  circle,
  isJoined,
  isPending = false,
  currentUser,
  variant = 'header',
  onOpenCircle,
  onOpenPublish,
  onSelectTab,
  onToggleJoin,
  onUpdateCircle,
  onDeleteCircle
}: CircleOptionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [prefs, setPrefs] = useState<CircleLocalPrefs>(() => readCirclePrefs(circle.id, currentUser?.id));

  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Edit form state
  const [editNom, setEditNom] = useState(circle.nom);
  const [editCategorie, setEditCategorie] = useState(circle.categorie);
  const [editDescription, setEditDescription] = useState(circle.description);
  const [editImage, setEditImage] = useState(circle.image);
  const [editCoverImage, setEditCoverImage] = useState(circle.cover_image || circle.image);
  const [editVisibility, setEditVisibility] = useState<CircleVisibility>(circle.visibility || 'public');
  const [editPostPerm, setEditPostPerm] = useState<CirclePostPermission>(circle.post_permission || 'all_members');
  const [editRulesText, setEditRulesText] = useState((circle.rules || []).join('\n'));
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = currentUser?.email?.toLowerCase() === 'mahamadougarbamoussa8080@gmail.com';
  const isCreator = Boolean(currentUser && circle.created_by && circle.created_by === currentUser.id);
  const canManageCircle = Boolean(currentUser && (isCreator || isAdmin));
  const isPrivate = circle.visibility === 'private';

  useEffect(() => {
    setPrefs(readCirclePrefs(circle.id, currentUser?.id));
  }, [circle.id, currentUser?.id]);

  useEffect(() => {
    const handlePrefsSync = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (!detail || detail.circleId === circle.id) {
        setPrefs(readCirclePrefs(circle.id, currentUser?.id));
      }
    };
    window.addEventListener(PREFS_EVENT, handlePrefsSync);
    return () => window.removeEventListener(PREFS_EVENT, handlePrefsSync);
  }, [circle.id, currentUser?.id]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const openEditModal = () => {
    setEditNom(circle.nom);
    setEditCategorie(circle.categorie);
    setEditDescription(circle.description);
    setEditImage(circle.image);
    setEditCoverImage(circle.cover_image || circle.image);
    setEditVisibility(circle.visibility || 'public');
    setEditPostPerm(circle.post_permission || 'all_members');
    setEditRulesText((circle.rules || []).join('\n'));
    setEditError(null);
    setIsOpen(false);
    setShowEditModal(true);
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/circles/${encodeURIComponent(circle.id)}`;
    try {
      await navigator.clipboard?.writeText?.(shareUrl);
    } catch {
      // ignore clipboard fallback
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const toggleMute = () => {
    const next: CircleLocalPrefs = { ...prefs, muted: !prefs.muted };
    setPrefs(next);
    writeCirclePrefs(circle.id, next, currentUser?.id);
  };

  const togglePin = () => {
    const next: CircleLocalPrefs = { ...prefs, pinned: !prefs.pinned };
    setPrefs(next);
    writeCirclePrefs(circle.id, next, currentUser?.id);
  };

  const handleJoinAction = async () => {
    if (isJoined) {
      setIsOpen(false);
      setShowLeaveModal(true);
      return;
    }
    setIsOpen(false);
    await onToggleJoin();
  };

  const confirmLeave = async () => {
    setIsProcessingAction(true);
    try {
      await onToggleJoin();
      setShowLeaveModal(false);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const confirmDelete = async () => {
    if (!onDeleteCircle) return;
    setIsProcessingAction(true);
    try {
      await onDeleteCircle(circle.id);
      setShowDeleteModal(false);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditError(null);
    try {
      const compressed = await compressImageFile(file, 720, 405, 0.78);
      if (compressed.length > 340000) {
        setEditError('Image de couverture trop volumineuse après compression.');
        return;
      }
      setEditCoverImage(compressed);
    } catch {
      setEditError("Impossible de traiter cette image.");
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditError(null);
    try {
      const compressed = await compressImageFile(file, 300, 300, 0.8);
      if (compressed.length > 340000) {
        setEditError('Logo trop volumineux après compression.');
        return;
      }
      setEditImage(compressed);
    } catch {
      setEditError("Impossible de traiter cette image.");
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateCircle) return;
    if (editNom.trim().length < 2) {
      setEditError('Le nom du cercle doit contenir au moins 2 caractères.');
      return;
    }
    if (editDescription.trim().length < 1) {
      setEditError('La description du cercle est obligatoire.');
      return;
    }
    setIsSavingEdit(true);
    setEditError(null);
    try {
      const parsedRules = editRulesText
        .split('\n')
        .map((r) => r.trim())
        .filter((r) => r.length > 0)
        .slice(0, 20);
      await onUpdateCircle(circle.id, {
        nom: editNom.trim(),
        categorie: editCategorie.trim() || 'Technologie',
        description: editDescription.trim(),
        image: editImage.trim() || circle.image,
        cover_image: editCoverImage.trim() || editImage.trim() || circle.image,
        visibility: editVisibility,
        post_permission: editPostPerm,
        rules: parsedRules
      });
      setShowEditModal(false);
    } catch (err: any) {
      setEditError(err?.message || 'Erreur lors de la mise à jour du cercle.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div
      ref={menuRef}
      className="relative"
      onClick={(e) => e.stopPropagation()}
    >
      {/* 3-DOT TRIGGER BUTTON */}
      {variant === 'card' ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          aria-label={`Paramètres du cercle ${circle.nom}`}
          title="Paramètres et options du cercle"
          className="w-8 h-8 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition active:scale-95"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          aria-label={`Paramètres du cercle ${circle.nom}`}
          title="Paramètres et options du cercle"
          id="btn-circle-settings-menu"
          className={`min-h-[40px] px-3 py-2 rounded-xl border transition flex items-center gap-1.5 text-xs font-bold active:scale-95 ${
            isOpen
              ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300'
              : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
          }`}
        >
          <MoreVertical className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">Paramètres</span>
        </button>
      )}

      {/* DROPDOWN PANEL GROUPING ALL CIRCLE OPTIONS */}
      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 sm:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-40 overflow-hidden animate-fadeIn text-left"
        >
          {/* Dropdown Header */}
          <div className="px-4 py-3 bg-[#F3F6FB] dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Options du cercle
              </p>
              <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate mt-0.5">{circle.nom}</p>
            </div>
            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-blue-700 dark:text-blue-400 shrink-0">
              {isCreator ? 'Créateur' : isAdmin ? 'Admin' : isJoined ? 'Membre' : isPending ? 'En attente' : isPrivate ? 'Privé' : 'Public'}
            </span>
          </div>

          <div className="p-1.5 space-y-1 max-h-[75vh] overflow-y-auto">
            {/* Group 1: Navigation & Actions */}
            {variant === 'card' && onOpenCircle && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  onOpenCircle();
                }}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 hover:bg-[#F0F2F5] flex items-center justify-between gap-2.5 transition"
              >
                <span className="flex items-center gap-2.5">
                  <ArrowRight className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Ouvrir le cercle</span>
                </span>
              </button>
            )}

            {variant === 'header' && onOpenPublish && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  onOpenPublish();
                }}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 hover:bg-[#F0F2F5] flex items-center gap-2.5 transition"
              >
                <Plus className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Publier une capsule</span>
              </button>
            )}

            {variant === 'header' && onSelectTab && (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsOpen(false);
                    onSelectTab('about');
                  }}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-[#F3F6FB] dark:hover:bg-slate-800 flex items-center gap-2.5 transition"
                >
                  <Info className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>À propos du cercle</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsOpen(false);
                    onSelectTab('members');
                  }}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-[#F3F6FB] dark:hover:bg-slate-800 flex items-center gap-2.5 transition"
                >
                  <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>Membres & Modération</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsOpen(false);
                    onSelectTab('media');
                  }}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-[#F3F6FB] dark:hover:bg-slate-800 flex items-center gap-2.5 transition"
                >
                  <ImageIcon className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>Médias partagés</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsOpen(false);
                    onSelectTab('events');
                  }}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-[#F3F6FB] dark:hover:bg-slate-800 flex items-center gap-2.5 transition"
                >
                  <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>Événements</span>
                </button>
              </>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={handleShare}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 hover:bg-[#F0F2F5] flex items-center justify-between gap-2.5 transition"
            >
              <span className="flex items-center gap-2.5">
                {copied ? (
                  <Check className="w-4 h-4 text-blue-600 shrink-0" />
                ) : (
                  <Share2 className="w-4 h-4 text-blue-600 shrink-0" />
                )}
                <span>{copied ? 'Lien copié !' : 'Partager ce cercle'}</span>
              </span>
              {copied && (
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                  OK
                </span>
              )}
            </button>

            <div className="my-1 border-t border-slate-100" />

            {/* Group 2: Personal Preferences */}
            <button
              type="button"
              role="menuitem"
              onClick={toggleMute}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 hover:bg-[#F0F2F5] flex items-center justify-between gap-2.5 transition"
            >
              <span className="flex items-center gap-2.5">
                {prefs.muted ? (
                  <BellOff className="w-4 h-4 text-red-600 shrink-0" />
                ) : (
                  <Bell className="w-4 h-4 text-blue-600 shrink-0" />
                )}
                <span>Notifications du cercle</span>
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  prefs.muted ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'
                }`}
              >
                {prefs.muted ? 'Sourdine' : 'Activées'}
              </span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={togglePin}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 hover:bg-[#F0F2F5] flex items-center justify-between gap-2.5 transition"
            >
              <span className="flex items-center gap-2.5">
                <Bookmark
                  className={`w-4 h-4 shrink-0 ${
                    prefs.pinned ? 'text-blue-600 fill-blue-600' : 'text-slate-500'
                  }`}
                />
                <span>{prefs.pinned ? 'Retirer des favoris' : 'Épingler en favori'}</span>
              </span>
              {prefs.pinned && (
                <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">
                  Épinglé
                </span>
              )}
            </button>

            <div className="my-1 border-t border-slate-100" />

            {/* Group 3: Membership & Management */}
            {canManageCircle && onUpdateCircle && (
              <button
                type="button"
                role="menuitem"
                onClick={openEditModal}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 hover:bg-[#F0F2F5] flex items-center gap-2.5 transition"
              >
                <Settings2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Modifier les infos du cercle</span>
              </button>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={handleJoinAction}
              className={`w-full min-h-[42px] px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 transition ${
                isJoined
                  ? 'text-slate-700 dark:text-slate-200 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700'
                  : isPending
                    ? 'text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                    : 'text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40'
              }`}
            >
              {isJoined ? (
                <>
                  <LogOut className="w-4 h-4 text-red-600 shrink-0" />
                  <span>Quitter ce cercle</span>
                </>
              ) : isPending ? (
                <>
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Annuler la demande</span>
                </>
              ) : isPrivate ? (
                <>
                  <Lock className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Demander à rejoindre</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Rejoindre ce cercle</span>
                </>
              )}
            </button>

            {canManageCircle && onDeleteCircle && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  setShowDeleteModal(true);
                }}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition"
              >
                <Trash2 className="w-4 h-4 text-red-600 shrink-0" />
                <span>Supprimer ce cercle</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* IN-APP MODAL 1: EDIT CIRCLE SETTINGS */}
      {showEditModal &&
        createPortal(
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn"
            onClick={(e) => {
              e.stopPropagation();
              if (!isSavingEdit) setShowEditModal(false);
            }}
          >
            <div
              className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Settings2 className="w-4 h-4" />
                  </div>
                  <h3 className="font-extrabold text-slate-950 text-base">Paramètres du cercle</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  disabled={isSavingEdit}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4 mt-4">
                {editError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                    {editError}
                  </div>
                )}

                {/* Cover + Logo previews */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Image de couverture
                    </label>
                    <div className="relative h-28 rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <img
                        src={editCoverImage || editImage || circle.image}
                        alt={editNom}
                        className="w-full h-full object-cover opacity-85"
                        referrerPolicy="no-referrer"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-2 right-2 px-3 py-1.5 bg-white/95 hover:bg-white text-slate-900 text-[11px] font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition"
                      >
                        <Camera className="w-3.5 h-3.5 text-blue-600" />
                        <span>Changer la couverture</span>
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleCoverUpload}
                        className="hidden"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#F3F6FB] dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700">
                    <img
                      src={editImage || circle.image}
                      alt={editNom}
                      className="w-12 h-12 rounded-full object-cover ring-2 ring-blue-500/30 shrink-0 bg-white"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100">Logo / Photo de profil du cercle</p>
                      <p className="text-[10px] text-slate-500">Affiché dans la grille et l&apos;en-tête</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-blue-600 hover:bg-blue-50 transition shrink-0"
                    >
                      Modifier
                    </button>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {PRESET_COVERS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => {
                          setEditCoverImage(preset.url);
                          setEditImage(preset.url);
                        }}
                        className={`text-[9px] font-semibold p-1.5 border rounded-xl truncate transition ${
                          editImage === preset.url
                            ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Nom du cercle
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={120}
                    value={editNom}
                    onChange={(e) => setEditNom(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-100 bg-[#F3F6FB] dark:bg-slate-800 focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Catégorie
                    </label>
                    <select
                      value={editCategorie}
                      onChange={(e) => setEditCategorie(e.target.value)}
                      className="w-full text-xs bg-[#F3F6FB] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-100"
                    >
                      {ALL_CREATE_CIRCLE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      {!ALL_CREATE_CIRCLE_CATEGORIES.includes(editCategorie as any) && (
                        <option value={editCategorie}>{editCategorie}</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Visibilité
                    </label>
                    <select
                      value={editVisibility}
                      onChange={(e) => setEditVisibility(e.target.value as CircleVisibility)}
                      className="w-full text-xs bg-[#F3F6FB] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-100"
                    >
                      <option value="public">Public (accès ouvert)</option>
                      <option value="private">Privé (sur validation)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Autorisations de publication
                  </label>
                  <select
                    value={editPostPerm}
                    onChange={(e) => setEditPostPerm(e.target.value as CirclePostPermission)}
                    className="w-full text-xs bg-[#F3F6FB] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-100"
                  >
                    <option value="all_members">Tous les membres peuvent publier</option>
                    <option value="admins_only">Admins & Modérateurs uniquement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Description
                  </label>
                  <textarea
                    required
                    maxLength={1000}
                    rows={3}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-100 bg-[#F3F6FB] dark:bg-slate-800 focus:bg-white resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Règles du cercle (une règle par ligne)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Ex : Respect mutuel&#10;Sources vérifiées uniquement"
                    value={editRulesText}
                    onChange={(e) => setEditRulesText(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-100 bg-[#F3F6FB] dark:bg-slate-800 focus:bg-white resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    disabled={isSavingEdit}
                    className="min-h-[40px] px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold transition"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="min-h-[40px] px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition shadow-xs"
                  >
                    {isSavingEdit ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* IN-APP MODAL 2: LEAVE CIRCLE CONFIRMATION */}
      {showLeaveModal &&
        createPortal(
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn"
            onClick={(e) => {
              e.stopPropagation();
              if (!isProcessingAction) setShowLeaveModal(false);
            }}
          >
            <div
              className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl border border-slate-100 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                  <LogOut className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-950 text-sm">Quitter ce cercle ?</h3>
                  <p className="text-xs text-slate-500 truncate max-w-[210px]">{circle.nom}</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Vous ne recevrez plus les nouveautés de ce cercle dans votre fil personnalisé. Vous pourrez le rejoindre à tout moment.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  disabled={isProcessingAction}
                  className="min-h-[42px] px-4 py-2 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={confirmLeave}
                  disabled={isProcessingAction}
                  className="min-h-[42px] px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shadow-xs"
                >
                  {isProcessingAction ? 'Sortie...' : 'Quitter le cercle'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* IN-APP MODAL 3: DELETE CIRCLE CONFIRMATION */}
      {showDeleteModal &&
        createPortal(
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn"
            onClick={(e) => {
              e.stopPropagation();
              if (!isProcessingAction) setShowDeleteModal(false);
            }}
          >
            <div
              className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl border border-slate-100 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-950 text-sm">Supprimer ce cercle ?</h3>
                  <p className="text-xs text-slate-500 truncate max-w-[210px]">{circle.nom}</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Cette action supprimera définitivement le cercle <span className="font-bold text-slate-900">{circle.nom}</span>. Confirmez-vous la suppression ?
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isProcessingAction}
                  className="min-h-[42px] px-4 py-2 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={isProcessingAction}
                  className="min-h-[42px] px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shadow-xs"
                >
                  {isProcessingAction ? 'Suppression...' : 'Oui, supprimer'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
