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
  CloudUpload,
  LogOut
} from 'lucide-react';
import { AdminSessionContext, IndexedZaureFile, PlatformSettings } from '../types';
import { adminService } from '../services/adminService';
import { DriveFileItem, driveStorageService } from '../services/driveStorageService';
import { ConfirmModal } from '../components/ConfirmModal';

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
  onGoToDrive: () => void;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}

export const FilesManagementModule: React.FC<FilesModuleProps> = ({
  session,
  files,
  settings,
  onGoToDrive,
  onNotify
}) => {
  const [search, setSearch] = useState('');
  const [originFilter, setOriginFilter] = useState<'all' | 'post' | 'capsule' | 'conversation' | 'circle'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video' | 'audio' | 'document'>('all');
  const [pendingSyncFile, setPendingSyncFile] = useState<IndexedZaureFile | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const hasDriveToken = Boolean(driveStorageService.getAccessToken());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return files.filter((f) => {
      if (originFilter !== 'all' && f.origin !== originFilter) return false;
      if (typeFilter !== 'all' && f.mediaType !== typeFilter) return false;
      if (!q) return true;
      return (
        f.name.toLowerCase().includes(q) ||
        f.ownerName.toLowerCase().includes(q) ||
        f.originLabel.toLowerCase().includes(q)
      );
    });
  }, [files, search, originFilter, typeFilter]);

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
        <div className="bg-white border border-slate-200 rounded-xl p-3.5">
          <p className="text-[11px] font-semibold text-slate-500">Total fichiers indexés</p>
          <p className="text-xl font-extrabold font-mono tabular-nums text-slate-900 mt-1">{files.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5">
          <p className="text-[11px] font-semibold text-slate-500">Publications & Capsules</p>
          <p className="text-xl font-extrabold font-mono tabular-nums text-blue-600 mt-1">
            {files.filter((f) => f.origin === 'post' || f.origin === 'capsule').length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5">
          <p className="text-[11px] font-semibold text-slate-500">Échanges conversations</p>
          <p className="text-xl font-extrabold font-mono tabular-nums text-indigo-600 mt-1">
            {files.filter((f) => f.origin === 'conversation').length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5">
          <p className="text-[11px] font-semibold text-slate-500">Médias des Cercles</p>
          <p className="text-xl font-extrabold font-mono tabular-nums text-emerald-600 mt-1">
            {files.filter((f) => f.origin === 'circle').length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un fichier, auteur ou source..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value as any)}
            className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg"
          >
            <option value="all">Toutes origines</option>
            <option value="post">Publications</option>
            <option value="capsule">Capsules</option>
            <option value="conversation">Conversations</option>
            <option value="circle">Cercles</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg"
          >
            <option value="all">Tous formats</option>
            <option value="image">Images</option>
            <option value="video">Vidéos</option>
            <option value="audio">Audio</option>
            <option value="document">Documents</option>
          </select>

          <button
            type="button"
            onClick={exportInventoryJson}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exporter JSON</span>
          </button>

          <button
            type="button"
            onClick={onGoToDrive}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg"
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Google Drive</span>
          </button>
        </div>
      </div>

      {/* Files Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Fichier</th>
                <th className="py-3 px-4">Origine</th>
                <th className="py-3 px-4">Propriétaire</th>
                <th className="py-3 px-4">Format / Taille</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    <FolderOpen className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                    Aucun fichier indexé ne correspond aux filtres.
                  </td>
                </tr>
              ) : (
                filtered.map((file) => {
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
                    <tr key={file.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate max-w-[200px]">{file.name}</p>
                            <p className="text-[11px] text-slate-500 truncate max-w-[220px]">{file.contextTitle}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-slate-700">{file.originLabel}</td>
                      <td className="py-2.5 px-4 font-medium text-slate-800">{file.ownerName}</td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-[11px] text-slate-500">
                        {file.mediaType.toUpperCase()} · {formatBytes(file.sizeBytes)}
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-[11px] text-slate-500">
                        {file.createdAt ? new Date(file.createdAt).toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
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
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 rounded-md"
                          >
                            <CloudUpload className="w-3 h-3" />
                            <span>Drive</span>
                          </button>

                          {isDataUri ? (
                            <a
                              href={file.url}
                              download={file.name}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 rounded-md"
                            >
                              <Download className="w-3 h-3" />
                              <span>Télécharger</span>
                            </a>
                          ) : (
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 rounded-md"
                            >
                              <ExternalLink className="w-3 h-3" />
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
      </div>

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

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'folder' | 'image' | 'document' | 'media'>('all');

  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const [syncOriginFilter, setSyncOriginFilter] = useState<'all' | 'post' | 'capsule' | 'conversation' | 'circle'>('all');

  const [renameTarget, setRenameTarget] = useState<DriveFileItem | null>(null);
  const [renameValue, setRenameValue] = useState('');

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
      return item.name.toLowerCase().includes(q);
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

  // ---------------------------------------------------------------------------
  // UNAUTHENTICATED DRIVE STATE (REQUIRED GOOGLE SIGN-IN UI)
  // ---------------------------------------------------------------------------
  if (needsAuth) {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Stockage centralisé Google Drive
                </h3>
                <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                  Connectez votre compte Google Drive avec autorisation explicite pour explorer vos dossiers, téléverser des médias et archiver les fichiers des publications, conversations et Cercles Zaure.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
              API GOOGLE DRIVE ACTIVE
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Dossier racine configuré
              </p>
              <p className="text-sm font-mono font-bold text-slate-900 mt-1">{rootFolderName}</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Fichiers Zaure prêts à archiver
              </p>
              <p className="text-sm font-mono tabular-nums font-bold text-slate-900 mt-1">
                {files.length} élément(s) indexé(s)
              </p>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Sécurité & jetons
              </p>
              <p className="text-xs font-medium text-slate-700 mt-1">
                Cache strictement en mémoire (aucun stockage persistant local) + confirmation requise avant modification/suppression.
              </p>
            </div>
          </div>

          {driveError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {driveError}
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-200">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
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
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Google Drive connecté</h3>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                EN LIGNE
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-500 mt-0.5">
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
            className={`px-3 py-2 text-xs font-semibold rounded-lg border ${
              viewAllDrive
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {viewAllDrive ? 'Vue : Tout mon Drive' : `Vue : ${rootFolderName}`}
          </button>

          <button
            type="button"
            onClick={() => setShowNewFolderInput((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg"
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
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isUploading ? 'Envoi...' : 'Téléverser'}</span>
          </button>

          <button
            type="button"
            disabled={isLoadingDrive}
            onClick={() => loadDriveDirectory(currentFolder?.id, searchQuery, viewAllDrive)}
            className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg"
            title="Actualiser Drive"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDrive ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleDisconnectDrive}
            className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 rounded-lg"
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
          className="bg-white border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
        >
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder={`Nom du sous-dossier dans ${viewAllDrive ? 'Mon Drive' : currentFolder?.name || rootFolderName}...`}
            className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
            required
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isMutating}
              className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Créer le dossier
            </button>
            <button
              type="button"
              onClick={() => setShowNewFolderInput(false)}
              className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Search, Breadcrumbs & Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        {!viewAllDrive && breadcrumbs.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
            <HardDrive className="w-3.5 h-3.5 text-slate-400 mr-1" />
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.id}>
                {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
                <button
                  type="button"
                  onClick={() => {
                    const nextCrumbs = breadcrumbs.slice(0, idx + 1);
                    setBreadcrumbs(nextCrumbs);
                    loadDriveDirectory(crumb.id, searchQuery, false);
                  }}
                  className={`px-1.5 py-0.5 rounded font-medium ${
                    idx === breadcrumbs.length - 1
                      ? 'text-slate-900 font-bold bg-slate-100'
                      : 'hover:text-blue-600'
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
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg"
          >
            <option value="all">Tous les types ({driveItems.length})</option>
            <option value="folder">Dossiers</option>
            <option value="image">Images</option>
            <option value="media">Vidéos & Audio</option>
            <option value="document">Documents</option>
          </select>
        </div>
      </div>

      {driveError && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
          {driveError}
        </div>
      )}

      {/* Live Drive Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Nom dans Google Drive</th>
                <th className="py-3 px-4">Type MIME</th>
                <th className="py-3 px-4">Taille</th>
                <th className="py-3 px-4">Modifié le</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoadingDrive && filteredDriveItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    Chargement des fichiers Google Drive...
                  </td>
                </tr>
              ) : filteredDriveItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    <FolderOpen className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                    Aucun fichier ou dossier dans cet emplacement.
                  </td>
                </tr>
              ) : (
                filteredDriveItems.map((item) => {
                  const isFolder = item.mimeType === FOLDER_MIME;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4">
                        {isFolder ? (
                          <button
                            type="button"
                            onClick={() => {
                              setViewAllDrive(false);
                              setBreadcrumbs((prev) => [...prev, { id: item.id, name: item.name }]);
                              loadDriveDirectory(item.id, '', false);
                            }}
                            className="flex items-center gap-2.5 text-left font-bold text-slate-900 hover:text-blue-600"
                          >
                            <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                            <span className="truncate max-w-[260px]">{item.name}</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-2.5">
                            <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                            <span className="font-semibold text-slate-900 truncate max-w-[260px]">
                              {item.name}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 truncate max-w-[220px]">
                        {isFolder ? 'Dossier Drive' : item.mimeType}
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-[11px] text-slate-500">
                        {isFolder ? '—' : formatBytes(item.size)}
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-[11px] text-slate-500">
                        {item.modifiedTime ? new Date(item.modifiedTime).toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          {item.webViewLink && (
                            <a
                              href={item.webViewLink}
                              target="_blank"
                              rel="noreferrer"
                              title="Ouvrir dans Google Drive"
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md"
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
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
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
                              })
                            }
                            title="Supprimer de Drive"
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"
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
      </div>

      {/* Sync Indexed Zaure Files -> Google Drive */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Archiver les fichiers Zaure vers ce dossier Drive
            </h3>
            <p className="text-[11px] text-slate-500">
              Synchronisation directe des médias publiés, échangés en messagerie ou partagés dans les Cercles.
            </p>
          </div>
          <select
            value={syncOriginFilter}
            onChange={(e) => setSyncOriginFilter(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
          >
            <option value="all">Toutes origines ({files.length})</option>
            <option value="post">Publications</option>
            <option value="capsule">Capsules</option>
            <option value="conversation">Conversations</option>
            <option value="circle">Cercles</option>
          </select>
        </div>
        {syncCandidates.length === 0 ? (
          <p className="p-6 text-xs text-slate-500 text-center">
            Aucun fichier Zaure disponible pour cette origine.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {syncCandidates.map((f) => (
              <div key={f.id} className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-slate-50">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">{f.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shrink-0"
                >
                  <CloudUpload className="w-3.5 h-3.5" />
                  <span>Archiver</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rename Modal with Confirmation */}
      {renameTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          onClick={() => setRenameTarget(null)}
        >
          <div
            className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-slate-900">Renommer sur Google Drive</h3>
            <p className="text-xs text-slate-600">
              Nouveau nom pour <span className="font-mono font-semibold">{renameTarget.name}</span> :
            </p>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
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
                className="px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
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
