import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquare,
  Send,
  Paperclip,
  Smile,
  Mic,
  MicOff,
  Square,
  Trash2,
  Edit3,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Info,
  X,
  ChevronLeft,
  Search,
  Users,
  UserPlus,
  MoreVertical,
  Check,
  CheckCheck,
  Image as ImageIcon,
  FileText,
  Download,
  Volume2,
  VolumeX,
  Archive,
  Bell,
  BellOff,
  ShieldAlert,
  Sparkles,
  Plus,
  Play,
  Pause,
  Maximize2,
  Filter,
  UserCheck,
  UserX,
  AlertTriangle,
  Camera,
  Shield,
  Activity,
  Calendar,
  BadgeCheck,
  Copy,
  ExternalLink,
  ShieldCheck,
  Clock,
  ChevronUp,
  ChevronDown,
  Globe,
  Loader2,
  Eye,
  UploadCloud,
  FileCheck,
  FileCode,
  FolderArchive,
  Film
} from 'lucide-react';
import {
  UserProfile,
  Conversation,
  Message,
  MessageAttachment,
  MessageReplyInfo,
  UserReport
} from '../types';
import { zaureService } from '../firebaseClient';
import { useTranslation } from '../context/LanguageContext';
import VoiceNotePlayer from './VoiceNotePlayer';
import {
  validateFileForChat,
  formatFileSize,
  DEFAULT_FILE_LIMITS,
  getDocumentBadgeInfo
} from '../utils/fileValidation';

interface ChatViewProps {
  currentUser: UserProfile | null;
  initialSelectedUser?: UserProfile | null;
  mobileView?: 'list' | 'chat';
  onMobileViewChange?: (view: 'list' | 'chat') => void;
}

// Popular reaction emojis
const QUICK_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏', '🔥'];

