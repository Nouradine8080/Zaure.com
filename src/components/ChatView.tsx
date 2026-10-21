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
  Filter
} from 'lucide-react';
import {
  UserProfile,
  Conversation,
  Message,
  MessageAttachment,
  MessageReplyInfo
} from '../types';
import { zaureService } from '../firebaseClient';
import { useTranslation } from '../context/LanguageContext';

interface ChatViewProps {
  currentUser: UserProfile | null;
  initialSelectedUser?: UserProfile | null;
}

// Popular reaction emojis
const QUICK_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏', '🔥'];

export default function ChatView({ currentUser, initialSelectedUser = null }: ChatViewProps) {
  const { t } = useTranslation();

  // State: Data
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);

  // State: UI & Navigation
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'groups' | 'archived'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [presenceStatus, setPresenceStatus] = useState<'online' | 'busy' | 'offline'>('online');

  // State: Message Composer
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  // State: Media Upload & Audio Recording
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);

  // State: Modals
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // --------------------------------------------------------------------------
  // 1. Load users & listen to conversations
  // --------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;
    zaureService.getAvailableUsers().then((users) => {
      if (!isMounted) return;
      setAvailableUsers(users);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = zaureService.subscribeUserConversations(currentUser.id, (convs) => {
      setConversations(convs);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser?.id]);

  // Handle initial selected user from mentor/profile clicks
  useEffect(() => {
    if (!initialSelectedUser || !currentUser) return;
    const directConvId = zaureService.getConversationId(currentUser.id, initialSelectedUser.id);
    setActiveConvId(directConvId);
    setMobileView('chat');
  }, [initialSelectedUser, currentUser]);

  // If no conversation selected on wide screens, auto-select first one if available
  useEffect(() => {
    if (!activeConvId && conversations.length > 0 && window.innerWidth >= 768) {
      setActiveConvId(conversations[0].id);
    }
  }, [conversations, activeConvId]);

  // Active conversation object
  const activeConversation = useMemo(() => {
    if (!activeConvId) return null;
    const found = conversations.find((c) => c.id === activeConvId);
    if (found) return found;

    // Direct chat optimistic draft
    if (initialSelectedUser && currentUser) {
      const draftConvId = zaureService.getConversationId(currentUser.id, initialSelectedUser.id);
      if (activeConvId === draftConvId) {
        return {
          id: draftConvId,
          type: 'direct' as const,
          participant_ids: [currentUser.id, initialSelectedUser.id],
          participants: {
            [currentUser.id]: {
              id: currentUser.id,
              nom: currentUser.nom,
              avatar_url: currentUser.avatar_url,
              role: currentUser.role
            },
            [initialSelectedUser.id]: {
              id: initialSelectedUser.id,
              nom: initialSelectedUser.nom,
              avatar_url: initialSelectedUser.avatar_url,
              role: initialSelectedUser.role
            }
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
    }
    return null;
  }, [activeConvId, conversations, initialSelectedUser, currentUser]);

  // Active other user (for 1-on-1 direct conversations)
  const activeOtherUser = useMemo<UserProfile | null>(() => {
    if (!activeConversation || !currentUser) return null;
    if (activeConversation.type === 'group') return null;

    const otherId = activeConversation.participant_ids.find((id) => id !== currentUser.id);
    if (!otherId) return null;

    const fromAll = availableUsers.find((u) => u.id === otherId);
    if (fromAll) return fromAll;

    const pMeta = activeConversation.participants?.[otherId];
    if (pMeta) {
      return {
        id: otherId,
        nom: pMeta.nom || 'Membre Zaure',
        avatar_url: pMeta.avatar_url || null,
        email: '',
        bio: null,
        role: (pMeta.role as any) || 'utilisateur',
        langue_preferee: 'fr'
      };
    }
    return null;
  }, [activeConversation, currentUser, availableUsers]);

  // --------------------------------------------------------------------------
  // 2. Subscribe to messages of active conversation
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }

    const unsubscribe = zaureService.subscribeConversationMessages(activeConvId, (newMsgs) => {
      setMessages(newMsgs);
      // Mark as read
      zaureService.markConversationAsRead(activeConvId);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [activeConvId]);

  // Auto-scroll to bottom
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom('auto');
  }, [messages.length, activeConvId]);

  // --------------------------------------------------------------------------
  // 3. Typing indicator management
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
  // 4. Send Message (Text, Attachments, Reply)
  // --------------------------------------------------------------------------
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUser || !activeConvId) return;

    const trimmed = inputText.trim();
    if (!trimmed && !recordedAudioBlob) return;

    try {
      if (editingMessage) {
        await zaureService.editChatMessage(activeConvId, editingMessage.id, trimmed);
        setEditingMessage(null);
        setInputText('');
        return;
      }

      let attachments: MessageAttachment[] = [];
      let msgType: 'texte' | 'audio' = 'texte';

      // If sending a voice note recorded inline
      if (recordedAudioBlob) {
        setIsUploading(true);
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
        content: trimmed || (msgType === 'audio' ? 'Note vocale' : ''),
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
    }
  };

  // --------------------------------------------------------------------------
  // 5. File Attachment Upload (Photos, Videos, PDFs)
  // --------------------------------------------------------------------------
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser || !activeConvId) return;

    try {
      setIsUploading(true);
      setUploadProgress(10);

      let folder: 'images' | 'videos' | 'documents' = 'documents';
      let type: 'image' | 'video' | 'file' = 'file';

      if (file.type.startsWith('image/')) {
        folder = 'images';
        type = 'image';
      } else if (file.type.startsWith('video/')) {
        folder = 'videos';
        type = 'video';
      }

      const attachment = await zaureService.uploadMessageAttachment(
        file,
        folder,
        file.name,
        (progress) => setUploadProgress(progress)
      );

      await zaureService.sendChatMessage({
        conversationId: activeConvId,
        receiverId: activeOtherUser?.id,
        content: file.name,
        type,
        attachments: [attachment],
        replyTo: replyingTo
          ? {
              id: replyingTo.id,
              content: replyingTo.content,
              sender_nom: replyingTo.sender_nom || 'Membre',
              type: replyingTo.type
            }
          : null,
        otherUser: activeOtherUser
      });

      setReplyingTo(null);
      scrollToBottom();
    } catch (err) {
      console.error('Erreur téléversement fichier:', err);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // --------------------------------------------------------------------------
  // 6. Inline Voice Note Recorder (MediaRecorder API)
  // --------------------------------------------------------------------------
  const startVoiceRecording = async () => {
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

  // --------------------------------------------------------------------------
  // 7. Message Interactions (Reactions, Reply, Edit, Delete)
  // --------------------------------------------------------------------------
  const handleAddReaction = async (messageId: string, emoji: string) => {
    if (!activeConvId) return;
    await zaureService.addReactionToMessage(activeConvId, messageId, emoji);
    setHoveredMessageId(null);
  };

  const handleStartReply = (msg: Message) => {
    setReplyingTo(msg);
    setEditingMessage(null);
  };

  const handleStartEdit = (msg: Message) => {
    setEditingMessage(msg);
    setReplyingTo(null);
    setInputText(msg.content);
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!activeConvId) return;
    if (window.confirm('Voulez-vous vraiment supprimer ce message pour tout le monde ?')) {
      await zaureService.deleteChatMessage(activeConvId, messageId);
    }
  };

  // --------------------------------------------------------------------------
  // 8. Group Creation
  // --------------------------------------------------------------------------
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
  // 9. WebRTC Audio & Video Calls
  // --------------------------------------------------------------------------
  const initiateCall = async (type: 'audio' | 'video') => {
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

    // Connect after 2 seconds to simulate peer answer
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

  // Format seconds to mm:ss
  const formatCallTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  // --------------------------------------------------------------------------
  // 10. Filtered Conversations
  // --------------------------------------------------------------------------
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      // 1. Tab filters
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

      // 2. Search query filter
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
  }, [conversations, activeFilter, searchQuery, currentUser]);

  // Shared media list in current chat
  const sharedMediaMessages = useMemo(() => {
    return messages.filter(
      (m) => m.attachments && m.attachments.length > 0 && !m.is_deleted
    );
  }, [messages]);

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------
  return (
    <div className="relative flex h-[calc(100vh-5.5rem)] min-h-[600px] w-full overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
      {/* ==================================================================== */}
      {/* 1. PANNEAU GAUCHE : LISTE DES CONVERSATIONS & RECHERCHE              */}
      {/* ==================================================================== */}
      <div
        className={`flex h-full w-full flex-col border-r border-slate-200/80 bg-slate-50/70 transition-all duration-300 md:w-80 lg:w-96 dark:border-slate-800 dark:bg-slate-900/60 ${
          mobileView === 'chat' ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* En-tête Discussions */}
        <div className="flex flex-col gap-3 p-4 border-b border-slate-200/70 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold shadow-md shadow-blue-500/20">
                  {currentUser?.avatar_url ? (
                    <img
                      src={currentUser.avatar_url}
                      alt={currentUser.nom}
                      className="h-full w-full rounded-2xl object-cover"
                    />
                  ) : (
                    <span>{currentUser?.nom?.charAt(0).toUpperCase() || 'Z'}</span>
                  )}
                </div>
                {/* Indicateur de disponibilité */}
                <button
                  onClick={() =>
                    setPresenceStatus((prev) =>
                      prev === 'online' ? 'busy' : prev === 'busy' ? 'offline' : 'online'
                    )
                  }
                  title={`Statut: ${presenceStatus}`}
                  aria-label={`Statut: ${presenceStatus}`}
                  className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-slate-900 transition-colors ${
                    presenceStatus === 'online'
                      ? 'bg-emerald-500'
                      : presenceStatus === 'busy'
                      ? 'bg-amber-500'
                      : 'bg-slate-400'
                  }`}
                />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Discussions
                </h2>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {presenceStatus === 'online'
                    ? '🟢 En ligne'
                    : presenceStatus === 'busy'
                    ? '🟠 Occupé'
                    : '⚪ Invisible'}
                </span>
              </div>
            </div>

            {/* Bouton Nouvelle Discussion / Groupe */}
            <button
              onClick={() => {
                setShowNewChatModal(true);
                setNewChatTab('direct');
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 active:scale-95"
              title="Nouvelle discussion ou groupe"
              aria-label="Nouvelle discussion ou groupe"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>

          {/* Barre de Recherche */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher sur Messenger Zaure..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Effacer la recherche"
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filtres de conversations (Tous, Non lus, Groupes, Archivés) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setActiveFilter('all')}
              className={`rounded-full px-3 py-1 font-medium transition ${
                activeFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-200/70 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setActiveFilter('unread')}
              className={`rounded-full px-3 py-1 font-medium transition ${
                activeFilter === 'unread'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-200/70 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              Non lus
            </button>
            <button
              onClick={() => setActiveFilter('groups')}
              className={`rounded-full px-3 py-1 font-medium transition ${
                activeFilter === 'groups'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-200/70 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              Groupes
            </button>
            <button
              onClick={() => setActiveFilter('archived')}
              className={`rounded-full px-3 py-1 font-medium transition ${
                activeFilter === 'archived'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-200/70 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              Archivés
            </button>
          </div>
        </div>

        {/* Carousel de contacts rapides (Démarrer une conversation en 1 clic) */}
        <div className="border-b border-slate-200/70 p-3 dark:border-slate-800">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Contacts en ligne
          </p>
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            {availableUsers
              .filter((u) => u.id !== currentUser?.id)
              .slice(0, 10)
              .map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    if (!currentUser) return;
                    const convId = zaureService.getConversationId(currentUser.id, u.id);
                    setActiveConvId(convId);
                    setMobileView('chat');
                  }}
                  className="flex flex-col items-center gap-1 group flex-shrink-0"
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
              ))}
          </div>
        </div>

        {/* Liste des conversations défilable */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <MessageSquare className="mb-2 h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium">Aucune conversation trouvée</p>
              <p className="text-xs text-slate-400">
                Cliquez sur le bouton + pour démarrer un nouvel échange.
              </p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isGroup = conv.type === 'group';
              const isSelected = activeConvId === conv.id;
              const unreadCount = currentUser ? conv.unread_counts?.[currentUser.id] || 0 : 0;
              const isMuted = currentUser ? conv.is_muted_by?.includes(currentUser.id) : false;

              // Display details
              let title = conv.group_name || 'Discussion de groupe';
              let avatar = conv.group_photo;

              if (!isGroup && currentUser) {
                const otherUid = conv.participant_ids.find((id) => id !== currentUser.id);
                const participant = otherUid ? conv.participants?.[otherUid] : null;
                title = participant?.nom || 'Membre Zaure';
                avatar = participant?.avatar_url || '';
              }

              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    setActiveConvId(conv.id);
                    setMobileView('chat');
                  }}
                  className={`group relative flex cursor-pointer items-center gap-3 p-3 transition hover:bg-slate-100/80 dark:hover:bg-slate-800/50 ${
                    isSelected
                      ? 'bg-blue-50/80 dark:bg-blue-950/40 border-l-4 border-blue-600'
                      : ''
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-slate-200 to-slate-300 font-bold text-slate-700 dark:from-slate-700 dark:to-slate-800 dark:text-slate-200">
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
                    {!isGroup && (
                      <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
                    )}
                  </div>

                  {/* Info principale */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h3
                        className={`truncate text-sm font-semibold ${
                          unreadCount > 0
                            ? 'text-slate-900 dark:text-white font-bold'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {title}
                      </h3>
                      {conv.last_message && (
                        <span className="text-[11px] text-slate-400 flex-shrink-0 ml-1">
                          {new Date(conv.last_message.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <p
                        className={`truncate text-xs ${
                          unreadCount > 0
                            ? 'font-semibold text-blue-600 dark:text-blue-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {conv.last_message
                          ? `${
                              conv.last_message.sender_id === currentUser?.id ? 'Vous: ' : ''
                            }${conv.last_message.content}`
                          : 'Nouvelle conversation'}
                      </p>

                      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                        {isMuted && <BellOff className="h-3.5 w-3.5 text-slate-400" />}
                        {unreadCount > 0 && (
                          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-bold text-white shadow-xs">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. ZONE CENTRALE : DISCUSSION EN COURS & BULLES MESSENGER            */}
      {/* ==================================================================== */}
      <div
        className={`flex h-full flex-1 flex-col bg-slate-50/30 dark:bg-slate-950 ${
          mobileView === 'list' ? 'hidden md:flex' : 'flex'
        }`}
      >
        {activeConversation ? (
          <>
            {/* Top Bar de la Discussion */}
            <div className="flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
              <div className="flex items-center gap-3">
                {/* Bouton retour mobile */}
                <button
                  onClick={() => setMobileView('list')}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 md:hidden dark:bg-slate-800 dark:text-slate-300"
                  aria-label="Retour à la liste"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                {/* Avatar du contact/groupe */}
                <div className="relative">
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

                {/* Nom et statut en direct */}
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {activeConversation.type === 'group'
                      ? activeConversation.group_name
                      : activeOtherUser?.nom || 'Membre Zaure'}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    {isOtherUserTyping ? (
                      <span className="font-medium text-blue-600 animate-pulse dark:text-blue-400">
                        écrit...
                      </span>
                    ) : activeConversation.type === 'group' ? (
                      <span>{activeConversation.participant_ids.length} membres</span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        En ligne actuellement
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Boutons d'action (Appels WebRTC & Panneau Info) */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => initiateCall('audio')}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition dark:text-slate-300 dark:hover:bg-slate-800"
                  title="Démarrer un appel vocal"
                  aria-label="Appel vocal"
                >
                  <Phone className="h-4 w-4" />
                </button>
                <button
                  onClick={() => initiateCall('video')}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition dark:text-slate-300 dark:hover:bg-slate-800"
                  title="Démarrer un appel vidéo"
                  aria-label="Appel vidéo"
                >
                  <Video className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setShowRightPanel((prev) => !prev)}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                    showRightPanel
                      ? 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                  title="Informations du contact ou groupe"
                  aria-label="Informations"
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Zone de défilement des messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                  <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                    <Sparkles className="h-8 w-8" />
                  </div>
                  <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                    Débutez votre conversation
                  </h4>
                  <p className="max-w-xs text-xs text-slate-500">
                    Envoyez un premier message, une note vocale ou partagez des documents médicaux et académiques.
                  </p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isMe = msg.sender_id === currentUser?.id;
                  const isHovered = hoveredMessageId === msg.id;

                  // System message (e.g., group created)
                  if (msg.type === 'system') {
                    return (
                      <div key={msg.id} className="my-2 flex justify-center">
                        <span className="rounded-full bg-slate-200/80 px-3 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          {msg.content}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      onMouseEnter={() => setHoveredMessageId(msg.id)}
                      onMouseLeave={() => setHoveredMessageId(null)}
                      className={`relative flex items-end gap-2 group ${
                        isMe ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {/* Avatar de l'interlocuteur (à gauche) */}
                      {!isMe && (
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200 mb-1">
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

                      {/* Barre d'action au survol (Réactions, Répondre, Modifier, Supprimer) */}
                      {isHovered && !msg.is_deleted && (
                        <div
                          className={`absolute -top-9 z-10 flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 px-2 py-1 shadow-lg backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/95 ${
                            isMe ? 'right-4' : 'left-10'
                          }`}
                        >
                          {/* Quick Emoji Reactions */}
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
                          {/* Répondre */}
                          <button
                            onClick={() => handleStartReply(msg)}
                            className="p-1 text-slate-500 hover:text-blue-600"
                            title="Répondre"
                            aria-label="Répondre"
                          >
                            <Smile className="h-3.5 w-3.5" />
                          </button>
                          {/* Modifier (pour soi-même si texte) */}
                          {isMe && msg.type === 'texte' && (
                            <button
                              onClick={() => handleStartEdit(msg)}
                              className="p-1 text-slate-500 hover:text-blue-600"
                              title="Modifier"
                              aria-label="Modifier"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {/* Supprimer (pour soi-même) */}
                          {isMe && (
                            <button
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="p-1 text-slate-500 hover:text-red-500"
                              title="Supprimer"
                              aria-label="Supprimer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Bulle de message principale */}
                      <div className="flex flex-col max-w-[85%] md:max-w-[70%]">
                        {/* En-tête de groupe : Nom de l'expéditeur */}
                        {activeConversation.type === 'group' && !isMe && (
                          <span className="mb-0.5 ml-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            {msg.sender_nom}
                          </span>
                        )}

                        {/* Citation de réponse (reply quote) */}
                        {msg.reply_to && (
                          <div
                            className={`mb-1 rounded-xl p-2 text-xs border-l-2 ${
                              isMe
                                ? 'bg-blue-700/60 text-blue-100 border-white'
                                : 'bg-slate-200/80 text-slate-700 border-blue-500 dark:bg-slate-800 dark:text-slate-300'
                            }`}
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
                          {/* Contenu du message */}
                          {msg.is_deleted ? (
                            <p className="italic text-xs opacity-75">
                              🚫 Ce message a été supprimé
                            </p>
                          ) : (
                            <>
                              {/* 1. Affichage des Pièces Jointes */}
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
                                        <div
                                          key={attIdx}
                                          className={`flex items-center gap-2 rounded-2xl p-2.5 ${
                                            isMe
                                              ? 'bg-blue-700/60 text-white'
                                              : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                                          }`}
                                        >
                                          <audio src={att.url} controls className="h-8 w-56" />
                                        </div>
                                      );
                                    }

                                    // Document / PDF
                                    return (
                                      <a
                                        key={attIdx}
                                        href={att.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`flex items-center gap-2.5 rounded-2xl p-2.5 transition ${
                                          isMe
                                            ? 'bg-blue-700/60 hover:bg-blue-700 text-white'
                                            : 'bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200'
                                        }`}
                                      >
                                        <FileText className="h-6 w-6 flex-shrink-0" />
                                        <div className="flex-1 min-w-0 text-left">
                                          <p className="truncate text-xs font-semibold">
                                            {att.name}
                                          </p>
                                          <span className="text-[10px] opacity-75">
                                            {att.size
                                              ? `${(att.size / 1024).toFixed(1)} Ko`
                                              : 'Document'}
                                          </span>
                                        </div>
                                        <Download className="h-4 w-4" />
                                      </a>
                                    );
                                  })}
                                </div>
                              )}

                              {/* 2. Texte principal */}
                              {msg.content && msg.type !== 'audio' && (
                                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                                  {msg.content}
                                </p>
                              )}

                              {/* Indication message modifié */}
                              {msg.is_edited && (
                                <span className="ml-1 text-[10px] opacity-70">(modifié)</span>
                              )}
                            </>
                          )}

                          {/* Horodatage & Statut d'envoi */}
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
                                  <CheckCheck className="h-3.5 w-3.5 text-blue-200" />
                                ) : (
                                  <Check className="h-3.5 w-3.5 opacity-80" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Badges de Réactions Émojis */}
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
                  );
                })
              )}

              {/* Indicateur de saisie en temps réel */}
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

            {/* Barre de Progression de Téléversement */}
            {isUploading && (
              <div className="bg-blue-50 px-4 py-1.5 border-t border-blue-100 flex items-center justify-between text-xs text-blue-700 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-300">
                <span>Téléversement du fichier vers Firebase Storage...</span>
                <span className="font-bold">{uploadProgress}%</span>
              </div>
            )}

            {/* Aperçu Réponse en cours (Reply Banner) */}
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
                  aria-label="Annuler la réponse"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Aperçu Modification en cours (Edit Banner) */}
            {editingMessage && (
              <div className="flex items-center justify-between border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                <span className="font-bold">Modification du message en cours...</span>
                <button
                  onClick={() => {
                    setEditingMessage(null);
                    setInputText('');
                  }}
                  className="rounded-lg p-1 text-amber-600 hover:text-amber-900"
                  aria-label="Annuler la modification"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Barre d'Enregistrement Vocal Actif */}
            {isRecording ? (
              <div className="flex items-center justify-between border-t border-red-200 bg-red-50/90 px-4 py-3 dark:border-red-900/60 dark:bg-red-950/40">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full bg-red-600 animate-ping" />
                  <span className="text-sm font-semibold text-red-700 dark:text-red-400">
                    Enregistrement de la note vocale : {formatCallTime(recordingSeconds)}
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
              /* Pré-écoute de la note vocale enregistrée avant envoi */
              <div className="flex items-center justify-between border-t border-slate-200 bg-blue-50/80 px-4 py-3 dark:border-slate-800 dark:bg-blue-950/40">
                <div className="flex items-center gap-3">
                  <audio src={recordedAudioUrl || ''} controls className="h-9 w-60" />
                  <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                    Prêt à envoyer
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={discardRecordedAudio}
                    className="rounded-xl p-2 text-slate-500 hover:text-red-500"
                    title="Supprimer la note vocale"
                    aria-label="Supprimer la note vocale"
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

            {/* Barre de saisie inférieure (Messenger Dock) */}
            <form
              onSubmit={handleSendMessage}
              className="flex items-center gap-2 border-t border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
            >
              {/* Bouton Pièce jointe (Fichier / Image / Vidéo) */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,application/pdf,.doc,.docx"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-slate-500 hover:bg-slate-100 hover:text-blue-600 transition dark:text-slate-400 dark:hover:bg-slate-800"
                title="Joindre une photo, vidéo ou document"
                aria-label="Joindre un fichier"
              >
                <Paperclip className="h-5 w-5" />
              </button>

              {/* Bouton Micro Enregistreur Vocal */}
              <button
                type="button"
                onClick={startVoiceRecording}
                disabled={isRecording || isUploading}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-slate-500 hover:bg-slate-100 hover:text-blue-600 transition dark:text-slate-400 dark:hover:bg-slate-800"
                title="Enregistrer un message vocal"
                aria-label="Enregistrer un message vocal"
              >
                <Mic className="h-5 w-5" />
              </button>

              {/* Champ de texte avec gestion de la touche Entrée */}
              <div className="relative flex-1">
                <textarea
                  rows={1}
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Écrivez un message..."
                  className="max-h-28 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50/70 py-2.5 pl-4 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />

                {/* Popover Émojis */}
                <button
                  type="button"
                  onClick={() => setIsEmojiPickerOpen((prev) => !prev)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title="Insérer un émoji"
                  aria-label="Insérer un émoji"
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

              {/* Bouton Envoyer */}
              <button
                type="submit"
                disabled={(!inputText.trim() && !recordedAudioBlob) || isUploading}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 transition hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 active:scale-95"
                title="Envoyer le message"
                aria-label="Envoyer"
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
              Sélectionnez une conversation
            </h3>
            <p className="max-w-sm text-sm text-slate-500">
              Choisissez un correspondant dans la liste ou démarrez une nouvelle discussion pour commencer à échanger.
            </p>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* 3. PANNEAU DROIT : DÉTAILS DU CONTACT & GALERIE DE MÉDIAS            */}
      {/* ==================================================================== */}
      {showRightPanel && activeConversation && (
        <div className="hidden h-full w-80 flex-col border-l border-slate-200/80 bg-slate-50/40 p-4 overflow-y-auto lg:flex dark:border-slate-800 dark:bg-slate-900/50">
          {/* Avatar & Identité */}
          <div className="flex flex-col items-center text-center pb-4 border-b border-slate-200/80 dark:border-slate-800">
            <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-2xl font-bold text-white shadow-lg">
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

            {/* Courte biographie */}
            {(activeOtherUser?.bio || activeConversation.group_description) && (
              <p className="mt-2 text-xs text-slate-500 italic max-w-xs">
                "{activeConversation.group_description || activeOtherUser?.bio}"
              </p>
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
            <button
              onClick={() => alert("Ce membre a été signalé à l'équipe de modération de Zaure.")}
              className="flex flex-col items-center gap-1 text-xs hover:text-red-600 transition"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white shadow-xs dark:bg-slate-800">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <span>Signaler</span>
            </button>
          </div>

          {/* Liste des membres du groupe (si groupe) */}
          {activeConversation.type === 'group' && (
            <div className="py-4 border-b border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Membres ({activeConversation.participant_ids.length})
                </span>
              </div>
              <div className="space-y-2">
                {activeConversation.participant_ids.map((uid) => {
                  const p = activeConversation.participants?.[uid];
                  const isAdmin = activeConversation.admin_ids?.includes(uid);
                  return (
                    <div key={uid} className="flex items-center justify-between text-xs">
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

          {/* Galerie des Médias & Documents partagés */}
          <div className="py-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
              Fichiers et Médias partagés ({sharedMediaMessages.length})
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
                        className="cursor-pointer overflow-hidden rounded-xl aspect-square bg-slate-200 dark:bg-slate-800"
                      >
                        <img
                          src={att.url}
                          alt={att.name}
                          className="h-full w-full object-cover transition hover:scale-110"
                        />
                      </div>
                    );
                  }
                  return (
                    <a
                      key={msg.id}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex aspect-square flex-col items-center justify-center rounded-xl bg-slate-100 p-1 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                    >
                      <FileText className="h-6 w-6 text-blue-600 mb-1" />
                      <span className="truncate max-w-[50px] text-[10px]">{att.name}</span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. MODALE : NOUVELLE CONVERSATION OU CRÉATION DE GROUPE              */}
      {/* ==================================================================== */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Nouvelle discussion
              </h3>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="rounded-xl p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                aria-label="Fermer la modale"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Onglets Direct vs Groupe */}
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
                Message privé
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
              /* Choix d'un utilisateur pour message direct */
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {availableUsers
                  .filter((u) => u.id !== currentUser?.id)
                  .map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        if (!currentUser) return;
                        const convId = zaureService.getConversationId(currentUser.id, u.id);
                        setActiveConvId(convId);
                        setShowNewChatModal(false);
                        setMobileView('chat');
                      }}
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
              /* Formulaire de création de groupe */
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
                    Ajouter des membres ({selectedMemberIds.length})
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
                  {isCreatingGroup ? 'Création en cours...' : 'Créer le groupe de discussion'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. MODALE : APPELS AUDIO ET VIDÉO WEBRTC                              */}
      {/* ==================================================================== */}
      {callModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="relative flex h-[85vh] w-full max-w-2xl flex-col justify-between overflow-hidden rounded-3xl bg-slate-900 text-white shadow-2xl border border-slate-800">
            {/* Haut de la fenêtre d'appel */}
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

            {/* Centre de la fenêtre d'appel */}
            <div className="relative flex flex-1 items-center justify-center p-4">
              {callModal.type === 'video' ? (
                <div className="relative h-full w-full overflow-hidden rounded-2xl bg-slate-950 flex items-center justify-center">
                  {/* Remote simulation avatar */}
                  <div className="flex flex-col items-center text-center">
                    <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-4xl font-bold shadow-2xl animate-pulse">
                      {activeOtherUser?.nom?.charAt(0).toUpperCase() || 'Z'}
                    </div>
                    <p className="mt-4 text-sm font-semibold text-slate-300">
                      Flux vidéo chiffré de bout en bout
                    </p>
                  </div>

                  {/* Local video thumbnail preview */}
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

            {/* Barre de contrôles inférieure (Mute, Caméra, Raccrocher) */}
            <div className="flex items-center justify-center gap-6 p-6 bg-slate-950/60 border-t border-slate-800/80">
              {/* Micro ON/OFF */}
              <button
                onClick={toggleCallMute}
                className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
                  callModal.isMuted ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
                title={callModal.isMuted ? 'Activer le micro' : 'Couper le micro'}
                aria-label={callModal.isMuted ? 'Activer le micro' : 'Couper le micro'}
              >
                {callModal.isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>

              {/* Caméra ON/OFF (si vidéo) */}
              {callModal.type === 'video' && (
                <button
                  onClick={toggleCallVideo}
                  className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
                    callModal.isVideoOff ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                  title={callModal.isVideoOff ? 'Activer la caméra' : 'Couper la caméra'}
                  aria-label={callModal.isVideoOff ? 'Activer la caméra' : 'Couper la caméra'}
                >
                  {callModal.isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                </button>
              )}

              {/* Raccrocher */}
              <button
                onClick={endCall}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-red-600/40 hover:bg-red-700 transition"
                title="Raccrocher"
                aria-label="Raccrocher"
              >
                <PhoneOff className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. MODALE LIGHTBOX : APERÇU GRAND FORMAT D'IMAGE                      */}
      {/* ==================================================================== */}
      {lightboxImageUrl && (
        <div
          onClick={() => setLightboxImageUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
        >
          <div className="relative max-h-[90vh] max-w-[90vw]">
            <img
              src={lightboxImageUrl}
              alt="Aperçu agrandi"
              className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
            />
            <button
              onClick={() => setLightboxImageUrl(null)}
              className="absolute -top-4 -right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40"
              aria-label="Fermer l'aperçu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
