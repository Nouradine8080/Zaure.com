import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { zaureService } from '../firebaseClient';
import { ZAURE_GLOWS, ZAURE_SURFACES } from '../styles/designSystem';

type ResetViewState = 'verifying' | 'form' | 'invalid_code' | 'success';

interface PasswordStrengthResult {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  barColorClass: string;
  textColorClass: string;
  hasMinLength: boolean;
  hasMixedChars: boolean;
  notCommonWord: boolean;
}

const COMMON_WEAK_PASSWORDS = new Set([
  'password',
  'motdepasse',
  '123456',
  '12345678',
  '123456789',
  'azerty',
  'qwerty',
  'admin',
  'zaure',
  'zaure2025',
  'zaure2026',
  'welcome',
  'soleil',
  'bonjour',
]);

function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const value = password || '';
  const hasMinLength = value.length >= 8;
  const hasLower = /[a-z]/.test(value);
  const hasUpper = /[A-Z]/.test(value);
  const hasDigit = /\d/.test(value);
  const hasSymbol = /[^A-Za-z0-9]/.test(value);
  const categoryCount = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
  const hasMixedChars = (hasLower || hasUpper) && hasDigit && (hasSymbol || hasUpper);
  const normalized = value.toLowerCase().trim();
  const notCommonWord =
    normalized.length > 0 &&
    !COMMON_WEAK_PASSWORDS.has(normalized) &&
    !/^(.)\1{4,}$/.test(normalized);

  if (!value) {
    return {
      score: 0,
      label: 'À définir',
      barColorClass: 'bg-slate-200 dark:bg-slate-700',
      textColorClass: 'text-slate-500 dark:text-slate-400',
      hasMinLength: false,
      hasMixedChars: false,
      notCommonWord: false,
    };
  }

  let points = 0;
  if (value.length >= 6) points += 1;
  if (hasMinLength) points += 1;
  if (value.length >= 12) points += 1;
  if (categoryCount >= 2) points += 1;
  if (categoryCount >= 3) points += 1;
  if (hasSymbol && hasDigit) points += 1;
  if (!notCommonWord) points = Math.min(points, 1);

  if (points <= 1 || value.length < 6) {
    return {
      score: 1,
      label: 'Faible',
      barColorClass: 'bg-red-500',
      textColorClass: 'text-red-600 dark:text-red-400',
      hasMinLength,
      hasMixedChars,
      notCommonWord,
    };
  }

  if (points <= 3) {
    return {
      score: 2,
      label: 'Moyen',
      barColorClass: 'bg-amber-500',
      textColorClass: 'text-amber-600 dark:text-amber-400',
      hasMinLength,
      hasMixedChars,
      notCommonWord,
    };
  }

  if (points <= 4) {
    return {
      score: 3,
      label: 'Bon',
      barColorClass: 'bg-emerald-500',
      textColorClass: 'text-emerald-600 dark:text-emerald-400',
      hasMinLength,
      hasMixedChars,
      notCommonWord,
    };
  }

  return {
    score: 4,
    label: 'Excellent',
    barColorClass: 'bg-emerald-600',
    textColorClass: 'text-emerald-600 dark:text-emerald-400',
    hasMinLength,
    hasMixedChars,
    notCommonWord,
  };
}

/**
 * Arrière-plan décoratif ZAURE avec vagues bleues et grilles de points subtiles,
 * fidèle à la maquette et léger pour 60fps sur smartphone Android.
 */
function ResetCanvasBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden z-0">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 12% 14%, rgba(37, 99, 235, 0.14), transparent 44%), radial-gradient(circle at 88% 82%, rgba(14, 165, 233, 0.18), transparent 48%)',
        }}
      />

      {/* Top-right sweeping blue ribbon */}
      <svg
        className="absolute -top-12 -right-20 w-[340px] h-[340px] sm:w-[460px] sm:h-[460px] opacity-90 dark:opacity-50"
        viewBox="0 0 460 460"
        fill="none"
      >
        <defs>
          <linearGradient id="zaureResetWaveTop" x1="60" y1="20" x2="430" y2="420" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.45" />
            <stop offset="55%" stopColor="#1D4ED8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0.95" />
          </linearGradient>
        </defs>
        <path
          d="M170 -30C215 95 310 190 480 230L480 -30H170Z"
          fill="url(#zaureResetWaveTop)"
        />
        <path
          d="M240 -20C285 95 365 170 480 205"
          stroke="#93C5FD"
          strokeOpacity="0.45"
          strokeWidth="18"
          strokeLinecap="round"
        />
      </svg>

      {/* Bottom-left soft arc */}
      <svg
        className="absolute -bottom-16 -left-24 w-[320px] h-[320px] sm:w-[440px] sm:h-[440px] opacity-85 dark:opacity-40"
        viewBox="0 0 440 440"
        fill="none"
      >
        <defs>
          <linearGradient id="zaureResetWaveBottomLeft" x1="20" y1="120" x2="340" y2="440" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#174EE2" stopOpacity="0.88" />
          </linearGradient>
        </defs>
        <path
          d="M-30 140C120 185 215 290 250 470H-30V140Z"
          fill="url(#zaureResetWaveBottomLeft)"
        />
      </svg>

      {/* Bottom-right wave corner */}
      <svg
        className="hidden sm:block absolute -bottom-12 -right-12 w-[300px] h-[300px] opacity-90 dark:opacity-50"
        viewBox="0 0 300 300"
        fill="none"
      >
        <path
          d="M80 310C125 205 205 140 315 115V310H80Z"
          fill="#1D4ED8"
          fillOpacity="0.85"
        />
      </svg>

      {/* Left & Right subtle dot matrices */}
      <svg
        className="hidden md:block absolute left-6 top-[22%] w-24 h-24 text-blue-400/35 dark:text-sky-400/20"
        viewBox="0 0 100 100"
        fill="none"
      >
        {[0, 1, 2, 3, 4].map((row) =>
          [0, 1, 2, 3, 4].map((col) => (
            <circle key={`l-${row}-${col}`} cx={10 + col * 18} cy={10 + row * 18} r="2.2" fill="currentColor" />
          ))
        )}
      </svg>
      <svg
        className="hidden md:block absolute right-8 bottom-[20%] w-24 h-24 text-blue-400/35 dark:text-sky-400/20"
        viewBox="0 0 100 100"
        fill="none"
      >
        {[0, 1, 2, 3, 4].map((row) =>
          [0, 1, 2, 3, 4].map((col) => (
            <circle key={`r-${row}-${col}`} cx={10 + col * 18} cy={10 + row * 18} r="2.2" fill="currentColor" />
          ))
        )}
      </svg>
    </div>
  );
}

/**
 * Illustration vectorielle du cadenas ZAURE avec halo bleu et badge de réinitialisation.
 */