// Helper to format date separators
function formatDateDivider(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((today.getTime() - msgDay.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return "Hier";
    if (diffDays < 7) {
      const weekday = d.toLocaleDateString('fr-FR', { weekday: 'long' });
      return weekday.charAt(0).toUpperCase() + weekday.slice(1);
    }
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  } catch {
    return 'Date récente';
  }
}

// Helper to format timestamps in conversation list
function formatLastMessageTimestamp(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((today.getTime() - msgDay.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) {
      const weekday = d.toLocaleDateString('fr-FR', { weekday: 'short' });
      return weekday.charAt(0).toUpperCase() + weekday.slice(1);
    }
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

// Helper to detect URLs in message content
function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}

export default function ChatView({ 
  currentUser, 
  initialSelectedUser = null,
  mobileView: propMobileView = 'list',
  onMobileViewChange
}: ChatViewProps) {
  const { t } = useTranslation();

  // State: Data
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [selectedDirectUser, setSelectedDirectUser] = useState<UserProfile | null>(initialSelectedUser);

  // State: UI & Navigation
  const [internalMobileView, setInternalMobileView] = useState<'list' | 'chat'>(propMobileView);

  const setMobileView = (view: 'list' | 'chat') => {
    setInternalMobileView(view);
    if (onMobileViewChange) {
      onMobileViewChange(view);
    }
  };

  const mobileView = internalMobileView;
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'groups' | 'archived'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showMobileInfoModal, setShowMobileInfoModal] = useState(false);
  const [presenceStatus, setPresenceStatus] = useState<'online' | 'busy' | 'offline'>('online');
  const [statusMessage, setStatusMessage] = useState('');

  // State: Top Bar Menus & Dropdowns
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  // State: In-Chat Search & Pagination
  const [inChatSearchOpen, setInChatSearchOpen] = useState(false);
  const [inChatSearchQuery, setInChatSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);

  // State: User Profile Modals
  const [viewingUserProfile, setViewingUserProfile] = useState<UserProfile | null>(null);
  const [reportingUser, setReportingUser] = useState<UserProfile | null>(null);
  const [reportReason, setReportReason] = useState<'spam' | 'harcelement' | 'usurpation' | 'contenu_inapproprie' | 'autre'>('spam');
  const [reportDetails, setReportDetails] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSuccessToast, setReportSuccessToast] = useState(false);

  // State: Edit Own Profile Modal
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editStatusMsg, setEditStatusMsg] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  // State: Message Composer
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  // State: Media Upload & Audio Recording
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);

  // State: Staged Attachment Preview (Facebook Messenger Style staging before send)
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [stagedPreviewUrl, setStagedPreviewUrl] = useState<string | null>(null);
  const [stagedCategory, setStagedCategory] = useState<'image' | 'video' | 'audio' | 'document'>('document');
  const [stagedFormattedSize, setStagedFormattedSize] = useState<string>('');
  const [fileValidationError, setFileValidationError] = useState<string | null>(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // State: Modals (New Chat & Groups)
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatTab, setNewChatTab] = useState<'direct' | 'group'>('direct');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // State: Audio/Video Call Modal
  const [callModal, setCallModal] = useState<{
    isOpen: boolean;
    type: 'audio' | 'video';
    status: 'ringing' | 'connected' | 'ended';
    duration: number;
    isMuted: boolean;
    isVideoOff: boolean;
  }>({
    isOpen: false,
    type: 'video',
    status: 'ringing',
    duration: 0,
    isMuted: false,
    isVideoOff: false
  });

  // State: Image Lightbox Preview
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // --------------------------------------------------------------------------
  // Direct Chat Starter Handler (Guarantees chat always opens on click)
  // --------------------------------------------------------------------------
  const handleStartDirectChat = (user: UserProfile) => {
    if (!currentUser) return;
    setSelectedDirectUser(user);
    const convId = zaureService.getConversationId(currentUser.id, user.id);
    setActiveConvId(convId);
    setMobileView('chat');
    setShowNewChatModal(false);
    setViewingUserProfile(null);
    setInChatSearchOpen(false);
    setInChatSearchQuery('');
  };

  // --------------------------------------------------------------------------
  // 1. Initial Data Loading & Subscriptions
  // --------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;
    zaureService.getAvailableUsers().then((users) => {
      if (!isMounted) return;
      setAvailableUsers(users);
    });

    zaureService.getBlockedUserIds().then((blockedIds) => {
      if (!isMounted) return;
      setBlockedUserIds(blockedIds);
    });

    if (currentUser) {
      setPresenceStatus(currentUser.availability || 'online');
      setStatusMessage(currentUser.status_message || '');
      setEditName(currentUser.nom || '');
      setEditBio(currentUser.bio || '');
      setEditStatusMsg(currentUser.status_message || '');
    }

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  // Subscribe to conversations
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = zaureService.subscribeUserConversations(currentUser.id, (convs) => {
      setConversations(convs);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser?.id]);

  // Handle direct navigation to a chat when initialSelectedUser is provided
  useEffect(() => {
    if (!initialSelectedUser || !currentUser) return;
    handleStartDirectChat(initialSelectedUser);
  }, [initialSelectedUser, currentUser]);

  // Auto-select first conversation on wide desktop screens if none active
  useEffect(() => {
    if (!activeConvId && conversations.length > 0 && window.innerWidth >= 768) {
      setActiveConvId(conversations[0].id);
    }
  }, [conversations, activeConvId]);

  // --------------------------------------------------------------------------
  // Resilient Active Conversation Resolver (Works for existing AND new chats)
  // --------------------------------------------------------------------------
  const activeConversation = useMemo(() => {
    if (!activeConvId) return null;
    const found = conversations.find((c) => c.id === activeConvId);
    if (found) return found;

    // Direct conversation draft for any user clicked
    if (currentUser && activeConvId.includes('_')) {
      const otherId = activeConvId.split('_').find((id) => id !== currentUser.id);
      let otherUser: UserProfile | undefined = undefined;

      if (selectedDirectUser && selectedDirectUser.id === otherId) {
        otherUser = selectedDirectUser;
      } else if (initialSelectedUser && initialSelectedUser.id === otherId) {
        otherUser = initialSelectedUser;
      } else if (otherId) {
        otherUser = availableUsers.find((u) => u.id === otherId);
      }

      if (otherUser || otherId) {
        const targetNom = otherUser?.nom || 'Membre Zaure';
        const targetAvatar = otherUser?.avatar_url || null;
        const targetRole = otherUser?.role || 'utilisateur';
        const targetId = otherId || otherUser?.id || '';

        return {
          id: activeConvId,
          type: 'direct' as const,
          participant_ids: [currentUser.id, targetId],
          participants: {
            [currentUser.id]: {
              id: currentUser.id,
              nom: currentUser.nom,
              avatar_url: currentUser.avatar_url,
              role: currentUser.role,
              is_online: true
            },
            [targetId]: {
              id: targetId,
              nom: targetNom,
              avatar_url: targetAvatar,
              role: targetRole,
              is_online: otherUser?.availability !== 'offline'
            }
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          unread_counts: { [currentUser.id]: 0, [targetId]: 0 }
        };
      }
    }
    return null;
  }, [activeConvId, conversations, selectedDirectUser, initialSelectedUser, currentUser, availableUsers]);

  // Active other user (1-on-1 direct)
  const activeOtherUser = useMemo<UserProfile | null>(() => {
    if (!currentUser || !activeConvId) return null;
    if (activeConversation) {
      if (activeConversation.type === 'group') return null;
      const otherId = activeConversation.participant_ids.find((id) => id !== currentUser.id);
      if (otherId) {
        const fromAll = availableUsers.find((u) => u.id === otherId);
        if (fromAll) return fromAll;
        if (selectedDirectUser && selectedDirectUser.id === otherId) return selectedDirectUser;
        if (initialSelectedUser && initialSelectedUser.id === otherId) return initialSelectedUser;
        const pMeta = activeConversation.participants?.[otherId];
        if (pMeta) {
          return {
            id: otherId,
            nom: pMeta.nom || 'Membre Zaure',
            avatar_url: pMeta.avatar_url || null,
            email: '',
            bio: null,
            role: (pMeta.role as any) || 'utilisateur',
            langue_preferee: 'fr',
            availability: pMeta.is_online ? 'online' : 'offline'
          };
        }
      }
    }
    if (selectedDirectUser) return selectedDirectUser;
    return null;
  }, [activeConversation, activeConvId, currentUser, availableUsers, selectedDirectUser, initialSelectedUser]);

  const isOtherUserBlocked = useMemo(() => {
    if (!activeOtherUser) return false;
    return blockedUserIds.includes(activeOtherUser.id);
  }, [activeOtherUser, blockedUserIds]);

  // --------------------------------------------------------------------------
  // 2. Subscribe to Messages & Synchronize Read Receipts
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }

    setHasMoreOlder(true);
    const unsubscribe = zaureService.subscribeConversationMessages(activeConvId, (newMsgs) => {
      setMessages(newMsgs);
      zaureService.markConversationAsRead(activeConvId);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [activeConvId]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom('auto');
  }, [messages.length, activeConvId]);

  // --------------------------------------------------------------------------
  // 3. Messenger Signature Read Receipts
  // --------------------------------------------------------------------------
  const lastReadMessageIdByOther = useMemo(() => {
    if (!activeOtherUser || !currentUser) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.sender_id === currentUser.id && m.read_by?.includes(activeOtherUser.id)) {
        return m.id;
      }
    }
    return null;
  }, [messages, activeOtherUser, currentUser]);

  // --------------------------------------------------------------------------
  // 4. In-Chat Message Search & Jump
  // --------------------------------------------------------------------------
  const matchingMessageIds = useMemo(() => {
    if (!inChatSearchQuery.trim()) return [];
    const q = inChatSearchQuery.toLowerCase();
    return messages
      .filter((m) => !m.is_deleted && m.content.toLowerCase().includes(q))
      .map((m) => m.id);
  }, [messages, inChatSearchQuery]);

  const jumpToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(msgId);
      setTimeout(() => setHighlightedMsgId(null), 2500);
    }
  };

  const handleNextSearchMatch = () => {
    if (matchingMessageIds.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % matchingMessageIds.length;
    setCurrentMatchIndex(nextIdx);
    jumpToMessage(matchingMessageIds[nextIdx]);
  };

  const handlePrevSearchMatch = () => {
    if (matchingMessageIds.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + matchingMessageIds.length) % matchingMessageIds.length;
    setCurrentMatchIndex(prevIdx);
    jumpToMessage(matchingMessageIds[prevIdx]);
  };

  // --------------------------------------------------------------------------
  // 5. Pagination: Load Older Messages
  // --------------------------------------------------------------------------
  const handleLoadOlderMessages = async () => {
    if (!activeConvId || messages.length === 0 || isLoadingOlder || !hasMoreOlder) return;

    try {
      setIsLoadingOlder(true);
      const oldestMessage = messages[0];
      const older = await zaureService.loadOlderMessages(activeConvId, oldestMessage.created_at, 20);

      if (older.length === 0) {
        setHasMoreOlder(false);
      } else {
        setMessages((prev) => [...older, ...prev]);
      }
    } catch (err) {
      console.warn('Erreur chargement anciens messages:', err);
    } finally {
      setIsLoadingOlder(false);
    }
  };

  // --------------------------------------------------------------------------
  // 6. User Presence, Status, Block & Report
  // --------------------------------------------------------------------------
  const handleUpdateAvailability = async (status: 'online' | 'busy' | 'offline') => {
    setPresenceStatus(status);
    await zaureService.setUserAvailability(status, statusMessage);
  };

  const handleToggleBlockUser = async (targetUser: UserProfile) => {
    const isBlocked = blockedUserIds.includes(targetUser.id);
    if (isBlocked) {
      await zaureService.unblockUser(targetUser.id);
      setBlockedUserIds((prev) => prev.filter((id) => id !== targetUser.id));
    } else {
      if (window.confirm(`Voulez-vous bloquer ${targetUser.nom} ? Vous ne recevrez plus ses messages.`)) {
        await zaureService.blockUser(targetUser.id);
        setBlockedUserIds((prev) => [...prev, targetUser.id]);
      }
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingUser) return;

    try {
      setIsSubmittingReport(true);
      const res = await zaureService.reportUser({
        targetUserId: reportingUser.id,
        targetUserNom: reportingUser.nom,
        reason: reportReason,
        details: reportDetails
      });

      if (res.success) {
        setReportSuccessToast(true);
        setTimeout(() => setReportSuccessToast(false), 4000);
        setReportingUser(null);
        setReportDetails('');
      } else {
        alert(res.error || 'Erreur lors du signalement');
      }
    } catch (err) {
      console.error('Erreur signalement:', err);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    try {
      setIsUploadingAvatar(true);
      const res = await zaureService.uploadAndSetAvatar(file);
      if (res.error) {
        alert(res.error);
      }
    } catch (err) {
      console.error('Erreur mise à jour avatar:', err);
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      setIsSavingProfile(true);
      await zaureService.updateUserProfile(currentUser.id, {
        nom: editName.trim(),
        bio: editBio.trim()
      });
      await zaureService.setUserAvailability(presenceStatus, editStatusMsg.trim());
      setStatusMessage(editStatusMsg.trim());
      setIsEditProfileOpen(false);
    } catch (err) {
      console.error('Erreur sauvegarde profil:', err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // --------------------------------------------------------------------------
  // 7. Typing Indicator
  // --------------------------------------------------------------------------
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    if (!activeConvId) return;

    zaureService.setTypingStatus(activeConvId, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      zaureService.setTypingStatus(activeConvId, false);
    }, 2000);
  };

  const isOtherUserTyping = useMemo(() => {
    if (!activeConversation?.typing || !currentUser) return false;
    return Object.entries(activeConversation.typing).some(
      ([uid, isTyping]) => uid !== currentUser.id && isTyping === true
    );
  }, [activeConversation?.typing, currentUser]);

  // --------------------------------------------------------------------------
  // 8. Send Message
  // --------------------------------------------------------------------------
  // --------------------------------------------------------------------------
  // 8. Staged Attachment & Validation Helpers
  // --------------------------------------------------------------------------
  const stageIncomingFile = (file: File) => {
    if (isOtherUserBlocked) return;
    const validation = validateFileForChat(file);
    if (!validation.valid) {
      setFileValidationError(validation.error || 'Fichier non autorisé.');
      setTimeout(() => setFileValidationError(null), 6000);
      return;
    }

    if (stagedPreviewUrl) {
      URL.revokeObjectURL(stagedPreviewUrl);
    }

    setFileValidationError(null);
    setStagedFile(file);
    setStagedCategory(validation.category);
    setStagedFormattedSize(validation.formattedSize);
    setStagedPreviewUrl(URL.createObjectURL(file));
    setShowAttachmentMenu(false);
  };

  const discardStagedFile = () => {
    if (stagedPreviewUrl) {
      URL.revokeObjectURL(stagedPreviewUrl);
    }
    setStagedFile(null);
    setStagedPreviewUrl(null);
    setStagedFormattedSize('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openFilePicker = (acceptTypes: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = acceptTypes;
      fileInputRef.current.click();
    }
    setShowAttachmentMenu(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      stageIncomingFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOver && !isOtherUserBlocked) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (isOtherUserBlocked) return;
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      stageIncomingFile(files[0]);
    }
  };

  // --------------------------------------------------------------------------
  // 9. Send Message (Texts, Voice Notes, Photos, Videos & Documents)
  // --------------------------------------------------------------------------
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUser || !activeConvId || isOtherUserBlocked) return;

    const trimmed = inputText.trim();
    if (!trimmed && !recordedAudioBlob && !stagedFile) return;

    try {
      if (editingMessage) {
        await zaureService.editChatMessage(activeConvId, editingMessage.id, trimmed);
        setEditingMessage(null);
        setInputText('');
        return;
      }

      let attachments: MessageAttachment[] = [];
      let msgType: 'texte' | 'audio' | 'image' | 'video' | 'file' = 'texte';

      // A. Mémo vocal enregistré
      if (recordedAudioBlob) {
        setIsUploading(true);
        setUploadingFileName('Note vocale');
        setUploadProgress(15);
        const voiceAttachment = await zaureService.uploadMessageAttachment(
          recordedAudioBlob,
          'audio',
          `voice_${Date.now()}.webm`,
          (pct) => setUploadProgress(pct)
        );
        attachments = [voiceAttachment];
        msgType = 'audio';
        discardRecordedAudio();
        setIsUploading(false);
        setUploadingFileName('');
        setUploadProgress(0);
      }
      // B. Fichier prévisualisé (Photo, Vidéo ou Document)
      else if (stagedFile) {
        setIsUploading(true);
        setUploadingFileName(stagedFile.name);
        setUploadProgress(10);

        let folder: 'images' | 'videos' | 'documents' = 'documents';
        if (stagedCategory === 'image') {
          folder = 'images';
          msgType = 'image';
        } else if (stagedCategory === 'video') {
          folder = 'videos';
          msgType = 'video';
        } else {
          folder = 'documents';
          msgType = 'file';
        }

        const uploadedAtt = await zaureService.uploadMessageAttachment(
          stagedFile,
          folder,
          stagedFile.name,
          (pct) => setUploadProgress(pct)
        );
        attachments = [uploadedAtt];
        discardStagedFile();
        setIsUploading(false);
        setUploadingFileName('');
        setUploadProgress(0);
      }

      const replyToPayload: MessageReplyInfo | null = replyingTo
        ? {
            id: replyingTo.id,
            content: replyingTo.content,
            sender_nom: replyingTo.sender_nom || 'Membre',
            type: replyingTo.type
          }
        : null;

      await zaureService.sendChatMessage({
        conversationId: activeConvId,
        receiverId: activeOtherUser?.id,
        content: trimmed || (msgType === 'audio' ? 'Note vocale' : attachments[0]?.name || ''),
        type: msgType,
        attachments,
        replyTo: replyToPayload,
        otherUser: activeOtherUser
      });

      setInputText('');
      setReplyingTo(null);
      setIsEmojiPickerOpen(false);
      scrollToBottom();
    } catch (error) {
      console.error('Erreur lors de l’envoi:', error);
      setIsUploading(false);
      setUploadingFileName('');
      setUploadProgress(0);
    }
  };

  const startVoiceRecording = async () => {
    if (isOtherUserBlocked) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedAudioBlob(audioBlob);
        setRecordedAudioUrl(URL.createObjectURL(audioBlob));
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('Accès microphone refusé ou indisponible:', err);
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  const discardRecordedAudio = () => {
    setRecordedAudioBlob(null);
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
      setRecordedAudioUrl(null);
    }
    setRecordingSeconds(0);
    setIsRecording(false);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  };

  const handleAddReaction = async (messageId: string, emoji: string) => {
    if (!activeConvId) return;
    await zaureService.addReactionToMessage(activeConvId, messageId, emoji);
    setHoveredMessageId(null);
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!activeConvId) return;
    if (window.confirm('Voulez-vous vraiment supprimer ce message pour tout le monde ?')) {
      await zaureService.deleteChatMessage(activeConvId, messageId);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newGroupName.trim() || selectedMemberIds.length === 0) return;

    try {
      setIsCreatingGroup(true);
      const newGroup = await zaureService.createGroupConversation({
        groupName: newGroupName.trim(),
        groupDescription: newGroupDescription.trim(),
        memberIds: selectedMemberIds,
        allUsers: availableUsers
      });

      setShowNewChatModal(false);
      setNewGroupName('');
      setNewGroupDescription('');
      setSelectedMemberIds([]);
      setActiveConvId(newGroup.id);
      setMobileView('chat');
    } catch (err) {
      console.error('Erreur création groupe:', err);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // --------------------------------------------------------------------------
  // 10. WebRTC Audio & Video Calls
  // --------------------------------------------------------------------------
  const initiateCall = async (type: 'audio' | 'video') => {
    if (isOtherUserBlocked) {
      alert('Impossible de passer un appel à un utilisateur bloqué.');
      return;
    }

    setCallModal({
      isOpen: true,
      type,
      status: 'ringing',
      duration: 0,
      isMuted: false,
      isVideoOff: false
    });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video'
      });
      localStreamRef.current = stream;
      if (localVideoRef.current && type === 'video') {
        localVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Erreur accès caméra/micro pour l’appel:', err);
    }

    setTimeout(() => {
      setCallModal((prev) => ({ ...prev, status: 'connected' }));
      callTimerRef.current = setInterval(() => {
        setCallModal((prev) => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
    }, 2000);
  };

  const endCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    setCallModal((prev) => ({ ...prev, isOpen: false, status: 'ended', duration: 0 }));
  };

  const toggleCallMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !t.enabled;
      });
      setCallModal((prev) => ({ ...prev, isMuted: !prev.isMuted }));
    }
  };

  const toggleCallVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = !t.enabled;
      });
      setCallModal((prev) => ({ ...prev, isVideoOff: !prev.isVideoOff }));
    }
  };

  const formatCallTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  // --------------------------------------------------------------------------
  // 11. Filtered & Sorted Conversations (Date desc, Unread, Groups, Archived)
  // --------------------------------------------------------------------------
  const filteredConversations = useMemo(() => {
    const list = conversations.filter((c) => {
      if (activeFilter === 'unread') {
        const unread = currentUser ? c.unread_counts?.[currentUser.id] || 0 : 0;
        if (unread <= 0) return false;
      }
      if (activeFilter === 'groups' && c.type !== 'group') return false;
      if (activeFilter === 'archived') {
        const isArch = currentUser ? c.is_archived_by?.includes(currentUser.id) : false;
        if (!isArch) return false;
      } else {
        const isArch = currentUser ? c.is_archived_by?.includes(currentUser.id) : false;
        if (isArch) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const groupNameMatch = c.group_name?.toLowerCase().includes(q);
        const lastMsgMatch = c.last_message?.content?.toLowerCase().includes(q);
        const participantMatch = Object.values(c.participants || {}).some((p: any) =>
          p?.nom?.toLowerCase().includes(q)
        );
        return groupNameMatch || lastMsgMatch || participantMatch;
      }

      return true;
    });

    // Tri strict selon la date du dernier message (les plus récentes en tête de liste)
    return list.sort((a, b) => {
      const timeA = a.last_message?.created_at
        ? new Date(a.last_message.created_at).getTime()
        : new Date(a.updated_at || a.created_at).getTime();
      const timeB = b.last_message?.created_at
        ? new Date(b.last_message.created_at).getTime()
        : new Date(b.updated_at || b.created_at).getTime();
      return timeB - timeA;
    });
  }, [conversations, activeFilter, searchQuery, currentUser]);

  // Badges de comptage pour chaque onglet de filtre
  const unreadCountBadge = useMemo(() => {
    if (!currentUser) return 0;
    return conversations.filter(
      (c) =>
        (c.unread_counts?.[currentUser.id] || 0) > 0 &&
        !c.is_archived_by?.includes(currentUser.id)
    ).length;
  }, [conversations, currentUser]);

  const groupsCountBadge = useMemo(() => {
    return conversations.filter(
      (c) =>
        c.type === 'group' &&
        (!currentUser || !c.is_archived_by?.includes(currentUser.id))
    ).length;
  }, [conversations, currentUser]);

  const archivedCountBadge = useMemo(() => {
    if (!currentUser) return 0;
    return conversations.filter((c) => c.is_archived_by?.includes(currentUser.id)).length;
  }, [conversations, currentUser]);

  // Users found via search query who might not have an existing conversation
  const matchedUsersFromSearch = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return availableUsers.filter(
      (u) => u.id !== currentUser?.id && u.nom.toLowerCase().includes(q)
    );
  }, [availableUsers, searchQuery, currentUser]);

  const totalUnreadCount = useMemo(() => {
    if (!currentUser) return 0;
    return conversations.reduce((acc, c) => acc + (c.unread_counts?.[currentUser.id] || 0), 0);
  }, [conversations, currentUser]);

  const sharedMediaMessages = useMemo(() => {
    return messages.filter(
      (m) => m.attachments && m.attachments.length > 0 && !m.is_deleted
    );
  }, [messages]);

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------
  return (
    <div className="relative flex flex-col h-[calc(100vh-4.5rem)] md:h-[calc(100vh-5.5rem)] min-h-[500px] md:min-h-[650px] w-full overflow-hidden rounded-2xl md:rounded-3xl border border-slate-200/90 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
      {/* ==================================================================== */}
      {/* 1. BARRE SUPÉRIEURE MESSENGER (BRANDING SAAS & CENTRE NOTIFICATIONS)   */}
      {/* ==================================================================== */}
      <header className="flex h-14 items-center justify-between border-b border-slate-200/80 bg-white px-4 dark:border-slate-800 dark:bg-slate-900 z-20">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black shadow-md shadow-blue-500/20">
            Z
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white">
                Zaure <span className="text-blue-600 dark:text-blue-400 font-semibold">Messenger</span>
              </span>
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Synchronisé Firebase" />
            </div>
            <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
              Réseau Médical & Académique
            </span>
          </div>
        </div>

        <div className="relative hidden md:block max-w-sm w-full mx-4">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher des confrères, groupes ou messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-full border border-slate-200 bg-slate-50/80 py-1.5 pl-9 pr-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Centre de Notifications */}
          <div className="relative">
            <button
              onClick={() => setIsNotificationsOpen((prev) => !prev)}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 transition dark:text-slate-300 dark:hover:bg-slate-800"
              title="Centre de notifications"
            >
              <Bell className="h-4 w-4" />
              {totalUnreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white shadow-xs">
                  {totalUnreadCount}
                </span>
              )}
            </button>

            {isNotificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-800 dark:bg-slate-900 z-30 animate-fadeIn">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Notifications Messages
                  </h4>
                  <span className="text-[10px] text-blue-600 font-semibold">
                    {totalUnreadCount} non lus
                  </span>
                </div>
                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 mt-1">
                  {conversations.filter((c) => (c.unread_counts?.[currentUser?.id || ''] || 0) > 0).length === 0 ? (
                    <p className="p-4 text-center text-xs text-slate-400">Toutes vos discussions sont à jour.</p>
                  ) : (
                    conversations
                      .filter((c) => (c.unread_counts?.[currentUser?.id || ''] || 0) > 0)
                      .map((c) => (
                        <div
                          key={c.id}
                          onClick={() => {
                            setActiveConvId(c.id);
                            setIsNotificationsOpen(false);
                            setMobileView('chat');
                          }}
                          className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-xs"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 font-bold text-blue-700 text-xs">
                            {c.group_name?.charAt(0) || 'M'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate text-slate-800 dark:text-slate-200">
                              {c.group_name || 'Nouveau message'}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">{c.last_message?.content}</p>
                          </div>
                          <span className="h-2 w-2 rounded-full bg-blue-600" />
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profil connecté avec statut de présence */}
          <div className="relative">
            <button
              onClick={() => setIsProfileMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-xl p-1 hover:bg-slate-100 transition dark:hover:bg-slate-800"
            >
              <div className="relative">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-xs font-bold text-white shadow-xs">
                  {currentUser?.avatar_url ? (
                    <img
                      src={currentUser.avatar_url}
                      alt={currentUser.nom}
                      className="h-full w-full rounded-xl object-cover"
                    />
                  ) : (
                    currentUser?.nom?.charAt(0).toUpperCase() || 'Z'
                  )}
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
                    presenceStatus === 'online'
                      ? 'bg-emerald-500'
                      : presenceStatus === 'busy'
                      ? 'bg-amber-500'
                      : 'bg-slate-400'
                  }`}
                />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 hidden sm:inline max-w-[100px] truncate">
                {currentUser?.nom?.split(' ')[0] || 'Mon Compte'}
              </span>
            </button>

            {isProfileMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-800 dark:bg-slate-900 z-30 animate-fadeIn">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white font-bold text-base shadow-sm">
                    {currentUser?.avatar_url ? (
                      <img
                        src={currentUser.avatar_url}
                        alt={currentUser.nom}
                        className="h-full w-full rounded-2xl object-cover"
                      />
                    ) : (
                      currentUser?.nom?.charAt(0).toUpperCase() || 'Z'
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {currentUser?.nom}
                    </h4>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                      {currentUser?.role === 'mentor' ? '🩺 Mentor certifié' : 'Étudiant en médecine'}
                    </span>
                  </div>
                </div>

                <div className="py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1.5">
                    Statut de présence
                  </span>
                  <div className="grid grid-cols-3 gap-1 text-[11px] font-semibold">
                    <button
                      onClick={() => handleUpdateAvailability('online')}
                      className={`flex items-center justify-center gap-1 rounded-xl py-1.5 transition ${
                        presenceStatus === 'online'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'hover:bg-slate-100 text-slate-600 dark:hover:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      En ligne
                    </button>
                    <button
                      onClick={() => handleUpdateAvailability('busy')}
                      className={`flex items-center justify-center gap-1 rounded-xl py-1.5 transition ${
                        presenceStatus === 'busy'
                          ? 'bg-amber-50 text-amber-700 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'hover:bg-slate-100 text-slate-600 dark:hover:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      Occupé
                    </button>
                    <button
                      onClick={() => handleUpdateAvailability('offline')}
                      className={`flex items-center justify-center gap-1 rounded-xl py-1.5 transition ${
                        presenceStatus === 'offline'
                          ? 'bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300'
                          : 'hover:bg-slate-100 text-slate-600 dark:hover:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full bg-slate-400" />
                      Invisible
                    </button>
                  </div>
                </div>

                <div className="pt-2 space-y-1 text-xs">
                  <button
                    onClick={() => {
                      if (currentUser) setViewingUserProfile(currentUser);
                      setIsProfileMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-slate-700 hover:bg-slate-100 transition dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                    <span>Voir mon profil public</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsEditProfileOpen(true);
                      setIsProfileMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-slate-700 hover:bg-slate-100 transition dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Camera className="h-4 w-4 text-blue-600" />
                    <span>Modifier photo et nom</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* 2. CORPS PRINCIPAL : STRUCTURE EN 3 COLONNES                         */}
      {/* ==================================================================== */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* ==================================================================== */}
        {/* A. VOLET GAUCHE : CONVERSATIONS & RECHERCHE CONTACTS                 */}
        {/* ==================================================================== */}
        <aside
          className={`flex h-full w-full flex-col border-r border-slate-200/80 bg-slate-50/70 transition-all duration-300 md:w-80 lg:w-96 dark:border-slate-800 dark:bg-slate-900/60 ${
            mobileView === 'chat' ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="flex flex-col gap-3 p-4 border-b border-slate-200/70 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Discussions
              </h2>
              <button
                onClick={() => {
                  setShowNewChatModal(true);
                  setNewChatTab('direct');
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 active:scale-95"
                title="Nouvelle discussion ou groupe"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                onClick={() => setActiveFilter('all')}
                className={`rounded-full px-3 py-1 font-semibold transition flex items-center gap-1.5 shrink-0 ${
                  activeFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-200/70 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <span>Toutes</span>
              </button>
              <button
                onClick={() => setActiveFilter('unread')}
                className={`rounded-full px-3 py-1 font-semibold transition flex items-center gap-1.5 shrink-0 ${
                  activeFilter === 'unread'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-200/70 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <span>Non lus</span>
                {unreadCountBadge > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      activeFilter === 'unread'
                        ? 'bg-white text-blue-600'
                        : 'bg-blue-600 text-white'
                    }`}
                  >
                    {unreadCountBadge}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveFilter('groups')}
                className={`rounded-full px-3 py-1 font-semibold transition flex items-center gap-1.5 shrink-0 ${
                  activeFilter === 'groups'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-200/70 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <span>Groupes</span>
                {groupsCountBadge > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      activeFilter === 'groups'
                        ? 'bg-white text-blue-600'
                        : 'bg-slate-300 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {groupsCountBadge}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveFilter('archived')}
                className={`rounded-full px-3 py-1 font-semibold transition flex items-center gap-1.5 shrink-0 ${
                  activeFilter === 'archived'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-200/70 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <span>Archivées</span>
                {archivedCountBadge > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      activeFilter === 'archived'
                        ? 'bg-white text-blue-600'
                        : 'bg-slate-300 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {archivedCountBadge}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Carrousel Membres Actifs (Clic démarre immédiatement le chat) */}
          <div className="border-b border-slate-200/70 p-3 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Membres Actifs
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold">
                ● {availableUsers.length} confrères
              </span>
            </div>
            <div className="flex items-center gap-3 overflow-x-auto pb-1">
              {availableUsers
                .filter((u) => u.id !== currentUser?.id)
                .slice(0, 10)
                .map((u) => (
                  <div key={u.id} className="relative group/user flex-shrink-0">
                    <button
                      onClick={() => handleStartDirectChat(u)}
                      className="flex flex-col items-center gap-1 group"
                      title={`Discuter avec ${u.nom}`}
                    >
                      <div className="relative">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700 transition group-hover:scale-105 group-hover:ring-2 group-hover:ring-blue-500 dark:bg-slate-700 dark:text-slate-200">
                          {u.avatar_url ? (
                            <img
                              src={u.avatar_url}
                              alt={u.nom}
                              className="h-full w-full rounded-full object-cover"
                            />
                          ) : (
                            u.nom.charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
                      </div>
                      <span className="max-w-[55px] truncate text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        {u.nom.split(' ')[0]}
                      </span>
                    </button>
                  </div>
                ))}
            </div>
          </div>

          {/* Résultats de recherche de membres (si recherche active) */}
          {searchQuery.trim() && matchedUsersFromSearch.length > 0 && (
            <div className="p-3 border-b border-slate-200/80 bg-blue-50/50 dark:bg-blue-950/20 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400 tracking-wider block mb-2">
                Confrères trouvés ({matchedUsersFromSearch.length})
              </span>
              <div className="space-y-1.5">
                {matchedUsersFromSearch.slice(0, 3).map((u) => (
                  <div
                    key={u.id}
                    onClick={() => handleStartDirectChat(u)}
                    className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800 shadow-xs cursor-pointer hover:bg-blue-100/50 transition"
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                        {u.nom.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{u.nom}</p>
                        <p className="text-[10px] text-slate-400">{u.role === 'mentor' ? 'Médecin tuteur' : 'Étudiant'}</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <MessageSquare className="h-3.5 w-3.5" /> Discuter
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Liste des discussions */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <MessageSquare className="mb-2 h-10 w-10 text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-medium">Aucune discussion trouvée</p>
                <p className="text-xs text-slate-400 mt-1">
                  Recherchez un membre ou créez un groupe médical pour débuter.
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isGroup = conv.type === 'group';
                const isSelected = activeConvId === conv.id;
                const unreadCount = currentUser ? conv.unread_counts?.[currentUser.id] || 0 : 0;
                const isMuted = currentUser ? conv.is_muted_by?.includes(currentUser.id) : false;
                const isArchived = currentUser ? conv.is_archived_by?.includes(currentUser.id) : false;

                let title = conv.group_name || 'Groupe';
                let avatar = conv.group_photo;
                let otherUid = '';
                let otherUserObj: UserProfile | undefined = undefined;

                if (!isGroup && currentUser) {
                  otherUid = conv.participant_ids.find((id) => id !== currentUser.id) || '';
                  otherUserObj = availableUsers.find((u) => u.id === otherUid);
                  const participant = otherUid ? conv.participants?.[otherUid] : null;
                  title = otherUserObj?.nom || participant?.nom || 'Membre Zaure';
                  avatar = otherUserObj?.avatar_url || participant?.avatar_url || '';
                }

                // Détermination du statut de présence du correspondant
                const presence = otherUserObj?.availability || (conv.participants?.[otherUid]?.is_online ? 'online' : 'offline');

                // Formatage du dernier message et indication de type média
                const lastMsg = conv.last_message;
                const isLastMsgMe = lastMsg?.sender_id === currentUser?.id;
                const lastMsgPrefix = isLastMsgMe ? 'Vous : ' : '';

                return (
                  <div
                    key={conv.id}
                    onClick={() => {
                      if (!isGroup && otherUid) {
                        const target = availableUsers.find((u) => u.id === otherUid);
                        if (target) setSelectedDirectUser(target);
                      }
                      setActiveConvId(conv.id);
                      setMobileView('chat');
                    }}
                    className={`group relative flex cursor-pointer items-center gap-3 p-3 transition hover:bg-slate-100/90 dark:hover:bg-slate-800/60 ${
                      isSelected
                        ? 'bg-blue-50/90 dark:bg-blue-950/40 border-l-4 border-blue-600'
                        : ''
                    } ${unreadCount > 0 ? 'bg-white dark:bg-slate-900/90' : ''}`}
                  >
                    {/* Photo de profil avec badge de présence ou badge groupe */}
                    <div className="relative flex-shrink-0">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-slate-200 to-slate-300 font-bold text-slate-700 dark:from-slate-700 dark:to-slate-800 dark:text-slate-200 ring-1 ring-slate-200/80 dark:ring-slate-700">
                        {avatar ? (
                          <img
                            src={avatar}
                            alt={title}
                            className="h-full w-full rounded-2xl object-cover"
                          />
                        ) : isGroup ? (
                          <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        ) : (
                          <span>{title.charAt(0).toUpperCase()}</span>
                        )}
                      </div>

                      {/* Indicateur de présence pour discussion individuelle */}
                      {!isGroup ? (
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-slate-900 shadow-2xs ${
                            presence === 'online'
                              ? 'bg-emerald-500'
                              : presence === 'busy'
                              ? 'bg-amber-500'
                              : 'bg-slate-400'
                          }`}
                          title={
                            presence === 'online'
                              ? 'En ligne'
                              : presence === 'busy'
                              ? 'Occupé'
                              : 'Hors ligne'
                          }
                        />
                      ) : (
                        <span className="absolute -bottom-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-slate-900 px-1 text-[9px] font-bold text-white shadow-xs dark:bg-slate-700">
                          {conv.participant_ids.length}
                        </span>
                      )}
                    </div>

                    {/* Informations textuelles */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <h3
                          className={`truncate text-sm ${
                            unreadCount > 0
                              ? 'text-slate-950 dark:text-white font-extrabold'
                              : 'text-slate-800 dark:text-slate-200 font-semibold'
                          }`}
                        >
                          {title}
                        </h3>
                        {(lastMsg?.created_at || conv.updated_at) && (
                          <span
                            className={`text-[11px] flex-shrink-0 ml-1.5 font-medium ${
                              unreadCount > 0
                                ? 'text-blue-600 dark:text-blue-400 font-bold'
                                : 'text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            {formatLastMessageTimestamp(lastMsg?.created_at || conv.updated_at)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        {/* Prévisualisation du dernier message avec indication multimédia */}
                        <div
                          className={`truncate text-xs ${
                            unreadCount > 0
                              ? 'font-bold text-slate-900 dark:text-slate-100'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {!lastMsg ? (
                            <span className="italic opacity-80">Nouvelle conversation</span>
                          ) : lastMsg.type === 'image' ? (
                            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                              <span>{lastMsgPrefix}</span>
                              <ImageIcon className="h-3.5 w-3.5 shrink-0 inline" />
                              <span>Photo</span>
                            </span>
                          ) : lastMsg.type === 'video' ? (
                            <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium">
                              <span>{lastMsgPrefix}</span>
                              <Film className="h-3.5 w-3.5 shrink-0 inline" />
                              <span>Vidéo</span>
                            </span>
                          ) : lastMsg.type === 'audio' ? (
                            <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                              <span>{lastMsgPrefix}</span>
                              <Mic className="h-3.5 w-3.5 shrink-0 inline" />
                              <span>Note vocale</span>
                            </span>
                          ) : lastMsg.type === 'file' ? (
                            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                              <span>{lastMsgPrefix}</span>
                              <FileText className="h-3.5 w-3.5 shrink-0 inline" />
                              <span className="truncate">{lastMsg.content || 'Document'}</span>
                            </span>
                          ) : (
                            <span className="truncate">
                              {lastMsgPrefix}{lastMsg.content}
                            </span>
                          )}
                        </div>

                        {/* Badges d'état et actions rapides */}
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          {isMuted && (
                            <BellOff className="h-3.5 w-3.5 text-slate-400 shrink-0" title="En sourdine" />
                          )}
                          {isArchived && (
                            <Archive className="h-3.5 w-3.5 text-slate-400 shrink-0" title="Archivée" />
                          )}

                          {unreadCount > 0 ? (
                            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-black text-white shadow-xs">
                              {unreadCount}
                            </span>
                          ) : (
                            /* Bouton d'action rapide au survol */
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  zaureService.toggleArchiveConversation(conv.id);
                                }}
                                className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-200/50 dark:hover:bg-slate-700 transition"
                                title={isArchived ? 'Désarchiver' : 'Archiver'}
                              >
                                <Archive className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* ==================================================================== */}
        {/* B. ZONE CENTRALE : DISCUSSION, RECHERCHE IN-CHAT & PAGINATION        */}
        {/* ==================================================================== */}
        <main
          className={`flex h-full flex-1 flex-col bg-slate-50/30 dark:bg-slate-950 ${
            mobileView === 'list' ? 'hidden md:flex' : 'flex'
          }`}
        >
          {activeConversation ? (
            <>
              {/* En-tête discussion */}
              <div className="flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setMobileView('list')}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 md:hidden dark:bg-slate-800 dark:text-slate-300"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  <div
                    onClick={() => {
                      if (activeOtherUser) setViewingUserProfile(activeOtherUser);
                    }}
                    className="relative cursor-pointer"
                    title="Consulter le profil public"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 font-bold text-white shadow-sm">
                      {activeConversation.type === 'group' ? (
                        activeConversation.group_photo ? (
                          <img
                            src={activeConversation.group_photo}
                            alt={activeConversation.group_name}
                            className="h-full w-full rounded-2xl object-cover"
                          />
                        ) : (
                          <Users className="h-5 w-5" />
                        )
                      ) : activeOtherUser?.avatar_url ? (
                        <img
                          src={activeOtherUser.avatar_url}
                          alt={activeOtherUser.nom}
                          className="h-full w-full rounded-2xl object-cover"
                        />
                      ) : (
                        <span>
                          {(activeOtherUser?.nom || activeConversation.group_name || 'Z')
                            .charAt(0)
                            .toUpperCase()}
                        </span>
                      )}
                    </div>
                    {activeConversation.type !== 'group' && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3
                        onClick={() => {
                          if (activeOtherUser) setViewingUserProfile(activeOtherUser);
                        }}
                        className="text-sm font-bold text-slate-900 dark:text-white cursor-pointer hover:underline"
                      >
                        {activeConversation.type === 'group'
                          ? activeConversation.group_name
                          : activeOtherUser?.nom || 'Membre Zaure'}
                      </h3>
                      {activeOtherUser?.role === 'mentor' && (
                        <BadgeCheck className="h-4 w-4 text-blue-600" title="Mentor certifié" />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      {isOtherUserTyping ? (
                        <span className="font-medium text-blue-600 animate-pulse dark:text-blue-400">
                          écrit...
                        </span>
                      ) : activeConversation.type === 'group' ? (
                        <span>{activeConversation.participant_ids.length} membres</span>
                      ) : isOtherUserBlocked ? (
                        <span className="text-red-500 font-medium">Utilisateur bloqué</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          En ligne • {activeOtherUser?.role === 'mentor' ? 'Médecin tuteur' : 'Étudiant'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Boutons d'action (Recherche in-chat, Appels & Info) */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setInChatSearchOpen((prev) => !prev);
                      if (inChatSearchOpen) setInChatSearchQuery('');
                    }}
                    className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                      inChatSearchOpen
                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                    title="Rechercher dans cette discussion"
                  >
                    <Search className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => initiateCall('audio')}
                    disabled={isOtherUserBlocked}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
                    title="Appel vocal"
                  >
                    <Phone className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => initiateCall('video')}
                    disabled={isOtherUserBlocked}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
                    title="Appel vidéo"
                  >
                    <Video className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.innerWidth < 1024) {
                        setShowMobileInfoModal(true);
                      } else {
                        setShowRightPanel((prev) => !prev);
                      }
                    }}
                    className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                      showRightPanel || showMobileInfoModal
                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                    title="Informations"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Barre de Recherche dans la discussion active */}
              {inChatSearchOpen && (
                <div className="flex items-center justify-between border-b border-blue-200 bg-blue-50/90 px-4 py-2 text-xs dark:border-blue-900 dark:bg-blue-950/70 animate-fadeIn z-10">
                  <div className="flex items-center gap-2 flex-1 max-w-md">
                    <Search className="h-3.5 w-3.5 text-blue-600" />
                    <input
                      type="text"
                      autoFocus
                      placeholder="Rechercher un mot ou une phrase dans ce fil..."
                      value={inChatSearchQuery}
                      onChange={(e) => {
                        setInChatSearchQuery(e.target.value);
                        setCurrentMatchIndex(0);
                      }}
                      className="w-full bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    {inChatSearchQuery.trim() && (
                      <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                        {matchingMessageIds.length > 0
                          ? `${currentMatchIndex + 1} / ${matchingMessageIds.length}`
                          : 'Aucun résultat'}
                      </span>
                    )}

                    {matchingMessageIds.length > 0 && (
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={handlePrevSearchMatch}
                          className="p-1 text-slate-600 hover:text-blue-600 dark:text-slate-300"
                          title="Résultat précédent"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          onClick={handleNextSearchMatch}
                          className="p-1 text-slate-600 hover:text-blue-600 dark:text-slate-300"
                          title="Résultat suivant"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setInChatSearchOpen(false);
                        setInChatSearchQuery('');
                      }}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white ml-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Avertissement Utilisateur Bloqué */}
              {isOtherUserBlocked && (
                <div className="flex items-center justify-between bg-red-50 px-4 py-2 text-xs text-red-700 border-b border-red-200 dark:bg-red-950/60 dark:border-red-900 dark:text-red-300">
                  <div className="flex items-center gap-2">
                    <UserX className="h-4 w-4 text-red-600" />
                    <span>Vous avez bloqué cet utilisateur. Vous ne pouvez plus échanger de messages.</span>
                  </div>
                  <button
                    onClick={() => activeOtherUser && handleToggleBlockUser(activeOtherUser)}
                    className="font-bold underline hover:text-red-900"
                  >
                    Débloquer
                  </button>
                </div>
              )}

              {/* Alerte Erreur de Validation Fichier */}
              {fileValidationError && (
                <div className="flex items-center justify-between bg-amber-500 text-white px-4 py-2.5 text-xs font-semibold shadow-md animate-fadeIn z-20">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{fileValidationError}</span>
                  </div>
                  <button
                    onClick={() => setFileValidationError(null)}
                    className="p-1 hover:bg-white/20 rounded-lg transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Zone défilable des messages avec support Drag & Drop */}
              <div
                ref={messagesContainerRef}
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className="relative flex-1 overflow-y-auto p-4 space-y-4"
              >
                {/* Overlay Drag & Drop immersif */}
                {isDraggingOver && (
                  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-blue-600/90 backdrop-blur-xs text-white p-6 m-2 rounded-3xl border-2 border-dashed border-white animate-fadeIn pointer-events-none">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 mb-3 animate-bounce">
                      <UploadCloud className="h-8 w-8 text-white" />
                    </div>
                    <h4 className="text-base font-bold">Déposez votre fichier ici</h4>
                    <p className="text-xs text-blue-100 mt-1 text-center max-w-sm">
                      Photos (15 Mo), Vidéos (50 Mo), Documents PDF & Médicaux (25 Mo)
                    </p>
                  </div>
                )}
                {messages.length >= 15 && hasMoreOlder && (
                  <div className="flex justify-center pb-2">
                    <button
                      onClick={handleLoadOlderMessages}
                      disabled={isLoadingOlder}
                      className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 shadow-xs hover:bg-slate-50 transition disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                    >
                      {isLoadingOlder ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                          <span>Chargement des messages précédents...</span>
                        </>
                      ) : (
                        <>
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <span>Charger les messages plus anciens</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                    <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                      <Sparkles className="h-8 w-8" />
                    </div>
                    <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                      Débutez votre conversation avec {activeOtherUser?.nom || 'ce confrère'}
                    </h4>
                    <p className="max-w-xs text-xs text-slate-500 mt-1">
                      Envoyez votre premier message ou note vocale pour échanger en direct.
                    </p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isMe = msg.sender_id === currentUser?.id;
                    const isHovered = hoveredMessageId === msg.id;
                    const isHighlighted = highlightedMsgId === msg.id;

                    const prevMsg = idx > 0 ? messages[idx - 1] : null;
                    const showDateDivider =
                      !prevMsg ||
                      new Date(prevMsg.created_at).toDateString() !==
                        new Date(msg.created_at).toDateString();

                    const isLastReadByOther = msg.id === lastReadMessageIdByOther;
                    const detectedUrls = extractUrls(msg.content);

                    if (msg.type === 'system') {
                      return (
                        <React.Fragment key={msg.id}>
                          {showDateDivider && (
                            <div className="flex justify-center my-3">
                              <span className="rounded-full bg-slate-200/80 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                {formatDateDivider(msg.created_at)}
                              </span>
                            </div>
                          )}
                          <div className="my-2 flex justify-center">
                            <span className="rounded-full bg-slate-200/80 px-3 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              {msg.content}
                            </span>
                          </div>
                        </React.Fragment>
                      );
                    }

                    return (
                      <React.Fragment key={msg.id}>
                        {showDateDivider && (
                          <div className="flex justify-center my-3">
                            <span className="rounded-full bg-slate-200/80 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-400 shadow-xs">
                              {formatDateDivider(msg.created_at)}
                            </span>
                          </div>
                        )}

                        <div
                          id={`msg-${msg.id}`}
                          onMouseEnter={() => setHoveredMessageId(msg.id)}
                          onMouseLeave={() => setHoveredMessageId(null)}
                          className={`relative flex items-end gap-2 group transition-all duration-300 ${
                            isMe ? 'justify-end' : 'justify-start'
                          } ${
                            isHighlighted
                              ? 'ring-4 ring-blue-400/50 rounded-3xl p-1 bg-blue-50/40 dark:bg-blue-950/40'
                              : ''
                          }`}
                        >
                          {!isMe && (
                            <div
                              onClick={() => {
                                const author = availableUsers.find((u) => u.id === msg.sender_id);
                                if (author) setViewingUserProfile(author);
                              }}
                              className="flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-xl bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200 mb-1"
                              title="Consulter le profil public"
                            >
                              {msg.sender_avatar ? (
                                <img
                                  src={msg.sender_avatar}
                                  alt={msg.sender_nom}
                                  className="h-full w-full rounded-xl object-cover"
                                />
                              ) : (
                                <span>{msg.sender_nom?.charAt(0).toUpperCase() || 'M'}</span>
                              )}
                            </div>
                          )}

                          {/* Barre d'action au survol */}
                          {isHovered && !msg.is_deleted && !isOtherUserBlocked && (
                            <div
                              className={`absolute -top-9 z-10 flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 px-2 py-1 shadow-lg backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/95 ${
                                isMe ? 'right-4' : 'left-10'
                              }`}
                            >
                              {QUICK_EMOJIS.slice(0, 5).map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => handleAddReaction(msg.id, emoji)}
                                  className="text-sm transition hover:scale-125 px-0.5"
                                >
                                  {emoji}
                                </button>
                              ))}
                              <div className="h-3 w-[1px] bg-slate-200 dark:bg-slate-700 mx-0.5" />
                              <button
                                onClick={() => {
                                  setReplyingTo(msg);
                                  setEditingMessage(null);
                                }}
                                className="p-1 text-slate-500 hover:text-blue-600"
                                title="Répondre"
                              >
                                <Smile className="h-3.5 w-3.5" />
                              </button>
                              {isMe && msg.type === 'texte' && (
                                <button
                                  onClick={() => {
                                    setEditingMessage(msg);
                                    setReplyingTo(null);
                                    setInputText(msg.content);
                                  }}
                                  className="p-1 text-slate-500 hover:text-blue-600"
                                  title="Modifier"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {isMe && (
                                <button
                                  onClick={() => handleDeleteMessage(msg.id)}
                                  className="p-1 text-slate-500 hover:text-red-500"
                                  title="Supprimer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          )}

                          {/* Bulle de message principale */}
                          <div className="flex flex-col max-w-[85%] md:max-w-[70%]">
                            {activeConversation.type === 'group' && !isMe && (
                              <span className="mb-0.5 ml-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                {msg.sender_nom}
                              </span>
                            )}

                            {msg.reply_to && (
                              <div
                                onClick={() => msg.reply_to && jumpToMessage(msg.reply_to.id)}
                                className={`mb-1 cursor-pointer rounded-xl p-2 text-xs border-l-2 transition hover:opacity-90 ${
                                  isMe
                                    ? 'bg-blue-700/60 text-blue-100 border-white'
                                    : 'bg-slate-200/80 text-slate-700 border-blue-500 dark:bg-slate-800 dark:text-slate-300'
                                }`}
                                title="Cliquer pour voir le message cité"
                              >
                                <span className="font-bold block text-[10px] opacity-80">
                                  En réponse à {msg.reply_to.sender_nom}
                                </span>
                                <p className="truncate text-xs">{msg.reply_to.content}</p>
                              </div>
                            )}

                            <div
                              className={`relative rounded-3xl p-3.5 shadow-xs transition-all ${
                                isMe
                                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-xs'
                                  : 'bg-white text-slate-800 border border-slate-200/70 rounded-bl-xs dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700'
                              }`}
                            >
                              {msg.is_deleted ? (
                                <p className="italic text-xs opacity-75">
                                  🚫 Ce message a été supprimé
                                </p>
                              ) : (
                                <>
                                  {msg.attachments && msg.attachments.length > 0 && (
                                    <div className="mb-2 space-y-2">
                                      {msg.attachments.map((att, attIdx) => {
                                        if (att.type === 'image') {
                                          return (
                                            <div
                                              key={attIdx}
                                              onClick={() => setLightboxImageUrl(att.url)}
                                              className="cursor-pointer overflow-hidden rounded-2xl group/img relative"
                                            >
                                              <img
                                                src={att.url}
                                                alt={att.name}
                                                className="max-h-64 w-full rounded-2xl object-cover transition group-hover/img:scale-105"
                                              />
                                              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center">
                                                <Maximize2 className="h-6 w-6 text-white" />
                                              </div>
                                            </div>
                                          );
                                        }

                                        if (att.type === 'video') {
                                          return (
                                            <video
                                              key={attIdx}
                                              src={att.url}
                                              controls
                                              className="max-h-64 w-full rounded-2xl"
                                            />
                                          );
                                        }

                                        if (att.type === 'audio') {
                                          return (
                                            <div key={attIdx} className="my-1">
                                              <VoiceNotePlayer url={att.url} isMe={isMe} />
                                            </div>
                                          );
                                        }

                                        const badge = getDocumentBadgeInfo(att.name, att.mime_type);
                                        return (
                                          <div
                                            key={attIdx}
                                            className={`flex items-center gap-3 rounded-2xl p-2.5 sm:p-3 transition border ${
                                              isMe
                                                ? 'bg-blue-700/70 border-blue-400/30 text-white'
                                                : 'bg-slate-50 border-slate-200 text-slate-800 dark:bg-slate-800/80 dark:border-slate-700 dark:text-slate-200'
                                            }`}
                                          >
                                            <div
                                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black text-[10px] tracking-wider border shadow-2xs ${badge.badgeBg}`}
                                            >
                                              {badge.label}
                                            </div>
                                            <div className="flex-1 min-w-0 text-left">
                                              <p className="truncate text-xs font-bold leading-tight">
                                                {att.name}
                                              </p>
                                              <span className="text-[10px] opacity-75 font-mono">
                                                {att.size ? formatFileSize(att.size) : 'Document'}
                                              </span>
                                            </div>
                                            <a
                                              href={att.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              download={att.name}
                                              className={`p-2 rounded-xl transition shrink-0 ${
                                                isMe
                                                  ? 'hover:bg-white/20 text-white'
                                                  : 'hover:bg-slate-200 text-slate-700 dark:hover:bg-slate-700 dark:text-slate-300'
                                              }`}
                                              title="Télécharger le document"
                                            >
                                              <Download className="h-4 w-4" />
                                            </a>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {msg.content && msg.type !== 'audio' && (
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                                      {msg.content}
                                    </p>
                                  )}

                                  {detectedUrls.length > 0 && !msg.is_deleted && (
                                    <div className="mt-2 space-y-1.5">
                                      {detectedUrls.map((url, uIdx) => {
                                        try {
                                          const parsed = new URL(url);
                                          return (
                                            <a
                                              key={uIdx}
                                              href={url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className={`flex items-center gap-2 rounded-xl p-2 text-xs transition ${
                                                isMe
                                                  ? 'bg-blue-700/80 hover:bg-blue-800 text-white'
                                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                                              }`}
                                            >
                                              <Globe className="h-4 w-4 flex-shrink-0 text-blue-300" />
                                              <div className="flex-1 min-w-0">
                                                <span className="font-bold truncate block">
                                                  {parsed.hostname.replace('www.', '')}
                                                </span>
                                                <span className="text-[10px] opacity-75 truncate block">
                                                  {url}
                                                </span>
                                              </div>
                                              <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 opacity-70" />
                                            </a>
                                          );
                                        } catch {
                                          return null;
                                        }
                                      })}
                                    </div>
                                  )}

                                  {msg.is_edited && (
                                    <span className="ml-1 text-[10px] opacity-70">(modifié)</span>
                                  )}
                                </>
                              )}

                              <div
                                className={`mt-1 flex items-center gap-1 text-[10px] ${
                                  isMe ? 'justify-end text-blue-100/90' : 'justify-end text-slate-400'
                                }`}
                              >
                                <span>
                                  {new Date(msg.created_at).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                                {isMe && (
                                  <span>
                                    {msg.read_by && msg.read_by.length > 1 ? (
                                      <CheckCheck className="h-3.5 w-3.5 text-blue-200" title="Lu" />
                                    ) : (
                                      <Check className="h-3.5 w-3.5 opacity-80" title="Envoyé" />
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Accusé miniature Facebook Messenger */}
                            {isMe && isLastReadByOther && activeOtherUser && (
                              <div className="mt-1 flex justify-end items-center gap-1 animate-fadeIn">
                                <span className="text-[9px] text-slate-400">Vu</span>
                                <div
                                  className="h-3.5 w-3.5 rounded-full ring-1 ring-white overflow-hidden shadow-xs"
                                  title={`Vu par ${activeOtherUser.nom}`}
                                >
                                  {activeOtherUser.avatar_url ? (
                                    <img
                                      src={activeOtherUser.avatar_url}
                                      alt={activeOtherUser.nom}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="h-full w-full bg-blue-600 text-[8px] font-bold text-white flex items-center justify-center">
                                      {activeOtherUser.nom.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {isMe && activeConversation.type === 'group' && msg.read_by && msg.read_by.length > 1 && (
                              <div className="mt-1 flex justify-end items-center gap-1 text-[10px] text-slate-400">
                                <Eye className="h-3 w-3" />
                                <span>Vu par {msg.read_by.length - 1}</span>
                              </div>
                            )}

                            {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                              <div
                                className={`mt-1 flex flex-wrap gap-1 ${
                                  isMe ? 'justify-end' : 'justify-start'
                                }`}
                              >
                                {Object.entries(msg.reactions).map(([emoji, rawUids]) => {
                                  const uids = Array.isArray(rawUids) ? (rawUids as string[]) : [];
                                  const hasReacted = currentUser ? uids.includes(currentUser.id) : false;
                                  return (
                                    <button
                                      key={emoji}
                                      onClick={() => handleAddReaction(msg.id, emoji)}
                                      className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs shadow-xs transition ${
                                        hasReacted
                                          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                      }`}
                                    >
                                      <span>{emoji}</span>
                                      <span className="font-semibold text-[10px]">{uids.length}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}

                {isOtherUserTyping && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs py-1">
                    <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-200 text-slate-600 dark:bg-slate-700">
                      <Sparkles className="h-3.5 w-3.5 animate-spin" />
                    </div>
                    <div className="flex items-center gap-1 rounded-2xl bg-white border border-slate-200 px-3 py-2 shadow-xs dark:bg-slate-800 dark:border-slate-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce"
                        style={{ animationDelay: '0.2s' }}
                      />
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce"
                        style={{ animationDelay: '0.4s' }}
                      />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Barre de téléversement animée avec progression en temps réel */}
              {isUploading && (
                <div className="border-t border-blue-200 bg-blue-50/95 px-4 py-2.5 dark:border-blue-900 dark:bg-blue-950/90 animate-fadeIn">
                  <div className="flex items-center justify-between text-xs text-blue-900 dark:text-blue-200 mb-1.5 font-semibold">
                    <span className="flex items-center gap-2 truncate">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 shrink-0" />
                      <span className="truncate">
                        Téléversement vers Firebase Storage : {uploadingFileName || 'Fichier en cours...'}
                      </span>
                    </span>
                    <span className="font-mono font-bold text-blue-700 dark:text-blue-300 shrink-0 ml-2">
                      {uploadProgress}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-blue-200 dark:bg-blue-900">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 transition-all duration-300 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Tiroir de prévisualisation avant envoi (Staging Facebook Messenger) */}
              {stagedFile && !isUploading && (
                <div className="flex items-center justify-between border-t border-blue-200 bg-blue-50/80 px-4 py-2.5 dark:border-blue-900/60 dark:bg-blue-950/50 animate-fadeIn">
                  <div className="flex items-center gap-3 min-w-0">
                    {stagedCategory === 'image' && stagedPreviewUrl ? (
                      <div className="relative h-12 w-12 rounded-xl overflow-hidden ring-2 ring-blue-500/30 shrink-0">
                        <img
                          src={stagedPreviewUrl}
                          alt="Aperçu"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : stagedCategory === 'video' ? (
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 shrink-0">
                        <Film className="h-6 w-6" />
                      </div>
                    ) : stagedCategory === 'audio' ? (
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 shrink-0">
                        <Volume2 className="h-6 w-6" />
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 shrink-0">
                        <FileText className="h-6 w-6" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                        {stagedFile.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {stagedFormattedSize} · Pièce jointe prête (ajoutez une légende ou validez)
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={discardStagedFile}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-xl hover:bg-slate-200/50 transition shrink-0"
                    title="Retirer cette pièce jointe"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Bannières Réponse / Modification */}
              {replyingTo && (
                <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/90 px-4 py-2 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      Réponse à {replyingTo.sender_nom} :
                    </span>
                    <span className="truncate italic">{replyingTo.content}</span>
                  </div>
                  <button
                    onClick={() => setReplyingTo(null)}
                    className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {editingMessage && (
                <div className="flex items-center justify-between border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  <span className="font-bold">Modification du message...</span>
                  <button
                    onClick={() => {
                      setEditingMessage(null);
                      setInputText('');
                    }}
                    className="rounded-lg p-1 text-amber-600 hover:text-amber-900"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Barre Enregistrement Vocal */}
              {isRecording ? (
                <div className="flex items-center justify-between border-t border-red-200 bg-red-50/90 px-4 py-3 dark:border-red-900/60 dark:bg-red-950/40">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full bg-red-600 animate-ping" />
                    <span className="text-sm font-semibold text-red-700 dark:text-red-400">
                      Enregistrement : {formatCallTime(recordingSeconds)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={discardRecordedAudio}
                      className="flex items-center gap-1 rounded-xl bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300"
                    >
                      <Trash2 className="h-4 w-4" /> Annuler
                    </button>
                    <button
                      onClick={stopVoiceRecording}
                      className="flex items-center gap-1 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-red-700"
                    >
                      <Square className="h-4 w-4" /> Terminer
                    </button>
                  </div>
                </div>
              ) : recordedAudioBlob ? (
                <div className="flex items-center justify-between border-t border-slate-200 bg-blue-50/80 px-4 py-3 dark:border-slate-800 dark:bg-blue-950/40">
                  <div className="flex items-center gap-3">
                    <audio src={recordedAudioUrl || ''} controls className="h-9 w-60" />
                    <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                      Note prête
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={discardRecordedAudio}
                      className="rounded-xl p-2 text-slate-500 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleSendMessage()}
                      className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
                    >
                      <Send className="h-3.5 w-3.5" /> Envoyer la note
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Formulaire de saisie inférieur */}
              <form
                onSubmit={handleSendMessage}
                className="flex items-center gap-2 border-t border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isOtherUserBlocked}
                />

                {/* Bouton Popover d'ajout de pièces jointes (Photos, Vidéos, Documents) */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowAttachmentMenu((prev) => !prev)}
                    disabled={isUploading || isOtherUserBlocked}
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl transition disabled:opacity-30 ${
                      showAttachmentMenu
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                    title="Ajouter une pièce jointe"
                  >
                    <Plus className={`h-5 w-5 transition-transform duration-200 ${showAttachmentMenu ? 'rotate-45' : ''}`} />
                  </button>

                  {/* Popover Menu des pièces jointes style Facebook Messenger */}
                  {showAttachmentMenu && (
                    <div className="absolute bottom-12 left-0 z-30 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800 animate-fadeIn">
                      <button
                        type="button"
                        onClick={() => openFilePicker('image/*')}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-slate-700 transition"
                      >
                        <ImageIcon className="h-4 w-4 text-emerald-500" />
                        <span>Photos & Images</span>
                        <span className="ml-auto text-[10px] text-slate-400">15 Mo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openFilePicker('video/*')}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-purple-50 hover:text-purple-700 dark:text-slate-200 dark:hover:bg-slate-700 transition"
                      >
                        <Film className="h-4 w-4 text-purple-500" />
                        <span>Vidéos</span>
                        <span className="ml-auto text-[10px] text-slate-400">50 Mo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          openFilePicker(
                            '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip'
                          )
                        }
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-700 dark:text-slate-200 dark:hover:bg-slate-700 transition"
                      >
                        <FileText className="h-4 w-4 text-rose-500" />
                        <span>Documents & PDF</span>
                        <span className="ml-auto text-[10px] text-slate-400">25 Mo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAttachmentMenu(false);
                          startVoiceRecording();
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-red-50 hover:text-red-700 dark:text-slate-200 dark:hover:bg-slate-700 transition"
                      >
                        <Mic className="h-4 w-4 text-red-500" />
                        <span>Message vocal</span>
                        <span className="ml-auto text-[10px] text-slate-400">20 Mo</span>
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={startVoiceRecording}
                  disabled={isRecording || isUploading || isOtherUserBlocked}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-slate-500 hover:bg-slate-100 hover:text-blue-600 transition disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800"
                  title="Enregistrer un message vocal"
                >
                  <Mic className="h-5 w-5" />
                </button>

                <div className="relative flex-1">
                  <textarea
                    rows={1}
                    value={inputText}
                    disabled={isOtherUserBlocked}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={
                      isOtherUserBlocked
                        ? 'Cet utilisateur est bloqué.'
                        : stagedFile
                        ? 'Ajoutez une légende (optionnel)...'
                        : 'Écrivez un message...'
                    }
                    className="max-h-28 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50/70 py-2.5 pl-4 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />

                  <button
                    type="button"
                    disabled={isOtherUserBlocked}
                    onClick={() => setIsEmojiPickerOpen((prev) => !prev)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 dark:hover:text-slate-200"
                  >
                    <Smile className="h-5 w-5" />
                  </button>

                  {isEmojiPickerOpen && (
                    <div className="absolute bottom-12 right-0 z-20 flex gap-1.5 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                      {QUICK_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            setInputText((prev) => prev + emoji);
                            setIsEmojiPickerOpen(false);
                          }}
                          className="text-lg transition hover:scale-125 p-1"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={
                    (!inputText.trim() && !recordedAudioBlob && !stagedFile) ||
                    isUploading ||
                    isOtherUserBlocked
                  }
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 transition hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 active:scale-95"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center text-slate-400">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                <MessageSquare className="h-10 w-10" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                Sélectionnez une discussion
              </h3>
              <p className="max-w-sm text-sm text-slate-500 mt-1">
                Choisissez un confrère dans la liste ou démarrez un nouveau fil de discussion.
              </p>
            </div>
          )}
        </main>

        {/* ==================================================================== */}
        {/* C. VOLET DROIT : DÉTAILS CORRESPONDANT & MÉDIAS PARTAGÉS            */}
        {/* ==================================================================== */}
        {showRightPanel && activeConversation && (
          <aside className="hidden h-full w-80 flex-col border-l border-slate-200/80 bg-slate-50/40 p-4 overflow-y-auto lg:flex dark:border-slate-800 dark:bg-slate-900/50">
            <div className="flex flex-col items-center text-center pb-4 border-b border-slate-200/80 dark:border-slate-800">
              <div
                onClick={() => {
                  if (activeOtherUser) setViewingUserProfile(activeOtherUser);
                }}
                className="mb-3 flex h-20 w-20 cursor-pointer items-center justify-center rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-2xl font-bold text-white shadow-lg transition hover:scale-105"
                title="Consulter le profil public"
              >
                {activeConversation.type === 'group' ? (
                  activeConversation.group_photo ? (
                    <img
                      src={activeConversation.group_photo}
                      alt={activeConversation.group_name}
                      className="h-full w-full rounded-3xl object-cover"
                    />
                  ) : (
                    <Users className="h-10 w-10" />
                  )
                ) : activeOtherUser?.avatar_url ? (
                  <img
                    src={activeOtherUser.avatar_url}
                    alt={activeOtherUser.nom}
                    className="h-full w-full rounded-3xl object-cover"
                  />
                ) : (
                  <span>
                    {(activeOtherUser?.nom || activeConversation.group_name || 'Z')
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <h4
                  onClick={() => {
                    if (activeOtherUser) setViewingUserProfile(activeOtherUser);
                  }}
                  className="text-base font-bold text-slate-900 dark:text-white cursor-pointer hover:underline"
                >
                  {activeConversation.type === 'group'
                    ? activeConversation.group_name
                    : activeOtherUser?.nom || 'Membre Zaure'}
                </h4>
                {activeOtherUser?.role === 'mentor' && (
                  <BadgeCheck className="h-4 w-4 text-blue-600" />
                )}
              </div>

              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                {activeConversation.type === 'group'
                  ? 'Groupe de discussion médical'
                  : activeOtherUser?.role === 'mentor'
                  ? '🩺 Mentor certifié'
                  : 'Étudiant en médecine'}
              </span>

              {(activeOtherUser?.bio || activeConversation.group_description) && (
                <p className="mt-2 text-xs text-slate-500 italic max-w-xs">
                  "{activeConversation.group_description || activeOtherUser?.bio}"
                </p>
              )}

              {activeOtherUser && (
                <button
                  onClick={() => setViewingUserProfile(activeOtherUser)}
                  className="mt-3 flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition dark:bg-blue-950 dark:text-blue-300"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Voir profil public
                </button>
              )}
            </div>

            {/* Actions rapides */}
            <div className="py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-around text-slate-600 dark:text-slate-300">
              <button
                onClick={() => zaureService.toggleMuteConversation(activeConversation.id)}
                className="flex flex-col items-center gap-1 text-xs hover:text-blue-600 transition"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white shadow-xs dark:bg-slate-800">
                  <Bell className="h-4 w-4" />
                </div>
                <span>Sourdine</span>
              </button>
              <button
                onClick={() => zaureService.toggleArchiveConversation(activeConversation.id)}
                className="flex flex-col items-center gap-1 text-xs hover:text-blue-600 transition"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white shadow-xs dark:bg-slate-800">
                  <Archive className="h-4 w-4" />
                </div>
                <span>Archiver</span>
              </button>

              {activeOtherUser && (
                <>
                  <button
                    onClick={() => handleToggleBlockUser(activeOtherUser)}
                    className={`flex flex-col items-center gap-1 text-xs transition ${
                      isOtherUserBlocked ? 'text-red-600 font-bold' : 'hover:text-red-600'
                    }`}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white shadow-xs dark:bg-slate-800">
                      <UserX className="h-4 w-4" />
                    </div>
                    <span>{isOtherUserBlocked ? 'Débloquer' : 'Bloquer'}</span>
                  </button>
                  <button
                    onClick={() => setReportingUser(activeOtherUser)}
                    className="flex flex-col items-center gap-1 text-xs hover:text-amber-600 transition"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white shadow-xs dark:bg-slate-800">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <span>Signaler</span>
                  </button>
                </>
              )}
            </div>

            {/* Membres si groupe (Clic permet d'ouvrir le chat direct avec ce membre) */}
            {activeConversation.type === 'group' && (
              <div className="py-4 border-b border-slate-200/80 dark:border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Membres ({activeConversation.participant_ids.length})
                </span>
                <div className="space-y-2">
                  {activeConversation.participant_ids.map((uid) => {
                    const p = activeConversation.participants?.[uid];
                    const isAdmin = activeConversation.admin_ids?.includes(uid);
                    return (
                      <div
                        key={uid}
                        onClick={() => {
                          if (uid !== currentUser?.id) {
                            const target = availableUsers.find((u) => u.id === uid);
                            if (target) handleStartDirectChat(target);
                          }
                        }}
                        className="flex cursor-pointer items-center justify-between text-xs p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        title={uid !== currentUser?.id ? 'Cliquer pour envoyer un message direct' : ''}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                            {p?.avatar_url ? (
                              <img
                                src={p.avatar_url}
                                alt={p.nom}
                                className="h-full w-full rounded-lg object-cover"
                              />
                            ) : (
                              p?.nom?.charAt(0).toUpperCase() || 'M'
                            )}
                          </div>
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {uid === currentUser?.id ? 'Vous' : p?.nom || 'Membre'}
                          </span>
                        </div>
                        {isAdmin && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                            Admin
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Fichiers & Médias Partagés */}
            <div className="py-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                Fichiers & Médias ({sharedMediaMessages.length})
              </span>
              {sharedMediaMessages.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Aucun média partagé pour le moment.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {sharedMediaMessages.slice(0, 9).map((msg) => {
                    const att = msg.attachments?.[0];
                    if (!att) return null;
                    if (att.type === 'image') {
                      return (
                        <div
                          key={msg.id}
                          onClick={() => setLightboxImageUrl(att.url)}
                          className="cursor-pointer overflow-hidden rounded-xl aspect-square bg-slate-200 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 relative group/m"
                          title={att.name}
                        >
                          <img
                            src={att.url}
                            alt={att.name}
                            className="h-full w-full object-cover transition group-hover/m:scale-110"
                          />
                        </div>
                      );
                    }
                    if (att.type === 'video') {
                      return (
                        <div
                          key={msg.id}
                          className="flex aspect-square flex-col items-center justify-center rounded-xl bg-purple-50 p-1.5 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 ring-1 ring-purple-200 dark:ring-purple-900"
                          title={att.name}
                        >
                          <Film className="h-6 w-6 text-purple-600 mb-1" />
                          <span className="truncate max-w-[55px] text-[10px] font-semibold">{att.name}</span>
                        </div>
                      );
                    }
                    if (att.type === 'audio') {
                      return (
                        <div
                          key={msg.id}
                          className="flex aspect-square flex-col items-center justify-center rounded-xl bg-amber-50 p-1.5 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-900"
                          title="Note vocale"
                        >
                          <Volume2 className="h-6 w-6 text-amber-600 mb-1" />
                          <span className="text-[10px] font-semibold">Vocal</span>
                        </div>
                      );
                    }
                    const badge = getDocumentBadgeInfo(att.name, att.mime_type);
                    return (
                      <a
                        key={msg.id}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={att.name}
                        className="flex aspect-square flex-col items-center justify-center rounded-xl bg-slate-100 p-1 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 transition"
                        title={att.name}
                      >
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md mb-1 ${badge.badgeBg}`}>
                          {badge.label}
                        </span>
                        <span className="truncate max-w-[55px] text-[10px] font-medium">{att.name}</span>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ==================================================================== */}
      {/* 3. MODALE : CONSULTATION DU PROFIL PUBLIC COMPLET                     */}
      {/* ==================================================================== */}
      {viewingUserProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setViewingUserProfile(null)}
              className="absolute top-4 right-4 rounded-xl p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="relative mb-3">
                <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-3xl font-bold text-white shadow-xl">
                  {viewingUserProfile.avatar_url ? (
                    <img
                      src={viewingUserProfile.avatar_url}
                      alt={viewingUserProfile.nom}
                      className="h-full w-full rounded-3xl object-cover"
                    />
                  ) : (
                    viewingUserProfile.nom.charAt(0).toUpperCase()
                  )}
                </div>
                <span
                  className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-white dark:border-slate-900 ${
                    viewingUserProfile.availability === 'busy'
                      ? 'bg-amber-500'
                      : viewingUserProfile.availability === 'offline'
                      ? 'bg-slate-400'
                      : 'bg-emerald-500'
                  }`}
                  title={viewingUserProfile.availability || 'online'}
                />
              </div>

              <div className="flex items-center gap-1.5">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {viewingUserProfile.nom}
                </h3>
                {viewingUserProfile.role === 'mentor' && (
                  <BadgeCheck className="h-5 w-5 text-blue-600" />
                )}
              </div>

              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
                {viewingUserProfile.role === 'mentor'
                  ? '🩺 Mentor Médical Certifié'
                  : '🎓 Étudiant en Médecine'}
              </span>

              {viewingUserProfile.bio && (
                <p className="mt-3 text-xs text-slate-600 dark:text-slate-300 italic max-w-sm">
                  "{viewingUserProfile.bio}"
                </p>
              )}
            </div>

            <div className="mt-5 space-y-2.5 rounded-2xl bg-slate-50 p-4 text-xs dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-blue-600" />
                  Identifiant Firebase (UID)
                </span>
                <div className="flex items-center gap-1 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                  <span className="max-w-[140px] truncate">{viewingUserProfile.id}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(viewingUserProfile.id);
                      alert('Identifiant copié !');
                    }}
                    className="p-1 hover:text-blue-600"
                    title="Copier l'identifiant"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-blue-600" />
                  Membre depuis
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {viewingUserProfile.created_at
                    ? new Date(viewingUserProfile.created_at).toLocaleDateString('fr-FR', {
                        month: 'long',
                        year: 'numeric'
                      })
                    : 'Octobre 2026'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-blue-600" />
                  Disponibilité
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {viewingUserProfile.availability === 'busy'
                    ? '🟠 Occupé (En garde)'
                    : viewingUserProfile.availability === 'offline'
                    ? '⚪ Hors ligne'
                    : '🟢 Disponible actuellement'}
                </span>
              </div>
            </div>

            {currentUser && viewingUserProfile.id !== currentUser.id && (
              <div className="mt-5 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleStartDirectChat(viewingUserProfile)}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Envoyer un message
                  </button>
                  <button
                    onClick={() => {
                      setViewingUserProfile(null);
                      initiateCall('video');
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition dark:bg-slate-800 dark:text-slate-200"
                  >
                    <Video className="h-4 w-4 text-blue-600" />
                    Appel vidéo HD
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => handleToggleBlockUser(viewingUserProfile)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold border transition ${
                      blockedUserIds.includes(viewingUserProfile.id)
                        ? 'border-red-300 bg-red-50 text-red-700'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <UserX className="h-3.5 w-3.5" />
                    {blockedUserIds.includes(viewingUserProfile.id) ? 'Débloquer' : 'Bloquer le membre'}
                  </button>

                  <button
                    onClick={() => {
                      setReportingUser(viewingUserProfile);
                      setViewingUserProfile(null);
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-xs font-semibold text-amber-600 hover:bg-amber-50 transition dark:border-slate-700"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Signaler
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. MODALE : SIGNALER UN UTILISATEUR                                   */}
      {/* ==================================================================== */}
      {reportingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Signaler {reportingUser.nom}
                </h3>
              </div>
              <button
                onClick={() => setReportingUser(null)}
                className="rounded-xl p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Votre signalement est confidentiel et sera examiné par le comité de modération de Zaure.
            </p>

            <form onSubmit={handleSubmitReport} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Motif du signalement
                </label>
                <div className="space-y-2 text-xs">
                  {[
                    { key: 'spam', label: 'Spam ou sollicitations non autorisées' },
                    { key: 'harcelement', label: 'Harcèlement ou propos déplacés' },
                    { key: 'usurpation', label: "Usurpation d'identité ou faux titre médical" },
                    { key: 'contenu_inapproprie', label: 'Partage de contenu non éthique ou inapproprié' },
                    { key: 'autre', label: 'Autre motif' }
                  ].map((opt) => (
                    <label
                      key={opt.key}
                      className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 p-2.5 hover:bg-slate-50 transition dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      <input
                        type="radio"
                        name="reportReason"
                        checked={reportReason === opt.key}
                        onChange={() => setReportReason(opt.key as any)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Détails complémentaires (facultatif)
                </label>
                <textarea
                  rows={3}
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Expliquez brièvement le problème rencontré..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReportingUser(null)}
                  className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReport}
                  className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white shadow-md shadow-red-600/20 hover:bg-red-700 disabled:opacity-40"
                >
                  {isSubmittingReport ? 'Envoi...' : 'Transmettre le signalement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {reportSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white shadow-xl animate-bounce">
          <Check className="h-4 w-4" />
          <span>Le signalement a été transmis à la modération avec succès.</span>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. MODALE : MODIFIER MON PROFIL                                       */}
      {/* ==================================================================== */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Modifier mon profil Zaure
              </h3>
              <button
                onClick={() => setIsEditProfileOpen(false)}
                className="rounded-xl p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col items-center mb-5">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarFileSelect}
                className="hidden"
              />
              <div
                onClick={() => avatarInputRef.current?.click()}
                className="group relative flex h-24 w-24 cursor-pointer items-center justify-center rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-3xl font-bold text-white shadow-lg overflow-hidden"
              >
                {currentUser?.avatar_url ? (
                  <img
                    src={currentUser.avatar_url}
                    alt={currentUser.nom}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  currentUser?.nom?.charAt(0).toUpperCase() || 'Z'
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center text-white">
                  <Camera className="h-6 w-6 mb-1" />
                  <span className="text-[10px] font-semibold">Changer</span>
                </div>
              </div>
              <span
                className="mt-2 text-xs font-semibold text-blue-600 dark:text-blue-400 cursor-pointer"
                onClick={() => avatarInputRef.current?.click()}
              >
                {isUploadingAvatar ? 'Téléversement en cours...' : 'Changer la photo de profil'}
              </span>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Nom d'affichage
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Message de statut (ex: En garde, Révision)
                </label>
                <input
                  type="text"
                  value={editStatusMsg}
                  onChange={(e) => setEditStatusMsg(e.target.value)}
                  placeholder="Votre statut actuel..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Courte biographie
                </label>
                <textarea
                  rows={2}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Spécialité, université, intérêts médicaux..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(false)}
                  className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile || !editName.trim()}
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-40"
                >
                  {isSavingProfile ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. MODALE : NOUVELLE CONVERSATION OU CRÉATION DE GROUPE              */}
      {/* ==================================================================== */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Nouvelle discussion
              </h3>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="rounded-xl p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex rounded-2xl bg-slate-100 p-1 mb-4 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setNewChatTab('direct')}
                className={`flex-1 rounded-xl py-1.5 text-xs font-semibold transition ${
                  newChatTab === 'direct'
                    ? 'bg-white text-blue-600 shadow-xs dark:bg-slate-700 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Message direct
              </button>
              <button
                type="button"
                onClick={() => setNewChatTab('group')}
                className={`flex-1 rounded-xl py-1.5 text-xs font-semibold transition ${
                  newChatTab === 'group'
                    ? 'bg-white text-blue-600 shadow-xs dark:bg-slate-700 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Créer un groupe
              </button>
            </div>

            {newChatTab === 'direct' ? (
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {availableUsers
                  .filter((u) => u.id !== currentUser?.id)
                  .map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleStartDirectChat(u)}
                      className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-2xl"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                        {u.avatar_url ? (
                          <img
                            src={u.avatar_url}
                            alt={u.nom}
                            className="h-full w-full rounded-xl object-cover"
                          />
                        ) : (
                          u.nom.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {u.nom}
                        </h4>
                        <span className="text-xs text-slate-400">
                          {u.role === 'mentor' ? '🩺 Mentor médical' : 'Étudiant en médecine'}
                        </span>
                      </div>
                    </button>
                  ))}
              </div>
            ) : (
              <form onSubmit={handleCreateGroup} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Nom du groupe
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Cardiologie — Promo 2026"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Description (facultatif)
                  </label>
                  <input
                    type="text"
                    placeholder="Objectif du groupe..."
                    value={newGroupDescription}
                    onChange={(e) => setNewGroupDescription(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Sélectionner des membres ({selectedMemberIds.length})
                  </label>
                  <div className="max-h-44 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 dark:border-slate-700">
                    {availableUsers
                      .filter((u) => u.id !== currentUser?.id)
                      .map((u) => {
                        const isSelected = selectedMemberIds.includes(u.id);
                        return (
                          <div
                            key={u.id}
                            onClick={() => {
                              setSelectedMemberIds((prev) =>
                                isSelected ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                              );
                            }}
                            className={`flex cursor-pointer items-center justify-between p-2 rounded-xl text-xs transition ${
                              isSelected
                                ? 'bg-blue-50 text-blue-700 font-semibold dark:bg-blue-950 dark:text-blue-300'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <span>{u.nom}</span>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                          </div>
                        );
                      })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isCreatingGroup || !newGroupName.trim() || selectedMemberIds.length === 0}
                  className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40"
                >
                  {isCreatingGroup ? 'Création...' : 'Créer le groupe de discussion'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 7. MODALE : APPELS AUDIO ET VIDÉO WEBRTC                              */}
      {/* ==================================================================== */}
      {callModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-fadeIn">
          <div className="relative flex h-[85vh] w-full max-w-2xl flex-col justify-between overflow-hidden rounded-3xl bg-slate-900 text-white shadow-2xl border border-slate-800">
            <div className="flex items-center justify-between p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 font-bold">
                  {activeOtherUser?.nom?.charAt(0).toUpperCase() || 'Z'}
                </div>
                <div>
                  <h3 className="text-lg font-bold">
                    {activeOtherUser?.nom || activeConversation?.group_name}
                  </h3>
                  <span className="text-xs text-slate-400">
                    {callModal.status === 'ringing'
                      ? 'Appel en cours...'
                      : `Connecté • ${formatCallTime(callModal.duration)}`}
                  </span>
                </div>
              </div>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-blue-400 border border-slate-700">
                {callModal.type === 'video' ? 'Vidéo HD' : 'Audio HD'}
              </span>
            </div>

            <div className="relative flex flex-1 items-center justify-center p-4">
              {callModal.type === 'video' ? (
                <div className="relative h-full w-full overflow-hidden rounded-2xl bg-slate-950 flex items-center justify-center">
                  <div className="flex flex-col items-center text-center">
                    <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-4xl font-bold shadow-2xl animate-pulse">
                      {activeOtherUser?.nom?.charAt(0).toUpperCase() || 'Z'}
                    </div>
                    <p className="mt-4 text-sm font-semibold text-slate-300">
                      Flux vidéo chiffré de bout en bout
                    </p>
                  </div>

                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute bottom-4 right-4 h-36 w-28 rounded-2xl border-2 border-white/20 bg-black object-cover shadow-xl"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="relative flex h-36 w-36 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-5xl font-bold shadow-2xl">
                    {activeOtherUser?.nom?.charAt(0).toUpperCase() || 'Z'}
                    <span className="absolute inset-0 rounded-full border-4 border-blue-400 animate-ping opacity-30" />
                  </div>
                  <p className="mt-6 text-sm text-slate-300">Appel audio sécurisé Zaure</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-6 p-6 bg-slate-950/60 border-t border-slate-800/80">
              <button
                onClick={toggleCallMute}
                className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
                  callModal.isMuted ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
                title={callModal.isMuted ? 'Activer micro' : 'Couper micro'}
              >
                {callModal.isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>

              {callModal.type === 'video' && (
                <button
                  onClick={toggleCallVideo}
                  className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
                    callModal.isVideoOff ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                  title={callModal.isVideoOff ? 'Activer caméra' : 'Couper caméra'}
                >
                  {callModal.isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                </button>
              )}

              <button
                onClick={endCall}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-red-600/40 hover:bg-red-700 transition"
                title="Raccrocher"
              >
                <PhoneOff className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 8. MODALE : INFORMATIONS DISCUSSION MOBILE                          */}
      {/* ==================================================================== */}
      {showMobileInfoModal && activeConversation && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setShowMobileInfoModal(false)}
              className="absolute top-4 right-4 rounded-xl p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex flex-col items-center text-center pb-4 border-b border-slate-200/80 dark:border-slate-800">
              <div
                onClick={() => {
                  if (activeOtherUser) {
                    setShowMobileInfoModal(false);
                    setViewingUserProfile(activeOtherUser);
                  }
                }}
                className="mb-3 flex h-20 w-20 cursor-pointer items-center justify-center rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-2xl font-bold text-white shadow-lg"
              >
                {activeConversation.type === 'group' ? (
                  activeConversation.group_photo ? (
                    <img
                      src={activeConversation.group_photo}
                      alt={activeConversation.group_name}
                      className="h-full w-full rounded-3xl object-cover"
                    />
                  ) : (
                    <Users className="h-10 w-10" />
                  )
                ) : activeOtherUser?.avatar_url ? (
                  <img
                    src={activeOtherUser.avatar_url}
                    alt={activeOtherUser.nom}
                    className="h-full w-full rounded-3xl object-cover"
                  />
                ) : (
                  <span>
                    {(activeOtherUser?.nom || activeConversation.group_name || 'Z')
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                )}
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                {activeConversation.type === 'group'
                  ? activeConversation.group_name
                  : activeOtherUser?.nom || 'Membre Zaure'}
              </h4>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                {activeConversation.type === 'group'
                  ? 'Groupe de discussion médical'
                  : activeOtherUser?.role === 'mentor'
                  ? '🩺 Mentor certifié'
                  : 'Étudiant en médecine'}
              </span>
            </div>

            <div className="py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-around text-slate-600 dark:text-slate-300">
              <button
                onClick={() => zaureService.toggleMuteConversation(activeConversation.id)}
                className="flex flex-col items-center gap-1 text-xs hover:text-blue-600 transition"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                  <Bell className="h-4 w-4" />
                </div>
                <span>Sourdine</span>
              </button>
              <button
                onClick={() => zaureService.toggleArchiveConversation(activeConversation.id)}
                className="flex flex-col items-center gap-1 text-xs hover:text-blue-600 transition"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                  <Archive className="h-4 w-4" />
                </div>
                <span>Archiver</span>
              </button>
              {activeOtherUser && (
                <button
                  onClick={() => handleToggleBlockUser(activeOtherUser)}
                  className="flex flex-col items-center gap-1 text-xs hover:text-red-600 transition"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                    <UserX className="h-4 w-4" />
                  </div>
                  <span>Bloquer</span>
                </button>
              )}
            </div>

            {activeConversation.type === 'group' && (
              <div className="py-4 border-b border-slate-200/80 dark:border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Membres ({activeConversation.participant_ids.length})
                </span>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {activeConversation.participant_ids.map((uid) => {
                    const p = activeConversation.participants?.[uid];
                    const isAdmin = activeConversation.admin_ids?.includes(uid);
                    return (
                      <div
                        key={uid}
                        onClick={() => {
                          if (uid !== currentUser?.id) {
                            const target = availableUsers.find((u) => u.id === uid);
                            if (target) {
                              setShowMobileInfoModal(false);
                              handleStartDirectChat(target);
                            }
                          }
                        }}
                        className="flex cursor-pointer items-center justify-between text-xs p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                            {p?.avatar_url ? (
                              <img src={p.avatar_url} alt={p.nom} className="h-full w-full rounded-lg object-cover" />
                            ) : (
                              p?.nom?.charAt(0).toUpperCase() || 'M'
                            )}
                          </div>
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {uid === currentUser?.id ? 'Vous' : p?.nom || 'Membre'}
                          </span>
                        </div>
                        {isAdmin && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                            Admin
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="py-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                Fichiers & Médias ({sharedMediaMessages.length})
              </span>
              {sharedMediaMessages.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Aucun média partagé.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {sharedMediaMessages.slice(0, 6).map((msg) => {
                    const att = msg.attachments?.[0];
                    if (!att) return null;
                    if (att.type === 'image') {
                      return (
                        <div
                          key={msg.id}
                          onClick={() => {
                            setShowMobileInfoModal(false);
                            setLightboxImageUrl(att.url);
                          }}
                          className="cursor-pointer overflow-hidden rounded-xl aspect-square bg-slate-200 dark:bg-slate-800 relative"
                        >
                          <img src={att.url} alt={att.name} className="h-full w-full object-cover" />
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 8. MODALE : VISIONNEUSE PLEIN ÉCRAN D'IMAGES                          */}
      {/* ==================================================================== */}
      {lightboxImageUrl && (
        <div
          onClick={() => setLightboxImageUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-fadeIn"
        >
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxImageUrl}
              alt="Aperçu agrandi"
              className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
            />
            <div className="absolute top-3 right-3 flex items-center gap-2">
              <a
                href={lightboxImageUrl}
                download="image_zaure.jpg"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 backdrop-blur-md transition shadow-md"
                title="Télécharger l'image"
              >
                <Download className="h-5 w-5" />
              </a>
              <button
                onClick={() => setLightboxImageUrl(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 backdrop-blur-md transition shadow-md"
                title="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
