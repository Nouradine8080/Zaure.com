import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, Home, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

export interface ZaureErrorLogEntry {
  id: string;
  timestamp: string;
  scope: string;
  message: string;
  stack?: string;
  componentStack?: string;
  url: string;
}

const ERROR_LOG_STORAGE_KEY = 'zaure_error_log';
const MAX_STORED_ERRORS = 20;

export function logZaureError(scope: string, error: unknown, componentStack?: string): ZaureErrorLogEntry {
  const errObj = error instanceof Error ? error : new Error(String(error ?? 'Erreur inconnue'));
  const entry: ZaureErrorLogEntry = {
    id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    scope,
    message: errObj.message || 'Erreur inattendue',
    stack: errObj.stack,
    componentStack,
    url: typeof window !== 'undefined' ? window.location.href : ''
  };

  console.error(`[ZAURE][ErrorBoundary:${scope}]`, errObj, componentStack || '');

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(ERROR_LOG_STORAGE_KEY);
      const existing: ZaureErrorLogEntry[] = raw ? JSON.parse(raw) : [];
      const next = [entry, ...(Array.isArray(existing) ? existing : [])].slice(0, MAX_STORED_ERRORS);
      localStorage.setItem(ERROR_LOG_STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // Ignore storage quota or private-mode errors
  }

  return entry;
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  scopeLabel?: string;
  variant?: 'fullscreen' | 'section' | 'inline';
  resetKey?: string | number | boolean | null;
  homeLabel?: string;
  onReset?: () => void;
  onNavigateHome?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorEntry: ZaureErrorLogEntry | null;
  showDetails: boolean;
}

const TypedComponentBase = Component as unknown as new <P, S>(props: P) => {
  props: P;
  state: S;
  setState: (
    partialState: Partial<S> | ((prevState: S, props: P) => Partial<S> | null),
    callback?: () => void
  ) => void;
};

export class ErrorBoundary extends TypedComponentBase<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorEntry: null,
    showDetails: false
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const scope = this.props.scopeLabel || 'Application';
    const entry = logZaureError(scope, error, info?.componentStack || undefined);
    this.setState({ errorEntry: entry });
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({
        hasError: false,
        error: null,
        errorEntry: null,
        showDetails: false
      });
    }
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorEntry: null,
      showDetails: false
    });
    this.props.onReset?.();
  };

  private handleHome = () => {
    this.setState({
      hasError: false,
      error: null,
      errorEntry: null,
      showDetails: false
    });
    if (this.props.onNavigateHome) {
      this.props.onNavigateHome();
    } else if (typeof window !== 'undefined') {
      window.location.assign('/');
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { variant = 'section', scopeLabel = 'Module', homeLabel = "Retour à l'accueil" } = this.props;
    const errorMessage = this.state.error?.message || "Une erreur inattendue s'est produite.";

    if (variant === 'inline') {
      return (
        <div
          role="alert"
          className="p-5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-2xl text-center space-y-3"
        >
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              Impossible d&apos;afficher ce bloc ({scopeLabel})
            </p>
            <p className="text-[11px] text-red-700 dark:text-red-300 break-words">
              {errorMessage}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Réessayer</span>
            </button>
          </div>
        </div>
      );
    }

    const wrapperClass =
      variant === 'fullscreen'
        ? 'min-h-screen bg-[#F0F2F5] dark:bg-slate-950 flex items-center justify-center p-4'
        : 'bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs my-2';

    return (
      <div role="alert" className={wrapperClass}>
        <div className={`${variant === 'fullscreen' ? 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-lg max-w-lg w-full' : 'max-w-lg mx-auto'} text-center space-y-4`}>
          <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto border border-red-100 dark:border-red-900/60">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
              Incident capturé · {scopeLabel}
            </p>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
              Une erreur est survenue lors de l&apos;affichage
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Le reste de la plateforme ZAURE reste fonctionnel. Vous pouvez réessayer l&apos;action ou revenir à l&apos;accueil.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={this.handleReset}
              className="min-h-[40px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Réessayer</span>
            </button>
            <button
              type="button"
              onClick={this.handleHome}
              className="min-h-[40px] px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition"
            >
              <Home className="w-3.5 h-3.5" />
              <span>{homeLabel}</span>
            </button>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-left">
            <button
              type="button"
              onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 inline-flex items-center gap-1"
            >
              {this.state.showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>{this.state.showDetails ? 'Masquer les détails techniques' : 'Afficher les détails techniques'}</span>
            </button>
            {this.state.showDetails && (
              <pre className="mt-2 p-3 rounded-xl bg-slate-950 text-slate-200 text-[10px] font-mono overflow-x-auto max-h-40 whitespace-pre-wrap break-all">
                {errorMessage}
                {this.state.error?.stack ? `\n\n${this.state.error.stack}` : ''}
              </pre>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
