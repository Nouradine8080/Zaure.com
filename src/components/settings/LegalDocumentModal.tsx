import React from 'react';
import { createPortal } from 'react-dom';
import { FileText, ShieldCheck, X } from 'lucide-react';

interface LegalDocumentModalProps {
  docType: 'terms' | 'privacy' | null;
  onClose: () => void;
}

export default function LegalDocumentModal({ docType, onClose }: LegalDocumentModalProps) {
  if (!docType) return null;

  const isPrivacy = docType === 'privacy';

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[88vh] overflow-hidden animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              {isPrivacy ? <ShieldCheck className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
                {isPrivacy ? 'Politique de confidentialité ZAURE' : "Conditions d'utilisation ZAURE"}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Dernière mise à jour : Plateforme sociale & communautaire ZAURE
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 flex items-center justify-center transition"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">
          {isPrivacy ? (
            <>
              <section className="space-y-1.5">
                <h4 className="font-extrabold text-slate-950 dark:text-white">
                  1. Données personnelles isolées et protégées
                </h4>
                <p>
                  Votre adresse e-mail, votre numéro de téléphone et votre date de naissance sont
                  conservés uniquement dans votre dossier privé (<code>users</code> et{' '}
                  <code>user_settings</code>). Ils ne sont jamais exposés dans l’annuaire public
                  des membres (<code>public_profiles</code>).
                </p>
              </section>
              <section className="space-y-1.5">
                <h4 className="font-extrabold text-slate-950 dark:text-white">
                  2. Contrôle granulaire de la visibilité
                </h4>
                <p>
                  Depuis « Confidentialité », vous décidez qui peut voir vos informations
                  personnelles, vos publications, vos listes d’abonnés/abonnements, qui peut vous
                  écrire en messagerie privée, qui peut commenter vos publications et qui peut vous
                  mentionner.
                </p>
              </section>
              <section className="space-y-1.5">
                <h4 className="font-extrabold text-slate-950 dark:text-white">
                  3. Sessions, blocages et suppression
                </h4>
                <p>
                  Vous pouvez consulter vos appareils connectés et révoquer vos autres sessions à
                  distance. Le blocage d’un membre empêche les échanges directs et mentions. La
                  suppression de votre compte efface vos données de profil et paramètres.
                </p>
              </section>
            </>
          ) : (
            <>
              <section className="space-y-1.5">
                <h4 className="font-extrabold text-slate-950 dark:text-white">
                  1. Esprit de partage et respect mutuel
                </h4>
                <p>
                  ZAURE est une plateforme sociale dédiée au partage de savoirs, d’expériences et
                  d’entraide communautaire. Les membres s’engagent à publier des contenus respectueux,
                  sourcés et conformes aux règles de chaque cercle communautaire.
                </p>
              </section>
              <section className="space-y-1.5">
                <h4 className="font-extrabold text-slate-950 dark:text-white">
                  2. Modération et signalement
                </h4>
                <p>
                  Tout membre peut signaler un profil, un commentaire ou une publication
                  inappropriée depuis le menu d’options ou le centre d’aide. L’équipe de modération
                  examine les signalements pour préserver la sécurité de la communauté.
                </p>
              </section>
              <section className="space-y-1.5">
                <h4 className="font-extrabold text-slate-950 dark:text-white">
                  3. Sécurité du compte
                </h4>
                <p>
                  Chaque utilisateur est responsable de la confidentialité de ses identifiants. En
                  cas d’activité inhabituelle, utilisez la section « Sécurité » pour changer votre
                  mot de passe et révoquer vos autres sessions.
                </p>
              </section>
            </>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
