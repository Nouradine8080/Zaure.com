import React from 'react';
import {
  FileText,
  Film,
  Image as ImageIcon,
  Loader2,
  Lock,
  Mic,
  Paperclip,
  Send,
  ShieldAlert,
  Smile,
  Square,
  Trash2,
  X
} from 'lucide-react';
import { Message } from '../../types';
import { EMOJI_CATEGORIES, formatCallTime } from './chatUtils';
import { ZAURE_SURFACES } from '../../styles/designSystem';

interface MessageComposerProps {
  inputText: string;
  replyingTo: Message | null;
  editingMessage: Message | null;
  isEmojiPickerOpen: boolean;
  isUploading: boolean;
  uploadProgress: number;
  uploadingFileName: string;
  isRecording: boolean;
  recordingSeconds: number;
  recordedAudioUrl: string | null;
  hasRecordedAudio: boolean;
  stagedFile: File | null;
  stagedPreviewUrl: string | null;
  stagedCategory: 'image' | 'video' | 'audio' | 'document';
  stagedFormattedSize: string;
  fileValidationError: string | null;
  isOtherUserBlocked: boolean;
  dmRestrictedReason: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSendMessage: (e?: React.FormEvent) => void;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onToggleEmojiPicker: () => void;
  onInsertEmoji: (emoji: string) => void;
  onOpenFilePicker: (accept: string) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDiscardStagedFile: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onDiscardRecordedAudio: () => void;
  onUnblockUser?: () => void;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  inputText,
  replyingTo,
  editingMessage,
  isEmojiPickerOpen,
  isUploading,
  uploadProgress,
  uploadingFileName,
  isRecording,
  recordingSeconds,
  recordedAudioUrl,
  hasRecordedAudio,
  stagedFile,
  stagedPreviewUrl,
  stagedCategory,
  stagedFormattedSize,
  fileValidationError,
  isOtherUserBlocked,
  dmRestrictedReason,
  fileInputRef,
  onInputChange,
  onSendMessage,
  onCancelReply,
  onCancelEdit,
  onToggleEmojiPicker,
  onInsertEmoji,
  onOpenFilePicker,
  onFileSelect,
  onDiscardStagedFile,
  onStartRecording,
  onStopRecording,
  onDiscardRecordedAudio,
  onUnblockUser
}) => {
  const canSubmit =
    !isUploading &&
    !isOtherUserBlocked &&
    !dmRestrictedReason &&
    (Boolean(inputText.trim()) || Boolean(stagedFile) || hasRecordedAudio);

  if (isOtherUserBlocked) {
    return (
      <div className="border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-4 py-4 pb-safe">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-xs text-red-800 dark:text-red-200">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            <span className="font-semibold">
              Vous avez bloqué ce membre. Débloquez-le pour reprendre la discussion.
            </span>
          </div>
          {onUnblockUser && (
            <button
              type="button"
              onClick={onUnblockUser}
              className="shrink-0 rounded-xl bg-white dark:bg-slate-900 px-3 py-1.5 font-bold text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/50 transition"
            >
              Débloquer
            </button>
          )}
        </div>
      </div>
    );
  }

  if (dmRestrictedReason) {
    return (
      <div className="border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-4 py-4 pb-safe">
        <div className="mx-auto flex max-w-xl items-center gap-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-xs font-medium text-slate-600 dark:text-slate-300">
          <Lock className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
          <span>{dmRestrictedReason}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative border-t border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-3 sm:px-5 pt-2.5 pb-3 pb-safe z-20">
      <input
        ref={fileInputRef}
        type="file"
        onChange={onFileSelect}
        className="hidden"
      />

      {/* Erreur validation fichier */}
      {fileValidationError && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 animate-fadeIn">
          <span>{fileValidationError}</span>
        </div>
      )}

      {/* Progression téléversement */}
      {isUploading && (
        <div className="mb-2.5 rounded-xl border border-blue-200 bg-blue-50/90 px-3.5 py-2.5 animate-fadeIn">
          <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-blue-900">
            <span className="flex items-center gap-2 truncate">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 shrink-0" />
              <span className="truncate">Envoi : {uploadingFileName || 'Fichier'}</span>
            </span>
            <span className="tabular-nums font-bold text-blue-700">{uploadProgress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-blue-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Bannière réponse ou modification */}
      {replyingTo && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border-l-4 border-blue-600 bg-slate-50 px-3 py-2 text-xs">
          <div className="min-w-0">
            <span className="font-bold text-blue-700">Réponse à {replyingTo.sender_nom}</span>
            <p className="truncate text-slate-600">{replyingTo.content}</p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {editingMessage && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border-l-4 border-amber-500 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span className="font-bold">Modification du message en cours</span>
          <button
            type="button"
            onClick={onCancelEdit}
            className="rounded-lg p-1 text-amber-700 hover:bg-amber-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Prévisualisation pièce jointe avant envoi */}
      {stagedFile && !isUploading && (
        <div className="mb-2.5 flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 px-3 py-2 animate-fadeIn">
          <div className="flex items-center gap-3 min-w-0">
            {stagedCategory === 'image' && stagedPreviewUrl ? (
              <img
                src={stagedPreviewUrl}
                alt="Aperçu"
                className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-blue-200"
              />
            ) : stagedCategory === 'video' ? (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                <Film className="h-5 w-5" />
              </div>
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                <FileText className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-slate-900">{stagedFile.name}</p>
              <p className="text-[11px] text-slate-500 tabular-nums">
                {stagedFormattedSize} · Prêt à envoyer
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDiscardStagedFile}
            className="rounded-xl p-1.5 text-slate-500 hover:bg-white hover:text-red-600 transition shrink-0"
            title="Retirer la pièce jointe"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Prévisualisation note vocale enregistrée */}
      {hasRecordedAudio && recordedAudioUrl && !isRecording && (
        <div className="mb-2.5 flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 px-3 py-2 animate-fadeIn">
          <audio src={recordedAudioUrl} controls className="h-9 flex-1" />
          <button
            type="button"
            onClick={onDiscardRecordedAudio}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-red-600 border border-red-200 hover:bg-red-50 transition"
            title="Supprimer l'enregistrement"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Sélecteur d'émojis */}
      {isEmojiPickerOpen && (
        <div className={`absolute bottom-full left-3 sm:left-5 mb-2 w-72 sm:w-80 p-3 z-30 ${ZAURE_SURFACES.popoverMenu}`}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-900 dark:text-white">Émojis</span>
            <button
              type="button"
              onClick={onToggleEmojiPicker}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="max-h-52 space-y-2.5 overflow-y-auto pr-1">
            {EMOJI_CATEGORIES.map((cat) => (
              <div key={cat.label}>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {cat.label}
                </p>
                <div className="grid grid-cols-8 gap-1">
                  {cat.emojis.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => onInsertEmoji(em)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-base hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mode enregistrement vocal actif */}
      {isRecording ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5">
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full bg-red-600 animate-ping" />
            <div>
              <p className="text-xs font-extrabold text-red-700">Enregistrement vocal en cours</p>
              <p className="text-[11px] font-semibold text-red-600 tabular-nums">
                {formatCallTime(recordingSeconds)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDiscardRecordedAudio}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-bold text-slate-700 border border-slate-200 hover:bg-slate-50 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Annuler</span>
            </button>
            <button
              type="button"
              onClick={onStopRecording}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-red-600 px-3.5 text-xs font-bold text-white hover:bg-red-700 transition"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              <span>Terminer</span>
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSendMessage} className="flex items-end gap-1.5 sm:gap-2">
          {/* Outils médias */}
          <div className="flex items-center gap-0.5 shrink-0 pb-0.5">
            <button
              type="button"
              onClick={onToggleEmojiPicker}
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                isEmojiPickerOpen
                  ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                  : 'text-amber-600/80 dark:text-amber-400/80 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-600'
              }`}
              title="Insérer un émoji"
            >
              <Smile className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => onOpenFilePicker('image/*')}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-emerald-600/85 dark:text-emerald-400/85 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 transition"
              title="Envoyer une photo"
            >
              <ImageIcon className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => onOpenFilePicker('video/*')}
              className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl text-indigo-600/85 dark:text-indigo-400/85 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 transition"
              title="Envoyer une vidéo"
            >
              <Film className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() =>
                onOpenFilePicker('.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip')
              }
              className="flex h-10 w-10 items-center justify-center rounded-xl text-sky-600/85 dark:text-sky-400/85 hover:bg-sky-50 dark:hover:bg-sky-950/40 hover:text-sky-600 transition"
              title="Joindre un document"
            >
              <Paperclip className="h-5 w-5" />
            </button>
          </div>

          {/* Zone de saisie texte */}
          <div className="flex-1 min-w-0">
            <textarea
              rows={1}
              value={inputText}
              onChange={onInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (canSubmit) onSendMessage();
                }
              }}
              placeholder={
                editingMessage
                  ? 'Modifier votre message...'
                  : stagedFile
                    ? 'Ajouter une légende (facultatif)...'
                    : 'Écrire un message...'
              }
              className="max-h-32 min-h-[42px] w-full resize-none rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/80 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
            />
          </div>

          {/* Micro ou bouton Envoyer */}
          <div className="flex items-center gap-1 shrink-0 pb-0.5">
            {!canSubmit && !editingMessage ? (
              <button
                type="button"
                onClick={onStartRecording}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50/80 dark:bg-blue-950/50 text-blue-600 dark:text-sky-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition"
                title="Enregistrer une note vocale"
              >
                <Mic className="h-5 w-5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSubmit}
                className={`${ZAURE_SURFACES.gradientButton} h-11 w-11 disabled:opacity-40`}
                title="Envoyer"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
};
