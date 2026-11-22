import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  LogOut,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  KeyRound
} from 'lucide-react';
import { adminService } from '../services/adminService';
import { AdminSessionContext, BOOTSTRAP_OWNER_EMAIL } from '../types';

interface AdminAuthGateProps {
  session: AdminSessionContext | null;
  onSessionRefresh: () => Promise<void>;
  onNavigateUserApp: () => void;
}

export const AdminAuthGate: React.FC<AdminAuthGateProps> = ({
  session,
  onSessionRefresh,
  onNavigateUserApp
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    if (!email.trim() || !password) {
      setErrorMsg('Veuillez saisir votre adresse e-mail et votre mot de passe.');
      return;
    }
    setIsLoading(true);
    const res = await adminService.signInAdminWithEmail(email, password);
    if (res.error) {
      setErrorMsg(res.error);
    } else {
      await onSessionRefresh();
    }
    setIsLoading(false);
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setIsLoading(true);
    const res = await adminService.signInAdminWithGoogle();
    if (res.error) {
      setErrorMsg(res.error);
    } else {
      await onSessionRefresh();
    }
    setIsLoading(false);
  };

  const handleResendVerification = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setIsLoading(true);
    const res = await adminService.resendAdminVerificationEmail();
    if (res.error) {
      setErrorMsg(res.error);
    } else {
      setInfoMsg("E-mail de vérification envoyé. Vérifiez votre boîte de réception puis actualisez votre session.");
    }
    setIsLoading(false);
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    await adminService.signOutAdmin();
    await onSessionRefresh();
    setIsLoading(false);
  };

  if (session && !session.isAuthorized) {
    const needsEmailVerify =
      session.email.toLowerCase() === BOOTSTRAP_OWNER_EMAIL.toLowerCase() && !session.emailVerified;

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
          <div className="px-6 py-5 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white">
                Z
              </div>
              <div>
                <p className="text-sm font-bold tracking-tight">Zaure Console Administration</p>
                <p className="text-[11px] text-slate-400 font-mono">AUTH / RBAC GATE</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold bg-red-500/20 text-red-300 border border-red-500/30">
              {session.role}
            </span>
          </div>

          <div className="p-6 space-y-4">
            {needsEmailVerify ? (
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <KeyRound className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Vérification d&apos;e-mail requise pour le Super Administrateur</span>
                </div>
                <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                  Votre compte propriétaire (<span className="font-mono font-semibold">{session.email}</span>) est reconnu, mais votre adresse e-mail n&apos;est pas encore marquée comme vérifiée dans Firebase Authentication.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleResendVerification}
                    className="min-h-[40px] px-3.5 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
                  >
                    Envoyer l&apos;e-mail de vérification
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={onSessionRefresh}
                    className="min-h-[40px] px-3.5 py-2 text-xs font-semibold bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 rounded-lg hover:bg-amber-100 dark:hover:bg-slate-700"
                  >
                    J&apos;ai vérifié — Actualiser
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-900 dark:text-red-200 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span>Accès administratif non autorisé</span>
                </div>
                <p className="text-xs leading-relaxed text-red-800 dark:text-red-300">
                  Le compte connecté (<span className="font-mono font-semibold">{session.email || session.uid}</span>) possède le rôle standard <span className="font-mono font-semibold">USER</span>. L&apos;accès à <span className="font-mono">/admin</span> est réservé aux comptes <span className="font-mono">SUPER_ADMIN</span>, <span className="font-mono">ADMIN</span> et <span className="font-mono">MODERATOR</span>.
                </p>
              </div>
            )}

            {errorMsg && (
              <p className="text-xs text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-lg p-3">
                {errorMsg}
              </p>
            )}
            {infoMsg && (
              <p className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-lg p-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{infoMsg}</span>
              </p>
            )}

            <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onNavigateUserApp}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Retour à la plateforme Zaure</span>
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleSignOut}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 rounded-lg"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Changer de compte</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col lg:flex-row">
      <div className="lg:w-5/12 bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-800 p-8 lg:p-12 flex flex-col justify-between text-white">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center font-black text-xl">
              Z
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight">Zaure Admin</h1>
              <p className="text-xs text-slate-400 font-mono">GOVERNANCE & OPERATIONS</p>
            </div>
          </div>

          <div className="mt-10 space-y-4">
            <h2 className="text-2xl font-extrabold tracking-tight text-white">
              Centre de supervision & gouvernance SaaS
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Console d&apos;administration dédiée au pilotage des utilisateurs, à la modération temps réel, à la gestion des communautés, aux médias Google Drive et à l&apos;audit de sécurité.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-3 text-xs">
            <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-200">Contrôle d&apos;accès RBAC strict</p>
                <p className="text-slate-400 mt-0.5">
                  Hiérarchie vérifiée <span className="font-mono text-slate-300">SUPER_ADMIN</span>, <span className="font-mono text-slate-300">ADMIN</span> et <span className="font-mono text-slate-300">MODERATOR</span> appliquée côté Firestore & API.
                </p>
              </div>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 flex items-start gap-3">
              <Lock className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-200">Traçabilité & Journal d&apos;audit immuable</p>
                <p className="text-slate-400 mt-0.5">
                  Chaque intervention administrative est horodatée et journalisée sans altération possible.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>Espace indépendant /admin</span>
          <button
            type="button"
            onClick={onNavigateUserApp}
            className="text-slate-300 hover:text-white inline-flex items-center gap-1 font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Ouvrir l&apos;app utilisateur</span>
          </button>
        </div>
      </div>

      <div className="flex-1 bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs p-6 sm:p-8">
          <div className="mb-6">
            <p className="text-[11px] font-mono font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Authentification Administrateur
            </p>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
              Connexion à la console
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Identifiez-vous avec votre compte habilité Firebase Authentication.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Adresse e-mail professionnelle
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@zaure.com"
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Afficher ou masquer le mot de passe"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="min-h-[44px] w-full py-2.5 px-4 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              <span>Accéder à la console /admin</span>
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
            <span className="text-[11px] font-medium text-slate-400 uppercase">ou</span>
            <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
          </div>

          <button
            type="button"
            disabled={isLoading}
            onClick={handleGoogleLogin}
            className="min-h-[44px] w-full py-2.5 px-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2.5 disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.19 14.97 0 12 0 7.31 0 3.25 2.69 1.28 6.61l3.66 2.84C5.8 6.86 8.65 5 12 5z" />
              <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.7 2.87c2.16-1.99 3.72-4.92 3.72-8.69z" />
              <path fill="#FBBC05" d="M4.94 14.55A7.01 7.01 0 0 1 4.58 12c0-.88.15-1.73.36-2.55L1.28 6.61A11.96 11.96 0 0 0 0 12c0 1.94.46 3.77 1.28 5.39l3.66-2.84z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.97-1.07 7.96-2.91l-3.7-2.87c-1.08.72-2.45 1.15-4.26 1.15-3.35 0-6.2-1.86-7.06-4.45L1.28 17.76C3.25 21.31 7.31 24 12 24z" />
            </svg>
            <span>Continuer avec Google</span>
          </button>
        </div>
      </div>
    </div>
  );
};
