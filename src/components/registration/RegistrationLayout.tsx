import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { AlertCircle, ArrowLeft, Check, LogIn } from 'lucide-react';
import { REGISTRATION_ROUTES, RegistrationRoute } from '../../constants/registration';
import { useRegistration } from '../../context/RegistrationContext';
import { PWAInstallButton } from '../PWAInstallButton';

interface RegistrationLayoutProps {
  currentStep: 1 | 2 | 3;
  title: string;
  subtitle: string;
  pageTitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const STEPS: {
  step: 1 | 2 | 3;
  label: string;
  shortLabel: string;
  route: RegistrationRoute;
}[] = [
  { step: 1, label: '1. Identité', shortLabel: '1. Identité', route: REGISTRATION_ROUTES.IDENTITE },
  {
    step: 2,
    label: '2. Profil & Vocation',
    shortLabel: '2. Profil',
    route: REGISTRATION_ROUTES.VOCATION,
  },
  {
    step: 3,
    label: '3. Cercles & Avatar',
    shortLabel: '3. Cercles',
    route: REGISTRATION_ROUTES.CERCLES_AVATAR,
  },
];

export const RegistrationLayout: React.FC<RegistrationLayoutProps> = ({
  currentStep,
  title,
  subtitle,
  pageTitle,
  icon,
  children,
}) => {
  const navigate = useNavigate();
  const {
    draft,
    isStep1Complete,
    isStep2Complete,
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
  }, [pageTitle, currentStep]);

  const canJumpToStep = (targetStep: 1 | 2 | 3): boolean => {
    if (targetStep === currentStep) return false;
    if (targetStep === 1) return true;
    if (targetStep === 2) return isStep1Complete || currentStep >= 2;
    if (targetStep === 3) return isStep2Complete || currentStep === 3;
    return false;
  };

  const progressWidth = currentStep === 1 ? '33.333%' : currentStep === 2 ? '66.666%' : '100%';

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col text-slate-800 font-sans selection:bg-blue-100">
      {/* Full-Page Top Navigation Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200/90 shadow-2xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Link
              to="/"
              onClick={() => setErrorMessage(null)}
              className="flex items-center gap-2 group"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-lg shadow-sm group-hover:bg-blue-700 transition">
                Z
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xl font-black text-blue-600 tracking-tight">Zaure</span>
                <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
              </div>
            </Link>
          </div>

          {/* Desktop/Tablet Inline Stepper */}
          <nav
            aria-label="Progression de l'inscription"
            className="hidden md:flex items-center gap-2"
          >
            {STEPS.map((item, idx) => {
              const isActive = item.step === currentStep;
              const isCompleted =
                item.step < currentStep ||
                (item.step === 1 && isStep1Complete && currentStep !== 1) ||
                (item.step === 2 && isStep2Complete && currentStep !== 2);
              const clickable = canJumpToStep(item.step);

              return (
                <React.Fragment key={item.step}>
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={() => {
                      if (clickable) {
                        setErrorMessage(null);
                        navigate(item.route);
                      }
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                        : isCompleted
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100 cursor-pointer'
                          : 'bg-slate-50 border-slate-200 text-slate-400 cursor-default'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0 ${
                        isActive
                          ? 'bg-white text-blue-600'
                          : isCompleted
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {isCompleted ? <Check className="w-3 h-3" /> : item.step}
                    </span>
                    <span>{item.label}</span>
                  </button>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={`w-6 h-0.5 rounded-full ${
                        item.step < currentStep ? 'bg-emerald-500' : 'bg-slate-200'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <PWAInstallButton compact />
            <Link
              to="/"
              onClick={() => setErrorMessage(null)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-blue-700 bg-slate-100 hover:bg-blue-50 px-3 py-2 rounded-xl transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Se connecter</span>
              <span className="sm:hidden">Connexion</span>
            </Link>
          </div>
        </div>

        {/* Mobile Stepper Row */}
        <div className="md:hidden border-t border-slate-100 bg-slate-50/70 px-3 py-2">
          <ol className="grid grid-cols-3 gap-1.5 max-w-xl mx-auto">
            {STEPS.map((item) => {
              const isActive = item.step === currentStep;
              const isCompleted =
                item.step < currentStep ||
                (item.step === 1 && isStep1Complete && currentStep !== 1) ||
                (item.step === 2 && isStep2Complete && currentStep !== 2);
              const clickable = canJumpToStep(item.step);

              return (
                <li key={item.step}>
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={() => {
                      if (clickable) {
                        setErrorMessage(null);
                        navigate(item.route);
                      }
                    }}
                    className={`w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl border text-[11px] font-bold transition-all ${
                      isActive
                        ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                        : isCompleted
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800 cursor-pointer'
                          : 'bg-white border-slate-200/80 text-slate-400 cursor-default'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0 ${
                        isActive
                          ? 'bg-white text-blue-600'
                          : isCompleted
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {isCompleted ? <Check className="w-2.5 h-2.5" /> : item.step}
                    </span>
                    <span className="truncate">{item.shortLabel}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Continuous Progress Bar */}
        <div className="w-full bg-slate-100 h-1 overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-300 ease-out"
            style={{ width: progressWidth }}
          />
        </div>
      </header>

      {/* Main Dedicated Page Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-3.5 sm:px-6 py-6 sm:py-10">
        <motion.div
          key={`page-step-${currentStep}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="w-full max-w-[560px] mx-auto"
        >
          <section className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-xl border border-slate-200/90">
            {/* Page Title Header */}
            <div className="flex items-start gap-3.5 pb-4 mb-5 border-b border-slate-100">
              <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                {icon}
              </div>
              <div className="min-w-0 flex-1">
                <span className="inline-block text-[11px] font-extrabold uppercase tracking-wider text-blue-600">
                  Page {currentStep} sur 3
                </span>
                <h1 className="text-lg sm:text-xl font-black text-slate-950 tracking-tight">
                  {title}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{subtitle}</p>
              </div>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="mb-4 p-3.5 bg-red-50 border border-red-200 text-xs text-red-700 rounded-2xl animate-fadeIn">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold leading-snug">{errorMessage}</p>
                    {emailAlreadyInUse && (
                      <div className="flex flex-wrap items-center gap-2 mt-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setErrorMessage(null);
                            navigate('/', { state: { prefilledEmail: draft.email } });
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded-xl transition"
                        >
                          <LogIn className="w-3.5 h-3.5" />
                          <span>Se connecter avec cet e-mail</span>
                        </button>
                        {currentStep !== 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setErrorMessage(null);
                              navigate(REGISTRATION_ROUTES.IDENTITE);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-red-100/50 text-red-700 border border-red-200 font-bold text-[11px] rounded-xl transition"
                          >
                            <span>Modifier mon e-mail (Étape 1)</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Page Form Content */}
            {children}

            {/* Footer Link */}
            <div className="text-center pt-4 mt-5 border-t border-slate-100">
              <Link
                to="/"
                onClick={() => setErrorMessage(null)}
                className="text-xs text-blue-700 hover:text-blue-800 font-bold hover:underline"
              >
                Vous avez déjà un compte ? Se connecter
              </Link>
            </div>
          </section>
        </motion.div>
      </main>
    </div>
  );
};
