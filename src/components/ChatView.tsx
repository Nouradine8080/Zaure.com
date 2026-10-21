import React, { useState, useEffect, useRef } from 'react';
import { Send, User, MessageSquare, ShieldCheck, Award, ChevronLeft } from 'lucide-react';
import { Message, UserProfile } from '../types';
import { zaureService } from '../firebaseClient';
import { useTranslation } from '../context/LanguageContext';

interface ChatViewProps {
  currentUser: UserProfile | null;
  initialSelectedUser?: UserProfile | null;
}

export default function ChatView({ currentUser, initialSelectedUser = null }: ChatViewProps) {
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(initialSelectedUser);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (initialSelectedUser) {
      setSelectedUser(initialSelectedUser);
    }
  }, [initialSelectedUser]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Load user contacts list
  useEffect(() => {
    let isMounted = true;
    zaureService.getAvailableUsers().then((list) => {
      if (!isMounted) return;
      if (currentUser) {
        setUsers(list.filter((u) => u.id !== currentUser.id));
      } else {
        setUsers(list);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  // Real-time Firestore subscription (onSnapshot) for the deterministic conversation
  useEffect(() => {
    if (!selectedUser || !currentUser) {
      setMessages([]);
      return;
    }

    setIsLoading(true);
    const unsubscribe = zaureService.subscribePrivateMessages(selectedUser.id, (msgs) => {
      setMessages(msgs);
      setIsLoading(false);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [selectedUser?.id, currentUser?.id]);

  // Scroll to bottom whenever messages list updates
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
    }
    if (!newMessageText.trim() || !selectedUser || !currentUser) return;

    const textToSend = newMessageText.trim();
    setNewMessageText('');

    try {
      await zaureService.sendPrivateMessage(selectedUser.id, textToSend);
      // onSnapshot handles appending the new message in real time
    } catch (err) {
      console.error("Erreur lors de l'envoi du message:", err);
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm h-[calc(100vh-200px)] md:h-[600px] min-h-[460px] max-h-[800px] flex overflow-hidden font-sans" id="chat-view-container">
      {/* 1. Contact List Pane */}
      <div
        className={`w-full md:w-80 border-r border-slate-100 flex flex-col bg-slate-50/50 ${
          selectedUser ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="p-4 border-b border-slate-100 bg-white">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-600" />
            <span>{t('chat.title')}</span>
          </h3>
          <p className="text-[10px] text-slate-400 mt-1">Échangez avec les mentors et apprenants de Zaure</p>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {users.length === 0 ? (
            <p className="text-xs text-slate-400 italic p-4 text-center">Aucun autre utilisateur disponible pour le chat.</p>
          ) : (
            users.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelectedUser(u)}
                className={`w-full text-left p-3 rounded-xl flex items-start gap-3 transition-all ${
                  selectedUser?.id === u.id
                    ? 'bg-blue-50 border border-blue-200 text-blue-950 shadow-xs'
                    : 'hover:bg-white border border-transparent text-slate-700'
                }`}
              >
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt={u.nom} className="w-9 h-9 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center shrink-0">
                    <User className="w-4.5 h-4.5 text-slate-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-xs truncate">{u.nom}</span>
                    {u.role === 'verifie' && <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                    {u.role === 'mentor' && <Award className="w-3.5 h-3.5 text-red-600 shrink-0" />}
                  </div>
                  <p className="text-[10px] text-slate-500 truncate mt-0.5">{u.bio || 'Aucune description'}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* 2. Messages Thread Pane */}
      <div
        className={`flex-1 flex flex-col bg-slate-50 ${
          !selectedUser ? 'hidden md:flex items-center justify-center p-6 text-center' : 'flex'
        }`}
      >
        {selectedUser ? (
          <>
            {/* Header chat partner info */}
            <div className="p-3 sm:p-4 border-b border-slate-100 bg-white flex items-center gap-3 shrink-0">
              <button
                onClick={() => setSelectedUser(null)}
                className="md:hidden p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 mr-1"
                title="Retour aux discussions"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              {selectedUser.avatar_url ? (
                <img src={selectedUser.avatar_url} alt={selectedUser.nom} className="w-9 h-9 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center shrink-0">
                  <User className="w-5.5 h-5.5 text-slate-500" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h4 className="font-bold text-slate-900 text-xs truncate">{selectedUser.nom}</h4>
                  {selectedUser.role === 'verifie' && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.2 bg-blue-50 text-blue-700 rounded-md shrink-0">Vérifié</span>
                  )}
                  {selectedUser.role === 'mentor' && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.2 bg-red-50 text-red-700 rounded-md shrink-0">Mentor</span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 truncate max-w-xs md:max-w-md">{selectedUser.bio || 'Aucune biographie disponible.'}</p>
              </div>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {isLoading && messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  Chargement de la conversation...
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs text-center py-10">
                  <MessageSquare className="w-8 h-8 text-slate-300 mb-2 stroke-1" />
                  <p>Début de la conversation avec {selectedUser.nom}</p>
                  <p className="text-[10px] mt-1 text-slate-400">Posez une question sur la santé, l'éducation ou la langue haoussa !</p>
                </div>
              ) : (
                messages.map((m) => {
                  const isOwn = m.sender_id === currentUser?.id;
                  return (
                    <div key={m.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-xs md:max-w-md p-3 rounded-2xl text-xs shadow-xs ${
                          isOwn
                            ? 'bg-blue-600 text-white rounded-br-none'
                            : 'bg-white text-slate-800 rounded-bl-none border border-slate-100'
                        }`}
                      >
                        <p className="leading-relaxed break-words">{m.content}</p>
                        <p
                          className={`text-[9px] text-right mt-1.5 font-mono ${
                            isOwn ? 'text-blue-100' : 'text-slate-400'
                          }`}
                        >
                          {formatTime(m.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Send Message Form */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 sm:p-4 bg-white border-t border-slate-100 flex items-center gap-2 shrink-0 sticky bottom-0 z-20"
            >
              <input
                type="text"
                placeholder={`Écrire à ${selectedUser.nom}...`}
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                className="flex-1 min-w-0 px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-800 bg-slate-50/50"
              />
              <button
                type="submit"
                disabled={!newMessageText.trim()}
                className="p-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl transition shadow-xs disabled:opacity-50 shrink-0 flex items-center justify-center font-bold"
                title="Envoyer le message"
              >
                <Send className="w-4.5 h-4.5" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 max-w-sm">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-blue-600 stroke-1" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Discussions directes</h4>
            <p className="text-xs text-slate-400 text-center mt-2 leading-relaxed">
              Sélectionnez un membre dans la liste latérale pour démarrer une messagerie privée et échanger vos savoirs de manière privilégiée.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
