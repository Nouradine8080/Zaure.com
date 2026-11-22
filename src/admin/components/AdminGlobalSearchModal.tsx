import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Loader2,
  RefreshCw,
  Search,
  X
} from 'lucide-react';
import {
  Capsule,
  CommunityGroup,
  GroupPost,
  GroupReport,
  SupportTicket,
  UserProfile,
  UserReport
} from '../../types';
import {
  AdminAuditLog,
  AdminModuleId,
  AdminSessionContext,
  IndexedZaureFile
} from '../types';
import {
  AdminGlobalSearchHit,
  executeAdminGlobalSearch
} from '../utils/adminSearch';
import { ErrorBoundary } from '../../components/ErrorBoundary';

interface AdminGlobalSearchModalProps {
  isOpen: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  onSelectHit: (module: AdminModuleId, seed: string) => void;
  session: AdminSessionContext | null;
  users: UserProfile[];
  groupPosts: GroupPost[];
  capsules: Capsule[];
  groups: CommunityGroup[];
  files: IndexedZaureFile[];
  userReports: UserReport[];
  groupReports: GroupReport[];
  supportTickets: SupportTicket[];
  auditLogs: AdminAuditLog[];
}

export const AdminGlobalSearchModal: React.FC<AdminGlobalSearchModalProps> = ({
  isOpen,
  query,
  onQueryChange,
  onClose,
  onSelectHit,
  session,
  users,
  groupPosts,
  capsules,
  groups,
  files,
  userReports,
  groupReports,
  supportTickets,
  auditLogs
}) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [results, setResults] = useState<AdminGlobalSearchHit[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const requestSeqRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      const id = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 20);
      return () => window.clearTimeout(id);
    }
    // Cancel pending search if modal closes
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const trimmed = typeof query === 'string' ? query.trim() : '';
    abortControllerRef.current?.abort();

    if (!trimmed) {
      setStatus('idle');
      setResults([]);
      setErrorMessage(null);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const seq = ++requestSeqRef.current;

    setStatus('loading');
    setErrorMessage(null);

    const timer = window.setTimeout(async () => {
      try {
        const hits = await executeAdminGlobalSearch({
          query: trimmed,
          session,
          users,
          groupPosts,
          capsules,
          groups,
          files,
          userReports,
          groupReports,
          supportTickets,
          auditLogs,
          signal: controller.signal
        });

        if (controller.signal.aborted || requestSeqRef.current !== seq) {
          return;
        }
        setResults(hits);
        setStatus('success');
      } catch (err: any) {
        if (
          controller.signal.aborted ||
          requestSeqRef.current !== seq ||
          err?.name === 'AbortError'
        ) {
          return;
        }
        console.error('[ZAURE][AdminGlobalSearch] Erreur lors de la recherche:', err);
        setResults([]);
        setStatus('error');
        setErrorMessage(
          err?.message || 'Une erreur est survenue pendant la recherche administrative.'
        );
      }
    }, 150);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    isOpen,
    query,
    retryNonce,
    session,
    users,
    groupPosts,
    capsules,
    groups,
    files,
    userReports,
    groupReports,
    supportTickets,
    auditLogs
  ]);

  const handleClose = useCallback(() => {
    abortControllerRef.current?.abort();
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-[2px] flex items-start justify-center p-4 pt-16 sm:pt-24"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Recherche globale administrative"
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <ErrorBoundary
          scopeLabel="Recherche administrative"
          variant="inline"
          resetKey={query}
          onReset={() => {
            onQueryChange('');
            setResults([]);
            setStatus('idle');
            setErrorMessage(null);
          }}
        >
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2.5">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Rechercher un utilisateur, publication, communauté, fichier, signalement, audit..."
              aria-label="Rechercher dans l'administration"
              className="flex-1 bg-transparent text-xs text-slate-900 dark:text-white focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => onQueryChange('')}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                title="Effacer la saisie"
                aria-label="Effacer la saisie"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
              title="Fermer (Échap)"
              aria-label="Fermer la recherche"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {!query.trim() ? (
              <p className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                Tapez un nom, un e-mail, un mot-clé, un signalement ou une action pour explorer toute l&apos;administration.
              </p>
            ) : status === 'loading' ? (
              <div className="p-6 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span>Recherche en cours...</span>
              </div>
            ) : status === 'error' ? (
              <div className="p-6 text-center space-y-2.5">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4" />
                  <span>{errorMessage || 'Erreur de recherche'}</span>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => setRetryNonce((n) => n + 1)}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Réessayer</span>
                  </button>
                </div>
              </div>
            ) : results.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                Aucun résultat dans les collections chargées pour « {query.trim()} ».
              </p>
            ) : (
              results.map((hit) => (
                <button
                  key={hit.key}
                  type="button"
                  onClick={() => onSelectHit(hit.module, hit.seed)}
                  className="w-full px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center justify-between gap-3 text-xs transition"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">
                      {hit.title}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {hit.subtitle}
                    </p>
                  </div>
                  <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                    {hit.category}
                  </span>
                </button>
              ))
            )}
          </div>
        </ErrorBoundary>
      </div>
    </div>
  );
};
