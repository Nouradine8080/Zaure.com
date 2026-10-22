// Configuration des limites et validation des fichiers partagés dans la messagerie

export interface FileLimitsConfig {
  maxImageBytes: number;
  maxVideoBytes: number;
  maxAudioBytes: number;
  maxDocumentBytes: number;
}

export const DEFAULT_FILE_LIMITS: FileLimitsConfig = {
  maxImageBytes: 15 * 1024 * 1024,      // 15 Mo
  maxVideoBytes: 50 * 1024 * 1024,      // 50 Mo
  maxAudioBytes: 20 * 1024 * 1024,      // 20 Mo
  maxDocumentBytes: 25 * 1024 * 1024     // 25 Mo
};

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/bmp',
  'image/heic'
];

export const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/ogg',
  'video/x-msvideo'
];

export const ALLOWED_AUDIO_TYPES = [
  'audio/webm',
  'audio/mp3',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/m4a',
  'audio/aac',
  'audio/mp4'
];

export const ALLOWED_DOC_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'csv',
  'zip',
  'rar',
  '7z',
  'json',
  'xml'
];

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 octets';
  const k = 1024;
  const sizes = ['octets', 'Ko', 'Mo', 'Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  category: 'image' | 'video' | 'audio' | 'document';
  formattedSize: string;
}

export function validateFileForChat(
  file: File,
  limits: FileLimitsConfig = DEFAULT_FILE_LIMITS
): ValidationResult {
  const formattedSize = formatFileSize(file.size);
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  // 1. Détection de catégorie
  if (file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'heic'].includes(ext)) {
    if (file.size > limits.maxImageBytes) {
      return {
        valid: false,
        error: `L'image « ${file.name} » (${formattedSize}) dépasse la taille maximale autorisée de ${formatFileSize(limits.maxImageBytes)}.`,
        category: 'image',
        formattedSize
      };
    }
    return { valid: true, category: 'image', formattedSize };
  }

  if (file.type.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) {
    if (file.size > limits.maxVideoBytes) {
      return {
        valid: false,
        error: `La vidéo « ${file.name} » (${formattedSize}) dépasse la taille maximale autorisée de ${formatFileSize(limits.maxVideoBytes)}.`,
        category: 'video',
        formattedSize
      };
    }
    return { valid: true, category: 'video', formattedSize };
  }

  if (file.type.startsWith('audio/') || ['webm', 'mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) {
    if (file.size > limits.maxAudioBytes) {
      return {
        valid: false,
        error: `Le fichier audio « ${file.name} » (${formattedSize}) dépasse la limite de ${formatFileSize(limits.maxAudioBytes)}.`,
        category: 'audio',
        formattedSize
      };
    }
    return { valid: true, category: 'audio', formattedSize };
  }

  // 2. Documents & autres fichiers
  if (file.size > limits.maxDocumentBytes) {
    return {
      valid: false,
      error: `Le document « ${file.name} » (${formattedSize}) dépasse la taille limite autorisée de ${formatFileSize(limits.maxDocumentBytes)}.`,
      category: 'document',
      formattedSize
    };
  }

  // Vérification de sécurité des extensions exécutables interdites
  const dangerousExtensions = ['exe', 'bat', 'cmd', 'sh', 'vbs', 'msi', 'com', 'scr', 'jar'];
  if (dangerousExtensions.includes(ext)) {
    return {
      valid: false,
      error: `Le format de fichier .${ext} est bloqué pour des raisons de sécurité.`,
      category: 'document',
      formattedSize
    };
  }

  return { valid: true, category: 'document', formattedSize };
}

export function getDocumentBadgeInfo(filename: string, mimeType?: string): {
  color: string;
  badgeBg: string;
  label: string;
  type: 'pdf' | 'doc' | 'sheet' | 'presentation' | 'archive' | 'file';
} {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  if (ext === 'pdf' || mimeType?.includes('pdf')) {
    return {
      color: 'text-rose-600 dark:text-rose-400',
      badgeBg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:border-rose-900 dark:text-rose-300',
      label: 'PDF',
      type: 'pdf'
    };
  }
  if (['doc', 'docx'].includes(ext) || mimeType?.includes('word')) {
    return {
      color: 'text-blue-600 dark:text-blue-400',
      badgeBg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:border-blue-900 dark:text-blue-300',
      label: 'DOC',
      type: 'doc'
    };
  }
  if (['xls', 'xlsx', 'csv'].includes(ext) || mimeType?.includes('sheet') || mimeType?.includes('csv')) {
    return {
      color: 'text-emerald-600 dark:text-emerald-400',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-900 dark:text-emerald-300',
      label: 'TABLEUR',
      type: 'sheet'
    };
  }
  if (['ppt', 'pptx'].includes(ext) || mimeType?.includes('presentation')) {
    return {
      color: 'text-amber-600 dark:text-amber-400',
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:border-amber-900 dark:text-amber-300',
      label: 'SLIDES',
      type: 'presentation'
    };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return {
      color: 'text-purple-600 dark:text-purple-400',
      badgeBg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:border-purple-900 dark:text-purple-300',
      label: 'ARCHIVE',
      type: 'archive'
    };
  }
  return {
    color: 'text-slate-600 dark:text-slate-400',
    badgeBg: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300',
    label: ext.toUpperCase() || 'FICHIER',
    type: 'file'
  };
}
