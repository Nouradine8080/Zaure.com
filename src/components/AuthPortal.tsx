import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  Smartphone,
  User,
} from 'lucide-react';
import { zaureService } from '../firebaseClient';
import { Circle, UserProfile } from '../types';
import { DEFAULT_AVATAR_URL, REGISTRATION_ROUTES } from '../constants/registration';
import { PWAInstallButton } from './PWAInstallButton';
import { ZAURE_GLOWS, ZAURE_SURFACES } from '../styles/designSystem';
import { ZaureGeometricBackdrop } from './ui/ZaureGeometricBackdrop';

interface AuthPortalProps {
  onAuthSuccess: (user: UserProfile) => void;
  circles?: Circle[];
  initialEmail?: string;
}

const REMEMBER_ME_KEY = 'zaure_remember_me';
const REMEMBERED_EMAIL_KEY = 'zaure_remembered_email';

function loadInitialRememberMe(): boolean {
  try {
    return localStorage.getItem(REMEMBER_ME_KEY) !== 'false';
  } catch {
    return true;
  }
}

function loadRememberedEmail(): string {
  try {
    if (localStorage.getItem(REMEMBER_ME_KEY) === 'false') return '';
    return localStorage.getItem(REMEMBERED_EMAIL_KEY) || '';
  } catch {
    return '';
  }
}

