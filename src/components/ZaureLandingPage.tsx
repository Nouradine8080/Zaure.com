import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Compass,
  Globe,
  GraduationCap,
  Lock,
  Menu,
  MessageSquare,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import heroMentorImg from '../assets/images/zaure_hero_mentor_1795453186546.jpg';
import communityExchangeImg from '../assets/images/zaure_community_exchange_1795453186510.jpg';
import { REGISTRATION_ROUTES } from '../constants/registration';
import { PWAInstallButton } from './PWAInstallButton';
import LegalDocumentModal from './settings/LegalDocumentModal';

const HERO_PILLARS = [
  {
    icon: Compass,
    title: 'Un réseau actif',
    description:
      'Publiez des capsules texte ou audio, posez vos questions et suivez des discussions ciblées chaque jour.',
    iconClass: 'bg-blue-50 text-blue-700',
  },
  {
    icon: ShieldCheck,
    title: 'Une plateforme sécurisée',
    description:
      'Vos données privées restent isolées, avec contrôle des appareils connectés et visibilité personnalisable.',
    iconClass: 'bg-emerald-50 text-emerald-700',
  },
  {
    icon: Globe,
    title: 'Une communauté mondiale',
    description:
      'Échangez entre étudiants, praticiens et mentors en français, haoussa ou anglais depuis tout appareil.',
    iconClass: 'bg-sky-50 text-sky-700',
  },
] as const;

const CAPABILITY_INDEX = [
  {
    num: '01',
    title: 'Cercles thématiques ciblés',
    detail:
      'Médecine, sciences, langues et agro-écologie : rejoignez des espaces structurés sans bruit inutile.',
  },
  {
    num: '02',
    title: 'Capsules texte & mémos audio',
    detail:
      'Partagez une synthèse de cours, une étude de cas ou une explication vocale claire en quelques secondes.',
  },
  {
    num: '03',
    title: 'Communautés & messagerie directe',
    detail:
      'Organisez vos groupes publics ou privés avec sondages, mentions, réactions et discussions instantanées.',
  },
  {
    num: '04',
    title: 'Confidentialité & sécurité maîtrisées',
    detail:
      'Gérez vos sessions actives, vos autorisations de contact et la modération directement depuis vos paramètres.',
  },
] as const;

