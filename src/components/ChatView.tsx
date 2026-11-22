import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Info, X } from 'lucide-react';
import {
  Conversation,
  ConversationParticipant,
  DEFAULT_PRIVACY_SETTINGS,
  Message,
  MessageAttachment,
  MessageReplyInfo,
  UserProfile
} from '../types';
import { doc, onSnapshot } from 'firebase/firestore';
import { dbFirestore, normalizePrivacySettings, zaureService } from '../firebaseClient';
import { canSendDirectMessage, profileService } from '../services/profileService';
import { validateFileForChat } from '../utils/fileValidation';
import { ChatFilterTab, ConversationSidebar } from './chat/ConversationSidebar';
import { ChatThread } from './chat/ChatThread';
import { MessageComposer } from './chat/MessageComposer';
import { ChatDetailsPanel } from './chat/ChatDetailsPanel';
import {
  CallOverlayModal,
  ConfirmDialog,
  EditGroupModal,
  ImageLightboxModal,
  ManageGroupMembersModal,
  NewChatModal,
  ReportModal,
  UserProfileModal
} from './chat/ChatModals';

interface ChatViewProps {
  currentUser: UserProfile | null;
  initialSelectedUser?: UserProfile | null;
  initialConversationId?: string | null;
  mobileView?: 'list' | 'chat';
  onMobileViewChange?: (view: 'list' | 'chat') => void;
  onConversationChange?: (convId: string | null) => void;
  onProfileUpdated?: (updatedUser: UserProfile) => void;
  onExitChat?: () => void;
}