function PadlockHeroIllustration({ isSuccess = false }: { isSuccess?: boolean }) {
  return (
    <div className="relative mx-auto w-36 h-28 flex items-center justify-center select-none">
      {/* Soft circular halo */}
      <div
        className={`w-24 h-24 rounded-full transition-colors ${
          isSuccess
            ? 'bg-emerald-100/80 dark:bg-emerald-950/50'
            : 'bg-blue-100/80 dark:bg-blue-950/50'
        }`}
      />

      {/* Left motion dashes */}
      <div aria-hidden="true" className="absolute left-1 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 items-end">
        <span className="w-5 h-1 rounded-full bg-blue-300/80 dark:bg-blue-500/40" />
        <span className="w-3 h-1 rounded-full bg-blue-200/80 dark:bg-blue-500/30" />
      </div>

      {/* Top-right action bursts */}
      <svg
        aria-hidden="true"
        className="absolute right-1 top-2 w-7 h-7 text-blue-600 dark:text-sky-400"
        viewBox="0 0 28 28"
        fill="none"
      >
        <path d="M5 10L11 5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M9 15L19 11" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M10 21L18 21" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      </svg>

      {/* Main 3D-styled Padlock SVG */}
      <svg
        aria-hidden="true"
        viewBox="0 0 96 96"
        className="absolute w-24 h-24 drop-shadow-[0_10px_18px_rgba(23,78,226,0.22)]"
        fill="none"
      >
        <defs>
          <linearGradient id="zaureLockBodyGrad" x1="20" y1="36" x2="76" y2="84" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={isSuccess ? '#22C55E' : '#3B82F6'} />
            <stop offset="55%" stopColor={isSuccess ? '#16A34A' : '#2563EB'} />
            <stop offset="100%" stopColor={isSuccess ? '#15803D' : '#174EE2'} />
          </linearGradient>
          <linearGradient id="zaureLockShackleGrad" x1="30" y1="12" x2="66" y2="42" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={isSuccess ? '#86EFAC' : '#93C5FD'} />
            <stop offset="100%" stopColor={isSuccess ? '#16A34A' : '#1D4ED8'} />
          </linearGradient>
        </defs>

        {/* Shackle */}
        <path
          d="M32 42V30C32 20.6112 39.6112 13 49 13C58.3888 13 66 20.6112 66 30V42"
          stroke="url(#zaureLockShackleGrad)"
          strokeWidth="7.5"
          strokeLinecap="round"
        />

        {/* Body */}
        <rect x="22" y="39" width="54" height="44" rx="13" fill="url(#zaureLockBodyGrad)" />
        {/* Left highlight bevel */}
        <rect
          x="24.5"
          y="41.5"
          width="49"
          height="39"
          rx="11"
          stroke="#FFFFFF"
          strokeOpacity="0.28"
          strokeWidth="1.5"
        />

        {/* Keyhole */}
        {isSuccess ? (
          <path
            d="M41 61L46.5 66.5L57 55"
            stroke="#FFFFFF"
            strokeWidth="4.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <>
            <circle cx="49" cy="56" r="5.2" fill="#FFFFFF" />
            <path d="M46.4 59L45.3 69.5H52.7L51.6 59H46.4Z" fill="#FFFFFF" />
          </>
        )}
      </svg>

      {/* Bottom-right refresh or verified badge */}
      <div
        className={`absolute right-4 bottom-2 w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-blue-100 dark:border-slate-700 flex items-center justify-center shadow-md ${
          isSuccess ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'
        }`}
      >
        {isSuccess ? (
          <CheckCircle2 className="w-5 h-5" />
        ) : (
          <RefreshCw className="w-4 h-4 stroke-[2.5]" />
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const oobCode = useMemo(() => {
    const params = new URLSearchParams(location.search || '');
    return (params.get('oobCode') || '').trim();
  }, [location.search]);

  const [viewState, setViewState] = useState<ResetViewState>(oobCode ? 'verifying' : 'invalid_code');
  const [verifiedEmail, setVerifiedEmail] = useState<string>('');
  const [codeError, setCodeError] = useState<string>(
    oobCode
      ? ''
      : 'Aucun code de réinitialisation valide n\'est présent dans ce lien. Veuillez utiliser le lien reçu par e-mail ou en demander un nouveau.'
  );
  const [codeErrorKind, setCodeErrorKind] = useState<'expired' | 'invalid' | 'missing'>(
    oobCode ? 'invalid' : 'missing'
  );

  // Form states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Resend link fallback inside invalid/expired state
  const [resendEmail, setResendEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  const strength = useMemo(() => evaluatePasswordStrength(newPassword), [newPassword]);
  const passwordsMatch =
    confirmPassword.length > 0 && newPassword === confirmPassword;
  const passwordsMismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;

  // Verify oobCode automatically on page open
  useEffect(() => {
    let active = true;

    if (!oobCode) {
      setViewState('invalid_code');
      setCodeErrorKind('missing');
      setCodeError(
        'Aucun code de réinitialisation valide n\'est présent dans cette URL. Veuillez ouvrir directement le lien reçu dans votre boîte e-mail.'
      );
      return () => {
        active = false;
      };
    }

    setViewState('verifying');
    setCodeError('');

    zaureService
      .verifyPasswordResetCode(oobCode)
      .then((res) => {
        if (!active) return;
        if (res.email && !res.error) {
          setVerifiedEmail(res.email);
          setResendEmail(res.email);
          setViewState('form');
        } else {
          setCodeErrorKind(
            res.errorCode === 'auth/expired-action-code' ? 'expired' : 'invalid'
          );
          setCodeError(
            res.error ||
              'Ce lien de réinitialisation est invalide, expiré ou a déjà été utilisé.'
          );
          setViewState('invalid_code');
        }
      })
      .catch(() => {
        if (!active) return;
        setCodeErrorKind('invalid');
        setCodeError(
          'Impossible de vérifier ce lien pour le moment. Vérifiez votre connexion internet et réessayez.'
        );
        setViewState('invalid_code');
      });

    return () => {
      active = false;
    };
  }, [oobCode]);

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!newPassword) {
      setFormError('Veuillez saisir un nouveau mot de passe.');
      return;
    }
    if (newPassword.length < 6) {
      setFormError(
        'Mot de passe insuffisant : il doit contenir au moins 6 caractères (8 caractères recommandés).'
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await zaureService.confirmPasswordReset(oobCode, newPassword);
      if (result.success) {
        // Efface les champs sensibles en mémoire et ferme une éventuelle session active obsolète
        setNewPassword('');
        setConfirmPassword('');
        if (zaureService.getCurrentUser()) {
          await zaureService.signOut();
        }
        setViewState('success');
      } else {
        if (
          result.errorCode === 'auth/expired-action-code' ||
          result.errorCode === 'auth/invalid-action-code'
        ) {
          setCodeErrorKind(
            result.errorCode === 'auth/expired-action-code' ? 'expired' : 'invalid'
          );
          setCodeError(
            result.error ||
              'Ce lien de réinitialisation a expiré ou a déjà été utilisé.'
          );
          setViewState('invalid_code');
        } else {
          setFormError(
            result.error ||
              'Impossible de modifier le mot de passe. Veuillez réessayer.'
          );
        }
      }
    } catch {
      setFormError('Problème de connexion réseau. Vérifiez votre accès internet et réessayez.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setResendError(null);
    setResendMessage(null);
    const cleanEmail = resendEmail.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setResendError('Veuillez saisir une adresse e-mail valide.');
      return;
    }

    setIsResending(true);
    try {
      const { success, error } = await zaureService.sendPasswordReset(cleanEmail);
      if (success) {
        setResendMessage(
          `Un nouveau lien de réinitialisation a été envoyé à ${cleanEmail}.`
        );
      } else {
        setResendError(error || "Impossible d'envoyer le lien de réinitialisation.");
      }
    } catch {
      setResendError('Problème de connexion réseau. Veuillez réessayer.');
    } finally {
      setIsResending(false);
    }
  };

  const handleGoToLogin = async () => {
    if (zaureService.getCurrentUser()) {
      await zaureService.signOut();
    }
    navigate('/connexion', {
      replace: true,
      state: verifiedEmail ? { prefilledEmail: verifiedEmail } : undefined,
    });
  };

  return (
    <div className="relative min-h-[100dvh] overflow-y-auto overflow-x-hidden zaure-grad-canvas-soft flex flex-col items-center justify-center px-4 py-6 sm:py-10 text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-100 dark:selection:bg-blue-900/50">
      <ResetCanvasBackdrop />

      <main className="relative z-10 w-full max-w-[460px] mx-auto zaure-animate-scale-in">
        <section
          aria-labelledby="zaure-reset-title"
          className={`w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-blue-100/90 dark:border-slate-800 rounded-[28px] p-6 sm:p-9 zaure-shadow-modal ${ZAURE_GLOWS.soft}`}
        >
          {/* Brand Logo Header */}
          <div className="flex flex-col items-center text-center">
            <Link
              to="/"
              className="inline-flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 rounded-xl"
            >
              <span
                className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl zaure-grad-primary flex items-center justify-center text-white font-black text-2xl ${ZAURE_GLOWS.blue}`}
              >
                Z
              </span>
              <span className="flex flex-col items-start">
                <span className="text-[28px] sm:text-3xl font-extrabold tracking-tight text-blue-600 dark:text-blue-400 leading-none">
                  ZAURE
                </span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 110 10"
                  className="w-24 h-2.5 mt-1 text-blue-600 dark:text-blue-400"
                  fill="none"
                >
                  <path
                    d="M3 7.5C32 2 76 1.5 107 4.5"
                    stroke="currentColor"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </Link>

            <div className="mt-4">
              <PadlockHeroIllustration isSuccess={viewState === 'success'} />
            </div>

            {viewState === 'verifying' && (
              <>
                <h1
                  id="zaure-reset-title"
                  className="mt-3 text-xl sm:text-2xl font-extrabold text-slate-950 dark:text-white tracking-tight"
                >
                  Vérification du lien sécurisé
                </h1>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-sm">
                  Nous contrôlons la validité de votre code de réinitialisation ZAURE...
                </p>
              </>
            )}

            {viewState === 'form' && (
              <>
                <h1
                  id="zaure-reset-title"
                  className="mt-2 text-[22px] sm:text-[26px] font-extrabold text-slate-950 dark:text-white tracking-tight leading-snug"
                >
                  Réinitialiser votre mot de passe
                </h1>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-sm">
                  Entrez votre nouveau mot de passe ci-dessous pour sécuriser à nouveau votre compte ZAURE.
                </p>
                {verifiedEmail && (
                  <p className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/70 text-xs font-semibold text-blue-700 dark:text-blue-300">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate max-w-[260px]">{verifiedEmail}</span>
                  </p>
                )}
              </>
            )}

            {viewState === 'invalid_code' && (
              <>
                <h1
                  id="zaure-reset-title"
                  className="mt-2 text-[22px] sm:text-2xl font-extrabold text-slate-950 dark:text-white tracking-tight"
                >
                  {codeErrorKind === 'expired'
                    ? 'Lien de réinitialisation expiré'
                    : codeErrorKind === 'missing'
                    ? 'Lien de réinitialisation requis'
                    : 'Lien invalide ou déjà utilisé'}
                </h1>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-sm">
                  Pour votre sécurité, les liens de réinitialisation ZAURE sont à usage unique et ont une durée limitée.
                </p>
              </>
            )}

            {viewState === 'success' && (
              <>
                <h1
                  id="zaure-reset-title"
                  className="mt-2 text-[22px] sm:text-[26px] font-extrabold text-slate-950 dark:text-white tracking-tight"
                >
                  Mot de passe mis à jour
                </h1>
                <p className="mt-2 text-sm sm:text-base font-bold text-emerald-700 dark:text-emerald-400">
                  Votre mot de passe a été modifié avec succès
                </p>
              </>
            )}
          </div>

          {/* STATE 1: VERIFYING */}
          {viewState === 'verifying' && (
            <div className="mt-6 py-6 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full border-[3px] border-blue-100 dark:border-slate-700 border-t-blue-600 dark:border-t-blue-400 animate-spin" />
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Validation Firebase en cours...
              </span>
            </div>
          )}

          {/* STATE 2: RESET FORM */}
          {viewState === 'form' && (
            <form onSubmit={handleResetSubmit} className="mt-6 space-y-4" noValidate>
              {formError && (
                <div
                  role="alert"
                  className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/45 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300 flex items-start gap-2.5 zaure-animate-fade-in"
                >
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <span className="font-semibold leading-snug">{formError}</span>
                </div>
              )}

              {/* New Password Field */}
              <div>
                <label htmlFor="zaure-new-password" className="sr-only">
                  Nouveau mot de passe
                </label>
                <div className="flex items-center min-h-[52px] rounded-full border border-blue-200/90 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800/80 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20 overflow-hidden transition">
                  <span className="pl-4 pr-2.5 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Lock className="w-4 h-4 fill-blue-600/15" />
                  </span>
                  <input
                    id="zaure-new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Nouveau mot de passe"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    className="flex-1 min-w-0 text-sm px-2 py-2.5 bg-transparent focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    aria-label={
                      showNewPassword
                        ? 'Masquer le nouveau mot de passe'
                        : 'Afficher le nouveau mot de passe'
                    }
                    className="min-w-[46px] min-h-[46px] pr-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center transition cursor-pointer"
                  >
                    {showNewPassword ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Password Strength Meter (directly between fields like reference) */}
              <div
                aria-live="polite"
                className="px-1 flex flex-wrap items-center justify-between gap-2.5"
              >
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 shrink-0">
                  Force du mot de passe :
                </span>
                <div className="flex-1 min-w-[120px] flex items-center gap-1.5">
                  {[1, 2, 3, 4].map((segment) => {
                    const active = strength.score >= segment;
                    return (
                      <span
                        key={segment}
                        className={`h-2 flex-1 rounded-full transition-colors duration-200 ${
                          active
                            ? strength.barColorClass
                            : 'bg-slate-200/90 dark:bg-slate-700/80'
                        }`}
                      />
                    );
                  })}
                </div>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-bold shrink-0 ${strength.textColorClass}`}
                >
                  {strength.score >= 3 ? (
                    <CheckCircle2 className="w-4 h-4 fill-emerald-500/15" />
                  ) : strength.score >= 1 ? (
                    <AlertCircle className="w-3.5 h-3.5" />
                  ) : null}
                  <span>{strength.label}</span>
                </span>
              </div>

              {/* Confirm New Password Field */}
              <div>
                <label htmlFor="zaure-confirm-password" className="sr-only">
                  Confirmer le nouveau mot de passe
                </label>
                <div
                  className={`flex items-center min-h-[52px] rounded-full border bg-[#F8FAFC] dark:bg-slate-800/80 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:ring-2 overflow-hidden transition ${
                    passwordsMismatch
                      ? 'border-red-400 dark:border-red-500 focus-within:border-red-500 focus-within:ring-red-500/20'
                      : passwordsMatch
                      ? 'border-emerald-400 dark:border-emerald-500 focus-within:border-emerald-500 focus-within:ring-emerald-500/20'
                      : 'border-blue-200/90 dark:border-slate-700 focus-within:border-blue-600 focus-within:ring-blue-600/20'
                  }`}
                >
                  <span className="pl-4 pr-2.5 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Lock className="w-4 h-4 fill-blue-600/15" />
                  </span>
                  <input
                    id="zaure-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Confirmer le nouveau mot de passe"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    className="flex-1 min-w-0 text-sm px-2 py-2.5 bg-transparent focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={
                      showConfirmPassword
                        ? 'Masquer la confirmation du mot de passe'
                        : 'Afficher la confirmation du mot de passe'
                    }
                    className="min-w-[46px] min-h-[46px] pr-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center transition cursor-pointer"
                  >
                    {showConfirmPassword ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {passwordsMismatch && (
                  <p className="mt-1.5 px-3 text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Les mots de passe ne correspondent pas</span>
                  </p>
                )}
                {passwordsMatch && (
                  <p className="mt-1.5 px-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Les mots de passe correspondent</span>
                  </p>
                )}
              </div>

              {/* Security Tips Panel */}
              <div className="rounded-2xl bg-[#EEF5FF]/90 dark:bg-blue-950/35 border border-blue-100 dark:border-blue-900/50 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-600/12 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-[13px] font-bold text-blue-600 dark:text-blue-400">
                      Conseils pour un mot de passe sécurisé :
                    </p>
                    <ul className="mt-2 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <li className="flex items-center gap-2">
                        <Check
                          className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                            strength.hasMinLength
                              ? 'text-emerald-600 dark:text-emerald-400 stroke-[2.8]'
                              : 'text-blue-600 dark:text-blue-400 stroke-[2.4]'
                          }`}
                        />
                        <span>Utilisez au moins 8 caractères</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check
                          className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                            strength.hasMixedChars
                              ? 'text-emerald-600 dark:text-emerald-400 stroke-[2.8]'
                              : 'text-blue-600 dark:text-blue-400 stroke-[2.4]'
                          }`}
                        />
                        <span>Combinez lettres, chiffres et symboles</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check
                          className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                            strength.notCommonWord
                              ? 'text-emerald-600 dark:text-emerald-400 stroke-[2.8]'
                              : 'text-blue-600 dark:text-blue-400 stroke-[2.4]'
                          }`}
                        />
                        <span>Évitez les mots courants</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Primary Gradient CTA */}
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full min-h-[52px] px-6 py-3 text-sm sm:text-base gap-2.5 disabled:opacity-60 cursor-pointer ${ZAURE_SURFACES.primaryButton}`}
              >
                <RefreshCw
                  className={`w-4 h-4 stroke-[2.5] ${isSubmitting ? 'animate-spin' : ''}`}
                />
                <span>
                  {isSubmitting
                    ? 'Réinitialisation en cours...'
                    : 'Réinitialiser le mot de passe'}
                </span>
              </button>
            </form>
          )}

          {/* STATE 3: INVALID / EXPIRED / MISSING CODE */}
          {viewState === 'invalid_code' && (
            <div className="mt-6 space-y-5 zaure-animate-fade-in">
              <div
                role="alert"
                className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-3"
              >
                <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm font-semibold text-red-700 dark:text-red-300 leading-relaxed">
                  {codeError}
                </p>
              </div>

              {/* Quick Resend New Link Form */}
              <form
                onSubmit={handleResendLink}
                className="rounded-2xl bg-[#EEF5FF]/85 dark:bg-blue-950/35 border border-blue-100 dark:border-blue-900/50 p-4 space-y-3"
              >
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Recevoir un nouveau lien de réinitialisation :
                </p>
                <div className="flex items-center min-h-[48px] rounded-full border border-blue-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20 overflow-hidden transition">
                  <span className="pl-3.5 pr-2 text-blue-600 dark:text-blue-400 shrink-0">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="Votre adresse e-mail ZAURE"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    className="flex-1 min-w-0 text-sm px-2 py-2 bg-transparent focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                    required
                  />
                </div>

                {resendError && (
                  <p role="alert" className="text-xs font-semibold text-red-600 dark:text-red-400">
                    {resendError}
                  </p>
                )}
                {resendMessage && (
                  <p role="status" className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    {resendMessage}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isResending}
                  className={`w-full min-h-[48px] px-5 py-2.5 text-sm gap-2 disabled:opacity-60 cursor-pointer ${ZAURE_SURFACES.primaryButton}`}
                >
                  <RefreshCw className={`w-4 h-4 ${isResending ? 'animate-spin' : ''}`} />
                  <span>
                    {isResending ? 'Envoi en cours...' : 'Envoyer un nouveau lien'}
                  </span>
                </button>
              </form>
            </div>
          )}

          {/* STATE 4: SUCCESS */}
          {viewState === 'success' && (
            <div className="mt-6 space-y-5 text-center zaure-animate-fade-in">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                <p className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-200 font-medium leading-relaxed">
                  Votre compte ZAURE est désormais protégé par votre nouveau mot de passe. Vous pouvez vous connecter dès maintenant.
                </p>
              </div>

              <button
                type="button"
                onClick={handleGoToLogin}
                className={`w-full min-h-[52px] px-6 py-3 text-sm sm:text-base gap-2 cursor-pointer ${ZAURE_SURFACES.primaryButton}`}
              >
                <span>Se connecter</span>
              </button>
            </div>
          )}

          {/* Footer Back to Login Link (hidden on success since primary CTA goes to login) */}
          {viewState !== 'success' && (
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={handleGoToLogin}
                className="min-h-[44px] px-4 inline-flex items-center justify-center gap-1.5 text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 stroke-[2.4]" />
                <span>Retour à la connexion</span>
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
