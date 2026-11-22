import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  FolderOpen,
  FolderPlus,
  Folder,
  Image as ImageIcon,
  Film,
  FileAudio,
  FileText,
  ExternalLink,
  HardDrive,
  ShieldCheck,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  Pencil,
  ArrowUpRight,
  ChevronRight,
  ChevronLeft,
  CloudUpload,
  LogOut,
  Eye,
  X,
  LayoutGrid,
  List,
  Info,
  Users as UsersIcon
} from 'lucide-react';
import { AdminSessionContext, IndexedZaureFile, PlatformSettings } from '../types';
import { adminService } from '../services/adminService';
import {
  DriveFileDetails,
  DriveFileItem,
  driveStorageService
} from '../services/driveStorageService';
import { ConfirmModal } from '../components/ConfirmModal';
import { canPerformAdminAction } from '../utils/adminAnalytics';

function formatBytes(bytes?: number | string): string {
  const num = typeof bytes === 'string' ? Number(bytes) : bytes;
  if (!num || Number.isNaN(num) || num <= 0) return '—';
  if (num < 1024) return `${num} o`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} Ko`;
  return `${(num / (1024 * 1024)).toFixed(2)} Mo`;
}

const GoogleSignInButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}> = ({ onClick, disabled, label = 'Se connecter avec Google Drive' }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="gsi-material-button"
  >
    <div className="gsi-material-button-state" />
    <div className="gsi-material-button-content-wrapper">
      <div className="gsi-material-button-icon">
        <svg
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 48 48"
          style={{ display: 'block' }}
        >
          <path
            fill="#EA4335"
            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
          />
          <path
            fill="#4285F4"
            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
          />
          <path
            fill="#FBBC05"
            d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
          />
          <path
            fill="#34A853"
            d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
          />
          <path fill="none" d="M0 0h48v48H0z" />
        </svg>
      </div>
      <span className="gsi-material-button-contents">{label}</span>
    </div>
  </button>
);

// ============================================================================
// MODULE 8 : GESTION DES FICHIERS CENTRALISÉE
// ============================================================================
interface FilesModuleProps {
  session: AdminSessionContext;
  files: IndexedZaureFile[];
  settings: PlatformSettings;
  initialSearch?: string;
  onGoToDrive: () => void;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}

export const FilesManagementModule: React.FC<FilesModuleProps> = ({
  session,
  files,
  settings,
  initialSearch = '',
  onGoToDrive,
  onNotify
}) => {
  const [search, setSearch] = useState(initialSearch);
  const [originFilter, setOriginFilter] = useState<'all' | 'post' | 'capsule' | 'conversation' | 'circle'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video' | 'audio' | 'document'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [page, setPage] = useState(1);
  const pageSize = 16;

  const [previewFile, setPreviewFile] = useState<IndexedZaureFile | null>(null);
  const [pendingSyncFile, setPendingSyncFile] = useState<IndexedZaureFile | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const hasDriveToken = Boolean(driveStorageService.getAccessToken());
  const canManageDrive = canPerformAdminAction(session, 'manageDrive');

  useEffect(() => {
    if (initialSearch) setSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    setPage(1);
  }, [search, originFilter, typeFilter]);

  useEffect(() => {
    if (!previewFile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewFile(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewFile]);

  const filtered = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    return files.filter((f) => {
      if (originFilter !== 'all' && f.origin !== originFilter) return false;
      if (typeFilter !== 'all' && f.mediaType !== typeFilter) return false;
      if (!q) return true;
      return (
        String(f.name ?? '').toLowerCase().includes(q) ||
        String(f.ownerName ?? '').toLowerCase().includes(q) ||
        String(f.originLabel ?? '').toLowerCase().includes(q) ||
        String(f.contextTitle ?? '').toLowerCase().includes(q)
      );
    });
  }, [files, search, originFilter, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage]);

  const exportInventoryJson = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zaure-files-inventory-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total fichiers indexés</p>
          <p className="text-xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {files.length}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Publications & Capsules</p>
          <p className="text-xl font-extrabold font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-1">
            {files.filter((f) => f.origin === 'post' || f.origin === 'capsule').length}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Échanges conversations</p>
          <p className="text-xl font-extrabold font-mono tabular-nums text-indigo-600 dark:text-indigo-400 mt-1">
            {files.filter((f) => f.origin === 'conversation').length}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Médias communautés</p>
          <p className="text-xl font-extrabold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            {files.filter((f) => f.origin === 'circle').length}
          </p>
        </div>
      </div>

      {/* Filters & View Mode */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un fichier, auteur ou source..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-blue-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value as any)}
            className="min-h-[38px] px-3 py-2 text-xs font-medium bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <option value="all">Toutes origines</option>
            <option value="post">Publications</option>
            <option value="capsule">Capsules</option>
            <option value="conversation">Conversations</option>
            <option value="circle">Communautés</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="min-h-[38px] px-3 py-2 text-xs font-medium bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <option value="all">Tous formats</option>
            <option value="image">Images</option>
            <option value="video">Vidéos</option>
            <option value="audio">Audio</option>
            <option value="document">Documents</option>
          </select>

          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-950">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`min-h-[34px] px-2.5 rounded-md text-xs font-semibold inline-flex items-center gap-1 ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
              title="Vue liste"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`min-h-[34px] px-2.5 rounded-md text-xs font-semibold inline-flex items-center gap-1 ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
              title="Vue grille"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={exportInventoryJson}
            className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg"
          >
            <Download className="w-3.5 h-3.5" />
            <span>JSON</span>
          </button>

          {canManageDrive && (
            <button
              type="button"
              onClick={onGoToDrive}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white rounded-lg"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Google Drive</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' ? (
        paginated.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-xs text-slate-500 dark:text-slate-400">
            <FolderOpen className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            Aucun fichier indexé ne correspond aux filtres.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {paginated.map((file) => {
              const Icon =
                file.mediaType === 'image'
                  ? ImageIcon
                  : file.mediaType === 'video'
                    ? Film
                    : file.mediaType === 'audio'
                      ? FileAudio
                      : FileText;
              return (
                <div
                  key={file.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col"
                >
                  <button
                    type="button"
                    onClick={() => setPreviewFile(file)}
                    className="h-36 bg-slate-100 dark:bg-slate-950 flex items-center justify-center relative overflow-hidden group"
                  >
                    {file.mediaType === 'image' ? (
                      <img
                        src={file.url}
                        alt={file.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <Icon className="w-9 h-9 text-slate-400 dark:text-slate-600" />
                    )}
                    <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-slate-950/75 text-white font-mono text-[10px]">
                      {file.mediaType.toUpperCase()}
                    </span>
                  </button>
                  <div className="p-3.5 flex-1 flex flex-col justify-between gap-2 text-xs">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white truncate">{file.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {file.ownerName} · {file.originLabel}
                      </p>
                      <p className="text-[10px] font-mono tabular-nums text-slate-400 dark:text-slate-500 mt-1">
                        {formatBytes(file.sizeBytes)} ·{' '}
                        {file.createdAt ? new Date(file.createdAt).toLocaleDateString('fr-FR') : '—'}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setPreviewFile(file)}
                        className="min-h-[34px] px-2.5 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-md inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Aperçu</span>
                      </button>
                      {canManageDrive && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!hasDriveToken) {
                              onGoToDrive();
                              return;
                            }
                            setPendingSyncFile(file);
                          }}
                          className="min-h-[34px] px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md inline-flex items-center gap-1"
                        >
                          <CloudUpload className="w-3.5 h-3.5" />
                          <span>Drive</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Fichier</th>
                  <th className="py-3 px-4">Origine</th>
                  <th className="py-3 px-4">Propriétaire</th>
                  <th className="py-3 px-4">Format / Taille</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500 dark:text-slate-400">
                      <FolderOpen className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      Aucun fichier indexé ne correspond aux filtres.
                    </td>
                  </tr>
                ) : (
                  paginated.map((file) => {
                    const Icon =
                      file.mediaType === 'image'
                        ? ImageIcon
                        : file.mediaType === 'video'
                          ? Film
                          : file.mediaType === 'audio'
                            ? FileAudio
                            : FileText;
                    const isDataUri = file.url.startsWith('data:');
                    return (
                      <tr key={file.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => setPreviewFile(file)}
                              className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 overflow-hidden"
                              title="Prévisualiser"
                            >
                              {file.mediaType === 'image' ? (
                                <img src={file.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                              ) : (
                                <Icon className="w-4 h-4" />
                              )}
                            </button>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">
                                {file.name}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
                                {file.contextTitle}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">{file.originLabel}</td>
                        <td className="py-2.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                          {file.ownerName}
                        </td>
                        <td className="py-2.5 px-4 font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                          {file.mediaType.toUpperCase()} · {formatBytes(file.sizeBytes)}
                        </td>
                        <td className="py-2.5 px-4 font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                          {file.createdAt ? new Date(file.createdAt).toLocaleDateString('fr-FR') : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setPreviewFile(file)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Aperçu</span>
                            </button>
                            {canManageDrive && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (!hasDriveToken) {
                                    onGoToDrive();
                                    return;
                                  }
                                  setPendingSyncFile(file);
                                }}
                                title={
                                  hasDriveToken
                                    ? 'Archiver ce fichier dans Google Drive'
                                    : 'Connecter Google Drive pour archiver'
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                              >
                                <CloudUpload className="w-3.5 h-3.5" />
                                <span>Drive</span>
                              </button>
                            )}
                            {isDataUri ? (
                              <a
                                href={file.url}
                                download={file.name}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-md"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Télécharger</span>
                              </a>
                            ) : (
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-md"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Ouvrir</span>
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {paginated.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                Aucun fichier indexé ne correspond aux filtres.
              </div>
            ) : (
              paginated.map((file) => (
                <div key={file.id} className="p-4 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white truncate">{file.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {file.ownerName} · {file.originLabel}
                      </p>
                    </div>
                    <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
                      {file.mediaType.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPreviewFile(file)}
                      className="min-h-[38px] px-3 py-1.5 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg inline-flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Aperçu</span>
                    </button>
                    {canManageDrive && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!hasDriveToken) {
                            onGoToDrive();
                            return;
                          }
                          setPendingSyncFile(file);
                        }}
                        className="min-h-[38px] px-3 py-1.5 text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 rounded-lg inline-flex items-center gap-1"
                      >
                        <CloudUpload className="w-3.5 h-3.5" />
                        <span>Archiver Drive</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Pagination */}
      {filtered.length > pageSize && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
          <span className="font-mono tabular-nums">
            Page {safePage} / {totalPages} · {filtered.length} fichier(s)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="min-h-[36px] px-2.5 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="min-h-[36px] px-2.5 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Media Preview Modal */}
      {previewFile && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {previewFile.name}
                </h3>
                <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  {previewFile.originLabel} · {previewFile.ownerName} · {formatBytes(previewFile.sizeBytes)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-center min-h-[220px]">
                {previewFile.mediaType === 'image' ? (
                  <img
                    src={previewFile.url}
                    alt={previewFile.name}
                    className="max-h-[420px] rounded-lg object-contain"
                  />
                ) : previewFile.mediaType === 'video' ? (
                  <video
                    src={previewFile.url}
                    controls
                    className="max-h-[420px] w-full rounded-lg bg-black"
                  />
                ) : previewFile.mediaType === 'audio' ? (
                  <div className="w-full max-w-md space-y-3 text-center">
                    <FileAudio className="w-10 h-10 text-blue-600 mx-auto" />
                    <audio src={previewFile.url} controls className="w-full" />
                  </div>
                ) : (
                  <div className="text-center space-y-3 py-6">
                    <FileText className="w-10 h-10 text-slate-400 mx-auto" />
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Document ({previewFile.mimeType})
                    </p>
                    <a
                      href={previewFile.url}
                      target="_blank"
                      rel="noreferrer"
                      download={previewFile.url.startsWith('data:') ? previewFile.name : undefined}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Ouvrir / Télécharger le document</span>
                    </a>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Contexte</p>
                  <p className="font-semibold text-slate-900 dark:text-white mt-0.5 truncate">
                    {previewFile.contextTitle}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Type MIME & Date</p>
                  <p className="font-mono text-[11px] text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                    {previewFile.mimeType} ·{' '}
                    {previewFile.createdAt ? new Date(previewFile.createdAt).toLocaleDateString('fr-FR') : '—'}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between gap-2">
              {canManageDrive ? (
                <button
                  type="button"
                  onClick={() => {
                    const target = previewFile;
                    setPreviewFile(null);
                    if (!hasDriveToken) {
                      onGoToDrive();
                      return;
                    }
                    setPendingSyncFile(target);
                  }}
                  className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white rounded-lg"
                >
                  <CloudUpload className="w-3.5 h-3.5" />
                  <span>Archiver sur Drive</span>
                </button>
              ) : (
                <span />
              )}
              <a
                href={previewFile.url}
                target="_blank"
                rel="noreferrer"
                download={previewFile.url.startsWith('data:') ? previewFile.name : undefined}
                className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-lg"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {pendingSyncFile && (
        <ConfirmModal
          open={true}
          title="Archiver ce fichier sur Google Drive"
          description={`Confirmez-vous le téléversement de "${pendingSyncFile.name}" (${pendingSyncFile.originLabel}) dans le dossier racine Google Drive "${settings.driveRootFolderName || 'Zaure-Admin-Storage'}" ?`}
          confirmLabel="Archiver sur Drive"
          tone="primary"
          isLoading={isSyncing}
          onCancel={() => setPendingSyncFile(null)}
          onConfirm={async () => {
            setIsSyncing(true);
            try {
              const folder = await driveStorageService.ensureFolder(
                settings.driveRootFolderName || 'Zaure-Admin-Storage'
              );
              const uploaded = await driveStorageService.syncZaureFileToDrive(
                pendingSyncFile,
                folder.id
              );
              await adminService.recordAuditLog(session, {
                action: 'DRIVE_SYNC_ZAURE_FILE',
                module: 'drive',
                targetType: 'drive_file',
                targetId: uploaded.id,
                details: `Archivage du fichier "${pendingSyncFile.name}" (${pendingSyncFile.origin}) vers Google Drive (${folder.name}).`
              });
              onNotify(`"${uploaded.name}" archivé dans Google Drive.`);
              setPendingSyncFile(null);
            } catch (err: any) {
              onNotify(err?.message || "Échec de l'archivage vers Google Drive.", 'error');
            } finally {
              setIsSyncing(false);
            }
          }}
        />
      )}
    </div>
  );
};

// ============================================================================
// MODULE 9 : STOCKAGE GOOGLE DRIVE (API GOOGLE DRIVE LIVE)
// ============================================================================
interface GoogleDriveModuleProps {
  session: AdminSessionContext;
  files: IndexedZaureFile[];
  settings: PlatformSettings;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}

const FOLDER_MIME = 'application/vnd.google-apps.folder';

export const GoogleDriveModule: React.FC<GoogleDriveModuleProps> = ({
  session,
  files,
  settings,
  onNotify
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [needsAuth, setNeedsAuth] = useState<boolean>(!driveStorageService.getAccessToken());
  const [driveUserEmail, setDriveUserEmail] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);

  const [driveItems, setDriveItems] = useState<DriveFileItem[]>([]);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);

  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string; name: string }>>([]);
  const [viewAllDrive, setViewAllDrive] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'folder' | 'image' | 'document' | 'media'>('all');

  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const [syncOriginFilter, setSyncOriginFilter] = useState<'all' | 'post' | 'capsule' | 'conversation' | 'circle'>('all');

  const [renameTarget, setRenameTarget] = useState<DriveFileItem | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const [detailTarget, setDetailTarget] = useState<DriveFileItem | null>(null);
  const [detailData, setDetailData] = useState<DriveFileDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [confirmState, setConfirmState] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    tone: 'danger' | 'warning' | 'primary';
    action: () => Promise<void>;
  } | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  const rootFolderName = settings.driveRootFolderName || 'Zaure-Admin-Storage';
  const currentFolder = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1] : null;

  const loadDriveDirectory = useCallback(
    async (folderId?: string, queryText?: string, forceAllDrive?: boolean) => {
      if (!driveStorageService.getAccessToken()) {
        setNeedsAuth(true);
        return;
      }
      setIsLoadingDrive(true);
      setDriveError(null);
      try {
        let activeFolderId = folderId;
        if (!forceAllDrive && !activeFolderId && breadcrumbs.length === 0) {
          const rootFolder = await driveStorageService.ensureFolder(rootFolderName);
          activeFolderId = rootFolder.id;
          setBreadcrumbs([{ id: rootFolder.id, name: rootFolder.name }]);
        }
        const items = await driveStorageService.listFiles({
          folderId: forceAllDrive ? undefined : activeFolderId,
          searchQuery: queryText
        });
        setDriveItems(items);
      } catch (err: any) {
        const msg = err?.message || 'Erreur lors du chargement Google Drive.';
        setDriveError(msg);
        if (!driveStorageService.getAccessToken()) {
          setNeedsAuth(true);
        }
      } finally {
        setIsLoadingDrive(false);
      }
    },
    [breadcrumbs.length, rootFolderName]
  );

  useEffect(() => {
    const unsub = driveStorageService.initDriveAuthListener(
      (user) => {
        setDriveUserEmail(user.email || '');
        setNeedsAuth(false);
        loadDriveDirectory(currentFolder?.id, searchQuery, viewAllDrive);
      },
      () => {
        setNeedsAuth(true);
        setDriveItems([]);
      }
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!detailTarget && !renameTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDetailTarget(null);
        setRenameTarget(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailTarget, renameTarget]);

  const openDriveDetails = async (item: DriveFileItem) => {
    setDetailTarget(item);
    setDetailData(null);
    setDetailError(null);
    setIsLoadingDetails(true);
    try {
      const details = await driveStorageService.getFileDetails(item.id);
      setDetailData(details);
    } catch (err: any) {
      setDetailError(err?.message || 'Impossible de charger les permissions et métadonnées.');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleConnectDrive = async () => {
    setIsConnecting(true);
    setDriveError(null);
    try {
      const res = await driveStorageService.connectGoogleDrive();
      setDriveUserEmail(res.user.email || '');
      setNeedsAuth(false);
      setBreadcrumbs([]);
      const rootFolder = await driveStorageService.ensureFolder(rootFolderName);
      setBreadcrumbs([{ id: rootFolder.id, name: rootFolder.name }]);
      const items = await driveStorageService.listFiles({ folderId: rootFolder.id });
      setDriveItems(items);
      onNotify(`Connecté à Google Drive (${res.user.email || 'compte Google'}).`);
    } catch (err: any) {
      setDriveError(err?.message || 'Connexion Google Drive annulée ou refusée.');
      onNotify(err?.message || 'Connexion Google Drive impossible.', 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectDrive = () => {
    driveStorageService.clearDriveToken();
    setNeedsAuth(true);
    setDriveItems([]);
    setBreadcrumbs([]);
    onNotify('Session Google Drive déconnectée de la mémoire.');
  };

  const filteredDriveItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return driveItems.filter((item) => {
      const isFolder = item.mimeType === FOLDER_MIME;
      if (typeFilter === 'folder' && !isFolder) return false;
      if (typeFilter === 'image' && !item.mimeType.startsWith('image/')) return false;
      if (
        typeFilter === 'media' &&
        !item.mimeType.startsWith('video/') &&
        !item.mimeType.startsWith('audio/')
      ) {
        return false;
      }
      if (
        typeFilter === 'document' &&
        (isFolder ||
          item.mimeType.startsWith('image/') ||
          item.mimeType.startsWith('video/') ||
          item.mimeType.startsWith('audio/'))
      ) {
        return false;
      }
      if (!q) return true;
      return String(item.name ?? '').toLowerCase().includes(q);
    });
  }, [driveItems, searchQuery, typeFilter]);

  const syncCandidates = useMemo(() => {
    return files
      .filter((f) => syncOriginFilter === 'all' || f.origin === syncOriginFilter)
      .slice(0, 12);
  }, [files, syncOriginFilter]);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setIsMutating(true);
    try {
      const created = await driveStorageService.createFolder(
        newFolderName.trim(),
        viewAllDrive ? undefined : currentFolder?.id
      );
      await adminService.recordAuditLog(session, {
        action: 'DRIVE_CREATE_FOLDER',
        module: 'drive',
        targetType: 'drive_folder',
        targetId: created.id,
        details: `Création du dossier Google Drive "${created.name}".`
      });
      setNewFolderName('');
      setShowNewFolderInput(false);
      onNotify(`Dossier "${created.name}" créé sur Google Drive.`);
      await loadDriveDirectory(currentFolder?.id, searchQuery, viewAllDrive);
    } catch (err: any) {
      onNotify(err?.message || 'Erreur lors de la création du dossier.', 'error');
    } finally {
      setIsMutating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxBytes = (settings.maxUploadSizeMb || 15) * 1024 * 1024;
    if (file.size > maxBytes) {
      onNotify(`Fichier trop volumineux (max ${settings.maxUploadSizeMb} Mo configuré).`, 'error');
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const uploaded = await driveStorageService.uploadBlobToDrive(
        file,
        file.name,
        file.type || 'application/octet-stream',
        viewAllDrive ? undefined : currentFolder?.id
      );
      await adminService.recordAuditLog(session, {
        action: 'DRIVE_UPLOAD_FILE',
        module: 'drive',
        targetType: 'drive_file',
        targetId: uploaded.id,
        details: `Téléversement manuel de "${uploaded.name}" (${formatBytes(file.size)}) vers Google Drive.`
      });
      onNotify(`"${uploaded.name}" téléversé sur Google Drive.`);
      await loadDriveDirectory(currentFolder?.id, searchQuery, viewAllDrive);
    } catch (err: any) {
      onNotify(err?.message || 'Échec du téléversement Google Drive.', 'error');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const openDeleteConfirm = (item: DriveFileItem, isFolder: boolean) => {
    setConfirmState({
      title: `Supprimer "${item.name}" de Google Drive`,
      description: isFolder
        ? `Confirmez-vous la suppression définitive du dossier "${item.name}" et de son contenu sur Google Drive ?`
        : `Confirmez-vous la suppression définitive du fichier "${item.name}" sur Google Drive ?`,
      confirmLabel: 'Supprimer de Drive',
      tone: 'danger',
      action: async () => {
        await driveStorageService.deleteFile(item.id);
        await adminService.recordAuditLog(session, {
          action: 'DRIVE_DELETE_ITEM',
          module: 'drive',
          targetType: isFolder ? 'drive_folder' : 'drive_file',
          targetId: item.id,
          details: `Suppression sur Google Drive : "${item.name}".`
        });
        onNotify(`"${item.name}" supprimé de Google Drive.`);
        await loadDriveDirectory(currentFolder?.id, searchQuery, viewAllDrive);
      }
    });
  };

  // ---------------------------------------------------------------------------
  // UNAUTHENTICATED DRIVE STATE (REQUIRED GOOGLE SIGN-IN UI)
  // ---------------------------------------------------------------------------
  if (needsAuth) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Stockage centralisé Google Drive
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  Connectez votre compte Google Drive avec autorisation explicite pour explorer vos dossiers, téléverser des médias, inspecter les permissions et archiver les fichiers Zaure.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900 shrink-0 self-start">
              API GOOGLE DRIVE ACTIVE
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Dossier racine configuré
              </p>
              <p className="text-sm font-mono font-bold text-slate-900 dark:text-white mt-1">
                {rootFolderName}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Fichiers Zaure prêts à archiver
              </p>
              <p className="text-sm font-mono tabular-nums font-bold text-slate-900 dark:text-white mt-1">
                {files.length} élément(s) indexé(s)
              </p>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Sécurité & jetons
              </p>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1">
                Cache strictement en mémoire (aucun stockage persistant local) + confirmation requise avant modification/suppression.
              </p>
            </div>
          </div>

          {driveError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {driveError}
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Autorisation par compte Google requise pour cette session administrative.</span>
            </div>
            <GoogleSignInButton
              onClick={handleConnectDrive}
              disabled={isConnecting}
              label={isConnecting ? 'Connexion en cours...' : 'Se connecter avec Google Drive'}
            />
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // CONNECTED LIVE GOOGLE DRIVE WORKSPACE
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Connection Banner & Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Google Drive connecté</h3>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 rounded">
                EN LIGNE
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
              {driveUserEmail || session.email} · {driveItems.length} élément(s) affiché(s)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const nextAll = !viewAllDrive;
              setViewAllDrive(nextAll);
              loadDriveDirectory(currentFolder?.id, searchQuery, nextAll);
            }}
            className={`min-h-[38px] px-3 py-2 text-xs font-semibold rounded-lg border ${
              viewAllDrive
                ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-400'
                : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {viewAllDrive ? 'Vue : Tout mon Drive' : `Vue : ${rootFolderName}`}
          </button>

          <button
            type="button"
            onClick={() => setShowNewFolderInput((v) => !v)}
            className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Nouveau dossier</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isUploading ? 'Envoi...' : 'Téléverser'}</span>
          </button>

          <button
            type="button"
            disabled={isLoadingDrive}
            onClick={() => loadDriveDirectory(currentFolder?.id, searchQuery, viewAllDrive)}
            className="min-h-[38px] p-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg"
            title="Actualiser Drive"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDrive ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleDisconnectDrive}
            className="min-h-[38px] inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg"
            title="Fermer la session Google Drive"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Déconnecter</span>
          </button>
        </div>
      </div>

      {/* Inline New Folder Form */}
      {showNewFolderInput && (
        <form
          onSubmit={handleCreateFolder}
          className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
        >
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder={`Nom du sous-dossier dans ${viewAllDrive ? 'Mon Drive' : currentFolder?.name || rootFolderName}...`}
            className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-600"
            required
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isMutating}
              className="min-h-[38px] px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Créer le dossier
            </button>
            <button
              type="button"
              onClick={() => setShowNewFolderInput(false)}
              className="min-h-[38px] px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Search, Breadcrumbs, Filters & View Mode */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
        {!viewAllDrive && breadcrumbs.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <HardDrive className="w-3.5 h-3.5 text-slate-400 mr-1" />
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.id}>
                {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />}
                <button
                  type="button"
                  onClick={() => {
                    const nextCrumbs = breadcrumbs.slice(0, idx + 1);
                    setBreadcrumbs(nextCrumbs);
                    loadDriveDirectory(crumb.id, searchQuery, false);
                  }}
                  className={`px-1.5 py-0.5 rounded font-medium ${
                    idx === breadcrumbs.length - 1
                      ? 'text-slate-900 dark:text-white font-bold bg-slate-100 dark:bg-slate-800'
                      : 'hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  loadDriveDirectory(currentFolder?.id, searchQuery, viewAllDrive);
                }
              }}
              placeholder="Rechercher dans ce dossier Google Drive..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="min-h-[38px] px-3 py-2 text-xs font-medium bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <option value="all">Tous les types ({driveItems.length})</option>
              <option value="folder">Dossiers</option>
              <option value="image">Images</option>
              <option value="media">Vidéos & Audio</option>
              <option value="document">Documents</option>
            </select>

            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`min-h-[34px] px-2.5 rounded-md text-xs font-semibold ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
                title="Vue liste"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`min-h-[34px] px-2.5 rounded-md text-xs font-semibold ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
                title="Vue grille"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {driveError && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
          {driveError}
        </div>
      )}

      {/* Drive Items Display: Grid or List */}
      {viewMode === 'grid' ? (
        isLoadingDrive && filteredDriveItems.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-xs text-slate-500 dark:text-slate-400">
            Chargement des fichiers Google Drive...
          </div>
        ) : filteredDriveItems.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-xs text-slate-500 dark:text-slate-400">
            <FolderOpen className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            Aucun fichier ou dossier dans cet emplacement.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {filteredDriveItems.map((item) => {
              const isFolder = item.mimeType === FOLDER_MIME;
              return (
                <div
                  key={item.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start gap-2.5">
                    {isFolder ? (
                      <Folder className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    ) : (
                      <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      {isFolder ? (
                        <button
                          type="button"
                          onClick={() => {
                            setViewAllDrive(false);
                            setBreadcrumbs((prev) => [...prev, { id: item.id, name: item.name }]);
                            loadDriveDirectory(item.id, '', false);
                          }}
                          className="text-xs font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 text-left line-clamp-2"
                        >
                          {item.name}
                        </button>
                      ) : (
                        <p className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-2">
                          {item.name}
                        </p>
                      )}
                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                        {isFolder ? 'Dossier' : formatBytes(item.size)} ·{' '}
                        {item.modifiedTime ? new Date(item.modifiedTime).toLocaleDateString('fr-FR') : '—'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => openDriveDetails(item)}
                      title="Détails & permissions"
                      className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                    {item.webViewLink && (
                      <a
                        href={item.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        title="Ouvrir dans Google Drive"
                        className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-md"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setRenameTarget(item);
                        setRenameValue(item.name);
                      }}
                      title="Renommer"
                      className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openDeleteConfirm(item, isFolder)}
                      title="Supprimer de Drive"
                      className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Nom dans Google Drive</th>
                  <th className="py-3 px-4">Type MIME</th>
                  <th className="py-3 px-4">Taille</th>
                  <th className="py-3 px-4">Modifié le</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {isLoadingDrive && filteredDriveItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-500 dark:text-slate-400">
                      Chargement des fichiers Google Drive...
                    </td>
                  </tr>
                ) : filteredDriveItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-500 dark:text-slate-400">
                      <FolderOpen className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      Aucun fichier ou dossier dans cet emplacement.
                    </td>
                  </tr>
                ) : (
                  filteredDriveItems.map((item) => {
                    const isFolder = item.mimeType === FOLDER_MIME;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4">
                          {isFolder ? (
                            <button
                              type="button"
                              onClick={() => {
                                setViewAllDrive(false);
                                setBreadcrumbs((prev) => [...prev, { id: item.id, name: item.name }]);
                                loadDriveDirectory(item.id, '', false);
                              }}
                              className="flex items-center gap-2.5 text-left font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                            >
                              <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                              <span className="truncate max-w-[260px]">{item.name}</span>
                            </button>
                          ) : (
                            <div className="flex items-center gap-2.5">
                              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                              <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[260px]">
                                {item.name}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
                          {isFolder ? 'Dossier Drive' : item.mimeType}
                        </td>
                        <td className="py-2.5 px-4 font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                          {isFolder ? '—' : formatBytes(item.size)}
                        </td>
                        <td className="py-2.5 px-4 font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                          {item.modifiedTime ? new Date(item.modifiedTime).toLocaleDateString('fr-FR') : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openDriveDetails(item)}
                              title="Détails & permissions"
                              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                            >
                              <Info className="w-3.5 h-3.5" />
                            </button>
                            {item.webViewLink && (
                              <a
                                href={item.webViewLink}
                                target="_blank"
                                rel="noreferrer"
                                title="Ouvrir dans Google Drive"
                                className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-md"
                              >
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setRenameTarget(item);
                                setRenameValue(item.name);
                              }}
                              title="Renommer"
                              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openDeleteConfirm(item, isFolder)}
                              title="Supprimer de Drive"
                              className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {filteredDriveItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                {isLoadingDrive ? 'Chargement...' : 'Aucun élément.'}
              </div>
            ) : (
              filteredDriveItems.map((item) => {
                const isFolder = item.mimeType === FOLDER_MIME;
                return (
                  <div key={item.id} className="p-4 space-y-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      {isFolder ? (
                        <button
                          type="button"
                          onClick={() => {
                            setViewAllDrive(false);
                            setBreadcrumbs((prev) => [...prev, { id: item.id, name: item.name }]);
                            loadDriveDirectory(item.id, '', false);
                          }}
                          className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-left"
                        >
                          <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                          <span>{item.name}</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                          <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                          <span>{item.name}</span>
                        </div>
                      )}
                      <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                        {isFolder ? 'Dossier' : formatBytes(item.size)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => openDriveDetails(item)}
                        className="min-h-[36px] px-2.5 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-md inline-flex items-center gap-1"
                      >
                        <Info className="w-3.5 h-3.5" />
                        <span>Détails</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRenameTarget(item);
                          setRenameValue(item.name);
                        }}
                        className="min-h-[36px] px-2.5 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-md"
                      >
                        Renommer
                      </button>
                      <button
                        type="button"
                        onClick={() => openDeleteConfirm(item, isFolder)}
                        className="min-h-[36px] px-2.5 py-1 text-[11px] font-semibold bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-md"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Sync Indexed Zaure Files -> Google Drive */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Archiver les fichiers Zaure vers ce dossier Drive
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Synchronisation directe des médias publiés, échangés en messagerie ou partagés dans les communautés.
            </p>
          </div>
          <select
            value={syncOriginFilter}
            onChange={(e) => setSyncOriginFilter(e.target.value as any)}
            className="min-h-[36px] px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
          >
            <option value="all">Toutes origines ({files.length})</option>
            <option value="post">Publications</option>
            <option value="capsule">Capsules</option>
            <option value="conversation">Conversations</option>
            <option value="circle">Communautés</option>
          </select>
        </div>
        {syncCandidates.length === 0 ? (
          <p className="p-6 text-xs text-slate-500 dark:text-slate-400 text-center">
            Aucun fichier Zaure disponible pour cette origine.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {syncCandidates.map((f) => (
              <div
                key={f.id}
                className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{f.name}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {f.originLabel} · par {f.ownerName} · {f.mediaType.toUpperCase()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setConfirmState({
                      title: 'Archiver vers Google Drive',
                      description: `Téléverser "${f.name}" (${f.originLabel}) dans "${viewAllDrive ? 'Mon Drive' : currentFolder?.name || rootFolderName}" ?`,
                      confirmLabel: 'Archiver',
                      tone: 'primary',
                      action: async () => {
                        const uploaded = await driveStorageService.syncZaureFileToDrive(
                          f,
                          viewAllDrive ? undefined : currentFolder?.id
                        );
                        await adminService.recordAuditLog(session, {
                          action: 'DRIVE_SYNC_ZAURE_FILE',
                          module: 'drive',
                          targetType: 'drive_file',
                          targetId: uploaded.id,
                          details: `Archivage du fichier "${f.name}" (${f.origin}) dans Google Drive.`
                        });
                        onNotify(`"${uploaded.name}" archivé dans Google Drive.`);
                        await loadDriveDirectory(currentFolder?.id, searchQuery, viewAllDrive);
                      }
                    })
                  }
                  className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white rounded-lg shrink-0"
                >
                  <CloudUpload className="w-3.5 h-3.5" />
                  <span>Archiver</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Drive File Details & Permissions Modal */}
      {detailTarget && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-[1px] flex items-center justify-center p-4"
          onClick={() => setDetailTarget(null)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {detailTarget.name}
                </h3>
                <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  ID : {detailTarget.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailTarget(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {isLoadingDetails ? (
                <p className="text-slate-500 dark:text-slate-400 py-8 text-center">
                  Chargement des métadonnées et permissions Google Drive...
                </p>
              ) : detailError ? (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300">
                  {detailError}
                </div>
              ) : detailData ? (
                <>
                  {detailData.thumbnailLink && (
                    <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 flex justify-center p-2">
                      <img
                        src={detailData.thumbnailLink}
                        alt={detailData.name}
                        className="max-h-48 rounded object-contain"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Type MIME</p>
                      <p className="font-mono text-[11px] font-semibold text-slate-900 dark:text-white mt-0.5 break-all">
                        {detailData.mimeType}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Taille & Partage</p>
                      <p className="font-mono text-[11px] font-semibold text-slate-900 dark:text-white mt-0.5">
                        {formatBytes(detailData.size)} · {detailData.shared ? 'Partagé' : 'Privé'}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Créé le</p>
                      <p className="font-mono text-[11px] text-slate-800 dark:text-slate-200 mt-0.5">
                        {detailData.createdTime
                          ? new Date(detailData.createdTime).toLocaleString('fr-FR')
                          : '—'}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Modifié le</p>
                      <p className="font-mono text-[11px] text-slate-800 dark:text-slate-200 mt-0.5">
                        {detailData.modifiedTime
                          ? new Date(detailData.modifiedTime).toLocaleString('fr-FR')
                          : '—'}
                      </p>
                    </div>
                  </div>

                  {detailData.owners && detailData.owners.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                        Propriétaire(s)
                      </p>
                      <div className="space-y-1">
                        {detailData.owners.map((owner, idx) => (
                          <div
                            key={`${owner.emailAddress || idx}`}
                            className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                          >
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {owner.displayName || 'Propriétaire'}
                            </span>
                            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                              {owner.emailAddress || '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                      <UsersIcon className="w-3.5 h-3.5" />
                      <span>Permissions Google Drive ({detailData.permissions?.length || 0})</span>
                    </p>
                    {!detailData.permissions || detailData.permissions.length === 0 ? (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Aucune permission détaillée retournée par Drive.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {detailData.permissions.map((perm) => (
                          <div
                            key={perm.id}
                            className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 dark:text-white truncate">
                                {perm.displayName || perm.emailAddress || perm.type || 'Accès'}
                              </p>
                              {perm.emailAddress && (
                                <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                                  {perm.emailAddress}
                                </p>
                              )}
                            </div>
                            <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900 shrink-0">
                              {perm.role || perm.type}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {detailData?.webViewLink && (
              <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex justify-end">
                <a
                  href={detailData.webViewLink}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[38px] inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Ouvrir dans Google Drive</span>
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rename Modal with Confirmation */}
      {renameTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[1px] flex items-center justify-center p-4"
          onClick={() => setRenameTarget(null)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Renommer sur Google Drive
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Nouveau nom pour <span className="font-mono font-semibold">{renameTarget.name}</span> :
            </p>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-600"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="min-h-[38px] px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!renameValue.trim() || renameValue.trim() === renameTarget.name}
                onClick={() => {
                  const target = renameTarget;
                  const nextName = renameValue.trim();
                  setRenameTarget(null);
                  setConfirmState({
                    title: 'Confirmer le renommage Google Drive',
                    description: `Renommer "${target.name}" en "${nextName}" sur Google Drive ?`,
                    confirmLabel: 'Renommer',
                    tone: 'warning',
                    action: async () => {
                      const updated = await driveStorageService.renameFile(target.id, nextName);
                      await adminService.recordAuditLog(session, {
                        action: 'DRIVE_RENAME_ITEM',
                        module: 'drive',
                        targetType: 'drive_file',
                        targetId: updated.id,
                        details: `Renommage Google Drive : "${target.name}" -> "${updated.name}".`
                      });
                      onNotify(`Élément renommé en "${updated.name}".`);
                      await loadDriveDirectory(currentFolder?.id, searchQuery, viewAllDrive);
                    }
                  });
                }}
                className="min-h-[38px] px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                Continuer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Confirmation Modal for all mutating/destructive Drive operations */}
      {confirmState && (
        <ConfirmModal
          open={true}
          title={confirmState.title}
          description={confirmState.description}
          confirmLabel={confirmState.confirmLabel}
          tone={confirmState.tone}
          isLoading={isMutating}
          onCancel={() => setConfirmState(null)}
          onConfirm={async () => {
            setIsMutating(true);
            try {
              await confirmState.action();
              setConfirmState(null);
            } catch (err: any) {
              onNotify(err?.message || 'Erreur lors de l’opération Google Drive.', 'error');
            } finally {
              setIsMutating(false);
            }
          }}
        />
      )}
    </div>
  );
};