export default function ChatView({
  currentUser,
  initialSelectedUser = null,
  initialConversationId = null,
  mobileView: propMobileView = 'list',
  onMobileViewChange,
  onConversationChange,
  onProfileUpdated,
  onExitChat
}: ChatViewProps) {
  // Core Data State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(initialConversationId || null);
  const [rawMessages, setRawMessages] = useState<Message[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [selectedDirectUser, setSelectedDirectUser] = useState<UserProfile | null>(
    initialSelectedUser
  );
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [myJoinedCircleIds, setMyJoinedCircleIds] = useState<string[]>([]);

  // Navigation & Filters State
  const [internalMobileView, setInternalMobileView] = useState<'list' | 'chat'>(propMobileView);
  const setMobileView = (view: 'list' | 'chat') => {
    setInternalMobileView(view);
    if (onMobileViewChange) onMobileViewChange(view);
  };
  const mobileView = internalMobileView;

  const [activeFilter, setActiveFilter] = useState<ChatFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showMobileDetails, setShowMobileDetails] = useState(false);
  const [presenceStatus, setPresenceStatus] = useState<'online' | 'busy' | 'offline'>('online');

  // Toast notifications (replaces window.alert)
  const [toast, setToast] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);
  const showToast = (text: string, tone: 'success' | 'error' = 'success') => {
    setToast({ text, tone });
    setTimeout(() => setToast(null), 4000);
  };

  // In-Chat Search & Pagination
  const [inChatSearchOpen, setInChatSearchOpen] = useState(false);
  const [inChatSearchQuery, setInChatSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);

  // Composer State
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  // Upload & Voice Recording State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [stagedPreviewUrl, setStagedPreviewUrl] = useState<string | null>(null);
  const [stagedCategory, setStagedCategory] = useState<'image' | 'video' | 'audio' | 'document'>(
    'document'
  );
  const [stagedFormattedSize, setStagedFormattedSize] = useState('');
  const [fileValidationError, setFileValidationError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Modals State
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatModalTab, setNewChatModalTab] = useState<'direct' | 'group'>('direct');
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [showManageMembersModal, setShowManageMembersModal] = useState(false);
  const [viewingUserProfile, setViewingUserProfile] = useState<UserProfile | null>(null);
  const [reportingUser, setReportingUser] = useState<UserProfile | null>(null);
  const [reportReason, setReportReason] = useState<
    'spam' | 'harcelement' | 'usurpation' | 'contenu_inapproprie' | 'autre'
  >('spam');
  const [reportDetails, setReportDetails] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  // Confirmation Dialogs State
  const [pendingBlockUser, setPendingBlockUser] = useState<UserProfile | null>(null);
  const [pendingDeleteMessageId, setPendingDeleteMessageId] = useState<string | null>(null);
  const [pendingDeleteConversation, setPendingDeleteConversation] = useState<Conversation | null>(
    null
  );

  // WebRTC Call Modal State
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

  // Refs
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // --------------------------------------------------------------------------
  // 1. Real-Time Subscriptions: Conversations, Public Profiles Presence, Privacy
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!currentUser) return;

    setPresenceStatus(currentUser.availability || 'online');
    zaureService.getBlockedUserIds().then(setBlockedUserIds);
    zaureService.getJoinedCircleIds(currentUser.id).then(setMyJoinedCircleIds);

    const unsubSettings = dbFirestore
      ? onSnapshot(
          doc(dbFirestore, 'user_settings', currentUser.id),
          (snap) => {
            if (snap.exists()) {
              setBlockedUserIds(snap.data()?.utilisateurs_bloques || []);
            }
          },
          () => {}
        )
      : () => {};

    const unsubProfiles = zaureService.subscribePublicProfilesPresence((users) => {
      setAvailableUsers(users);
    });
    const unsubFollowing = profileService.subscribeFollowing(currentUser.id, (follows) => {
      setFollowingIds(follows.map((f) => f.followingId));
    });
    const unsubConvs = zaureService.subscribeUserConversations(currentUser.id, (convs) => {
      setConversations(convs);
    });

    return () => {
      unsubSettings();
      unsubProfiles();
      unsubFollowing();
      unsubConvs();
    };
  }, [currentUser?.id]);

  // Own presence heartbeat
  useEffect(() => {
    if (!currentUser) return;
    if (presenceStatus !== 'offline') {
      zaureService.setUserAvailability(presenceStatus);
    }
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && presenceStatus !== 'offline') {
        zaureService.setUserAvailability(presenceStatus);
      }
    }, 90_000);
    return () => clearInterval(interval);
  }, [currentUser?.id, presenceStatus]);

  // Sync activeConvId when parent URL route changes (refresh / browser Back & Forward)
  useEffect(() => {
    if (initialSelectedUser) return;
    if (initialConversationId) {
      setActiveConvId(initialConversationId);
      setMobileView('chat');
    } else if (initialConversationId === null) {
      setActiveConvId(null);
      if (window.innerWidth < 768) {
        setMobileView('list');
      }
    }
  }, [initialConversationId]);

  const selectConversationId = (convId: string | null) => {
    setActiveConvId(convId);
    onConversationChange?.(convId);
  };

  // Direct jump when initialSelectedUser is passed from Profile / Feed
  const handleStartDirectChat = (user: UserProfile) => {
    if (!currentUser) return;
    setSelectedDirectUser(user);
    const convId = zaureService.getConversationId(currentUser.id, user.id);
    selectConversationId(convId);
    setMobileView('chat');
    setShowNewChatModal(false);
    setViewingUserProfile(null);
    setInChatSearchOpen(false);
    setInChatSearchQuery('');
  };

  useEffect(() => {
    if (!initialSelectedUser || !currentUser) return;
    handleStartDirectChat(initialSelectedUser);
  }, [initialSelectedUser?.id, currentUser?.id]);

  // Auto-select first visible conversation on desktop when visiting /messages directly
  const visibleConversations = useMemo(() => {
    if (!currentUser) return conversations;
    return conversations.filter((c) => !c.deleted_by?.includes(currentUser.id));
  }, [conversations, currentUser]);

  useEffect(() => {
    if (
      !activeConvId &&
      !initialConversationId &&
      visibleConversations.length > 0 &&
      window.innerWidth >= 768
    ) {
      setActiveConvId(visibleConversations[0].id);
    }
  }, [visibleConversations, activeConvId, initialConversationId]);

  // --------------------------------------------------------------------------
  // 2. Active Conversation & Other User Resolution
  // --------------------------------------------------------------------------
  const activeConversation = useMemo(() => {
    if (!activeConvId) return null;
    const found = conversations.find((c) => c.id === activeConvId);
    if (found) return found;

    if (currentUser && activeConvId.includes('_')) {
      const otherId = activeConvId.split('_').find((id) => id !== currentUser.id);
      const otherUser =
        (selectedDirectUser?.id === otherId ? selectedDirectUser : undefined) ||
        (initialSelectedUser?.id === otherId ? initialSelectedUser : undefined) ||
        (otherId ? availableUsers.find((u) => u.id === otherId) : undefined);

      if (otherUser || otherId) {
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
              nom: otherUser?.nom || 'Membre Zaure',
              avatar_url: otherUser?.avatar_url || null,
              role: otherUser?.role || 'utilisateur',
              is_online: otherUser?.availability !== 'offline'
            }
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          unread_counts: { [currentUser.id]: 0, [targetId]: 0 },
          is_archived_by: [],
          is_muted_by: [],
          is_favorite_by: [],
          deleted_by: []
        };
      }
    }
    return null;
  }, [activeConvId, conversations, selectedDirectUser, initialSelectedUser, currentUser, availableUsers]);

  const activeOtherUser = useMemo<UserProfile | null>(() => {
    if (!currentUser || !activeConversation || activeConversation.type === 'group') return null;
    const otherId = activeConversation.participant_ids.find((id) => id !== currentUser.id);
    if (!otherId) return null;

    const live = availableUsers.find((u) => u.id === otherId);
    if (live) return live;
    if (selectedDirectUser?.id === otherId) return selectedDirectUser;
    if (initialSelectedUser?.id === otherId) return initialSelectedUser;

    const meta = activeConversation.participants?.[otherId];
    if (meta) {
      return {
        id: otherId,
        nom: meta.nom || 'Membre Zaure',
        avatar_url: meta.avatar_url || null,
        email: '',
        bio: null,
        role: (meta.role as UserProfile['role']) || 'utilisateur',
        langue_preferee: 'fr',
        availability: meta.is_online ? 'online' : 'offline'
      };
    }
    return null;
  }, [activeConversation, currentUser, availableUsers, selectedDirectUser, initialSelectedUser]);

  const isGroupAdmin = useMemo(() => {
    if (!activeConversation || activeConversation.type !== 'group' || !currentUser) return false;
    return Boolean(activeConversation.admin_ids?.includes(currentUser.id));
  }, [activeConversation, currentUser]);

  const isOtherUserBlocked = useMemo(() => {
    if (!activeOtherUser) return false;
    return blockedUserIds.includes(activeOtherUser.id);
  }, [activeOtherUser, blockedUserIds]);

  const dmRestrictedReason = useMemo(() => {
    if (!activeOtherUser || !currentUser || activeConversation?.type === 'group') return null;
    const targetPrivacy = normalizePrivacySettings(
      activeOtherUser.privacy_settings || DEFAULT_PRIVACY_SETTINGS
    );
    const allowed = canSendDirectMessage(targetPrivacy, {
      isOwnProfile: false,
      isFollower: followingIds.includes(activeOtherUser.id),
      sharesCircleOrGroup: myJoinedCircleIds.length > 0,
      isMentorOrVerified: currentUser.role === 'mentor' || currentUser.role === 'verifie',
      isBlocked: false
    });
    if (allowed) return null;
    if (targetPrivacy.allowMessages === 'personne') {
      return `${activeOtherUser.nom} n’accepte actuellement aucun message privé.`;
    }
    if (targetPrivacy.allowMessages === 'followers') {
      return `Suivez ${activeOtherUser.nom} pour pouvoir lui envoyer un message privé.`;
    }
    if (targetPrivacy.allowMessages === 'mentors') {
      return `${activeOtherUser.nom} autorise uniquement les messages des mentors et membres vérifiés.`;
    }
    return `${activeOtherUser.nom} limite la réception de ses messages privés.`;
  }, [activeOtherUser, currentUser, activeConversation?.type, followingIds, myJoinedCircleIds]);

  // --------------------------------------------------------------------------
  // 3. Subscribe to Active Conversation Messages & Apply Soft-Clear Filter
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!activeConvId) {
      setRawMessages([]);
      return;
    }
    setHasMoreOlder(true);
    const unsubscribe = zaureService.subscribeConversationMessages(activeConvId, (msgs) => {
      setRawMessages(msgs);
      zaureService.markConversationAsRead(activeConvId);
    });
    return () => unsubscribe();
  }, [activeConvId]);

  const messages = useMemo(() => {
    if (!currentUser || !activeConversation?.cleared_at?.[currentUser.id]) return rawMessages;
    const cutoffMs = new Date(activeConversation.cleared_at[currentUser.id]).getTime();
    return rawMessages.filter((m) => new Date(m.created_at).getTime() > cutoffMs);
  }, [rawMessages, activeConversation, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages.length, activeConvId]);

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

  const isOtherUserTyping = useMemo(() => {
    if (!activeConversation?.typing || !currentUser) return false;
    return Object.entries(activeConversation.typing).some(
      ([uid, val]) => uid !== currentUser.id && val === true
    );
  }, [activeConversation?.typing, currentUser]);

  // --------------------------------------------------------------------------
  // 4. In-Chat Search & Pagination
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
      setTimeout(() => setHighlightedMsgId(null), 2200);
    }
  };

  const handleNextSearchMatch = () => {
    if (matchingMessageIds.length === 0) return;
    const next = (currentMatchIndex + 1) % matchingMessageIds.length;
    setCurrentMatchIndex(next);
    jumpToMessage(matchingMessageIds[next]);
  };

  const handlePrevSearchMatch = () => {
    if (matchingMessageIds.length === 0) return;
    const prev = (currentMatchIndex - 1 + matchingMessageIds.length) % matchingMessageIds.length;
    setCurrentMatchIndex(prev);
    jumpToMessage(matchingMessageIds[prev]);
  };

  const handleLoadOlderMessages = async () => {
    if (!activeConvId || rawMessages.length === 0 || isLoadingOlder || !hasMoreOlder) return;
    setIsLoadingOlder(true);
    try {
      const older = await zaureService.loadOlderMessages(
        activeConvId,
        rawMessages[0].created_at,
        20
      );
      if (older.length === 0) setHasMoreOlder(false);
      else setRawMessages((prev) => [...older, ...prev]);
    } finally {
      setIsLoadingOlder(false);
    }
  };

  // --------------------------------------------------------------------------
  // 5. Typing, Attachments Staging, Recording & Sending
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

  const stageIncomingFile = (file: File) => {
    if (isOtherUserBlocked || dmRestrictedReason) return;
    const validation = validateFileForChat(file);
    if (!validation.valid) {
      setFileValidationError(validation.error || 'Fichier non autorisé.');
      setTimeout(() => setFileValidationError(null), 6000);
      return;
    }
    if (stagedPreviewUrl) URL.revokeObjectURL(stagedPreviewUrl);
    setFileValidationError(null);
    setStagedFile(file);
    setStagedCategory(validation.category);
    setStagedFormattedSize(validation.formattedSize);
    setStagedPreviewUrl(URL.createObjectURL(file));
  };

  const discardStagedFile = () => {
    if (stagedPreviewUrl) URL.revokeObjectURL(stagedPreviewUrl);
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
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) stageIncomingFile(file);
  };

  const startVoiceRecording = async () => {
    if (isOtherUserBlocked || dmRestrictedReason) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedAudioBlob(blob);
        setRecordedAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      showToast('Accès microphone refusé ou indisponible.', 'error');
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

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUser || !activeConvId || isOtherUserBlocked || dmRestrictedReason) return;
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

      if (recordedAudioBlob) {
        setIsUploading(true);
        setUploadingFileName('Note vocale');
        setUploadProgress(15);
        const att = await zaureService.uploadMessageAttachment(
          recordedAudioBlob,
          'audio',
          `voice_${Date.now()}.webm`,
          (pct) => setUploadProgress(pct)
        );
        attachments = [att];
        msgType = 'audio';
        discardRecordedAudio();
      } else if (stagedFile) {
        setIsUploading(true);
        setUploadingFileName(stagedFile.name);
        setUploadProgress(10);
        const folder =
          stagedCategory === 'image'
            ? 'images'
            : stagedCategory === 'video'
              ? 'videos'
              : 'documents';
        msgType =
          stagedCategory === 'image'
            ? 'image'
            : stagedCategory === 'video'
              ? 'video'
              : 'file';
        const att = await zaureService.uploadMessageAttachment(
          stagedFile,
          folder,
          stagedFile.name,
          (pct) => setUploadProgress(pct)
        );
        attachments = [att];
        discardStagedFile();
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
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (err: any) {
      showToast(err?.message || 'Impossible d’envoyer le message.', 'error');
    } finally {
      setIsUploading(false);
      setUploadingFileName('');
      setUploadProgress(0);
    }
  };

  // --------------------------------------------------------------------------
  // 6. Conversation, Group & Safety Actions
  // --------------------------------------------------------------------------
  const handleToggleFavorite = async (convId: string) => {
    const added = await zaureService.toggleFavoriteConversation(convId);
    showToast(added ? 'Conversation ajoutée aux favoris.' : 'Conversation retirée des favoris.');
  };

  const handleTogglePinMessage = async (msg: Message) => {
    if (!activeConvId) return;
    const pinned = await zaureService.togglePinMessage(activeConvId, msg.id, Boolean(msg.is_pinned));
    showToast(pinned ? 'Message épinglé en haut de la discussion.' : 'Message désépinglé.');
  };

  const handleConfirmDeleteConversation = async (mode: 'self' | 'group_permanent') => {
    if (!pendingDeleteConversation) return;
    const targetId = pendingDeleteConversation.id;
    try {
      if (mode === 'group_permanent') {
        await zaureService.deleteGroupConversation(targetId);
        showToast('Groupe supprimé définitivement.');
      } else {
        await zaureService.softDeleteConversationForUser(targetId);
        showToast('Conversation effacée de votre messagerie.');
      }
      if (activeConvId === targetId) {
        selectConversationId(null);
        setMobileView('list');
      }
    } catch {
      showToast('Erreur lors de la suppression.', 'error');
    } finally {
      setPendingDeleteConversation(null);
    }
  };

  const handleToggleBlockUser = async (user: UserProfile) => {
    if (blockedUserIds.includes(user.id)) {
      await zaureService.unblockUser(user.id);
      setBlockedUserIds((prev) => prev.filter((id) => id !== user.id));
      showToast(`${user.nom} a été débloqué.`);
    } else {
      setPendingBlockUser(user);
    }
  };

  const confirmBlockUser = async () => {
    if (!pendingBlockUser) return;
    await zaureService.blockUser(pendingBlockUser.id);
    setBlockedUserIds((prev) => [...prev, pendingBlockUser.id]);
    showToast(`${pendingBlockUser.nom} a été bloqué.`);
    setPendingBlockUser(null);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingUser) return;
    setIsSubmittingReport(true);
    try {
      const res = await zaureService.reportUser({
        targetUserId: reportingUser.id,
        targetUserNom: reportingUser.nom,
        reason: reportReason,
        details: reportDetails
      });
      if (res.success) {
        showToast('Signalement envoyé à la modération Zaure.');
        setReportingUser(null);
        setReportDetails('');
      } else {
        showToast(res.error || 'Erreur lors du signalement.', 'error');
      }
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // WebRTC Call Handlers
  const initiateCall = async (type: 'audio' | 'video') => {
    if (isOtherUserBlocked || dmRestrictedReason) {
      showToast('Impossible de passer un appel pour cette conversation.', 'error');
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
    } catch {
      showToast('Caméra ou microphone indisponible.', 'error');
    }
    setTimeout(() => {
      setCallModal((prev) => ({ ...prev, status: 'connected' }));
      callTimerRef.current = setInterval(() => {
        setCallModal((prev) => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
    }, 1800);
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

  // --------------------------------------------------------------------------
  // 7. Filtering, Search & Badge Counters
  // --------------------------------------------------------------------------
  const filteredConversations = useMemo(() => {
    const list = visibleConversations.filter((c) => {
      const isArch = currentUser ? Boolean(c.is_archived_by?.includes(currentUser.id)) : false;
      if (activeFilter === 'archived') {
        if (!isArch) return false;
      } else {
        if (isArch) return false;
      }

      if (activeFilter === 'unread') {
        const unread = currentUser ? c.unread_counts?.[currentUser.id] || 0 : 0;
        if (unread <= 0) return false;
      }
      if (activeFilter === 'favorites') {
        const isFav = currentUser ? Boolean(c.is_favorite_by?.includes(currentUser.id)) : false;
        if (!isFav) return false;
      }
      if (activeFilter === 'groups' && c.type !== 'group') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const groupMatch = c.group_name?.toLowerCase().includes(q);
        const msgMatch = c.last_message?.content?.toLowerCase().includes(q);
        const participantMatch = Object.values(
          (c.participants || {}) as Record<string, ConversationParticipant>
        ).some((p) => p?.nom?.toLowerCase().includes(q));
        return Boolean(groupMatch || msgMatch || participantMatch);
      }
      return true;
    });

    return list.sort((a, b) => {
      const timeA = new Date(a.last_message?.created_at || a.updated_at || a.created_at).getTime();
      const timeB = new Date(b.last_message?.created_at || b.updated_at || b.created_at).getTime();
      return timeB - timeA;
    });
  }, [visibleConversations, activeFilter, searchQuery, currentUser]);

  const filterCounts = useMemo(() => {
    if (!currentUser) return { all: 0, unread: 0, favorites: 0, groups: 0, archived: 0 };
    let all = 0;
    let unread = 0;
    let favorites = 0;
    let groups = 0;
    let archived = 0;

    visibleConversations.forEach((c) => {
      const isArch = Boolean(c.is_archived_by?.includes(currentUser.id));
      if (isArch) {
        archived += 1;
        return;
      }
      all += 1;
      if ((c.unread_counts?.[currentUser.id] || 0) > 0) unread += 1;
      if (c.is_favorite_by?.includes(currentUser.id)) favorites += 1;
      if (c.type === 'group') groups += 1;
    });

    return { all, unread, favorites, groups, archived };
  }, [visibleConversations, currentUser]);

  const matchedUsersFromSearch = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return availableUsers.filter(
      (u) => u.id !== currentUser?.id && u.nom.toLowerCase().includes(q)
    );
  }, [availableUsers, searchQuery, currentUser]);

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#F0F2F5] text-slate-900">
      {/* Top Bar Zaure Messages */}
      <header
        className={`h-14 sm:h-16 shrink-0 items-center justify-between border-b border-slate-200/90 bg-white px-3 sm:px-5 z-20 ${
          mobileView === 'chat' ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="flex items-center gap-2.5">
          {onExitChat && (
            <button
              type="button"
              onClick={onExitChat}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-slate-100 px-3 text-xs font-bold text-slate-700 hover:bg-slate-200 hover:text-slate-950 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Retour</span>
            </button>
          )}
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-base font-black text-white shadow-xs">
            Z
          </div>
          <div className="leading-none">
            <span className="text-base font-black tracking-tight text-slate-950">
              Zaure <span className="text-blue-600">Messages</span>
            </span>
            <p className="mt-0.5 hidden sm:block text-[10px] font-bold uppercase tracking-wider text-red-600">
              Savoirs du Sahel
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentUser && (
            <div className="hidden sm:flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-1.5 border border-slate-200/70">
              <span className="text-xs font-bold text-slate-800">{currentUser.nom}</span>
              <span
                className={`h-2 w-2 rounded-full ${
                  presenceStatus === 'online'
                    ? 'bg-emerald-500'
                    : presenceStatus === 'busy'
                      ? 'bg-amber-500'
                      : 'bg-slate-400'
                }`}
              />
            </div>
          )}
          {activeConversation && (
            <button
              type="button"
              onClick={() => setShowRightPanel((v) => !v)}
              className="hidden lg:flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              <Info className="h-4 w-4 text-blue-600" />
              <span>{showRightPanel ? 'Masquer détails' : 'Détails'}</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Split Workspace */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div
          className={`${
            mobileView === 'chat' ? 'hidden md:flex' : 'flex w-full md:w-auto'
          } h-full shrink-0`}
        >
          <ConversationSidebar
            currentUser={currentUser}
            conversations={filteredConversations}
            availableUsers={availableUsers}
            activeConvId={activeConvId}
            activeFilter={activeFilter}
            searchQuery={searchQuery}
            presenceStatus={presenceStatus}
            counts={filterCounts}
            matchedUsersFromSearch={matchedUsersFromSearch}
            onFilterChange={setActiveFilter}
            onSearchChange={setSearchQuery}
            onSelectConversation={(convId) => {
              selectConversationId(convId);
              setMobileView('chat');
              setInChatSearchOpen(false);
              setInChatSearchQuery('');
            }}
            onStartDirectChat={handleStartDirectChat}
            onOpenNewChatModal={(tab = 'direct') => {
              setNewChatModalTab(tab);
              setShowNewChatModal(true);
            }}
            onToggleFavorite={handleToggleFavorite}
            onToggleMute={(convId) => zaureService.toggleMuteConversation(convId)}
            onToggleArchive={(convId) => zaureService.toggleArchiveConversation(convId)}
            onRequestDeleteConversation={(conv) => setPendingDeleteConversation(conv)}
            onUpdateAvailability={async (status) => {
              setPresenceStatus(status);
              await zaureService.setUserAvailability(status);
              if (currentUser && onProfileUpdated) {
                onProfileUpdated({ ...currentUser, availability: status });
              }
            }}
          />
        </div>

        <div
          className={`${
            mobileView === 'list' ? 'hidden md:flex' : 'flex'
          } flex-1 min-w-0 h-full`}
        >
          <ChatThread
            currentUser={currentUser}
            activeConversation={activeConversation}
            activeOtherUser={activeOtherUser}
            messages={messages}
            availableUsers={availableUsers}
            isOtherUserTyping={isOtherUserTyping}
            isLoadingOlder={isLoadingOlder}
            hasMoreOlder={hasMoreOlder}
            isGroupAdmin={isGroupAdmin}
            showRightPanel={showRightPanel}
            isDraggingOver={isDraggingOver}
            inChatSearchOpen={inChatSearchOpen}
            inChatSearchQuery={inChatSearchQuery}
            matchingMessageIds={matchingMessageIds}
            currentMatchIndex={currentMatchIndex}
            highlightedMsgId={highlightedMsgId}
            lastReadMessageIdByOther={lastReadMessageIdByOther}
            onBackMobile={() => {
              setMobileView('list');
              if (window.innerWidth < 768) {
                selectConversationId(null);
              }
            }}
            onToggleRightPanel={() => {
              if (window.innerWidth < 1024) setShowMobileDetails(true);
              else setShowRightPanel((v) => !v);
            }}
            onOpenUserProfile={(user) => setViewingUserProfile(user)}
            onStartCall={initiateCall}
            onToggleFavorite={handleToggleFavorite}
            onToggleMute={(convId) => zaureService.toggleMuteConversation(convId)}
            onToggleArchive={(convId) => zaureService.toggleArchiveConversation(convId)}
            onRequestDeleteConversation={(conv) => setPendingDeleteConversation(conv)}
            onOpenEditGroupModal={() => setShowEditGroupModal(true)}
            onOpenManageMembersModal={() => setShowManageMembersModal(true)}
            onToggleInChatSearch={setInChatSearchOpen}
            onInChatSearchQueryChange={(q) => {
              setInChatSearchQuery(q);
              setCurrentMatchIndex(0);
            }}
            onNextSearchMatch={handleNextSearchMatch}
            onPrevSearchMatch={handlePrevSearchMatch}
            onLoadOlderMessages={handleLoadOlderMessages}
            onAddReaction={(msgId, emoji) =>
              activeConvId ? zaureService.addReactionToMessage(activeConvId, msgId, emoji) : Promise.resolve()
            }
            onReplyMessage={(msg) => {
              setReplyingTo(msg);
              setEditingMessage(null);
            }}
            onEditMessage={(msg) => {
              setEditingMessage(msg);
              setReplyingTo(null);
              setInputText(msg.content);
            }}
            onDeleteMessage={(msgId) => setPendingDeleteMessageId(msgId)}
            onTogglePinMessage={handleTogglePinMessage}
            onCopyMessage={(text) => {
              navigator.clipboard?.writeText(text).then(() => {
                showToast('Message copié.');
              });
            }}
            onOpenImageLightbox={(url) => setLightboxImageUrl(url)}
            onOpenNewChatModal={() => {
              setNewChatModalTab('direct');
              setShowNewChatModal(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!isDraggingOver && !isOtherUserBlocked) setIsDraggingOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
              setIsDraggingOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDraggingOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) stageIncomingFile(file);
            }}
            messagesEndRef={messagesEndRef}
            composerNode={
              <MessageComposer
                inputText={inputText}
                replyingTo={replyingTo}
                editingMessage={editingMessage}
                isEmojiPickerOpen={isEmojiPickerOpen}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
                uploadingFileName={uploadingFileName}
                isRecording={isRecording}
                recordingSeconds={recordingSeconds}
                recordedAudioUrl={recordedAudioUrl}
                hasRecordedAudio={Boolean(recordedAudioBlob)}
                stagedFile={stagedFile}
                stagedPreviewUrl={stagedPreviewUrl}
                stagedCategory={stagedCategory}
                stagedFormattedSize={stagedFormattedSize}
                fileValidationError={fileValidationError}
                isOtherUserBlocked={isOtherUserBlocked}
                dmRestrictedReason={dmRestrictedReason}
                fileInputRef={fileInputRef}
                onInputChange={handleInputChange}
                onSendMessage={handleSendMessage}
                onCancelReply={() => setReplyingTo(null)}
                onCancelEdit={() => {
                  setEditingMessage(null);
                  setInputText('');
                }}
                onToggleEmojiPicker={() => setIsEmojiPickerOpen((v) => !v)}
                onInsertEmoji={(emoji) => setInputText((prev) => prev + emoji)}
                onOpenFilePicker={openFilePicker}
                onFileSelect={handleFileSelect}
                onDiscardStagedFile={discardStagedFile}
                onStartRecording={startVoiceRecording}
                onStopRecording={stopVoiceRecording}
                onDiscardRecordedAudio={discardRecordedAudio}
                onUnblockUser={() => activeOtherUser && handleToggleBlockUser(activeOtherUser)}
              />
            }
          />
        </div>

        {/* Desktop Details Drawer */}
        {showRightPanel && activeConversation && (
          <ChatDetailsPanel
            currentUser={currentUser}
            activeConversation={activeConversation}
            activeOtherUser={activeOtherUser}
            availableUsers={availableUsers}
            messages={messages}
            isOtherUserBlocked={isOtherUserBlocked}
            isGroupAdmin={isGroupAdmin}
            onClose={() => setShowRightPanel(false)}
            onToggleFavorite={handleToggleFavorite}
            onToggleMute={(convId) => zaureService.toggleMuteConversation(convId)}
            onToggleArchive={(convId) => zaureService.toggleArchiveConversation(convId)}
            onToggleBlockUser={handleToggleBlockUser}
            onReportUser={(u) => setReportingUser(u)}
            onStartDirectChat={handleStartDirectChat}
            onOpenUserProfile={(u) => setViewingUserProfile(u)}
            onOpenImageLightbox={(url) => setLightboxImageUrl(url)}
            onOpenEditGroupModal={() => setShowEditGroupModal(true)}
            onOpenManageMembersModal={() => setShowManageMembersModal(true)}
            onLeaveGroup={async () => {
              if (!currentUser || !activeConversation) return;
              await zaureService.removeGroupMember(
                activeConversation.id,
                currentUser.id,
                currentUser.nom
              );
              selectConversationId(null);
              setMobileView('list');
              showToast('Vous avez quitté le groupe.');
            }}
            onRequestDeleteConversation={(conv) => setPendingDeleteConversation(conv)}
          />
        )}
      </div>

      {/* Mobile Details Sheet */}
      {showMobileDetails && activeConversation && (
        <ChatDetailsPanel
          isOpenMobileModal
          currentUser={currentUser}
          activeConversation={activeConversation}
          activeOtherUser={activeOtherUser}
          availableUsers={availableUsers}
          messages={messages}
          isOtherUserBlocked={isOtherUserBlocked}
          isGroupAdmin={isGroupAdmin}
          onClose={() => setShowMobileDetails(false)}
          onToggleFavorite={handleToggleFavorite}
          onToggleMute={(convId) => zaureService.toggleMuteConversation(convId)}
          onToggleArchive={(convId) => zaureService.toggleArchiveConversation(convId)}
          onToggleBlockUser={handleToggleBlockUser}
          onReportUser={(u) => {
            setShowMobileDetails(false);
            setReportingUser(u);
          }}
          onStartDirectChat={(u) => {
            setShowMobileDetails(false);
            handleStartDirectChat(u);
          }}
          onOpenUserProfile={(u) => {
            setShowMobileDetails(false);
            setViewingUserProfile(u);
          }}
          onOpenImageLightbox={(url) => {
            setShowMobileDetails(false);
            setLightboxImageUrl(url);
          }}
          onOpenEditGroupModal={() => {
            setShowMobileDetails(false);
            setShowEditGroupModal(true);
          }}
          onOpenManageMembersModal={() => {
            setShowMobileDetails(false);
            setShowManageMembersModal(true);
          }}
          onLeaveGroup={async () => {
            if (!currentUser || !activeConversation) return;
            await zaureService.removeGroupMember(
              activeConversation.id,
              currentUser.id,
              currentUser.nom
            );
            setShowMobileDetails(false);
            selectConversationId(null);
            setMobileView('list');
            showToast('Vous avez quitté le groupe.');
          }}
          onRequestDeleteConversation={(conv) => {
            setShowMobileDetails(false);
            setPendingDeleteConversation(conv);
          }}
        />
      )}

      {/* Modals */}
      <NewChatModal
        isOpen={showNewChatModal}
        initialTab={newChatModalTab}
        currentUser={currentUser}
        availableUsers={availableUsers}
        onClose={() => setShowNewChatModal(false)}
        onStartDirectChat={handleStartDirectChat}
        onCreateGroup={async ({ groupName, groupDescription, memberIds }) => {
          const newGroup = await zaureService.createGroupConversation({
            groupName,
            groupDescription,
            memberIds,
            allUsers: availableUsers
          });
          selectConversationId(newGroup.id);
          setMobileView('chat');
          showToast(`Groupe « ${newGroup.group_name} » créé.`);
        }}
      />

      <EditGroupModal
        isOpen={showEditGroupModal}
        conversation={activeConversation}
        onClose={() => setShowEditGroupModal(false)}
        onSave={async (updates) => {
          if (!activeConversation) return;
          await zaureService.updateGroupDetails(activeConversation.id, updates);
          showToast('Informations du groupe mises à jour.');
        }}
      />

      <ManageGroupMembersModal
        isOpen={showManageMembersModal}
        conversation={activeConversation}
        currentUser={currentUser}
        availableUsers={availableUsers}
        isGroupAdmin={isGroupAdmin}
        onClose={() => setShowManageMembersModal(false)}
        onAddMember={async (user) => {
          if (!activeConversation) return;
          await zaureService.addGroupMember(activeConversation.id, user);
          showToast(`${user.nom} a été ajouté au groupe.`);
        }}
        onRemoveMember={async (userId, name) => {
          if (!activeConversation) return;
          await zaureService.removeGroupMember(activeConversation.id, userId, name);
          showToast(`${name} a été retiré du groupe.`);
        }}
        onToggleAdmin={async (userId, makeAdmin, name) => {
          if (!activeConversation) return;
          await zaureService.toggleGroupAdmin(activeConversation.id, userId, makeAdmin, name);
          showToast(
            makeAdmin ? `${name} est maintenant administrateur.` : `${name} n'est plus administrateur.`
          );
        }}
        onLeaveGroup={async () => {
          if (!activeConversation || !currentUser) return;
          await zaureService.removeGroupMember(
            activeConversation.id,
            currentUser.id,
            currentUser.nom
          );
          selectConversationId(null);
          setMobileView('list');
          showToast('Vous avez quitté le groupe.');
        }}
      />

      <UserProfileModal
        user={viewingUserProfile}
        isBlocked={viewingUserProfile ? blockedUserIds.includes(viewingUserProfile.id) : false}
        onClose={() => setViewingUserProfile(null)}
        onStartDirectChat={handleStartDirectChat}
        onToggleBlock={handleToggleBlockUser}
        onReport={(u) => setReportingUser(u)}
      />

      <ReportModal
        user={reportingUser}
        reason={reportReason}
        details={reportDetails}
        isSubmitting={isSubmittingReport}
        onReasonChange={setReportReason}
        onDetailsChange={setReportDetails}
        onClose={() => setReportingUser(null)}
        onSubmit={handleSubmitReport}
      />

      <CallOverlayModal
        callModal={callModal}
        title={activeOtherUser?.nom || activeConversation?.group_name || 'Zaure'}
        localVideoRef={localVideoRef}
        onToggleMute={toggleCallMute}
        onToggleVideo={toggleCallVideo}
        onEndCall={endCall}
      />

      <ImageLightboxModal
        imageUrl={lightboxImageUrl}
        onClose={() => setLightboxImageUrl(null)}
      />

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={Boolean(pendingBlockUser)}
        title={`Bloquer ${pendingBlockUser?.nom || ''} ?`}
        description="Vous ne pourrez plus échanger de messages privés avec ce membre tant qu'il restera bloqué."
        confirmLabel="Bloquer"
        onConfirm={confirmBlockUser}
        onCancel={() => setPendingBlockUser(null)}
      />

      <ConfirmDialog
        isOpen={Boolean(pendingDeleteMessageId)}
        title="Supprimer ce message ?"
        description="Ce message sera supprimé pour tous les participants de la discussion."
        confirmLabel="Supprimer"
        onConfirm={async () => {
          if (activeConvId && pendingDeleteMessageId) {
            await zaureService.deleteChatMessage(activeConvId, pendingDeleteMessageId);
            showToast('Message supprimé.');
          }
          setPendingDeleteMessageId(null);
        }}
        onCancel={() => setPendingDeleteMessageId(null)}
      />

      <ConfirmDialog
        isOpen={Boolean(pendingDeleteConversation)}
        title="Supprimer cette conversation ?"
        description={
          pendingDeleteConversation?.type === 'group' &&
          currentUser &&
          pendingDeleteConversation.admin_ids?.includes(currentUser.id)
            ? 'Vous pouvez masquer cette conversation pour vous ou supprimer définitivement le groupe pour tous.'
            : 'Cette conversation sera effacée de votre liste et son historique précédent sera masqué pour vous.'
        }
        confirmLabel="Effacer pour moi"
        secondaryLabel={
          pendingDeleteConversation?.type === 'group' &&
          currentUser &&
          pendingDeleteConversation.admin_ids?.includes(currentUser.id)
            ? 'Supprimer le groupe pour tous'
            : undefined
        }
        onConfirm={() => handleConfirmDeleteConversation('self')}
        onSecondary={() => handleConfirmDeleteConversation('group_permanent')}
        onCancel={() => setPendingDeleteConversation(null)}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-2xl px-4 py-3 text-xs font-bold text-white shadow-xl animate-slideUp ${
            toast.tone === 'error' ? 'bg-red-600' : 'bg-slate-900'
          }`}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{toast.text}</span>
          <button type="button" onClick={() => setToast(null)} className="ml-1 opacity-75 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
