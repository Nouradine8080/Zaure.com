import React, { useEffect, useRef, useState } from 'react';
import {
  Accessibility,
  AlertCircle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Globe,
  HelpCircle,
  Info,
  Loader2,
  Lock,
  Palette,
  Settings,
  Shield,
  User,
  UserX
} from 'lucide-react';
import { DEFAULT_USER_SETTINGS, UserProfile, UserSettings } from '../types';
import { zaureService } from '../firebaseClient';
import { useTranslation } from '../context/LanguageContext';
import {
  applyAndPersistAppearancePreferences,
  extractAppearancePreferences
} from '../utils/appearancePreferences';
import AccountSection from './settings/AccountSection';
import SecuritySection from './settings/SecuritySection';
import PrivacySection from './settings/PrivacySection';
import NotificationsSection from './settings/NotificationsSection';
import AppearanceSection from './settings/AppearanceSection';
import LanguageSection from './settings/LanguageSection';
import AccessibilitySection from './settings/AccessibilitySection';
import BlockedUsersSection from './settings/BlockedUsersSection';
import HelpSupportSection from './settings/HelpSupportSection';
import AboutSection from './settings/AboutSection';
import { ZaureGeometricBackdrop } from './ui/ZaureGeometricBackdrop';
import { ZAURE_GLOWS, ZAURE_ICON_CHIPS, ZAURE_SURFACES } from '../styles/designSystem';

export type SettingsCategoryId =
  | 'compte'
  | 'securite'
  | 'confidentialite'
  | 'notifications'
  | 'apparence'
  | 'langue'
  | 'accessibilite'
  | 'bloques'
  | 'aide'
  | 'apropos';

interface SettingsViewProps {
  currentUser: UserProfile;
  initialCategory?: SettingsCategoryId;
  onCategoryChange?: (category: SettingsCategoryId) => void;
  onProfileUpdated: (updatedUser: UserProfile) => void;
  onSignOut: () => void;
  onImmediateSignOut?: () => void;
  onOpenOwnProfile?: () => void;
  onOpenUserProfile?: (userId: string) => void;
  onOpenCircles?: () => void;
  onPreferencesApplied?: (
    effectiveTheme: 'light' | 'dark',
    settingsPatch: Partial<UserSettings>
  ) => void;
}

interface CategoryItem {
  id: SettingsCategoryId;
  titleKey: string;
  fallbackTitle: string;
  description: string;
  icon: React.ReactNode;
  accentBg: string;
}

