import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  User
} from 'firebase/auth';
import { auth } from '../../firebaseClient';
import { IndexedZaureFile } from '../types';

export const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive'];

export interface DrivePermission {
  id: string;
  type?: string;
  role?: string;
  emailAddress?: string;
  displayName?: string;
}

export interface DriveFileDetails extends DriveFileItem {
  createdTime?: string;
  thumbnailLink?: string;
  shared?: boolean;
  owners?: Array<{ displayName?: string; emailAddress?: string; photoLink?: string }>;
  permissions?: DrivePermission[];
}

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  iconLink?: string;
  parents?: string[];
  trashed?: boolean;
}

const provider = new GoogleAuthProvider();
DRIVE_SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({ prompt: 'consent select_account' });

// Strict in-memory access token cache (NEVER persisted to localStorage or sessionStorage)
let cachedDriveAccessToken: string | null = null;
let isSigningInDrive = false;

export const driveStorageService = {
  initDriveAuthListener: (
    onTokenAvailable: (user: User, token: string) => void,
    onTokenCleared: () => void
  ) => {
    if (!auth) {
      onTokenCleared();
      return () => {};
    }
    return onAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        if (cachedDriveAccessToken) {
          onTokenAvailable(user, cachedDriveAccessToken);
        } else if (!isSigningInDrive) {
          cachedDriveAccessToken = null;
          onTokenCleared();
        }
      } else {
        cachedDriveAccessToken = null;
        onTokenCleared();
      }
    });
  },

  connectGoogleDrive: async (): Promise<{ user: User; accessToken: string }> => {
    if (!auth) throw new Error('Firebase Auth non initialisé.');
    try {
      isSigningInDrive = true;
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error("Impossible d'obtenir le jeton d'accès Google Drive.");
      }
      cachedDriveAccessToken = credential.accessToken;
      return { user: result.user, accessToken: cachedDriveAccessToken };
    } finally {
      isSigningInDrive = false;
    }
  },

  getAccessToken: (): string | null => cachedDriveAccessToken,

  clearDriveToken: () => {
    cachedDriveAccessToken = null;
  },

  ensureFolder: async (folderName: string): Promise<DriveFileItem> => {
    const token = cachedDriveAccessToken;
    if (!token) throw new Error('Connexion Google Drive requise.');

    const cleanName = folderName.trim() || 'Zaure-Admin-Storage';
    const q = encodeURIComponent(
      `name = '${cleanName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    );
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,modifiedTime,webViewLink)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!searchRes.ok) {
      const errBody = await searchRes.json().catch(() => ({}));
      throw new Error(errBody?.error?.message || `Erreur Google Drive (${searchRes.status})`);
    }
    const searchData = await searchRes.json();
    if (Array.isArray(searchData.files) && searchData.files.length > 0) {
      return searchData.files[0] as DriveFileItem;
    }

    const createRes = await fetch(
      'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,modifiedTime,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: cleanName,
          mimeType: 'application/vnd.google-apps.folder'
        })
      }
    );
    if (!createRes.ok) {
      const errBody = await createRes.json().catch(() => ({}));
      throw new Error(errBody?.error?.message || `Impossible de créer le dossier (${createRes.status})`);
    }
    return (await createRes.json()) as DriveFileItem;
  },

  listFiles: async (options?: { folderId?: string; searchQuery?: string }): Promise<DriveFileItem[]> => {
    const token = cachedDriveAccessToken;
    if (!token) throw new Error('Connexion Google Drive requise.');

    const clauses = ['trashed = false'];
    if (options?.folderId) {
      clauses.push(`'${options.folderId}' in parents`);
    }
    if (options?.searchQuery?.trim()) {
      const escaped = options.searchQuery.trim().replace(/'/g, "\\'");
      clauses.push(`name contains '${escaped}'`);
    }

    const q = encodeURIComponent(clauses.join(' and '));
    const fields = encodeURIComponent(
      'files(id,name,mimeType,size,modifiedTime,webViewLink,iconLink,parents,trashed)'
    );
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=folder,modifiedTime desc&pageSize=100`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
      if (res.status === 401) {
        cachedDriveAccessToken = null;
      }
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.error?.message || `Erreur lecture Google Drive (${res.status})`);
    }
    const data = await res.json();
    return (data.files || []) as DriveFileItem[];
  },

  createFolder: async (name: string, parentId?: string): Promise<DriveFileItem> => {
    const token = cachedDriveAccessToken;
    if (!token) throw new Error('Connexion Google Drive requise.');

    const metadata: Record<string, any> = {
      name: name.trim(),
      mimeType: 'application/vnd.google-apps.folder'
    };
    if (parentId) metadata.parents = [parentId];

    const res = await fetch(
      'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,modifiedTime,webViewLink,parents',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
      }
    );
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.error?.message || `Erreur création dossier (${res.status})`);
    }
    return (await res.json()) as DriveFileItem;
  },

  uploadBlobToDrive: async (
    blob: Blob,
    fileName: string,
    mimeType: string,
    parentId?: string
  ): Promise<DriveFileItem> => {
    const token = cachedDriveAccessToken;
    if (!token) throw new Error('Connexion Google Drive requise.');

    const metadata: Record<string, any> = {
      name: fileName,
      mimeType: mimeType || blob.type || 'application/octet-stream'
    };
    if (parentId) metadata.parents = [parentId];

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob, fileName);

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form
      }
    );
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.error?.message || `Échec du téléversement Drive (${res.status})`);
    }
    return (await res.json()) as DriveFileItem;
  },

  syncZaureFileToDrive: async (
    item: IndexedZaureFile,
    parentId?: string
  ): Promise<DriveFileItem> => {
    const response = await fetch(item.url);
    if (!response.ok) {
      throw new Error(`Impossible de récupérer le fichier source (${response.status}).`);
    }
    const blob = await response.blob();
    return driveStorageService.uploadBlobToDrive(
      blob,
      item.name,
      item.mimeType || blob.type || 'application/octet-stream',
      parentId
    );
  },

  renameFile: async (fileId: string, newName: string): Promise<DriveFileItem> => {
    const token = cachedDriveAccessToken;
    if (!token) throw new Error('Connexion Google Drive requise.');

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,modifiedTime,webViewLink`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newName.trim() })
      }
    );
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.error?.message || `Erreur renommage (${res.status})`);
    }
    return (await res.json()) as DriveFileItem;
  },

  deleteFile: async (fileId: string): Promise<void> => {
    const token = cachedDriveAccessToken;
    if (!token) throw new Error('Connexion Google Drive requise.');

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.error?.message || `Erreur suppression Drive (${res.status})`);
    }
  },

  getFileDetails: async (fileId: string): Promise<DriveFileDetails> => {
    const token = cachedDriveAccessToken;
    if (!token) throw new Error('Connexion Google Drive requise.');

    const fields = encodeURIComponent(
      'id,name,mimeType,size,createdTime,modifiedTime,webViewLink,thumbnailLink,iconLink,parents,trashed,shared,owners(displayName,emailAddress,photoLink),permissions(id,type,role,emailAddress,displayName)'
    );
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=${fields}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
      if (res.status === 401) {
        cachedDriveAccessToken = null;
      }
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.error?.message || `Impossible de lire les détails Drive (${res.status})`);
    }
    return (await res.json()) as DriveFileDetails;
  }
};