export default function ZaureLandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [collabImgFailed, setCollabImgFailed] = useState(false);
  const [legalDoc, setLegalDoc] = useState<'terms' | 'privacy' | null>(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'ZAURE — Apprendre, Échanger, Grandir';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-950 flex flex-col">
      {/* Top Bar Contract: strictly 3 zones, gap-8, whitespace-nowrap, compact height */}
      <header className="sticky top-0 z-40 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-8">
          {/* Zone 1: Clean Single-Line Wordmark */}
          <Link
            to="/"
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 rounded-lg"
          >
            <span className="w-9 h-9 rounded-xl bg-blue-600 text-white font-black text-lg flex items-center justify-center shadow-xs">
              Z
            </span>
            <span className="text-xl font-extrabold tracking-tight text-slate-950">
              Zaure
            </span>
          </Link>

          {/* Zone 2: Clean Single-Line Nav Links */}
          <nav
            aria-label="Navigation principale"
            className="hidden md:flex items-center gap-8"
          >
            <a
              href="#communautes"
              className="text-sm font-semibold text-slate-600 hover:text-blue-700 hover:underline underline-offset-4 whitespace-nowrap shrink-0 transition"
            >
              Communautés
            </a>
            <a
              href="#fonctionnement"
              className="text-sm font-semibold text-slate-600 hover:text-blue-700 hover:underline underline-offset-4 whitespace-nowrap shrink-0 transition"
            >
              Fonctionnement
            </a>
            <a
              href="#securite"
              className="text-sm font-semibold text-slate-600 hover:text-blue-700 hover:underline underline-offset-4 whitespace-nowrap shrink-0 transition"
            >
              Sécurité
            </a>
            <Link
              to="/connexion"
              className="text-sm font-semibold text-slate-600 hover:text-blue-700 hover:underline underline-offset-4 whitespace-nowrap shrink-0 transition"
            >
              Connexion
            </Link>
          </nav>

          {/* Zone 3: Single Primary Action + Mobile Drawer Toggle */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to={REGISTRATION_ROUTES.IDENTITE}
              className="hidden sm:inline-flex min-h-[44px] px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold whitespace-nowrap shrink-0 items-center justify-center shadow-xs transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Créer un compte
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              className="md:hidden min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center transition"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 px-4 py-4 shadow-lg">
            <div className="flex flex-col gap-1.5">
              <a
                href="#communautes"
                onClick={() => setMobileMenuOpen(false)}
                className="min-h-[44px] px-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center"
              >
                Communautés
              </a>
              <a
                href="#fonctionnement"
                onClick={() => setMobileMenuOpen(false)}
                className="min-h-[44px] px-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center"
              >
                Fonctionnement
              </a>
              <a
                href="#securite"
                onClick={() => setMobileMenuOpen(false)}
                className="min-h-[44px] px-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center"
              >
                Sécurité
              </a>
              <Link
                to="/connexion"
                onClick={() => setMobileMenuOpen(false)}
                className="min-h-[44px] px-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center"
              >
                Connexion
              </Link>
              <Link
                to={REGISTRATION_ROUTES.IDENTITE}
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 min-h-[44px] px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold inline-flex items-center justify-center gap-2 transition"
              >
                <span>Créer un compte</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        {/* Hero Band (Inspired by Image 1) */}
        <section className="relative overflow-hidden bg-gradient-to-b from-[#EFF6FF] via-[#F8FAFC] to-white border-b border-slate-200/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14 lg:pt-16 lg:pb-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
              {/* Left Editorial Copy */}
              <div className="lg:col-span-6 flex flex-col justify-center">
                <p className="text-xs sm:text-sm font-extrabold uppercase tracking-[0.16em] text-blue-700">
                  Apprendre · Échanger · Grandir
                </p>

                <h1 className="mt-4 text-[clamp(2.25rem,4vw,3.75rem)] font-extrabold leading-[1.08] tracking-tight text-slate-950 text-balance">
                  Rejoignez la communauté ZAURE !
                </h1>

                <p className="mt-5 text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                  Connectez-vous avec des professionnels, des étudiants et des passionnés du savoir
                  pour partager des connaissances fiables et progresser ensemble.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-4 sm:gap-6">
                  <Link
                    to={REGISTRATION_ROUTES.IDENTITE}
                    className="min-h-[48px] px-7 py-3.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-base font-bold inline-flex items-center gap-2.5 shadow-md shadow-blue-600/20 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    <span>Créer mon compte</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>

                  <Link
                    to="/connexion"
                    className="min-h-[44px] px-2 py-2 text-sm font-bold text-slate-700 hover:text-blue-700 underline underline-offset-4 decoration-slate-300 hover:decoration-blue-600 inline-flex items-center transition"
                  >
                    Déjà membre ? Se connecter
                  </Link>

                  <PWAInstallButton compact />
                </div>
              </div>

              {/* Right Visual Stage (Image 1 Portrait + 4 Domain Icon Tiles) */}
              <div className="lg:col-span-6 flex">
                <div className="w-full rounded-3xl bg-gradient-to-br from-[#DBEAFE] via-[#EFF6FF] to-white border border-blue-200/80 p-4 sm:p-6 shadow-lg flex flex-col justify-between gap-4">
                  <div className="relative w-full aspect-[4/3] lg:flex-1 lg:min-h-[340px] rounded-2xl overflow-hidden bg-blue-100 border border-white/80">
                    {!heroImgFailed ? (
                      <img
                        src={heroMentorImg}
                        alt="Praticien de santé et membre Zaure souriant consultant ses échanges communautaires"
                        referrerPolicy="no-referrer"
                        onError={() => setHeroImgFailed(true)}
                        className="w-full h-full object-cover object-top"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-600 to-sky-500 text-white p-6 text-center">
                        <GraduationCap className="w-12 h-12 mb-3 opacity-90" />
                        <p className="text-lg font-extrabold">Communauté ZAURE</p>
                        <p className="text-sm text-blue-100 mt-1">
                          Savoirs partagés entre étudiants, mentors et professionnels
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Clean Icon Strip Matching Image 1 Floating Icons Without Pill Clutter */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="rounded-2xl bg-white/95 border border-blue-100 px-3 py-2.5 flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <GraduationCap className="w-4 h-4" />
                      </span>
                      <span className="text-xs font-bold text-slate-800 leading-tight">
                        Formations & savoirs
                      </span>
                    </div>

                    <div className="rounded-2xl bg-white/95 border border-blue-100 px-3 py-2.5 flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4" />
                      </span>
                      <span className="text-xs font-bold text-slate-800 leading-tight">
                        Cercles d'entraide
                      </span>
                    </div>

                    <div className="rounded-2xl bg-white/95 border border-blue-100 px-3 py-2.5 flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                        <MessageSquare className="w-4 h-4" />
                      </span>
                      <span className="text-xs font-bold text-slate-800 leading-tight">
                        Échanges directs
                      </span>
                    </div>

                    <div className="rounded-2xl bg-white/95 border border-blue-100 px-3 py-2.5 flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                        <BookOpen className="w-4 h-4" />
                      </span>
                      <span className="text-xs font-bold text-slate-800 leading-tight">
                        Capsules & fiches
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3-Column Trust Row (Inspired by bottom of Image 1) */}
            <div className="mt-12 pt-10 border-t border-slate-200/80 grid grid-cols-1 md:grid-cols-3 gap-6">
              {HERO_PILLARS.map((pillar) => {
                const Icon = pillar.icon;
                return (
                  <div
                    key={pillar.title}
                    className="rounded-2xl bg-white border border-slate-200/90 p-5 sm:p-6 shadow-2xs flex items-start gap-4"
                  >
                    <div
                      className={`w-11 h-11 rounded-2xl ${pillar.iconClass} flex items-center justify-center shrink-0`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base font-extrabold text-slate-950 tracking-tight">
                        {pillar.title}
                      </h2>
                      <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                        {pillar.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Collaboration & Capabilities Section (Section 01-04) */}
        <section id="communautes" className="py-16 lg:py-24 bg-white border-b border-slate-200/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-blue-700">
                Fonctionnement de la plateforme
              </p>
              <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950 text-balance">
                Un espace pensé pour apprendre et publier sans friction
              </h2>
              <p className="mt-3 text-base text-slate-600 leading-relaxed">
                Chaque cercle et chaque discussion rassemble des contributions vérifiables,
                organisées par thématique et accessibles en un seul clic.
              </p>
            </div>

            <div
              id="fonctionnement"
              className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch"
            >
              {/* Left 16:9 Real Environment Photography */}
              <div className="lg:col-span-7 flex flex-col">
                <div className="flex-1 rounded-3xl overflow-hidden border border-slate-200 bg-slate-100 shadow-sm aspect-[16/9] lg:aspect-auto">
                  {!collabImgFailed ? (
                    <img
                      src={communityExchangeImg}
                      alt="Étudiants, enseignants et professionnels collaborant autour d'ouvrages et ordinateurs sur ZAURE"
                      referrerPolicy="no-referrer"
                      onError={() => setCollabImgFailed(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full min-h-[280px] flex flex-col items-center justify-center bg-blue-50 text-blue-900 p-8 text-center">
                      <Users className="w-10 h-10 mb-3 text-blue-600" />
                      <p className="font-extrabold text-base">
                        Échanges académiques et professionnels
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Numbered Editorial Index (01 - 04) */}
              <div className="lg:col-span-5 flex flex-col justify-between gap-4">
                {CAPABILITY_INDEX.map((item) => (
                  <div
                    key={item.num}
                    id={item.num === '04' ? 'securite' : undefined}
                    className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-5 transition hover:border-blue-200 hover:bg-blue-50/40"
                  >
                    <div className="flex items-start gap-4">
                      <span className="font-mono text-sm font-bold text-blue-700 pt-0.5 shrink-0">
                        {item.num}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-base font-extrabold text-slate-950 tracking-tight">
                          {item.title}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                          {item.detail}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Conversion Band */}
        <section className="py-14 lg:py-20 bg-[#EFF6FF]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl bg-blue-600 text-white p-8 sm:p-12 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-8">
              <div className="max-w-xl">
                <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-blue-100">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Inscription en une étape</span>
                </div>
                <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-balance">
                  Créez votre compte ZAURE en quelques secondes
                </h2>
                <p className="mt-2.5 text-sm sm:text-base text-blue-100 leading-relaxed">
                  Rejoignez dès maintenant vos pairs, partagez vos ressources et accédez à vos
                  communautés sur ordinateur comme sur mobile.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row md:flex-col items-stretch sm:items-center md:items-end gap-3 shrink-0">
                <Link
                  to={REGISTRATION_ROUTES.IDENTITE}
                  className="min-h-[48px] px-7 py-3 rounded-full bg-white hover:bg-blue-50 text-blue-700 text-sm font-extrabold inline-flex items-center justify-center gap-2 shadow-sm transition whitespace-nowrap"
                >
                  <span>Créer mon compte</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/connexion"
                  className="min-h-[44px] px-4 py-2 text-sm font-bold text-white/90 hover:text-white underline underline-offset-4 inline-flex items-center justify-center whitespace-nowrap transition"
                >
                  Se connecter
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Horizontal Footer */}
      <footer className="bg-white border-t border-slate-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2.5 font-semibold text-slate-700">
            <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center">
              Z
            </span>
            <span>ZAURE · Apprendre · Échanger · Grandir</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5 font-medium">
            <Link to="/connexion" className="hover:text-blue-700 transition">
              Connexion
            </Link>
            <Link to={REGISTRATION_ROUTES.IDENTITE} className="hover:text-blue-700 transition">
              Inscription
            </Link>
            <button
              type="button"
              onClick={() => setLegalDoc('terms')}
              className="hover:text-blue-700 transition cursor-pointer"
            >
              Conditions d'utilisation
            </button>
            <button
              type="button"
              onClick={() => setLegalDoc('privacy')}
              className="hover:text-blue-700 transition cursor-pointer"
            >
              Politique de confidentialité
            </button>
            <a href="mailto:contact@zaure.org" className="hover:text-blue-700 transition">
              contact@zaure.org
            </a>
          </div>
        </div>
      </footer>

      <LegalDocumentModal docType={legalDoc} onClose={() => setLegalDoc(null)} />
    </div>
  );
}
