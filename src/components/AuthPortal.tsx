import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Mail,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  KeyRound,
} from 'lucide-react';
import { zaureService } from '../firebaseClient';
import { Circle, UserProfile } from '../types';
import { REGISTRATION_ROUTES } from '../constants/registration';
import { PWAInstallButton } from './PWAInstallButton';

interface AuthPortalProps {
  onAuthSuccess: (user: UserProfile) => void;
  circles?: Circle[];
  initialEmail?: string;
}

export default function AuthPortal({
  onAuthSuccess,
  initialEmail = '',
}: AuthPortalProps) {
  const location = useLocation();
  const routePrefilledEmail =
    (location.state as { prefilledEmail?: string } | null)?.prefilledEmail || initialEmail;

  // Mode: 'login' | 'forgot_password'
  const [authMode, setAuthMode] = useState<'login' | 'forgot_password'>('login');

  // Form fields
  const [email, setEmail] = useState(routePrefilledEmail);
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (routePrefilledEmail) {
      setEmail(routePrefilledEmail);
      setAuthMode('login');
      setAuthMethod('email');
    }
  }, [routePrefilledEmail]);

  // UI states
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Phone Auth States
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [recaptchaVerifierInstance, setRecaptchaVerifierInstance] = useState<any>(null);

  const handleSendSmsCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!phoneNumber.trim() || !phoneNumber.startsWith('+')) {
      setErrorMessage('Veuillez entrer un numéro de téléphone valide au format international (ex: +22790123456).');
      return;
    }

    setIsLoading(true);
    try {
      if (recaptchaVerifierInstance) {
        try {
          recaptchaVerifierInstance.clear();
        } catch {
          // ignore
        }
      }
      const verifier = zaureService.createRecaptchaVerifier('recaptcha-container');
      setRecaptchaVerifierInstance(verifier);

      const { confirmationResult: res, error } = await zaureService.signInWithPhone(phoneNumber.trim(), verifier);
      if (error) {
        setErrorMessage(error);
      } else if (res) {
        setConfirmationResult(res);
        setSuccessMessage('Code SMS envoyé avec succès !');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de l’envoi du SMS.');
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
      const { user, error } = await zaureService.confirmPhoneCode(confirmationResult, smsCode.trim(), {
        nom: 'Membre Zaure',
        role: 'utilisateur',
        bio: 'Inscrit par téléphone sur Zaure',
        langue: 'fr',
        avatarUrl: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=200'
      });
      if (error) {
        setErrorMessage(error);
      } else if (user) {
        onAuthSuccess(user);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Code SMS incorrect.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetFormState = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setShowPassword(false);
    setConfirmationResult(null);
    setSmsCode('');
  };

  // Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim()) {
      setErrorMessage('Veuillez saisir votre adresse email.');
      return;
    }
    if (!password) {
      setErrorMessage('Veuillez saisir votre mot de passe.');
      return;
    }

    setIsLoading(true);
    try {
      const { user, error } = await zaureService.signIn(email.trim(), password);
      if (error) {
        setErrorMessage(error);
      } else if (user) {
        onAuthSuccess(user);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de la connexion.');
    } finally {
      setIsLoading(false);
    }
  };

  // Google Sign-In
  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const { user, error } = await zaureService.signInWithGoogle();
      if (error) {
        setErrorMessage(error);
      } else if (user) {
        onAuthSuccess(user);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Échec de la connexion avec Google.');
    } finally {
      setIsLoading(false);
    }
  };

  // Password Reset Submit
  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Veuillez renseigner une adresse email valide.');
      return;
    }

    setIsLoading(true);
    try {
      const { success, error } = await zaureService.sendPasswordReset(email);
      if (error) {
        setErrorMessage(error);
      } else if (success) {
        setSuccessMessage(`Un lien de réinitialisation sécurisé a été envoyé à ${email}. Vérifiez votre boîte de réception.`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de l\'envoi du lien de réinitialisation.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col items-center justify-center px-4 py-6 text-slate-800 font-sans selection:bg-blue-100">
      <div className="w-full max-w-[430px] mx-auto">
        {/* Centered Zaure Logo */}
        <div className="relative flex items-center justify-center mb-6 px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black text-2xl shadow-sm">
              Z
            </div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-3xl sm:text-4xl font-black text-blue-600 tracking-tight">
                Zaure
              </h1>
              <span className="w-2 h-2 rounded-full bg-red-600"></span>
            </div>
          </div>
          <div className="absolute right-0">
            <PWAInstallButton compact />
          </div>
        </div>

        {/* Authentication Card */}
        <section className="w-full">
          
          {/* Main Card */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-7 shadow-xl border border-slate-200/90 relative">
            
            {/* Notifications / Errors */}
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl flex items-start gap-2.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <span className="font-medium flex-1">{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 rounded-xl flex items-start gap-2.5 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span className="font-medium flex-1">{successMessage}</span>
              </div>
            )}

            {/* ======================================================== */}
            {/* VUE 1 : CONNEXION DIRECTE                                */}
            {/* ======================================================== */}
            {authMode === 'login' && (
              <>
                <div className="flex p-1 bg-slate-100 rounded-xl mb-4 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => { setAuthMethod('email'); resetFormState(); }}
                    className={`flex-1 py-2 rounded-lg transition ${authMethod === 'email' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'}`}
                  >
                    Par Email
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthMethod('phone'); resetFormState(); }}
                    className={`flex-1 py-2 rounded-lg transition ${authMethod === 'phone' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'}`}
                  >
                    Par Téléphone (SMS)
                  </button>
                </div>

                {authMethod === 'email' ? (
                  <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                    <div>
                      <div className="relative">
                        <input
                          type="email"
                          placeholder="Adresse e-mail universitaire ou personnelle"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full text-sm px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 placeholder:text-slate-400 bg-slate-50 focus:bg-white transition"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Mot de passe"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full text-sm pl-4 pr-11 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 placeholder:text-slate-400 bg-slate-50 focus:bg-white transition"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-base rounded-xl transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                          Connexion en cours...
                        </span>
                      ) : (
                        <span>Se connecter</span>
                      )}
                    </button>
                  </form>
                ) : (
                  <div className="space-y-3.5">
                    {!confirmationResult ? (
                      <form onSubmit={handleSendSmsCode} className="space-y-3.5">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Numéro de téléphone (Format international ex: +227...)
                          </label>
                          <input
                            type="tel"
                            placeholder="+227 90 12 34 56"
                            required
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            className="w-full text-sm px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 bg-slate-50 focus:bg-white transition"
                          />
                        </div>

                        <div id="recaptcha-container" className="my-2 flex justify-center"></div>

                        <button
                          type="submit"
                          disabled={isLoading}
                          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-base rounded-xl transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isLoading ? 'Envoi du SMS...' : 'Envoyer le code SMS'}
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleVerifySmsCode} className="space-y-3.5">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Code de vérification SMS (6 chiffres)
                          </label>
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="123456"
                            required
                            value={smsCode}
                            onChange={(e) => setSmsCode(e.target.value)}
                            className="w-full text-center tracking-widest text-lg font-mono px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 bg-slate-50 focus:bg-white transition"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={isLoading}
                          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base rounded-xl transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isLoading ? 'Vérification...' : 'Valider le code & Se connecter'}
                        </button>

                        <button
                          type="button"
                          onClick={() => { setConfirmationResult(null); setSmsCode(''); }}
                          className="w-full text-center text-xs text-blue-600 hover:underline pt-2 font-semibold"
                        >
                          ← Utiliser un autre numéro ou méthode
                        </button>
                      </form>
                    )}
                  </div>
                )}

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      resetFormState();
                      setAuthMode('forgot_password');
                    }}
                    className="text-xs text-blue-700 hover:text-blue-800 font-semibold hover:underline"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>

                {/* Divider Line */}
                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink mx-3 text-[11px] text-slate-400 uppercase font-bold tracking-wider">OU</span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                {/* Google Sign In */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-200 rounded-xl transition shadow-2xs flex items-center justify-center gap-2.5"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5.04c1.5 0 2.85.51 3.9 1.5l2.9-2.9C17.05 1.9 14.7 1 12 1 7.35 1 3.4 3.65 1.5 7.5l3.5 2.7C5.85 6.95 8.7 5.04 12 5.04z" />
                    <path fill="#4285F4" d="M23.49 12.27c0-.82-.07-1.61-.21-2.38H12v4.51h6.44c-.28 1.46-1.1 2.69-2.34 3.52l3.63 2.82c2.13-1.97 3.36-4.87 3.36-8.47z" />
                    <path fill="#FBBC05" d="M5 14.8c-.25-.75-.39-1.55-.39-2.38s.14-1.63.39-2.38L1.5 7.34C.55 9.24 0 11.36 0 13.6s.55 4.36 1.5 6.26l3.5-2.06z" />
                    <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.63-2.82c-1.01.68-2.3 1.09-3.9 1.09-3.3 0-6.15-1.91-7.15-4.78l-3.5 2.7C3.4 20.35 7.35 23 12 23z" />
                  </svg>
                  <span>Continuer avec Google</span>
                </button>

                {/* Create Account High-Impact Link to Page 1 (/inscription/identite) */}
                <div className="pt-2 text-center">
                  <Link
                    to={REGISTRATION_ROUTES.IDENTITE}
                    onClick={() => resetFormState()}
                    className="w-full sm:w-auto px-6 py-3 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-extrabold text-sm rounded-xl transition shadow-sm inline-flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 text-amber-200" />
                    <span>Créer un nouveau compte</span>
                  </Link>
                </div>
              </>
            )}

            {/* ======================================================== */}
            {/* VUE 2 : MOT DE PASSE OUBLIÉ                             */}
            {/* ======================================================== */}
            {authMode === 'forgot_password' && (
              <form onSubmit={handlePasswordResetSubmit} className="space-y-4 animate-fadeIn">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm">Retrouvez votre compte</h3>
                    <p className="text-[11px] text-slate-500">Réinitialisation sécurisée par e-mail.</p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Saisissez l'adresse e-mail associée à votre compte Zaure. Nous vous enverrons un lien officiel Firebase pour réinitialiser votre mot de passe.
                </p>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Adresse e-mail du compte
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      placeholder="Ex: mahamadou@zaure.org"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 bg-slate-50 focus:bg-white transition"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      resetFormState();
                      setAuthMode('login');
                    }}
                    className="px-4 py-2 border border-slate-200 text-slate-600 text-xs rounded-xl hover:bg-slate-50 font-bold transition"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        Envoi...
                      </span>
                    ) : (
                      <span>Envoyer le lien</span>
                    )}
                  </button>
                </div>
              </form>
            )}

          </div>
        </section>
      </div>
    </div>
  );
}
