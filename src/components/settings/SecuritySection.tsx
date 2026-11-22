import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  Laptop,
  Loader2,
  LogOut,
  MailCheck,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Tablet,
  Trash2
} from 'lucide-react';
import { TotpSecret } from 'firebase/auth';
import { UserProfile, UserSessionRecord } from '../../types';
import { auth, zaureService } from '../../firebaseClient';
import {
  getOrCreateDeviceId,
  MfaCapabilitiesState,
  settingsService
} from '../../services/settingsService';
import ConfirmActionModal from './ConfirmActionModal';

interface SecuritySectionProps {
  currentUser: UserProfile;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}

function formatDateTime(iso?: string): string {
  if (!iso) return 'Inconnue';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Inconnue';
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function SecuritySection({ currentUser, onNotify }: SecuritySectionProps) {
  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [pwdBusy, setPwdBusy] = useState(false);
  const [resetEmailBusy, setResetEmailBusy] = useState(false);

  // Email verification
  const [emailVerified, setEmailVerified] = useState<boolean>(() =>
    Boolean(auth?.currentUser?.emailVerified)
  );
  const [checkingVerification, setCheckingVerification] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);

  // 2FA / MFA
  const [mfaState, setMfaState] = useState<MfaCapabilitiesState | null>(null);
  const [mfaLoading, setMfaLoading] = useState(true);
  const [totpSetup, setTotpSetup] = useState<{
    secret: TotpSecret;
    otpAuthUri: string;
    manualKey: string;
  } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaNote, setMfaNote] = useState<string | null>(null);

  // Sessions & Devices
  const [sessions, setSessions] = useState<UserSessionRecord[]>([]);
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);
  const [revokingBusy, setRevokingBusy] = useState(false);
  const currentDeviceId = getOrCreateDeviceId();

  useEffect(() => {
    setEmailVerified(Boolean(auth?.currentUser?.emailVerified));
    settingsService.getMfaStatus().then((state) => {
      setMfaState(state);
      setMfaLoading(false);
    });
    const unsub = settingsService.subscribeUserSessions(currentUser.id, setSessions);
    return () => unsub();
  }, [currentUser.id]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      onNotify('Le nouveau mot de passe doit contenir au moins 6 caractères.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      onNotify('Les mots de passe saisis ne correspondent pas.', 'error');
      return;
    }
    setPwdBusy(true);
    try {
      const res = await zaureService.changeUserPassword(
        newPassword,
        currentPassword || undefined
      );
      if (res.success) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        onNotify('Mot de passe modifié avec succès.');
      } else {
        onNotify(res.error || 'Échec de mise à jour du mot de passe.', 'error');
      }
    } finally {
      setPwdBusy(false);
    }
  };

  const handleSendResetEmail = async () => {
    const email = currentUser.email || auth?.currentUser?.email;
    if (!email) {
      onNotify('Aucune adresse e-mail associée à ce compte.', 'error');
      return;
    }
    setResetEmailBusy(true);
    try {
      const res = await zaureService.sendPasswordReset(email);
      if (res.success) {
        onNotify(`Lien de réinitialisation envoyé à ${email}.`);
      } else {
        onNotify(res.error || 'Impossible d’envoyer l’e-mail.', 'error');
      }
    } finally {
      setResetEmailBusy(false);
    }
  };

  const handleRefreshVerification = async () => {
    setCheckingVerification(true);
    try {
      const status = await settingsService.refreshEmailVerificationStatus();
      setEmailVerified(status.emailVerified);
      onNotify(
        status.emailVerified
          ? 'Votre adresse e-mail est bien vérifiée.'
          : 'Adresse e-mail pas encore confirmée. Vérifiez votre boîte de réception.'
      );
    } finally {
      setCheckingVerification(false);
    }
  };

  const handleResendVerification = async () => {
    setSendingVerification(true);
    try {
      const res = await zaureService.sendEmailVerificationLink();
      if (res.success) {
        onNotify('E-mail de vérification envoyé.');
      } else {
        onNotify(res.error || 'Impossible d’envoyer l’e-mail de vérification.', 'error');
      }
    } finally {
      setSendingVerification(false);
    }
  };

  const handleStartMfaSetup = async () => {
    setMfaBusy(true);
    setMfaNote(null);
    try {
      const res = await settingsService.startTotpMfaEnrollment();
      if (res.secret && res.otpAuthUri && res.manualKey) {
        setTotpSetup({
          secret: res.secret,
          otpAuthUri: res.otpAuthUri,
          manualKey: res.manualKey
        });
      } else {
        setMfaNote(
          res.error || "L'inscription TOTP n'a pas pu démarrer sur ce compte."
        );
      }
    } finally {
      setMfaBusy(false);
    }
  };

  const handleConfirmTotpEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpSetup || totpCode.trim().length < 6) return;
    setMfaBusy(true);
    try {
      const res = await settingsService.finalizeTotpMfaEnrollment(
        totpSetup.secret,
        totpCode
      );
      if (res.success) {
        setTotpSetup(null);
        setTotpCode('');
        const refreshed = await settingsService.getMfaStatus();
        setMfaState(refreshed);
        onNotify('Double authentification activée.');
      } else {
        onNotify(res.error || 'Code TOTP invalide.', 'error');
      }
    } finally {
      setMfaBusy(false);
    }
  };

  const handleUnenrollMfa = async (factorUid: string) => {
    setMfaBusy(true);
    try {
      const res = await settingsService.unenrollMfaFactor(factorUid);
      if (res.success) {
        const refreshed = await settingsService.getMfaStatus();
        setMfaState(refreshed);
        onNotify('Facteur de double authentification retiré.');
      } else {
        onNotify(res.error || 'Impossible de retirer ce facteur.', 'error');
      }
    } finally {
      setMfaBusy(false);
    }
  };

  const handleRevokeOtherSessions = async () => {
    setRevokingBusy(true);
    try {
      const count = await settingsService.revokeOtherSessions(currentUser.id);
      setConfirmRevokeAll(false);
      onNotify(
        count > 0
          ? `${count} autre(s) session(s) ont été déconnectées.`
          : 'Aucune autre session active à déconnecter.'
      );
    } catch {
      onNotify('Erreur lors de la révocation des sessions.', 'error');
    } finally {
      setRevokingBusy(false);
    }
  };

  const activeSessions = sessions.filter((s) => !s.revoked);
  const otherActiveCount = activeSessions.filter((s) => s.deviceId !== currentDeviceId).length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Password Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/85 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-950 dark:text-white">
                Mot de passe & Sécurité
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Renforcez l’accès à votre compte et contrôlez vos appareils connectés.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
              Modifier le mot de passe
            </h3>
            <button
              type="button"
              onClick={() => setShowPasswords((v) => !v)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1"
            >
              {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showPasswords ? 'Masquer' : 'Afficher'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                Mot de passe actuel
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Requis pour validation"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F0F2F5] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                Nouveau mot de passe
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 caractères"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F0F2F5] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                Confirmer le nouveau
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Répétez le mot de passe"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F0F2F5] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="button"
              disabled={resetEmailBusy}
              onClick={handleSendResetEmail}
              className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition"
            >
              {resetEmailBusy ? 'Envoi...' : 'Recevoir un lien de réinitialisation par e-mail'}
            </button>

            <button
              type="submit"
              disabled={pwdBusy}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 transition"
            >
              {pwdBusy && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Mettre à jour le mot de passe</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. Email Verification & 2FA Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/85 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                emailVerified
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
              }`}
            >
              <MailCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-950 dark:text-white flex items-center gap-2">
                <span>Vérification de l’adresse e-mail</span>
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    emailVerified
                      ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                      : 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  {emailVerified ? 'Vérifiée' : 'En attente'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {currentUser.email || auth?.currentUser?.email || 'Aucun e-mail lié'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={checkingVerification}
              onClick={handleRefreshVerification}
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingVerification ? 'animate-spin' : ''}`} />
              <span>Actualiser</span>
            </button>

            {!emailVerified && (
              <button
                type="button"
                disabled={sendingVerification}
                onClick={handleResendVerification}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition"
              >
                {sendingVerification ? 'Envoi...' : 'Renvoyer le lien'}
              </button>
            )}
          </div>
        </div>

        {/* 2FA Honest State */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-950 dark:text-white">
                  Double authentification (2FA / MFA)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Protection supplémentaire par application d’authentification (TOTP) via Firebase Auth.
                </p>
              </div>
            </div>

            {!mfaLoading && mfaState && mfaState.enrolledFactors.length === 0 && !totpSetup && (
              <button
                type="button"
                disabled={mfaBusy || !mfaState.supported}
                onClick={handleStartMfaSetup}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shrink-0 transition"
              >
                {mfaBusy ? 'Préparation...' : 'Configurer la 2FA'}
              </button>
            )}
          </div>

          {mfaLoading ? (
            <p className="text-xs text-slate-500">Vérification des capacités MFA...</p>
          ) : mfaState?.enrolledFactors && mfaState.enrolledFactors.length > 0 ? (
            <div className="space-y-2">
              {mfaState.enrolledFactors.map((factor) => (
                <div
                  key={factor.uid}
                  className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {factor.displayName}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Active ({factor.factorId})
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={mfaBusy}
                    onClick={() => handleUnenrollMfa(factor.uid)}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Désactiver</span>
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {totpSetup && (
            <form
              onSubmit={handleConfirmTotpEnrollment}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3"
            >
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                Ajoutez cette clé secrète dans Google Authenticator ou Authy :
              </p>
              <code className="block p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono select-all text-slate-800 dark:text-slate-200 break-all">
                {totpSetup.manualKey}
              </code>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="Code à 6 chiffres"
                  className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm"
                />
                <button
                  type="submit"
                  disabled={mfaBusy || totpCode.trim().length < 6}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  Valider le code
                </button>
                <button
                  type="button"
                  onClick={() => setTotpSetup(null)}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}

          {(mfaNote || mfaState?.unsupportedReason) && (
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{mfaNote || mfaState?.unsupportedReason}</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Active Sessions & Login History */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/85 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-950 dark:text-white">
              Appareils connectés & Historique des sessions
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {activeSessions.length} session(s) active(s) enregistrée(s) sur votre compte.
            </p>
          </div>

          {otherActiveCount > 0 && (
            <button
              type="button"
              onClick={() => setConfirmRevokeAll(true)}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-950/80 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs font-bold flex items-center gap-2 transition shrink-0"
            >
              <LogOut className="w-4 h-4" />
              <span>Déconnecter les autres appareils ({otherActiveCount})</span>
            </button>
          )}
        </div>

        {sessions.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
            Aucune session enregistrée pour le moment.
          </p>
        ) : (
          <div className="space-y-2.5">
            {sessions.slice(0, 12).map((session) => {
              const isCurrent = session.deviceId === currentDeviceId && !session.revoked;
              const DeviceIcon =
                session.deviceType === 'mobile'
                  ? Smartphone
                  : session.deviceType === 'tablet'
                  ? Tablet
                  : Laptop;
              return (
                <div
                  key={session.id}
                  className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isCurrent
                      ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60'
                      : session.revoked
                      ? 'bg-slate-50/60 dark:bg-slate-800/30 border-slate-200/70 dark:border-slate-800 opacity-75'
                      : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isCurrent
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <DeviceIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {session.deviceName}
                        </p>
                        {isCurrent && (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                            Appareil actuel
                          </span>
                        )}
                        {session.revoked && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            Déconnecté
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <Clock className="w-3 h-3 shrink-0" />
                        <span>Dernière activité : {formatDateTime(session.lastActiveAt)}</span>
                        <span>·</span>
                        <span>Connexion : {formatDateTime(session.createdAt)}</span>
                      </p>
                    </div>
                  </div>

                  {!isCurrent && !session.revoked && (
                    <button
                      type="button"
                      onClick={() =>
                        settingsService
                          .revokeSessionById(session.id)
                          .then(() => onNotify('Appareil déconnecté.'))
                      }
                      className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 text-xs font-bold text-slate-700 dark:text-slate-200 transition shrink-0"
                    >
                      Déconnecter
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmActionModal
        isOpen={confirmRevokeAll}
        title="Déconnecter les autres appareils ?"
        description="Toutes vos autres sessions ouvertes sur d'autres navigateurs ou téléphones seront automatiquement fermées. Cet appareil restera connecté."
        confirmLabel="Déconnecter les autres"
        tone="warning"
        isLoading={revokingBusy}
        onConfirm={handleRevokeOtherSessions}
        onCancel={() => setConfirmRevokeAll(false)}
      />
    </div>
  );
}
