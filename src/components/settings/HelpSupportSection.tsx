import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  FileText,
  Flag,
  HelpCircle,
  Loader2,
  Mail,
  Search,
  Send,
  ShieldCheck
} from 'lucide-react';
import { SupportTicket, SupportTicketCategory, UserProfile } from '../../types';
import { zaureService } from '../../firebaseClient';
import { settingsService } from '../../services/settingsService';
import LegalDocumentModal from './LegalDocumentModal';

interface HelpSupportSectionProps {
  currentUser: UserProfile;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}

const FAQ_ITEMS = [
  {
    q: 'Comment contrôler qui peut voir mes informations et mes publications ?',
    a: 'Rendez-vous dans Paramètres > Confidentialité. Vous pouvez y définir un profil public ou privé, limiter la visibilité de vos informations, et choisir qui peut vous écrire, vous commenter ou vous mentionner.'
  },
  {
    q: 'Comment sécuriser mon compte et gérer mes appareils connectés ?',
    a: 'Ouvrez Paramètres > Sécurité pour vérifier votre adresse e-mail, changer votre mot de passe, consulter les appareils actifs et révoquer immédiatement vos autres sessions ouvertes.'
  },
  {
    q: 'Pourquoi certaines sections restent en français quand je choisis English ou Hausa ?',
    a: 'La navigation principale, les paramètres complets et les actions de base sont traduits, tandis que certains libellés secondaires et les publications des membres restent dans leur langue d’origine. La couverture exacte est indiquée dans Langue.'
  },
  {
    q: 'Comment signaler un comportement inapproprié ou bloquer un membre ?',
    a: 'Vous pouvez bloquer un utilisateur directement depuis son profil ou une discussion privée, puis gérer la liste dans Utilisateurs bloqués. Pour alerter la modération, utilisez le formulaire de signalement ci-dessous.'
  }
];

