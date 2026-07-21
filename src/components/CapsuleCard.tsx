import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, MessageSquare, Lightbulb, Heart, HelpCircle, CheckCircle2, Award, User, Clock, Languages, Volume2 } from 'lucide-react';
import { Capsule, Comment, Reaction, UserProfile } from '../types';
import { zaureService } from '../firebaseClient';

interface CapsuleCardProps {
  capsule: Capsule;
  currentUser: UserProfile | null;
  key?: React.Key;
}

export default function CapsuleCard({ capsule, currentUser }: CapsuleCardProps) {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState('0:00');
  const [audioCurrentTime, setAudioCurrentTime] = useState('0:00');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Load reactions & comments on mount / capsule change
  useEffect(() => {
    loadReactionsAndComments();

    return () => {
      // Clean up audio on unmount
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [capsule.id]);

  const loadReactionsAndComments = async () => {
    try {
      const rx = await zaureService.getReactions(capsule.id);
      setReactions(rx);
      const cx = await zaureService.getComments(capsule.id);
      setComments(cx);
    } catch (e) {
      console.error(e);
    }
  };

  // Toggling reaction
  const handleReact = async (type: 'utile' | 'merci' | 'question') => {
    if (!currentUser) return;
    try {
      const updated = await zaureService.toggleReaction(capsule.id, type);
      setReactions(updated);
    } catch (e) {
      console.error(e);
    }
  };

  // Adding comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !currentUser) return;

    try {
      const added = await zaureService.addComment(capsule.id, newCommentText.trim());
      setComments((prev) => [...prev, added]);
      setNewCommentText('');
    } catch (e) {
      console.error(e);
    }
  };

  // Audio Playback Helpers
  const setupAudio = () => {
    if (audioRef.current) return;

    // Standard fallback or actual base64 data
    const src = capsule.contenu.startsWith('data:audio') 
      ? capsule.contenu 
      : 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'; // public fallback if content isn't real base64

    const audio = new Audio(src);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      const mins = Math.floor(audio.duration / 60);
      const secs = Math.floor(audio.duration % 60);
      setAudioDuration(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
    };

    audio.onended = () => {
      setIsPlaying(false);
      setAudioProgress(0);
      setAudioCurrentTime('0:00');
    };
  };

  const updateAudioProgress = () => {
    if (!audioRef.current) return;
    const audio = audioRef.current;
    if (audio.duration) {
      setAudioProgress((audio.currentTime / audio.duration) * 100);
      const mins = Math.floor(audio.currentTime / 60);
      const secs = Math.floor(audio.currentTime % 60);
      setAudioCurrentTime(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
    }
    animationFrameRef.current = requestAnimationFrame(updateAudioProgress);
  };

  const handlePlayPauseAudio = () => {
    setupAudio();
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    } else {
      audio.play().catch(err => console.log('Audio playback error', err));
      setIsPlaying(true);
      animationFrameRef.current = requestAnimationFrame(updateAudioProgress);
    }
  };

  // Get count of specific reactions
  const getReactionCount = (type: 'utile' | 'merci' | 'question') => {
    return reactions.filter((r) => r.type === type).length;
  };

  const hasReacted = (type: 'utile' | 'merci' | 'question') => {
    return reactions.some((r) => r.user_id === currentUser?.id && r.type === type);
  };

  // Date formatter
  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Language mapping
  const languageNames = {
    fr: 'Français',
    ha: 'Haoussa (Hausa)',
    en: 'Anglais'
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200" id={`capsule-card-${capsule.id}`}>
      {/* Header info */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {capsule.auteur_avatar ? (
            <img
              src={capsule.auteur_avatar}
              alt={capsule.auteur_nom}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-500/10"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
              <User className="w-5 h-5" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-900 text-sm">{capsule.auteur_nom}</span>
              
              {/* Specialized roles badges */}
              {capsule.auteur_role === 'verifie' && (
                <span className="flex items-center gap-0.5 px-2 py-0.5 bg-emerald-50 text-[10px] font-medium text-emerald-700 rounded-full border border-emerald-100">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Vérifié</span>
                </span>
              )}
              {capsule.auteur_role === 'mentor' && (
                <span className="flex items-center gap-0.5 px-2 py-0.5 bg-amber-50 text-[10px] font-medium text-amber-700 rounded-full border border-amber-100">
                  <Award className="w-3 h-3 text-amber-600" />
                  <span>Mentor</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(capsule.created_at)}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded text-[10px] border border-slate-100">
                <Languages className="w-2.5 h-2.5 text-slate-400" />
                {languageNames[capsule.langue_dorigine] || capsule.langue_dorigine}
              </span>
            </div>
          </div>
        </div>

        <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100/50">
          {capsule.circle_nom}
        </span>
      </div>

      {/* Capsule Content */}
      <div className="mb-4 text-slate-800 text-sm leading-relaxed whitespace-pre-line">
        {capsule.type === 'audio' ? (
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={handlePlayPauseAudio}
                className="w-12 h-12 flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 rounded-full shadow-sm transition"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-slate-950 ml-0.5" />}
              </button>
              <div className="flex-1">
                <p className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Volume2 className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                  <span>Écouter la capsule vocale</span>
                </p>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2 relative">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-75"
                    style={{ width: `${audioProgress}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mt-1">
                  <span>{audioCurrentTime}</span>
                  <span>{audioDuration}</span>
                </div>
              </div>
            </div>
            {/* Short transcribed context/summary if present */}
            <p className="text-xs text-slate-500 italic border-l-2 border-slate-200 pl-2.5 mt-1">
              "Note vocale enregistrée par {capsule.auteur_nom} pour partager des connaissances orales de santé/langue."
            </p>
          </div>
        ) : (
          <div>{capsule.contenu}</div>
        )}
      </div>

      {/* Actions and Anti-addiction evaluation metrics */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-50 text-xs">
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Reaction 1: Utile */}
          <button
            onClick={() => handleReact('utile')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${
              hasReacted('utile')
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-transparent'
            }`}
          >
            <Lightbulb className={`w-4 h-4 ${hasReacted('utile') ? 'fill-amber-400 text-amber-500' : ''}`} />
            <span className="font-medium">Utile</span>
            <span className="bg-white/60 px-1.5 py-0.2 rounded-full font-bold text-[10px] border border-slate-100">
              {getReactionCount('utile')}
            </span>
          </button>

          {/* Reaction 2: Merci */}
          <button
            onClick={() => handleReact('merci')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${
              hasReacted('merci')
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-transparent'
            }`}
          >
            <Heart className={`w-4 h-4 ${hasReacted('merci') ? 'fill-rose-400 text-rose-500' : ''}`} />
            <span className="font-medium">Merci</span>
            <span className="bg-white/60 px-1.5 py-0.2 rounded-full font-bold text-[10px] border border-slate-100">
              {getReactionCount('merci')}
            </span>
          </button>

          {/* Reaction 3: Question */}
          <button
            onClick={() => handleReact('question')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${
              hasReacted('question')
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-transparent'
            }`}
          >
            <HelpCircle className={`w-4 h-4 ${hasReacted('question') ? 'fill-indigo-100 text-indigo-500' : ''}`} />
            <span className="font-medium">Question ?</span>
            <span className="bg-white/60 px-1.5 py-0.2 rounded-full font-bold text-[10px] border border-slate-100">
              {getReactionCount('question')}
            </span>
          </button>
        </div>

        {/* Comment toggle */}
        <button
          onClick={() => setShowComments(!showComments)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition ${
            showComments 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
              : 'bg-slate-50 border-transparent hover:bg-slate-100 text-slate-600'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span className="font-medium">Commenter</span>
          <span className="bg-white/60 px-1.5 py-0.2 rounded-full font-bold text-[10px] border border-slate-100">
            {comments.length}
          </span>
        </button>
      </div>

      {/* Expanded Comments List & Creation Form */}
      {showComments && (
        <div className="mt-4 pt-4 border-t border-slate-100 bg-slate-50/50 -mx-5 -mb-5 px-5 pb-5 rounded-b-2xl">
          <h5 className="font-semibold text-slate-700 text-xs mb-3">Discussions communautaires</h5>
          
          <div className="space-y-3 max-h-60 overflow-y-auto mb-4 pr-1">
            {comments.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-2">Aucun commentaire pour le moment. Soyez le premier à poser une question ou remercier l'auteur !</p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="flex gap-2.5 items-start text-xs bg-white p-3 rounded-xl border border-slate-100">
                  {comment.auteur_avatar ? (
                    <img
                      src={comment.auteur_avatar}
                      alt={comment.auteur_nom}
                      className="w-7 h-7 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{comment.auteur_nom}</span>
                      <span className="text-[10px] text-slate-400">{formatDate(comment.created_at)}</span>
                    </div>
                    <p className="text-slate-700 mt-1 leading-relaxed">{comment.contenu}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {currentUser ? (
            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                type="text"
                placeholder="Rédigez votre réponse ou question constructive..."
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
              />
              <button
                type="submit"
                disabled={!newCommentText.trim()}
                className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl transition shadow-sm disabled:opacity-50 disabled:hover:bg-emerald-500"
              >
                Envoyer
              </button>
            </form>
          ) : (
            <p className="text-xs text-slate-400 italic text-center">Connectez-vous pour participer à l'échange.</p>
          )}
        </div>
      )}
    </div>
  );
}
