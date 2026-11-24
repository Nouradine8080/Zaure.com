import type { Transition, Variants } from 'motion/react';

/**
 * Registre central du Design System ZAURE.
 * Centralise les couleurs, dégradés, ombres, surfaces et presets d'animations
 * réutilisables dans tous les composants React de la plateforme.
 */
export const ZAURE_COLORS = {
  brand: {
    primary: '#2563EB',
    primaryHover: '#1D4ED8',
    primaryDeep: '#174EE2',
    sky: '#0EA5E9',
    night: '#0F172A',
    nightDeep: '#020617',
    soft: '#EFF6FF',
  },
  surface: {
    canvasLight: '#F4F7FB',
    canvasDark: '#020617',
    cardLight: '#FFFFFF',
    cardDark: '#0F172A',
    mutedLight: '#F0F2F5',
    mutedDark: '#1E293B',
  },
  semantic: {
    success: '#16A34A',
    successBright: '#22C55E',
    warning: '#D97706',
    danger: '#DC2626',
    info: '#0284C7',
  },
  category: {
    health: '#F43F5E',
    tech: '#2563EB',
    education: '#4F46E5',
    community: '#0EA5E9',
    news: '#0284C7',
  },
} as const;

export const ZAURE_GRADIENTS = {
  hero: 'zaure-grad-hero',
  primary: 'zaure-grad-primary',
  night: 'zaure-grad-night',
  skyRing: 'zaure-grad-sky-ring',
  canvasSoft: 'zaure-grad-canvas-soft',
  surfaceTint: 'zaure-grad-surface-tint',
  scrim: 'zaure-grad-scrim',
  health: 'zaure-grad-health',
  tech: 'zaure-grad-tech',
  education: 'zaure-grad-education',
  community: 'zaure-grad-community',
  news: 'zaure-grad-news',
} as const;

export const ZAURE_SHADOWS = {
  xs: 'zaure-shadow-xs',
  card: 'zaure-shadow-card',
  cardHover: 'zaure-shadow-card-hover',
  hero: 'zaure-shadow-hero',
  primary: 'zaure-shadow-primary',
  modal: 'zaure-shadow-modal',
  nav: 'zaure-shadow-nav',
} as const;

export const ZAURE_ANIMATIONS = {
  fadeIn: 'zaure-animate-fade-in',
  slideUp: 'zaure-animate-slide-up',
  slideDown: 'zaure-animate-slide-down',
  scaleIn: 'zaure-animate-scale-in',
  pop: 'zaure-animate-pop',
  shimmer: 'zaure-animate-shimmer',
  float: 'zaure-animate-float',
} as const;

/**
 * Classes composées réutilisables pour unifier les cartes, bannières, modales et boutons.
 */
export const ZAURE_SURFACES = {
  canvas: 'zaure-bg-canvas',
  card: 'zaure-card rounded-2xl sm:rounded-3xl',
  cardInteractive: 'zaure-card-interactive rounded-2xl sm:rounded-3xl',
  heroBanner:
    'relative overflow-hidden rounded-2xl sm:rounded-3xl zaure-grad-hero zaure-shadow-hero text-white',
  modalPanel:
    'bg-white dark:bg-slate-900 border border-slate-200/85 dark:border-slate-800 rounded-3xl zaure-shadow-modal zaure-animate-scale-in',
  popoverMenu:
    'bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl zaure-shadow-modal zaure-animate-scale-in',
  primaryButton:
    'zaure-btn-primary zaure-focus-ring font-bold rounded-full inline-flex items-center justify-center gap-1.5',
  secondaryButton:
    'bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 zaure-btn-press zaure-shadow-xs zaure-focus-ring font-semibold rounded-full inline-flex items-center justify-center gap-1.5',
  skeleton: 'zaure-animate-shimmer rounded-xl',
} as const;

/**
 * Presets typés pour `motion/react` (courbes fluides <= 250ms, propriétés GPU uniquement).
 */
const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const ZAURE_TRANSITION: Transition = {
  duration: 0.22,
  ease: EASE_OUT,
};

export const ZAURE_MOTION = {
  fadeIn: {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 4 },
    transition: { duration: 0.2, ease: EASE_OUT },
  },
  slideUp: {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 },
    transition: { duration: 0.24, ease: EASE_OUT },
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.96 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.97 },
    transition: { duration: 0.18, ease: EASE_OUT },
  },
  tap: { scale: 0.97 },
  listItemVariants: {
    hidden: { opacity: 0, y: 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.2, ease: EASE_OUT },
    },
  } satisfies Variants,
} as const;

