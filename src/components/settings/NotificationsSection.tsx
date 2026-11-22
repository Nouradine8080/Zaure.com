import React, { useState } from 'react';
import {
  AtSign,
  Bell,
  BellRing,
  GraduationCap,
  Heart,
  Info,
  Mail,
  MessageCircle,
  MessageSquare,
  ShieldAlert,
  Sparkles,
  UserPlus,
  Users
} from 'lucide-react';
import { UserSettings } from '../../types';
import {
  getPushNotificationPermission,
  isPushNotificationSupported,
  requestBrowserPushPermission
} from '../../services/notificationService';

interface NotificationsSectionProps {
  settings: UserSettings;
  onSaveSettings: (patch: Partial<UserSettings>) => Promise<boolean>;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}

interface ToggleRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}

function ToggleRow({ icon, title, description, checked, disabled, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-b-0">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs sm:text-[13px] font-bold text-slate-900 dark:text-slate-100">
            {title}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${
          checked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

export default function NotificationsSection({
  settings,
  onSaveSettings,
  onNotify
}: NotificationsSectionProps) {
  const pushSupported = isPushNotificationSupported();
  const [pushPerm, setPushPerm] = useState<NotificationPermission | 'unsupported'>(() =>
    getPushNotificationPermission()
  );
  const [requestingPush, setRequestingPush] = useState(false);

  const toggleSetting = async (key: keyof UserSettings, value: boolean) => {
    const ok = await onSaveSettings({ [key]: value } as Partial<UserSettings>);
    if (ok) {
      onNotify('Préférence de notification mise à jour.');
    } else {
      onNotify('Erreur lors de la sauvegarde.', 'error');
    }
  };

  const handleTogglePush = async (enable: boolean) => {
    if (!pushSupported) {
      onNotify("Les notifications push ne sont pas supportées par ce navigateur.", 'error');
      return;
    }

    if (!enable) {
      await toggleSetting('notif_push_enabled', false);
      return;
    }

    setRequestingPush(true);
    try {
      const perm = await requestBrowserPushPermission();
      setPushPerm(perm);
      if (perm === 'granted') {
        await toggleSetting('notif_push_enabled', true);
      } else if (perm === 'denied') {
        await onSaveSettings({ notif_push_enabled: false });
        onNotify(
          "Autorisation refusée dans le navigateur. Activez-la depuis les paramètres du site.",
          'error'
        );
      } else {
        onNotify('Autorisation de notification non accordée.');
      }
    } finally {
      setRequestingPush(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Activité sociale & interactions */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 sm:p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
              Notifications d’interactions et d’activité
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Choisissez les événements qui génèrent des notifications dans votre centre Zaure.
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <ToggleRow
            icon={<Heart className="w-4 h-4 text-rose-500" />}
            title="J’aime et réactions"
            description="Lorsqu’un membre réagit à vos capsules ou publications."
            checked={settings.notif_reaction !== false}
            onChange={(v) => toggleSetting('notif_reaction', v)}
          />
          <ToggleRow
            icon={<MessageCircle className="w-4 h-4 text-blue-500" />}
            title="Commentaires et réponses"
            description="Lorsqu’on commente vos publications ou répond à vos discussions."
            checked={settings.notif_comment !== false}
            onChange={(v) => toggleSetting('notif_comment', v)}
          />
          <ToggleRow
            icon={<AtSign className="w-4 h-4 text-indigo-500" />}
            title="Mentions (@)"
            description="Lorsque votre nom ou @identifiant est mentionné dans une publication ou un commentaire."
            checked={settings.notif_mention !== false}
            onChange={(v) => toggleSetting('notif_mention', v)}
          />
          <ToggleRow
            icon={<UserPlus className="w-4 h-4 text-emerald-500" />}
            title="Nouveaux abonnés"
            description="Lorsqu’un membre commence à suivre votre profil."
            checked={settings.notif_follower !== false}
            onChange={(v) => toggleSetting('notif_follower', v)}
          />
          <ToggleRow
            icon={<MessageSquare className="w-4 h-4 text-sky-500" />}
            title="Messages privés"
            description="Alertes de nouveaux messages reçus dans votre messagerie."
            checked={settings.notif_message !== false}
            onChange={(v) => toggleSetting('notif_message', v)}
          />
          <ToggleRow
            icon={<Users className="w-4 h-4 text-violet-500" />}
            title="Activité des communautés & cercles"
            description="Invitations, approbations, annonces et nouvelles publications de vos groupes."
            checked={settings.notif_community !== false}
            onChange={(v) => toggleSetting('notif_community', v)}
          />
          <ToggleRow
            icon={<Sparkles className="w-4 h-4 text-amber-500" />}
            title="Capsules de savoir recommandées"
            description="Nouvelles capsules publiées dans vos cercles suivis."
            checked={settings.notif_capsule !== false}
            onChange={(v) => toggleSetting('notif_capsule', v)}
          />
          <ToggleRow
            icon={<GraduationCap className="w-4 h-4 text-teal-500" />}
            title="Demandes de mentorat"
            description="Nouvelles propositions et suivis de mentorat."
            checked={settings.notif_mentorat !== false}
            onChange={(v) => toggleSetting('notif_mentorat', v)}
          />
          <ToggleRow
            icon={<ShieldAlert className="w-4 h-4 text-slate-600 dark:text-slate-300" />}
            title="Alertes système & sécurité"
            description="Annonces importantes de la plateforme et notifications liées à votre compte."
            checked={settings.notif_system !== false}
            onChange={(v) => toggleSetting('notif_system', v)}
          />
        </div>
      </section>

      {/* Canaux & Push navigateur */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <BellRing className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
              Canaux de réception & Notifications navigateur
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Choisissez comment vous souhaitez recevoir vos alertes importantes.
            </p>
          </div>
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
            <Mail className="w-3.5 h-3.5" /> Canal privilégié
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[
              { id: 'inapp' as const, label: 'Dans l’application' },
              { id: 'email' as const, label: 'E-mail (résumés)' },
              { id: 'les_deux' as const, label: 'Application + E-mail' }
            ].map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={async () => {
                  const ok = await onSaveSettings({ canal_notif: ch.id });
                  if (ok) onNotify('Canal de notification mis à jour.');
                }}
                className={`min-h-[44px] px-3 py-2.5 rounded-xl border text-xs font-bold transition ${
                  settings.canal_notif === ch.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {ch.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          {pushSupported ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Notifications Push Web sur cet appareil
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  État navigateur :{' '}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {pushPerm === 'granted'
                      ? 'Autorisées'
                      : pushPerm === 'denied'
                      ? 'Bloquées par le navigateur'
                      : 'Non demandées'}
                  </span>
                </p>
              </div>
              <button
                type="button"
                disabled={requestingPush || pushPerm === 'denied'}
                onClick={() => handleTogglePush(!settings.notif_push_enabled)}
                className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
                  settings.notif_push_enabled && pushPerm === 'granted'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'
                }`}
              >
                {requestingPush
                  ? 'Vérification...'
                  : settings.notif_push_enabled && pushPerm === 'granted'
                  ? 'Push activé (Désactiver)'
                  : 'Activer les alertes Push'}
              </button>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <p>
                Les notifications Push navigateur ne sont pas disponibles dans cet environnement ou
                sur ce navigateur. Les notifications en temps réel dans l’application restent actives.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