export default function AuthPortal({
  onAuthSuccess,
  initialEmail = '',
}: AuthPortalProps) {
  const location = useLocation();
  const routePrefilledEmail =
    (location.state as { prefilledEmail?: string } | null)?.prefilledEmail || initialEmail;

  const [authMode, setAuthMode] = useState<'login' | 'forgot_password'>('login');
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');

  const [rememberMe, setRememberMe] = useState<boolean>(() => loadInitialRememberMe());
  const [email, setEmail] = useState<string>(
    () => routePrefilledEmail || loadRememberedEmail()
  );
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (routePrefilledEmail) {
      setEmail(routePrefilledEmail);
      setAuthMode('login');
      setAuthMethod('email');
    }
  }, [routePrefilledEmail]);

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Phone Auth States
  const [phoneNumber, setPhoneNumber] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [recaptchaVerifierInstance, setRecaptchaVerifierInstance] = useState<any>(null);

  const resetFormState = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setShowPassword(false);
    setConfirmationResult(null);
    setSmsCode('');
  };

  const syncRememberPreference = async (targetEmail?: string) => {
    await zaureService.setAuthPersistence(rememberMe);
    try {
      if (rememberMe && targetEmail?.trim()) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, targetEmail.trim());
      } else if (!rememberMe) {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }
    } catch {
      // ignore storage errors
    }
  };

  const handleSendSmsCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!phoneNumber.trim() || !phoneNumber.startsWith('+')) {
      setErrorMessage(
        'Veuillez entrer un numéro de téléphone valide au format international (ex : +22790123456).'
      );
      return;
    }

    setIsLoading(true);
    try {
      await syncRememberPreference();
      if (recaptchaVerifierInstance) {
        try {
          recaptchaVerifierInstance.clear();
        } catch {
          // ignore
        }
      }
      const verifier = zaureService.createRecaptchaVerifier('recaptcha-container');
      setRecaptchaVerifierInstance(verifier);

      const { confirmationResult: res, error } = await zaureService.signInWithPhone(
        phoneNumber.trim(),
        verifier
      );
      if (error) {
        setErrorMessage(error);
      } else if (res) {
        setConfirmationResult(res);
        setSuccessMessage('Code SMS envoyé avec succès.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erreur lors de l’envoi du SMS.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySmsCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!smsCode.trim() || smsCode.length < 6) {
      setErrorMessage('Veuillez entrer le code de vérification SMS à 6 chiffres.');
      return;
    }

    setIsLoading(true);
    try {
      const { user, error } = await zaureService.confirmPhoneCode(
        confirmationResult,
        smsCode.trim(),
        {
          nom: 'Membre Zaure',
          role: 'utilisateur',
          bio: 'Inscrit par téléphone sur Zaure',
          langue: 'fr',
          avatarUrl: DEFAULT_AVATAR_URL,
        }
      );
      if (error) {
        setErrorMessage(error);
      } else if (user) {
        onAuthSuccess(user);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Code SMS incorrect.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Veuillez saisir votre adresse e-mail.');
      return;
    }
    if (!trimmedEmail.includes('@')) {
      setErrorMessage(
        'Veuillez saisir l’adresse e-mail complète associée à votre compte Zaure.'
      );
      return;
    }
    if (!password) {
      setErrorMessage('Veuillez saisir votre mot de passe.');
      return;
    }

    setIsLoading(true);
    try {
      await syncRememberPreference(trimmedEmail);
      const { user, error } = await zaureService.signIn(trimmedEmail, password);
      if (error) {
        setErrorMessage(error);
      } else if (user) {
        onAuthSuccess(user);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erreur lors de la connexion.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);
    try {
      await syncRememberPreference();
      const { user, error } = await zaureService.signInWithGoogle();
      if (error) {
        setErrorMessage(error);
      } else if (user) {
        onAuthSuccess(user);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Échec de la connexion avec Google.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMessage('Veuillez renseigner une adresse e-mail valide.');
      return;
    }

    setIsLoading(true);
    try {
      const { success, error } = await zaureService.sendPasswordReset(trimmedEmail);
      if (error) {
        setErrorMessage(error);
      } else if (success) {
        setSuccessMessage(
          `Un lien de réinitialisation sécurisé a été envoyé à ${trimmedEmail}. Vérifiez votre boîte de réception.`
        );
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message || "Erreur lors de l'envoi du lien de réinitialisation."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden zaure-grad-canvas-soft flex flex-col items-center justify-center px-4 py-8 text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-100 dark:selection:bg-blue-900/50">
      <ZaureGeometricBackdrop variant="auth" />

      <div className="relative z-10 w-full max-w-[440px] mx-auto zaure-animate-scale-in">
        {/* Top Back to Landing & PWA Install */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <Link
            to="/"
            className="min-h-[40px] inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-400 bg-white/85 dark:bg-slate-900/85 hover:bg-white dark:hover:bg-slate-900 border border-blue-100 dark:border-slate-700 px-3.5 py-2 rounded-full zaure-shadow-xs zaure-btn-press"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Retour à l'accueil</span>
          </Link>
          <PWAInstallButton compact />
        </div>

        {/* Centered Luminous Auth Card */}
        <section className={`w-full zaure-card ${ZAURE_GLOWS.soft} rounded-[28px] p-7 sm:p-9 border-blue-100/90 dark:border-slate-800`}>
          {/* Top Brand Lockup */}
          <div className="flex flex-col items-center text-center">
            <Link
              to="/"
              className="inline-flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 rounded-xl"
            >
              <span className={`w-12 h-12 rounded-2xl zaure-grad-primary flex items-center justify-center text-white font-black text-2xl ${ZAURE_GLOWS.blue}`}>
                Z
              </span>
              <span className="flex flex-col items-start">
                <span className="text-3xl font-extrabold tracking-tight text-blue-600 dark:text-blue-400 leading-none">
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

            {authMode === 'login' ? (
              <>
                <h1 className="mt-5 text-2xl sm:text-[28px] font-extrabold text-slate-950 dark:text-white tracking-tight">
                  Connexion
                </h1>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 font-medium">
                  Accédez à votre compte en toute sécurité
                </p>
              </>
            ) : (
              <>
                <h1 className="mt-5 text-2xl font-extrabold text-slate-950 dark:text-white tracking-tight">
                  Mot de passe oublié
                </h1>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 font-medium">
                  Recevez un lien sécurisé par e-mail
                </p>
              </>
            )}
          </div>

          {/* Notifications / Errors */}
          {errorMessage && (
            <div
              role="alert"
              className="mt-5 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300 rounded-2xl flex items-start gap-2.5 animate-fadeIn"
            >
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <span className="font-semibold flex-1 leading-snug">{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div
              role="status"
              className="mt-5 p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-800 dark:text-emerald-300 rounded-2xl flex items-start gap-2.5 animate-fadeIn"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span className="font-semibold flex-1 leading-snug">{successMessage}</span>
            </div>
          )}

          {/* ======================================================== */}
          {/* VUE 1 : CONNEXION                                        */}
          {/* ======================================================== */}
          {authMode === 'login' && (
            <div className="mt-6">
              {authMethod === 'email' ? (
                <form onSubmit={handleLoginSubmit} className="space-y-4" noValidate>
                  {/* Email Input Pill with vertical hairline divider */}
                  <div>
                    <label htmlFor="login-email" className="sr-only">
                      Adresse e-mail
                    </label>
                    <div className="flex items-center min-h-[50px] rounded-full border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800/80 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20 overflow-hidden transition">
                      <span className="pl-4 pr-3 py-3 border-r border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4" />
                      </span>
                      <input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        placeholder="Adresse e-mail"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="flex-1 min-w-0 text-sm px-3.5 py-2.5 bg-transparent focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                  {/* Password Input Pill with vertical hairline divider + eye toggle */}
                  <div>
                    <label htmlFor="login-password" className="sr-only">
                      Mot de passe
                    </label>
                    <div className="flex items-center min-h-[50px] rounded-full border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800/80 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20 overflow-hidden transition">
                      <span className="pl-4 pr-3 py-3 border-r border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                        <Lock className="w-4 h-4" />
                      </span>
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="Mot de passe"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="flex-1 min-w-0 text-sm px-3.5 py-2.5 bg-transparent focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={
                          showPassword
                            ? 'Masquer le mot de passe'
                            : 'Afficher le mot de passe'
                        }
                        className="pr-4 pl-2 min-h-[44px] flex items-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Remember me & Forgot Password Row */}
                  <div className="flex items-center justify-between gap-2 pt-0.5 px-1">
                    <label
                      htmlFor="login-remember"
                      className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none min-h-[36px]"
                    >
                      <input
                        id="login-remember"
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-600 cursor-pointer"
                      />
                      <span>Se souvenir de moi</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        resetFormState();
                        setAuthMode('forgot_password');
                      }}
                      className="text-xs sm:text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline underline-offset-4 cursor-pointer min-h-[36px]"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>

                  {/* Primary Submit CTA */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full min-h-[52px] py-3 px-6 text-base gap-2.5 disabled:opacity-50 cursor-pointer ${ZAURE_SURFACES.primaryButton}`}
                  >
                    {isLoading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Connexion en cours...</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        <span>Se connecter</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="space-y-4 animate-fadeIn">
                  {!confirmationResult ? (
                    <form onSubmit={handleSendSmsCode} className="space-y-4">
                      <div>
                        <label
                          htmlFor="login-phone"
                          className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 px-2"
                        >
                          Numéro de téléphone (format international)
                        </label>
                        <div className="flex items-center min-h-[50px] rounded-full border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800/80 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20 overflow-hidden transition">
                          <span className="pl-4 pr-3 py-3 border-r border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                            <Smartphone className="w-4 h-4" />
                          </span>
                          <input
                            id="login-phone"
                            type="tel"
                            placeholder="+227 90 12 34 56"
                            required
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            className="flex-1 min-w-0 text-sm px-3.5 py-2.5 bg-transparent focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                          />
                        </div>
                      </div>

                      <div id="recaptcha-container" className="my-2 flex justify-center" />

                      <button
                        type="submit"
                        disabled={isLoading}
                        className={`w-full min-h-[50px] py-3 px-6 text-sm gap-2 disabled:opacity-50 cursor-pointer ${ZAURE_SURFACES.primaryButton}`}
                      >
                        {isLoading ? 'Envoi du SMS...' : 'Envoyer le code SMS'}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifySmsCode} className="space-y-4">
                      <div>
                        <label
                          htmlFor="login-sms-code"
                          className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 px-2"
                        >
                          Code de vérification SMS (6 chiffres)
                        </label>
                        <input
                          id="login-sms-code"
                          type="text"
                          maxLength={6}
                          placeholder="123456"
                          required
                          value={smsCode}
                          onChange={(e) => setSmsCode(e.target.value)}
                          className="w-full min-h-[50px] text-center tracking-widest text-lg font-mono px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 dark:text-slate-100 bg-[#F8FAFC] dark:bg-slate-800/80 focus:bg-white dark:focus:bg-slate-800 transition"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full min-h-[50px] py-3 px-6 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer zaure-btn-press"
                      >
                        {isLoading ? 'Vérification...' : 'Valider le code & Se connecter'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setConfirmationResult(null);
                          setSmsCode('');
                        }}
                        className="w-full text-center text-xs text-blue-600 dark:text-blue-400 hover:underline pt-1 font-semibold cursor-pointer"
                      >
                        Utiliser un autre numéro
                      </button>
                    </form>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      resetFormState();
                      setAuthMethod('email');
                    }}
                    className="w-full text-center text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400 py-1.5 cursor-pointer"
                  >
                    ← Revenir à la connexion par e-mail
                  </button>
                </div>
              )}

              {/* Divider "Ou" */}
              <div className="relative flex py-4 items-center">
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
                <span className="shrink mx-3 text-xs font-semibold text-slate-400 dark:text-slate-500">Ou</span>
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
              </div>

              {/* Google Sign-In Only (Facebook & Apple deliberately excluded) */}
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full min-h-[48px] py-2.5 px-5 rounded-full bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/90 text-slate-800 dark:text-slate-100 font-bold text-sm border border-slate-200 dark:border-slate-700 transition shadow-2xs flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer zaure-btn-press"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#EA4335"
                      d="M12 5.04c1.5 0 2.85.51 3.9 1.5l2.9-2.9C17.05 1.9 14.7 1 12 1 7.35 1 3.4 3.65 1.5 7.5l3.5 2.7C5.85 6.95 8.7 5.04 12 5.04z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.49 12.27c0-.82-.07-1.61-.21-2.38H12v4.51h6.44c-.28 1.46-1.1 2.69-2.34 3.52l3.63 2.82c2.13-1.97 3.36-4.87 3.36-8.47z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5 14.8c-.25-.75-.39-1.55-.39-2.38s.14-1.63.39-2.38L1.5 7.34C.55 9.24 0 11.36 0 13.6s.55 4.36 1.5 6.26l3.5-2.06z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.63-2.82c-1.01.68-2.3 1.09-3.9 1.09-3.3 0-6.15-1.91-7.15-4.78l-3.5 2.7C3.4 20.35 7.35 23 12 23z"
                    />
                  </svg>
                  <span>Continuer avec Google</span>
                </button>

                {authMethod === 'email' && (
                  <button
                    type="button"
                    onClick={() => {
                      resetFormState();
                      setAuthMethod('phone');
                    }}
                    className="w-full min-h-[40px] py-2 px-4 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400 hover:bg-blue-50/60 dark:hover:bg-slate-800/80 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Se connecter par téléphone (SMS)</span>
                  </button>
                )}
              </div>

              {/* Bottom Create Account Link */}
              <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center">
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  Vous n’avez pas de compte ?{' '}
                  <Link
                    to={REGISTRATION_ROUTES.IDENTITE}
                    onClick={() => resetFormState()}
                    className="font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline"
                  >
                    Créer un compte
                  </Link>
                </p>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* VUE 2 : MOT DE PASSE OUBLIÉ                             */}
          {/* ======================================================== */}
          {authMode === 'forgot_password' && (
            <form onSubmit={handlePasswordResetSubmit} className="mt-6 space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/35 border border-blue-100 dark:border-blue-900/50">
                <div className={`w-9 h-9 rounded-xl zaure-grad-primary text-white flex items-center justify-center shrink-0 ${ZAURE_GLOWS.soft}`}>
                  <KeyRound className="w-4 h-4" />
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Saisissez l'adresse e-mail associée à votre compte Zaure pour recevoir un lien
                  officiel de réinitialisation.
                </p>
              </div>

              <div>
                <label htmlFor="reset-email" className="sr-only">
                  Adresse e-mail du compte
                </label>
                <div className="flex items-center min-h-[50px] rounded-full border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800/80 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20 overflow-hidden transition">
                  <span className="pl-4 pr-3 py-3 border-r border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    placeholder="Adresse e-mail du compte"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 min-w-0 text-sm px-3.5 py-2.5 bg-transparent focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    resetFormState();
                    setAuthMode('login');
                  }}
                  className="min-h-[46px] px-5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer zaure-btn-press"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`flex-1 min-h-[46px] px-6 py-2.5 text-xs sm:text-sm gap-2 disabled:opacity-50 cursor-pointer ${ZAURE_SURFACES.primaryButton}`}
                >
                  {isLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Envoi...</span>
                    </>
                  ) : (
                    <span>Envoyer le lien</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
