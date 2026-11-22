import { DisplayDensity, ThemeMode, UserSettings } from '../types';

export interface AppearancePreferences {
  theme_mode: ThemeMode;
  densite_affichage: DisplayDensity;
  taille_texte: 'normal' | 'grand' | 'tres_grand';
  contraste_eleve: boolean;
  animations_reduites: boolean;
  lisibilite_amelioree: boolean;
  mode_faible_consommation: boolean;
}

export const DEFAULT_APPEARANCE_PREFERENCES: AppearancePreferences = {
  theme_mode: 'light',
  densite_affichage: 'confort',
  taille_texte: 'normal',
  contraste_eleve: false,
  animations_reduites: false,
  lisibilite_amelioree: false,
  mode_faible_consommation: false
};

const STORAGE_KEY_GLOBAL = 'zaure_appearance_prefs';
const STORAGE_KEY_PREFIX = 'zaure_appearance_prefs_';

let currentSystemListenerCleanup: (() => void) | null = null;

export function extractAppearancePreferences(settings?: Partial<UserSettings> | null): AppearancePreferences {
  return {
    theme_mode:
      settings?.theme_mode === 'dark' || settings?.theme_mode === 'system' || settings?.theme_mode === 'light'
        ? settings.theme_mode
        : 'light',
    densite_affichage: settings?.densite_affichage === 'compact' ? 'compact' : 'confort',
    taille_texte:
      settings?.taille_texte === 'grand' || settings?.taille_texte === 'tres_grand'
        ? settings.taille_texte
        : 'normal',
    contraste_eleve: Boolean(settings?.contraste_eleve),
    animations_reduites: Boolean(settings?.animations_reduites),
    lisibilite_amelioree: Boolean(settings?.lisibilite_amelioree),
    mode_faible_consommation: Boolean(settings?.mode_faible_consommation)
  };
}

export function resolveEffectiveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'dark') return 'dark';
  if (mode === 'light') return 'light';
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function updateDomForPreferences(prefs: AppearancePreferences): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  const effectiveTheme = resolveEffectiveTheme(prefs.theme_mode);
  root.classList.toggle('dark', effectiveTheme === 'dark');
  root.style.colorScheme = effectiveTheme;
  root.dataset.themeMode = prefs.theme_mode;

  // Text size classes
  root.classList.remove('text-scale-normal', 'text-scale-grand', 'text-scale-tres-grand');
  root.classList.add(`text-scale-${prefs.taille_texte || 'normal'}`);

  // Accessibility & density classes
  root.classList.toggle('high-contrast', Boolean(prefs.contraste_eleve));
  root.classList.toggle('reduced-motion', Boolean(prefs.animations_reduites));
  root.classList.toggle('enhanced-readability', Boolean(prefs.lisibilite_amelioree));
  root.classList.toggle('density-compact', prefs.densite_affichage === 'compact');

  // Mobile browser address bar theme-color
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', effectiveTheme === 'dark' ? '#0f172a' : '#2563EB');
  }
}

export function applyAppearancePreferences(
  prefs: AppearancePreferences,
  onApplied?: (effectiveTheme: 'light' | 'dark') => void
): void {
  if (currentSystemListenerCleanup) {
    currentSystemListenerCleanup();
    currentSystemListenerCleanup = null;
  }

  updateDomForPreferences(prefs);
  onApplied?.(resolveEffectiveTheme(prefs.theme_mode));

  if (
    prefs.theme_mode === 'system' &&
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function'
  ) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      updateDomForPreferences(prefs);
      onApplied?.(resolveEffectiveTheme(prefs.theme_mode));
    };
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handler);
      currentSystemListenerCleanup = () => mq.removeEventListener('change', handler);
    } else if (typeof (mq as any).addListener === 'function') {
      (mq as any).addListener(handler);
      currentSystemListenerCleanup = () => (mq as any).removeListener(handler);
    }
  }
}

export function persistAppearancePreferencesLocal(prefs: AppearancePreferences, userId?: string): void {
  try {
    const payload = JSON.stringify(prefs);
    localStorage.setItem(STORAGE_KEY_GLOBAL, payload);
    if (userId) {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, payload);
    }
  } catch {
    // ignore storage quota errors
  }
}

export function loadStoredAppearancePreferences(userId?: string): AppearancePreferences {
  try {
    const raw =
      (userId ? localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`) : null) ||
      localStorage.getItem(STORAGE_KEY_GLOBAL);
    if (raw) {
      return extractAppearancePreferences(JSON.parse(raw));
    }
  } catch {
    // ignore malformed storage
  }
  return { ...DEFAULT_APPEARANCE_PREFERENCES };
}

export function applyAndPersistAppearancePreferences(
  prefs: AppearancePreferences,
  userId?: string,
  onApplied?: (effectiveTheme: 'light' | 'dark') => void
): void {
  persistAppearancePreferencesLocal(prefs, userId);
  applyAppearancePreferences(prefs, onApplied);
}

export function bootstrapAppearancePreferences(): AppearancePreferences {
  const prefs = loadStoredAppearancePreferences();
  applyAppearancePreferences(prefs);
  return prefs;
}