export default function HelpSupportSection({ currentUser, onNotify }: HelpSupportSectionProps) {
  const [faqSearch, setFaqSearch] = useState('');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [legalDoc, setLegalDoc] = useState<'terms' | 'privacy' | null>(null);

  // Support ticket form
  const [ticketCategory, setTicketCategory] = useState<SupportTicketCategory>('bug');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);

  // Report a user form
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
  const [reportUserId, setReportUserId] = useState('');
  const [reportReason, setReportReason] = useState<
    'spam' | 'harcelement' | 'usurpation' | 'contenu_inapproprie' | 'autre'
  >('spam');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setLoadingTickets(true);
      try {
        const [userTickets, users] = await Promise.all([
          settingsService.getUserSupportTickets(currentUser.id),
          zaureService.getAvailableUsers()
        ]);
        if (!cancelled) {
          setTickets(userTickets);
          setAvailableUsers(users.filter((u) => u.id !== currentUser.id));
        }
      } finally {
        if (!cancelled) setLoadingTickets(false);
      }
    };
    loadData();
    return () => {
      cancelled = true;
    };
  }, [currentUser.id]);

  const filteredFaq = FAQ_ITEMS.filter(
    (item) =>
      !faqSearch.trim() ||
      item.q.toLowerCase().includes(faqSearch.toLowerCase()) ||
      item.a.toLowerCase().includes(faqSearch.toLowerCase())
  );

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingTicket(true);
    try {
      const res = await settingsService.submitSupportTicket(currentUser, {
        category: ticketCategory,
        subject: ticketSubject,
        description: ticketDescription
      });
      if (res.ticket) {
        setTickets((prev) => [res.ticket!, ...prev]);
        setTicketSubject('');
        setTicketDescription('');
        onNotify('Votre demande a été envoyée à l’équipe support ZAURE.');
      } else {
        onNotify(res.error || 'Impossible d’envoyer la demande.', 'error');
      }
    } finally {
      setSubmittingTicket(false);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportUserId) {
      onNotify('Sélectionnez le compte concerné par le signalement.', 'error');
      return;
    }
    const target = availableUsers.find((u) => u.id === reportUserId);
    setSubmittingReport(true);
    try {
      const res = await zaureService.reportUser({
        targetUserId: reportUserId,
        targetUserNom: target?.nom || 'Utilisateur Zaure',
        reason: reportReason,
        details: reportDetails.trim()
      });
      if (res.success) {
        setReportUserId('');
        setReportDetails('');
        onNotify('Signalement transmis à l’équipe de modération.');
      } else {
        onNotify(res.error || 'Erreur lors du signalement.', 'error');
      }
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Centre d'aide & FAQ */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
              Centre d’aide & Foire aux questions
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Guides rapides pour maîtriser votre compte, votre confidentialité et vos cercles.
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={faqSearch}
            onChange={(e) => setFaqSearch(e.target.value)}
            placeholder="Rechercher dans l’aide..."
            className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="space-y-2">
          {filteredFaq.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
              Aucun article ne correspond à votre recherche.
            </p>
          ) : (
            filteredFaq.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={item.q}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full min-h-[44px] px-4 py-3 flex items-center justify-between gap-3 text-left"
                  >
                    <span className="text-xs sm:text-[13px] font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      {item.q}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-3.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-200/70 dark:border-slate-700/70 pt-2.5">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="flex flex-wrap gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => setLegalDoc('terms')}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 transition"
          >
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Conditions d’utilisation</span>
          </button>
          <button
            type="button"
            onClick={() => setLegalDoc('privacy')}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 transition"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Politique de confidentialité</span>
          </button>
        </div>
      </section>

      {/* Signaler un problème / Contacter le support */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
              Signaler un problème ou contacter l’assistance
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Votre ticket est enregistré dans notre suivi support avec les informations de votre appareil.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmitTicket} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                Catégorie
              </label>
              <select
                value={ticketCategory}
                onChange={(e) => setTicketCategory(e.target.value as SupportTicketCategory)}
                className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="bug">Signaler un bug</option>
                <option value="contact">Contacter le support</option>
                <option value="securite">Problème de sécurité</option>
                <option value="confidentialite">Question de confidentialité</option>
                <option value="autre">Autre demande</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                Sujet
              </label>
              <input
                type="text"
                required
                maxLength={160}
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                placeholder="Ex. : Difficulté à lire un média sur Android"
                className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
              Description détaillée
            </label>
            <textarea
              rows={3}
              required
              maxLength={3000}
              value={ticketDescription}
              onChange={(e) => setTicketDescription(e.target.value)}
              placeholder="Décrivez précisément le problème rencontré ou votre question..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submittingTicket}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 transition disabled:opacity-60"
            >
              {submittingTicket ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>Envoyer au support</span>
            </button>
          </div>
        </form>

        {/* Historique des demandes */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <p className="text-[11px] font-bold uppercase text-slate-400 mb-2">
            Vos demandes récentes
          </p>
          {loadingTickets ? (
            <p className="text-xs text-slate-400">Chargement de vos demandes...</p>
          ) : tickets.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Aucune demande enregistrée pour l’instant.
            </p>
          ) : (
            <div className="space-y-2">
              {tickets.slice(0, 5).map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {t.subject}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {new Date(t.createdAt).toLocaleDateString('fr-FR')} · {t.category}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      t.status === 'resolved'
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                        : t.status === 'in_review'
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                        : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                    }`}
                  >
                    {t.status === 'resolved'
                      ? 'Résolu'
                      : t.status === 'in_review'
                      ? 'En cours'
                      : 'Ouvert'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Signaler un utilisateur */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Flag className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
              Signaler un utilisateur
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Signalez un compte pour spam, harcèlement, usurpation ou contenu inapproprié.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmitReport} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                Membre concerné
              </label>
              <select
                value={reportUserId}
                onChange={(e) => setReportUserId(e.target.value)}
                className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sélectionner un utilisateur...</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nom} {u.username ? `(@${u.username})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                Motif
              </label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value as any)}
                className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="spam">Spam ou sollicitation abusive</option>
                <option value="harcelement">Harcèlement ou propos offensants</option>
                <option value="usurpation">Usurpation d’identité</option>
                <option value="contenu_inapproprie">Contenu inapproprié</option>
                <option value="autre">Autre motif</option>
              </select>
            </div>
          </div>

          <textarea
            rows={2}
            value={reportDetails}
            onChange={(e) => setReportDetails(e.target.value)}
            placeholder="Précisions complémentaires (optionnel)..."
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:ring-2 focus:ring-blue-500"
          />

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submittingReport || !reportUserId}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-2 transition disabled:opacity-50"
            >
              {submittingReport ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
              <span>Transmettre le signalement</span>
            </button>
          </div>
        </form>
      </section>

      <LegalDocumentModal docType={legalDoc} onClose={() => setLegalDoc(null)} />
    </div>
  );
}