export type ZaureCategoryThemeKey =
  | 'health'
  | 'tech'
  | 'education'
  | 'community'
  | 'news'
  | 'default';

export interface ZaureCategoryStyle {
  key: ZaureCategoryThemeKey;
  gradientClass: string;
  softBgClass: string;
  textClass: string;
  borderClass: string;
}

const CATEGORY_STYLE_MAP: Record<ZaureCategoryThemeKey, ZaureCategoryStyle> = {
  health: {
    key: 'health',
    gradientClass: ZAURE_GRADIENTS.health,
    softBgClass: 'bg-rose-50 dark:bg-rose-950/40',
    textClass: 'text-rose-600 dark:text-rose-400',
    borderClass: 'border-rose-200/80 dark:border-rose-800/60',
  },
  tech: {
    key: 'tech',
    gradientClass: ZAURE_GRADIENTS.tech,
    softBgClass: 'bg-blue-50 dark:bg-blue-950/40',
    textClass: 'text-blue-600 dark:text-blue-400',
    borderClass: 'border-blue-200/80 dark:border-blue-800/60',
  },
  education: {
    key: 'education',
    gradientClass: ZAURE_GRADIENTS.education,
    softBgClass: 'bg-indigo-50 dark:bg-indigo-950/40',
    textClass: 'text-indigo-600 dark:text-indigo-400',
    borderClass: 'border-indigo-200/80 dark:border-indigo-800/60',
  },
  community: {
    key: 'community',
    gradientClass: ZAURE_GRADIENTS.community,
    softBgClass: 'bg-sky-50 dark:bg-sky-950/40',
    textClass: 'text-sky-600 dark:text-sky-400',
    borderClass: 'border-sky-200/80 dark:border-sky-800/60',
  },
  news: {
    key: 'news',
    gradientClass: ZAURE_GRADIENTS.news,
    softBgClass: 'bg-cyan-50 dark:bg-cyan-950/40',
    textClass: 'text-cyan-700 dark:text-cyan-400',
    borderClass: 'border-cyan-200/80 dark:border-cyan-800/60',
  },
  default: {
    key: 'default',
    gradientClass: ZAURE_GRADIENTS.primary,
    softBgClass: 'bg-blue-50 dark:bg-blue-950/40',
    textClass: 'text-blue-600 dark:text-blue-400',
    borderClass: 'border-blue-200/80 dark:border-blue-800/60',
  },
};

/**
 * Retourne un jeu de classes cohérent (dégradé, fond doux, texte, bordure)
 * pour n'importe quelle catégorie de cercle, communauté ou raccourci.
 */
export function getZaureCategoryStyle(category?: string | null): ZaureCategoryStyle {
  const norm = (category || '').toLowerCase().trim();
  if (norm.includes('sant') || norm.includes('médec') || norm.includes('medec')) {
    return CATEGORY_STYLE_MAP.health;
  }
  if (norm.includes('tech') || norm.includes('ia') || norm.includes('science') || norm.includes('digital')) {
    return CATEGORY_STYLE_MAP.tech;
  }
  if (norm.includes('éduc') || norm.includes('educ') || norm.includes('étud') || norm.includes('etud') || norm.includes('langue')) {
    return CATEGORY_STYLE_MAP.education;
  }
  if (norm.includes('communaut') || norm.includes('vie') || norm.includes('cercle')) {
    return CATEGORY_STYLE_MAP.community;
  }
  if (norm.includes('actual') || norm.includes('info') || norm.includes('monde')) {
    return CATEGORY_STYLE_MAP.news;
  }
  return CATEGORY_STYLE_MAP.default;
}

export type ZaureStatusTone = 'success' | 'warning' | 'danger' | 'info';

export function getZaureStatusStyle(tone: ZaureStatusTone): {
  badgeClass: string;
  bannerClass: string;
  dotClass: string;
} {
  switch (tone) {
    case 'success':
      return {
        badgeClass:
          'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60',
        bannerClass:
          'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800',
        dotClass: 'bg-emerald-500',
      };
    case 'warning':
      return {
        badgeClass:
          'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60',
        bannerClass:
          'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800',
        dotClass: 'bg-amber-500',
      };
    case 'danger':
      return {
        badgeClass:
          'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200/80 dark:border-red-800/60',
        bannerClass:
          'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-200 border border-red-200 dark:border-red-800',
        dotClass: 'bg-red-600',
      };
    case 'info':
    default:
      return {
        badgeClass:
          'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/60',
        bannerClass:
          'bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200 border border-sky-200 dark:border-sky-800',
        dotClass: 'bg-sky-500',
      };
  }
}
