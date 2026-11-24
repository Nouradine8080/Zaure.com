import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Compass,
  Globe,
  GraduationCap,
  LogIn,
  MessageSquare,
  ShieldCheck,
  Users,
} from 'lucide-react';
import heroMentorImg from '../../assets/images/zaure_hero_mentor_1795453186546.jpg';
import { useRegistration } from '../../context/RegistrationContext';
import { PWAInstallButton } from '../PWAInstallButton';
import {
  ZAURE_GLOWS,
  ZAURE_ICON_CHIPS,
  ZAURE_MOTION,
  ZAURE_SURFACES,
} from '../../styles/designSystem';
import { ZaureGeometricBackdrop } from '../ui/ZaureGeometricBackdrop';

interface RegistrationLayoutProps {
  title: string;
  subtitle: string;
  pageTitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

export const RegistrationLayout: React.FC<RegistrationLayoutProps> = ({
  title,
  subtitle,
  pageTitle,
  icon,
  children,
}) => {
  const navigate = useNavigate();
  const [showcaseImgFailed, setShowcaseImgFailed] = useState(false);
  const {
    draft,
    errorMessage,
    emailAlreadyInUse,
    setErrorMessage,
  } = useRegistration();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = pageTitle;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return () => {
      document.title = previousTitle;
    };
  }, [pageTitle]);

  return (
    <div className="relative min-h-screen overflow-x-hidden zaure-grad-canvas-soft flex flex-col text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-100 dark:selection:bg-blue-900/50">
      <ZaureGeometricBackdrop variant="auth" />

      {/* Compact Top Navigation Bar */}
      <header className={`sticky top-0 z-30 h-16 ${ZAURE_SURFACES.glassHeader}`}>
        <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          <Link
            to="/"
            onClick={() => setErrorMessage(null)}
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 group focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 rounded-lg"
          >
            <span className={`w-9 h-9 rounded-xl zaure-grad-primary flex items-center justify-center text-white font-black text-lg ${ZAURE_GLOWS.blue} transition`}>
              Z
            </span>
            <span className="text-xl font-extrabold text-slate-950 dark:text-white tracking-tight">Zaure</span>
          </Link>

          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <PWAInstallButton compact />
            <Link
              to="/"
              onClick={() => setErrorMessage(null)}
              className="min-h-[44px] inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400 px-3 py-2 rounded-full hover:bg-blue-50 dark:hover:bg-slate-800 transition whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Accueil</span>
            </Link>
            <Link
              to="/connexion"
              onClick={() => setErrorMessage(null)}
              className="min-h-[44px] inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200/70 dark:border-blue-800/60 px-4 py-2 rounded-full transition whitespace-nowrap zaure-btn-press"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Se connecter</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Centered Split Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-3.5 sm:px-6 py-6 sm:py-10">
        <motion.div
          {...ZAURE_MOTION.slideUp}
          className="w-full max-w-5xl mx-auto"
        >
          <div className={`zaure-card ${ZAURE_GLOWS.soft} rounded-[28px] border border-blue-100/90 dark:border-slate-800 overflow-hidden grid grid-cols-1 lg:grid-cols-12`}>
            {/* Left Visual Showcase Column (Desktop) */}
            <aside className="relative overflow-hidden hidden lg:flex lg:col-span-5 bg-gradient-to-b from-[#F4F8FF] via-[#EBF3FF] to-[#DBEAFE] dark:from-slate-900 dark:via-blue-950/60 dark:to-slate-900 p-8 flex-col justify-between border-r border-blue-100/90 dark:border-slate-800">
              <ZaureGeometricBackdrop variant="canvas" className="!absolute opacity-55" />

              <div className="relative z-10">
                <div className="flex items-center gap-3">
                  <span className={`w-11 h-11 rounded-2xl zaure-grad-primary text-white font-black text-xl flex items-center justify-center ${ZAURE_GLOWS.blue}`}>
                    Z
                  </span>
                  <div>
                    <p className="text-lg font-extrabold tracking-tight text-blue-700 dark:text-blue-400 leading-none">
                      ZAURE
                    </p>
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">
                      Apprendre · Échanger · Grandir
                    </p>
                  </div>
                </div>

                <h2 className="mt-6 text-2xl font-extrabold text-slate-950 dark:text-white tracking-tight leading-snug text-balance">
                  Rejoignez la communauté ZAURE !
                </h2>
                <p className="mt-2.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Connectez-vous avec des professionnels, des étudiants et des passionnés du savoir.
                </p>

                {/* Portrait + Domain Icon Mini Grid */}
                <div className="mt-6 rounded-2xl bg-white/85 dark:bg-slate-900/80 border border-blue-100 dark:border-slate-800 p-3 zaure-shadow-card">
                  <div className="aspect-[4/3] w-full rounded-xl overflow-hidden bg-blue-100 dark:bg-slate-800">
                    {!showcaseImgFailed ? (
                      <img
                        src={heroMentorImg}
                        alt="Praticien et membre de la communauté Zaure"
                        referrerPolicy="no-referrer"
                        onError={() => setShowcaseImgFailed(true)}
                        className="w-full h-full object-cover object-top"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center zaure-grad-primary text-white">
                        <GraduationCap className="w-10 h-10" />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-2 mt-3">
                    <div
                      title="Savoirs & cours"
                      className={`rounded-xl py-2 flex items-center justify-center ${ZAURE_ICON_CHIPS.blue}`}
                    >
                      <GraduationCap className="w-4 h-4" />
                    </div>
                    <div
                      title="Cercles communautaires"
                      className={`rounded-xl py-2 flex items-center justify-center ${ZAURE_ICON_CHIPS.indigo}`}
                    >
                      <Users className="w-4 h-4" />
                    </div>
                    <div
                      title="Échanges directs"
                      className={`rounded-xl py-2 flex items-center justify-center ${ZAURE_ICON_CHIPS.emerald}`}
                    >
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div
                      title="Fiches et capsules"
                      className={`rounded-xl py-2 flex items-center justify-center ${ZAURE_ICON_CHIPS.amber}`}
                    >
                      <BookOpen className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom 3 Pillars */}
              <div className="relative z-10 mt-6 pt-5 border-t border-blue-200/70 dark:border-slate-800 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-white/90 dark:bg-slate-900/85 border border-blue-100 dark:border-slate-800 p-2.5">
                  <Compass className="w-4 h-4 text-blue-600 dark:text-blue-400 mx-auto mb-1" />
                  <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-tight">
                    Un réseau actif
                  </p>
                </div>
                <div className="rounded-2xl bg-white/90 dark:bg-slate-900/85 border border-blue-100 dark:border-slate-800 p-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mx-auto mb-1" />
                  <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-tight">
                    Plateforme sécurisée
                  </p>
                </div>
                <div className="rounded-2xl bg-white/90 dark:bg-slate-900/85 border border-blue-100 dark:border-slate-800 p-2.5">
                  <Globe className="w-4 h-4 text-sky-600 dark:text-sky-400 mx-auto mb-1" />
                  <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-tight">
                    Communauté mondiale
                  </p>
                </div>
              </div>
            </aside>

            {/* Right Clean Registration Form Column */}
            <section className="lg:col-span-7 bg-white dark:bg-slate-900 p-6 sm:p-9 lg:p-10 flex flex-col justify-center">
              {/* Centered Luminous Blue Header Pill & Subtitle */}
              <div className="text-center mb-6">
                <div className={`inline-flex items-center justify-center gap-2.5 px-7 py-2.5 rounded-full zaure-grad-primary text-white ${ZAURE_GLOWS.blue}`}>
                  {icon}
                  <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">{title}</h1>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-3 font-medium">{subtitle}</p>
              </div>

              {/* Error Banner */}
              {errorMessage && (
                <div
                  role="alert"
                  className="mb-5 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300 rounded-2xl animate-fadeIn"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold leading-snug">{errorMessage}</p>
                      {emailAlreadyInUse && (
                        <div className="flex flex-wrap items-center gap-2 mt-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              setErrorMessage(null);
                              navigate('/connexion', { state: { prefilledEmail: draft.email } });
                            }}
                            className={`px-3.5 py-2 text-[11px] ${ZAURE_SURFACES.primaryButton}`}
                          >
                            <LogIn className="w-3.5 h-3.5" />
                            <span>Se connecter avec cet e-mail</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Form Content */}
              {children}

              {/* Bottom Login Redirect */}
              <div className="text-center pt-5 mt-5 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  Déjà un compte ?{' '}
                  <Link
                    to="/connexion"
                    onClick={() => setErrorMessage(null)}
                    className="text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-bold hover:underline"
                  >
                    Se connecter
                  </Link>
                </p>
              </div>
            </section>
          </div>
        </motion.div>
      </main>
    </div>
  );
};
