import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Image as ImageIcon,
  Video,
  Link2,
  FileText,
  BarChart2,
  Send,
  X,
  Plus,
  Trash2,
  EyeOff,
  Clock,
  ShieldAlert,
  Globe,
  Mic
} from 'lucide-react';
import AudioRecorder from '../AudioRecorder';
import VoiceNotePlayer from '../VoiceNotePlayer';
import {
  CommunityGroup,
  CommunityMember,
  GroupMemberRole,
  GroupPoll,
  GroupPostMediaItem,
  GroupPostType,
  UserProfile
} from '../../types';
import { communityService } from '../../services/communityService';
import { formatFileSize, validateFileForChat } from '../../utils/fileValidation';

interface CommunityPostComposerProps {
  group: CommunityGroup;
  currentUser: UserProfile;
  currentMember?: CommunityMember;
  initialType?: GroupPostType;
  onPublished?: () => void;
  onCancel?: () => void;
}

export default function CommunityPostComposer({
  group,
  currentUser,
  currentMember,
  initialType = 'text',
  onPublished,
  onCancel
}: CommunityPostComposerProps) {
  const [postType, setPostType] = useState<GroupPostType>(initialType);
  const [content, setContent] = useState('');
  const [media, setMedia] = useState<GroupPostMediaItem[]>([]);
  const [externalLink, setExternalLink] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduledFor, setScheduledFor] = useState('');

  // Poll state
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollAllowMultiple, setPollAllowMultiple] = useState(false);

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPostType(initialType);
  }, [initialType]);

  const isPublicFeed = group.id === 'public';
  const effectiveRole: GroupMemberRole = currentMember?.role || 'membre';
  const isStaff = effectiveRole === 'administrateur' || effectiveRole === 'moderateur';
  const canPost = isPublicFeed || group.postPermission === 'all_members' || isStaff;

  if (!canPost) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3 text-xs text-slate-600">
        <ShieldAlert className="w-5 h-5 text-blue-600 shrink-0" />
        <span>
          Seuls les administrateurs et modérateurs sont autorisés à créer de nouvelles publications dans ce cercle. Vous pouvez commenter et réagir aux discussions ci-dessous.
        </span>
      </div>
    );
  }

  const handleFilesSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
    targetFolder: 'images' | 'videos' | 'documents'
  ) => {
    const fileList = e.target.files as FileList | null;
    const files: File[] = fileList ? Array.from(fileList) : [];
    if (files.length === 0) return;
    setError(null);

    try {
      for (const file of files) {
        const validation = validateFileForChat(file);
        if (!validation.valid) {
          setError(validation.error || 'Fichier non autorisé.');
          continue;
        }
        setUploadProgress(5);
        const uploaded = await communityService.uploadCommunityMedia(
          group.id,
          file,
          targetFolder,
          (pct) => setUploadProgress(pct)
        );
        setMedia((prev) => [...prev, uploaded].slice(0, 10));
      }
    } catch (err: any) {
      setError(err?.message || 'Erreur lors du téléversement.');
    } finally {
      setUploadProgress(null);
      e.target.value = '';
    }
  };

  const handleRemoveMedia = (index: number) => {
    setMedia((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    let pollPayload: GroupPoll | null = null;
    if (postType === 'poll') {
      const validOpts = pollOptions.map((o) => o.trim()).filter(Boolean);
      if (!pollQuestion.trim()) {
        setError('Veuillez saisir la question du sondage.');
        return;
      }
      if (validOpts.length < 2) {
        setError('Un sondage doit contenir au moins 2 choix.');
        return;
      }
      pollPayload = {
        question: pollQuestion.trim(),
        allowMultiple: pollAllowMultiple,
        options: validOpts.map((text, idx) => ({
          id: `opt_${idx}_${Date.now()}`,
          text,
          voterIds: []
        }))
      };
    }

    if (postType === 'link' && !externalLink.trim()) {
      setError('Veuillez saisir un lien externe valide (https://...).');
      return;
    }

    if (!content.trim() && media.length === 0 && !pollPayload && !externalLink.trim()) {
      setError('Ajoutez un message, un média, un document, un lien ou un sondage.');
      return;
    }

    setIsSubmitting(true);
    try {
      const firestoreSafeType: GroupPostType =
        postType === 'audio' ? 'document' : postType;

      const created = await communityService.createGroupPost(
        group,
        currentUser,
        effectiveRole,
        {
          type: firestoreSafeType,
          content: content.trim() || pollPayload?.question || externalLink.trim() || media[0]?.name || '',
          media,
          externalLink: postType === 'link' ? externalLink.trim() : '',
          poll: pollPayload,
          isAnonymous,
          scheduledFor: showSchedule && scheduledFor ? new Date(scheduledFor).toISOString() : ''
        }
      );

      setContent('');
      setMedia([]);
      setExternalLink('');
      setPollQuestion('');
      setPollOptions(['', '']);
      setIsAnonymous(false);
      setShowSchedule(false);
      setScheduledFor('');
      setPostType('text');

      if (created.status === 'pending') {
        setNotice("Publication envoyée ! Elle sera visible après validation d'un modérateur.");
      } else if (created.status === 'scheduled') {
        setNotice('Publication programmée avec succès.');
      } else {
        setNotice(isPublicFeed ? 'Publication partagée sur le fil public.' : 'Publication ajoutée au cercle.');
      }
      setTimeout(() => setNotice(null), 4000);
      if (onPublished) onPublished();
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la publication.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="bg-white border border-slate-200/85 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] space-y-3.5"
    >
      {/* Header Row */}
      <div className="flex items-center gap-3">
        {isAnonymous ? (
          <div className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0">
            <EyeOff className="w-5 h-5" />
          </div>
        ) : currentUser.avatar_url ? (
          <img
            src={currentUser.avatar_url}
            alt={currentUser.nom}
            className="w-10 h-10 rounded-full object-cover shrink-0 bg-slate-100"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
            {currentUser.nom.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold text-slate-900 truncate">
            {isAnonymous ? 'Publication anonyme' : currentUser.nom}
          </p>
          {isPublicFeed ? (
            <p className="text-[11px] text-blue-700 font-semibold flex items-center gap-1">
              <Globe className="w-3 h-3" />
              <span>Fil public · Visible hors cercle</span>
            </p>
          ) : (
            <p className="text-[11px] text-slate-500">
              Publier dans <span className="font-semibold text-slate-700">{group.name}</span>
            </p>
          )}
        </div>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition shrink-0"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {error && (
        <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-800">
          {notice}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            isPublicFeed
              ? `Quoi de neuf, ${currentUser.nom.split(' ')[0]} ? Publiez un texte, des photos, une vidéo, un lien, un document ou un sondage...`
              : 'Partagez une réflexion, une ressource, une question ou une annonce avec le cercle...'
          }
          className="w-full text-xs sm:text-sm p-3.5 rounded-2xl bg-[#F0F2F5] focus:bg-white border border-transparent focus:border-blue-500 focus:outline-none text-slate-900 resize-none leading-relaxed"
        />

        {/* Post Type Mode Selector */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setPostType('image');
              imageInputRef.current?.click();
            }}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
              postType === 'image'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <ImageIcon className="w-4 h-4 text-blue-600" />
            <span>Photos</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setPostType('video');
              videoInputRef.current?.click();
            }}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
              postType === 'video'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <Video className="w-4 h-4 text-red-600" />
            <span>Vidéo</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setPostType('document');
              docInputRef.current?.click();
            }}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
              postType === 'document'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <FileText className="w-4 h-4 text-amber-600" />
            <span>Document</span>
          </button>

          <button
            type="button"
            onClick={() => setPostType(postType === 'link' ? 'text' : 'link')}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
              postType === 'link'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <Link2 className="w-4 h-4 text-blue-600" />
            <span>Lien</span>
          </button>

          <button
            type="button"
            onClick={() => setPostType(postType === 'poll' ? 'text' : 'poll')}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
              postType === 'poll'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <BarChart2 className="w-4 h-4 text-emerald-600" />
            <span>Sondage</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAudioRecorder(true)}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
              postType === 'audio'
                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <Mic className="w-4 h-4 text-purple-600" />
            <span>Note vocale</span>
          </button>
        </div>

        {/* Hidden File Inputs */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFilesSelected(e, 'images')}
          className="hidden"
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          onChange={(e) => handleFilesSelected(e, 'videos')}
          className="hidden"
        />
        <input
          ref={docInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
          onChange={(e) => handleFilesSelected(e, 'documents')}
          className="hidden"
        />

        {/* Upload Progress */}
        {uploadProgress !== null && (
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-semibold text-blue-700">
              <span>Téléversement en cours...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Attached Media Previews */}
        {media.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {media.map((m, idx) => (
              <div
                key={`${m.name}-${idx}`}
                className={`relative rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden p-2.5 flex items-center gap-2 ${
                  m.type === 'audio' ? 'sm:col-span-2' : ''
                }`}
              >
                {m.type === 'image' ? (
                  <img src={m.url} alt={m.name} className="w-full h-28 object-cover rounded-xl" />
                ) : m.type === 'video' ? (
                  <div className="w-full py-3 px-2 text-center">
                    <Video className="w-6 h-6 text-red-600 mx-auto" />
                    <p className="text-[11px] font-bold text-slate-800 truncate mt-1">{m.name}</p>
                  </div>
                ) : m.type === 'audio' ? (
                  <div className="w-full pr-7">
                    <VoiceNotePlayer url={m.url} />
                  </div>
                ) : (
                  <div className="min-w-0 flex-1 py-1 pr-7">
                    <p className="text-xs font-bold text-slate-800 truncate">{m.name}</p>
                    {m.size && (
                      <p className="text-[10px] text-slate-500 font-mono tabular-nums">{formatFileSize(m.size)}</p>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveMedia(idx)}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-slate-950/75 text-white flex items-center justify-center hover:bg-red-600 transition"
                  title="Retirer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* External Link Box */}
        {postType === 'link' && (
          <div className="p-3 rounded-2xl bg-[#F0F2F5] space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-700">
              URL du lien externe
            </label>
            <input
              type="url"
              placeholder="https://exemple.org/article"
              value={externalLink}
              onChange={(e) => setExternalLink(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-blue-600"
            />
          </div>
        )}

        {/* Interactive Poll Builder */}
        {postType === 'poll' && (
          <div className="p-3.5 rounded-2xl bg-[#F0F2F5] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-800">Configurer le sondage</span>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pollAllowMultiple}
                  onChange={(e) => setPollAllowMultiple(e.target.checked)}
                  className="accent-blue-600"
                />
                <span>Choix multiples</span>
              </label>
            </div>
            <input
              type="text"
              placeholder="Posez votre question de sondage..."
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-blue-600 font-semibold"
            />
            <div className="space-y-1.5">
              {pollOptions.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder={`Option ${idx + 1}`}
                    value={opt}
                    onChange={(e) => {
                      const copy = [...pollOptions];
                      copy[idx] = e.target.value;
                      setPollOptions(copy);
                    }}
                    className="flex-1 text-xs px-3 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-blue-600"
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setPollOptions((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-2 text-slate-400 hover:text-red-600 rounded-xl"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {pollOptions.length < 6 && (
              <button
                type="button"
                onClick={() => setPollOptions((prev) => [...prev, ''])}
                className="text-xs font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter une option</span>
              </button>
            )}
          </div>
        )}

        {/* Advanced Toggles: Anonymous + Scheduled */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            {group.allowAnonymousPosts && (
              <button
                type="button"
                onClick={() => setIsAnonymous((prev) => !prev)}
                className={`min-h-[36px] px-3 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5 border transition ${
                  isAnonymous
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>{isAnonymous ? 'Mode anonyme actif' : 'Publier en anonyme'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowSchedule((prev) => !prev)}
              className={`min-h-[36px] px-3 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5 border transition ${
                showSchedule
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Programmer</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || uploadProgress !== null}
            className="min-h-[42px] px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl flex items-center gap-1.5 transition shadow-xs"
          >
            <Send className="w-3.5 h-3.5" />
            <span>
              {isSubmitting
                ? 'Envoi...'
                : showSchedule && scheduledFor
                ? 'Programmer'
                : group.requirePostApproval && !isStaff
                ? 'Soumettre'
                : 'Publier'}
            </span>
          </button>
        </div>

        {showSchedule && (
          <div className="flex items-center gap-2 bg-blue-50/70 border border-blue-200 p-2.5 rounded-xl">
            <Clock className="w-4 h-4 text-blue-600 shrink-0" />
            <label className="text-[11px] font-bold text-blue-900 shrink-0">
              Date & heure :
            </label>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="text-xs bg-white border border-blue-200 rounded-lg px-2.5 py-1 text-slate-800"
            />
          </div>
        )}
      </form>

      {showAudioRecorder && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <AudioRecorder
            onAudioReady={(base64Audio) => {
              setMedia((prev) => [
                ...prev,
                {
                  type: 'audio',
                  url: base64Audio,
                  name: `Note_vocale_${Date.now()}.webm`,
                  mimeType: 'audio/webm'
                }
              ]);
              setPostType('audio');
              setShowAudioRecorder(false);
            }}
            onCancel={() => setShowAudioRecorder(false)}
          />
        </div>
      )}
    </motion.div>
  );
}