export default function SettingsView({
  currentUser,
  initialCategory = 'compte',
  onCategoryChange,
  onProfileUpdated,
  onSignOut,
  onImmediateSignOut,
  onOpenOwnProfile,
  onOpenUserProfile,
  onOpenCircles,
  onPreferencesApplied
}: SettingsViewProps) {
  const { setLanguage, t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<SettingsCategoryId>(initialCategory);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; tone: 'success' | 'error' } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = (msg: string, tone: 'success' | 'error' = 'success') => {
    setToast({ msg, tone });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3600);
  };

  useEffect(() => {
    if (initialCategory) {
      setActiveCategory(initialCategory);
    }
  }, [initialCategory]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadSettings = async () => {
      setLoading(true);
      try {
        const fetched = await zaureService.getUserSettings(currentUser.id);
        if (cancelled) return;
        const merged: UserSettings = {
          ...DEFAULT_USER_SETTINGS,
          ...fetched,
          nom: fetched.nom || currentUser.nom,
          username: fetched.username || currentUser.username || '',
          email: fetched.email || currentUser.email,
          telephone: fetched.telephone || currentUser.phone || '',
          date_naissance: fetched.date_naissance || currentUser.date_naissance || '',
          bio: fetched.bio ?? (currentUser.bio || ''),
          avatar_url: fetched.avatar_url || currentUser.avatar_url || ''
        };
        setSettings(merged);

        const prefs = extractAppearancePreferences(merged);
        applyAndPersistAppearancePreferences(prefs, currentUser.id, (effectiveTheme) => {
          onPreferencesApplied?.(effectiveTheme, prefs);
        });

        const targetLang = merged.langue_interface || merged.langue_preferee;
        if (targetLang === 'fr' || targetLang === 'en' || targetLang === 'ha') {
          setLanguage(targetLang);
        }
      } catch (e) {
        console.warn('Chargement paramètres:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadSettings();
    return () => {
      cancelled = true;
    };
  }, [currentUser.id]);

  const handleSettingsChangeLocal = (patch: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const handleSaveSettings = async (patch: Partial<UserSettings>): Promise<boolean> => {
    const next = { ...settings, ...patch };
    setSettings(next);
    return zaureService.saveUserSettings(currentUser.id, next);
  };

  const categories: CategoryItem[] = [
    {
      id: 'compte',
      titleKey: 'settings.cat.account',
      fallbackTitle: 'Mon compte',
      description: 'Nom, @identifiant, e-mail, téléphone, photo et profil personnel',
      icon: <User className="w-5 h-5" />,
      accentBg: ZAURE_ICON_CHIPS.blue
    },
    {
      id: 'securite',
      titleKey: 'settings.cat.security',
      fallbackTitle: 'Sécurité',
      description: 'Mot de passe, vérification e-mail, appareils actifs et 2FA',
      icon: <Lock className="w-5 h-5" />,
      accentBg: ZAURE_ICON_CHIPS.emerald
    },
    {
      id: 'confidentialite',
      titleKey: 'settings.cat.privacy',
      fallbackTitle: 'Confidentialité',
      description: 'Visibilité du profil, messages, commentaires et mentions',
      icon: <Shield className="w-5 h-5" />,
      accentBg: ZAURE_ICON_CHIPS.indigo
    },
    {
      id: 'notifications',
      titleKey: 'settings.cat.notifications',
      fallbackTitle: 'Notifications',
      description: 'Réactions, mentions, messages, communautés et alertes Push',
      icon: <Bell className="w-5 h-5" />,
      accentBg: ZAURE_ICON_CHIPS.amber
    },
    {
      id: 'apparence',
      titleKey: 'settings.cat.appearance',
      fallbackTitle: 'Apparence',
      description: 'Thème clair, sombre, automatique système, densité et données',
      icon: <Palette className="w-5 h-5" />,
      accentBg: ZAURE_ICON_CHIPS.violet
    },
    {
      id: 'langue',
      titleKey: 'settings.cat.language',
      fallbackTitle: 'Langue',
      description: 'Français, English, Hausa et traduction des capsules',
      icon: <Globe className="w-5 h-5" />,
      accentBg: ZAURE_ICON_CHIPS.sky
    },
    {
      id: 'accessibilite',
      titleKey: 'settings.cat.accessibility',
      fallbackTitle: 'Accessibilité',
      description: 'Taille du texte, contraste élevé, animations et lisibilité',
      icon: <Accessibility className="w-5 h-5" />,
      accentBg: ZAURE_ICON_CHIPS.emerald
    },
    {
      id: 'bloques',
      titleKey: 'settings.cat.blocked',
      fallbackTitle: 'Utilisateurs bloqués',
      description: `${(settings.utilisateurs_bloques || []).length} compte(s) bloqué(s) · Déblocage`,
      icon: <UserX className="w-5 h-5" />,
      accentBg: ZAURE_ICON_CHIPS.rose
    },
    {
      id: 'aide',
      titleKey: 'settings.cat.help',
      fallbackTitle: 'Aide et assistance',
      description: 'FAQ, support technique, signalement et confidentialité',
      icon: <HelpCircle className="w-5 h-5" />,
      accentBg: ZAURE_ICON_CHIPS.amber
    },
    {
      id: 'apropos',
      titleKey: 'settings.cat.about',
      fallbackTitle: 'À propos de ZAURE',
      description: 'Mission, cercles, documents légaux, déconnexion et compte',
      icon: <Info className="w-5 h-5" />,
      accentBg: ZAURE_ICON_CHIPS.blue
    }
  ];

  const getCategoryTitle = (cat: CategoryItem) => {
    const translated = t(cat.titleKey);
    return translated !== cat.titleKey ? translated : cat.fallbackTitle;
  };

  const activeCategoryObj =
    categories.find((c) => c.id === activeCategory) || categories[0];

  const handleSelectCategory = (id: SettingsCategoryId) => {
    setActiveCategory(id);
    onCategoryChange?.(id);
    setMobileShowDetail(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderActiveSection = () => {
    if (loading) {
      return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
          <p className="text-xs font-semibold">Chargement de vos paramètres...</p>
        </div>
      );
    }

    switch (activeCategory) {
      case 'compte':
        return (
          <AccountSection
            currentUser={currentUser}
            settings={settings}
            onProfileUpdated={onProfileUpdated}
            onSettingsChange={handleSettingsChangeLocal}
            onNotify={showToast}
          />
        );
      case 'securite':
        return <SecuritySection currentUser={currentUser} onNotify={showToast} />;
      case 'confidentialite':
        return (
          <PrivacySection
            currentUser={currentUser}
            settings={settings}
            onProfileUpdated={onProfileUpdated}
            onSaveSettings={handleSaveSettings}
            onNotify={showToast}
          />
        );
      case 'notifications':
        return (
          <NotificationsSection
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onNotify={showToast}
          />
        );
      case 'apparence':
        return (
          <AppearanceSection
            userId={currentUser.id}
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onPreferencesApplied={onPreferencesApplied}
            onNotify={showToast}
          />
        );
      case 'langue':
        return (
          <LanguageSection
            currentUser={currentUser}
            settings={settings}
            onProfileUpdated={onProfileUpdated}
            onSaveSettings={handleSaveSettings}
            onNotify={showToast}
          />
        );
      case 'accessibilite':
        return (
          <AccessibilitySection
            userId={currentUser.id}
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onPreferencesApplied={onPreferencesApplied}
            onNotify={showToast}
          />
        );
      case 'bloques':
        return (
          <BlockedUsersSection
            settings={settings}
            onSettingsChange={handleSettingsChangeLocal}
            onOpenUserProfile={onOpenUserProfile}
            onNotify={showToast}
          />
        );
      case 'aide':
        return <HelpSupportSection currentUser={currentUser} onNotify={showToast} />;
      case 'apropos':
        return (
          <AboutSection
            currentUser={currentUser}
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onSignOut={onSignOut}
            onImmediateSignOut={onImmediateSignOut}
            onOpenCircles={onOpenCircles}
            onNotify={showToast}
          />
        );
      default:
        return null;
    }
  };

  const settingsHeading = t('settings.title') !== 'settings.title' ? t('settings.title') : 'Paramètres';

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 pb-20 space-y-5">
      {/* En-tête principal « Paramètres » */}
      <div className={`${ZAURE_SURFACES.sectionHeroBanner} flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
        <ZaureGeometricBackdrop variant="hero" />
        <div className="relative z-10 flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 backdrop-blur-xs text-white flex items-center justify-center shrink-0">
            <Settings className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              {settingsHeading}
            </h1>
            <p className="text-xs sm:text-[13px] text-blue-100/90 truncate">
              Gérez votre compte, votre sécurité, votre confidentialité et votre expérience ZAURE
            </p>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-3 shrink-0">
          {onOpenOwnProfile && (
            <button
              type="button"
              onClick={onOpenOwnProfile}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-white text-blue-700 hover:bg-blue-50 text-xs font-bold shadow-sm flex items-center gap-2 transition"
            >
              <img
                src={
                  currentUser.avatar_url ||
                  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                    currentUser.nom
                  )}`
                }
                alt={currentUser.nom}
                className="w-6 h-6 rounded-full object-cover ring-1 ring-blue-200"
              />
              <span>Voir mon profil</span>
              <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
            </button>
          )}
        </div>
      </div>

      {/* Layout principal : navigation latérale (desktop) + liste/détail Android-friendly (mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Colonne navigation catégories */}
        <aside
          className={`lg:col-span-4 xl:col-span-4 lg:sticky lg:top-20 ${
            mobileShowDetail ? 'hidden lg:block' : 'block'
          }`}
        >
          <div className={`${ZAURE_SURFACES.card} p-2.5 sm:p-3 space-y-1`}>
            {categories.map((cat) => {
              const isSelected = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSelectCategory(cat.id)}
                  className={`w-full min-h-[56px] p-3 rounded-2xl flex items-center gap-3 text-left transition ${
                    isSelected
                      ? `bg-gradient-to-r from-blue-50 to-sky-50/80 dark:from-blue-950/70 dark:to-sky-950/40 border border-blue-300 dark:border-blue-700 ${ZAURE_GLOWS.soft}`
                      : 'border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cat.accentBg}`}
                  >
                    {cat.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs sm:text-[13px] font-extrabold truncate ${
                        isSelected
                          ? 'text-blue-700 dark:text-sky-300'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {getCategoryTitle(cat)}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {cat.description}
                    </p>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 shrink-0 ${
                      isSelected ? 'text-blue-600 dark:text-sky-400' : 'text-slate-400'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </aside>

        {/* Contenu de la catégorie active */}
        <main
          className={`lg:col-span-8 xl:col-span-8 space-y-4 ${
            mobileShowDetail ? 'block' : 'hidden lg:block'
          }`}
        >
          {/* Barre retour mobile */}
          <div className={`lg:hidden ${ZAURE_SURFACES.card} px-3 py-2 flex items-center justify-between gap-3`}>
            <button
              type="button"
              onClick={() => setMobileShowDetail(false)}
              className="min-h-[44px] px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Toutes les catégories</span>
            </button>
            <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate pr-2">
              {getCategoryTitle(activeCategoryObj)}
            </span>
          </div>

          {renderActiveSection()}
        </main>
      </div>

      {/* Toast flottant */}
      {toast && (
        <div className="fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-50 animate-slideUp max-w-sm">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold ${
              toast.tone === 'error'
                ? 'bg-red-600 border-red-500 text-white'
                : 'bg-slate-900 dark:bg-slate-800 border-slate-700 text-white'
            }`}
          >
            {toast.tone === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{toast.msg}</span>
          </div>
        </div>
      )}
    </div>
  );
}
