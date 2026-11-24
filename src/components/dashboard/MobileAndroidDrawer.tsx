import React, { useEffect } from 'react';
import {
  Award,
  Bookmark,
  ChevronRight,
  Languages,
  LogOut,
  Moon,
  Plus,
  Settings,
  Sun,
  UserCheck,
  X,
} from 'lucide-react';
import { UserProfile } from '../../types';
import { calculateProfileCompletion } from './DashboardWelcomeAndShortcuts';
import { PWAInstallButton } from '../PWAInstallButton';
import ZaureGeometricBackdrop from '../ui/ZaureGeometricBackdrop';
import { ZAURE_ICON_CHIPS, ZAURE_SURFACES } from '../../styles/designSystem';

interface MobileAndroidDrawerProps {
  open: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  joinedCirclesCount: number;
  bookmarkedCount: number;
  themeMode: 'light' | 'dark';
  language: 'fr' | 'ha' | 'en';
  onToggleTheme: () => void;
  onChangeLanguage: (lang: 'fr' | 'ha' | 'en') => void;
  onNavigatePath: (path: string) => void;
  onOpenProfile: () => void;
  onOpenCreateCircle: () => void;
  onRequestSignOut: () => void;
}

export default function MobileAndroidDrawer({
  open,
  onClose,
  currentUser,
  joinedCirclesCount,
  bookmarkedCount,
  themeMode,
  language,
  onToggleTheme,
  onChangeLanguage,
  onNavigatePath,
  onOpenProfile,
  onOpenCreateCircle,
  onRequestSignOut,
}: MobileAndroidDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const completion = calculateProfileCompletion(currentUser);

  const runAndClose = (fn: () => void) => {
    onClose();
    fn();
  };

  return (
    <div
      className="fixed inset-0 z-50 lg:hidden flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Options et paramètres ZAURE"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-[2px] animate-fadeIn"
        onClick={onClose}
      />

      {/* Android Bottom Sheet */}
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200 dark:border-slate-800 zaure-shadow-modal flex flex-col max-h-[85vh] overflow-hidden animate-slideUp pb-safe-nav">
        {/* Hero Header Strip with Geometric Backdrop */}
        <div className="relative overflow-hidden zaure-grad-hero text-white shrink-0">
          <ZaureGeometricBackdrop variant="hero" />
          <div className="relative pt-2.5 pb-0.5 flex justify-center">
            <span className="w-10 h-1.5 rounded-full bg-white/40" />
          </div>

          <div className="relative px-4 py-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => runAndClose(onOpenProfile)}
              className="flex items-center gap-3 min-w-0 text-left flex-1"
            >
              {currentUser.avatar_url ? (
                <img
                  src={currentUser.avatar_url}
                  alt={currentUser.nom}
                  className="w-11 h-11 rounded-full object-cover ring-2 ring-white/90 shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-white/20 text-white font-bold flex items-center justify-center ring-2 ring-white/80 shrink-0">
                  {currentUser.nom.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-white truncate">
                  {currentUser.nom}
                </p>
                <p className="text-[11px] text-blue-100 truncate">
                  Profil complété à {completion.percent}% · {joinedCirclesCount} cercle{joinedCirclesCount > 1 ? 's' : ''}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="min-h-[44px] min-w-[44px] rounded-full text-white/90 hover:bg-white/15 flex items-center justify-center transition shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sheet Actions */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          <button
            type="button"
            onClick={() => runAndClose(onOpenCreateCircle)}
            className={`w-full min-h-[48px] px-4 py-2.5 rounded-2xl ${ZAURE_SURFACES.gradientButton} justify-between text-xs`}
          >
            <span className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </span>
              <span>Créer un Cercle de Savoir</span>
            </span>
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => runAndClose(() => onNavigatePath('/bookmarks'))}
            className="w-full min-h-[48px] px-3 py-2 rounded-2xl text-slate-800 dark:text-slate-200 hover:bg-blue-50/70 dark:hover:bg-slate-800 font-semibold text-xs flex items-center justify-between transition"
          >
            <span className="flex items-center gap-3">
              <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${ZAURE_ICON_CHIPS.blue}`}>
                <Bookmark className="w-4 h-4" />
              </span>
              <span>Publications enregistrées</span>
            </span>
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">{bookmarkedCount}</span>
          </button>

          <button
            type="button"
            onClick={() => runAndClose(() => onNavigatePath('/mentors'))}
            className="w-full min-h-[48px] px-3 py-2 rounded-2xl text-slate-800 dark:text-slate-200 hover:bg-blue-50/70 dark:hover:bg-slate-800 font-semibold text-xs flex items-center justify-between transition"
          >
            <span className="flex items-center gap-3">
              <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${ZAURE_ICON_CHIPS.amber}`}>
                <Award className="w-4 h-4" />
              </span>
              <span>Mentors & Professionnels</span>
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          <button
            type="button"
            onClick={() => runAndClose(() => onNavigatePath('/settings/compte'))}
            className="w-full min-h-[48px] px-3 py-2 rounded-2xl text-slate-800 dark:text-slate-200 hover:bg-blue-50/70 dark:hover:bg-slate-800 font-semibold text-xs flex items-center justify-between transition"
          >
            <span className="flex items-center gap-3">
              <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${ZAURE_ICON_CHIPS.emerald}`}>
                <UserCheck className="w-4 h-4" />
              </span>
              <span>Compléter mon profil ({completion.percent}%)</span>
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          <button
            type="button"
            onClick={() => runAndClose(() => onNavigatePath('/settings'))}
            className="w-full min-h-[48px] px-3 py-2 rounded-2xl text-slate-800 dark:text-slate-200 hover:bg-blue-50/70 dark:hover:bg-slate-800 font-semibold text-xs flex items-center justify-between transition"
          >
            <span className="flex items-center gap-3">
              <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${ZAURE_ICON_CHIPS.indigo}`}>
                <Settings className="w-4 h-4" />
              </span>
              <span>Paramètres du compte</span>
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* Preferences */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onToggleTheme}
              className="min-h-[44px] px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2 transition"
            >
              {themeMode === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span>Mode clair</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-blue-600" />
                  <span>Mode sombre</span>
                </>
              )}
            </button>

            <div className="min-h-[44px] px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-between gap-2">
              <Languages className="w-4 h-4 text-blue-600 shrink-0" />
              <select
                value={language}
                onChange={(e) => onChangeLanguage(e.target.value as 'fr' | 'ha' | 'en')}
                className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none w-full"
                aria-label="Langue"
              >
                <option value="fr" className="dark:bg-slate-900">Français</option>
                <option value="ha" className="dark:bg-slate-900">Hausa</option>
                <option value="en" className="dark:bg-slate-900">English</option>
              </select>
            </div>
          </div>

          <div className="pt-1 flex items-center gap-2">
            <PWAInstallButton />
          </div>

          <button
            type="button"
            onClick={() => runAndClose(onRequestSignOut)}
            className="w-full min-h-[46px] px-3.5 py-2.5 rounded-2xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 font-bold text-xs flex items-center justify-center gap-2 border border-red-200/70 dark:border-red-900/50 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Se déconnecter</span>
          </button>
        </div>
      </div>
    </div>
  );
}
