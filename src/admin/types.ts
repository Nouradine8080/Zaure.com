export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR' | 'USER';
export type StaffRole = 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR';

export type AdminModuleId =
  | 'dashboard'
  | 'users'
  | 'posts'
  | 'comments'
  | 'circles'
  | 'moderation'
  | 'reports'
  | 'files'
  | 'drive'
  | 'notifications'
  | 'admins'
  | 'security'
  | 'audit'
  | 'settings';

export type AdminPermissionKey =
  | 'viewDashboard'
  | 'manageUsers'
  | 'managePosts'
  | 'manageComments'
  | 'manageCircles'
  | 'moderateContent'
  | 'manageReports'
  | 'manageFiles'
  | 'manageDrive'
  | 'sendNotifications'
  | 'manageAdmins'
  | 'manageSecurity'
  | 'viewAuditLogs'
  | 'manageSettings';

export type AdminPermissionsMap = Record<AdminPermissionKey, boolean>;

export interface AdminAccount {
  id: string;
  email: string;
  displayName: string;
  role: StaffRole;
  isActive: boolean;
  permissions: AdminPermissionsMap;
  assignedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorEmail?: string;
  actorRole: StaffRole;
  action: string;
  module: AdminModuleId | string;
  targetType: string;
  targetId: string;
  details: string;
  createdAt: string;
}

export interface PlatformNotification {
  id: string;
  title: string;
  message: string;
  priority: 'info' | 'warning' | 'urgent';
  audience: 'all' | 'mentors' | 'admins';
  isActive: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformSettings {
  id: string;
  platformName: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  registrationOpen: boolean;
  requirePostModerationByDefault: boolean;
  maxUploadSizeMb: number;
  forbiddenKeywords: string[];
  driveRootFolderName: string;
  superAdminBootstrapped: boolean;
  updatedBy: string;
  updatedAt: string;
}

export interface UserModeration {
  userId: string;
  status: 'active' | 'warned' | 'suspended';
  reason: string;
  updatedBy: string;
  updatedAt: string;
}

export interface IndexedZaureFile {
  id: string;
  name: string;
  url: string;
  origin: 'post' | 'capsule' | 'conversation' | 'circle';
  originLabel: string;
  mediaType: 'image' | 'video' | 'audio' | 'document';
  mimeType: string;
  sizeBytes?: number;
  ownerId: string;
  ownerName: string;
  contextId: string;
  contextTitle: string;
  createdAt: string;
}

export interface AuthUserSummary {
  uid: string;
  email: string;
  emailVerified: boolean;
  disabled: boolean;
  customClaims: Record<string, unknown>;
  lastSignInTime: string | null;
  creationTime: string | null;
}

export interface AdminSessionContext {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  role: AdminRole;
  claimsRole?: AdminRole;
  isAuthorized: boolean;
  isBootstrapOwner: boolean;
  adminAccount: AdminAccount | null;
  permissions: AdminPermissionsMap;
}

export const BOOTSTRAP_OWNER_EMAIL = 'mahamadougarbamoussa8080@gmail.com';

export const ROLE_PRESET_PERMISSIONS: Record<StaffRole, AdminPermissionsMap> = {
  SUPER_ADMIN: {
    viewDashboard: true,
    manageUsers: true,
    managePosts: true,
    manageComments: true,
    manageCircles: true,
    moderateContent: true,
    manageReports: true,
    manageFiles: true,
    manageDrive: true,
    sendNotifications: true,
    manageAdmins: true,
    manageSecurity: true,
    viewAuditLogs: true,
    manageSettings: true
  },
  ADMIN: {
    viewDashboard: true,
    manageUsers: true,
    managePosts: true,
    manageComments: true,
    manageCircles: true,
    moderateContent: true,
    manageReports: true,
    manageFiles: true,
    manageDrive: true,
    sendNotifications: true,
    manageAdmins: false,
    manageSecurity: false,
    viewAuditLogs: true,
    manageSettings: true
  },
  MODERATOR: {
    viewDashboard: true,
    manageUsers: false,
    managePosts: true,
    manageComments: true,
    manageCircles: false,
    moderateContent: true,
    manageReports: true,
    manageFiles: false,
    manageDrive: false,
    sendNotifications: false,
    manageAdmins: false,
    manageSecurity: false,
    viewAuditLogs: true,
    manageSettings: false
  }
};

export const ZERO_PERMISSIONS: AdminPermissionsMap = {
  viewDashboard: false,
  manageUsers: false,
  managePosts: false,
  manageComments: false,
  manageCircles: false,
  moderateContent: false,
  manageReports: false,
  manageFiles: false,
  manageDrive: false,
  sendNotifications: false,
  manageAdmins: false,
  manageSecurity: false,
  viewAuditLogs: false,
  manageSettings: false
};

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  id: 'global',
  platformName: 'Zaure',
  maintenanceMode: false,
  maintenanceMessage: 'Maintenance technique en cours. Retour imminent.',
  registrationOpen: true,
  requirePostModerationByDefault: false,
  maxUploadSizeMb: 15,
  forbiddenKeywords: [],
  driveRootFolderName: 'Zaure-Admin-Storage',
  superAdminBootstrapped: false,
  updatedBy: '',
  updatedAt: new Date().toISOString()
};

export const PERMISSION_LABELS: Record<AdminPermissionKey, string> = {
  viewDashboard: 'Tableau de bord & analytiques',
  manageUsers: 'Gestion des comptes utilisateurs',
  managePosts: 'Gestion des publications & capsules',
  manageComments: 'Gestion des commentaires',
  manageCircles: 'Gestion des Cercles & communautés',
  moderateContent: 'File de modération des contenus',
  manageReports: 'Traitement des signalements',
  manageFiles: 'Explorateur centralisé des fichiers',
  manageDrive: 'Stockage Google Drive',
  sendNotifications: 'Notifications générales',
  manageAdmins: 'Gestion des administrateurs',
  manageSecurity: 'Permissions & sécurité RBAC',
  viewAuditLogs: "Journal d'audit immuable",
  manageSettings: 'Paramètres de la plateforme'
};

export const MODULE_TO_PERMISSION: Record<AdminModuleId, AdminPermissionKey> = {
  dashboard: 'viewDashboard',
  users: 'manageUsers',
  posts: 'managePosts',
  comments: 'manageComments',
  circles: 'manageCircles',
  moderation: 'moderateContent',
  reports: 'manageReports',
  files: 'manageFiles',
  drive: 'manageDrive',
  notifications: 'sendNotifications',
  admins: 'manageAdmins',
  security: 'manageSecurity',
  audit: 'viewAuditLogs',
  settings: 'manageSettings'
};
