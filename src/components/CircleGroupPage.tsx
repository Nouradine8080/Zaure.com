import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Users, 
  Layers, 
  Share2, 
  Check, 
  LogIn, 
  Sparkles, 
  Volume2, 
  MessageSquare, 
  ShieldCheck, 
  Info, 
  Plus, 
  Send,
  Globe,
  Radio,
  Clock,
  BookOpen
} from 'lucide-react';
import { Circle, Capsule, UserProfile } from '../types';
import CapsuleCard from './CapsuleCard';
import AudioRecorder from './AudioRecorder';

interface CircleGroupPageProps {
  circle: Circle;
  capsules: Capsule[];
  isJoined: boolean;
  currentUser: UserProfile | null;
  onBack: () => void;
  onToggleJoin: () => void;
  onCreateCapsule: (circleId: string, type: 'texte' | 'audio', contenu: string, langue: 'fr' | 'ha' | 'en') => Promise<void>;
  t: (key: string) => string;
  language: 'fr' | 'ha' | 'en';
}

export const CircleGroupPage: React.FC<CircleGroupPageProps> = ({
  circle,
  capsules,
  isJoined,
  currentUser,
  onBack,
  onToggleJoin,
  onCreateCapsule,
  t,
  language
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'feed' | 'about' | 'members'>('feed');
  const [filterType, setFilterType] = useState<'all' | 'audio' | 'texte'>('all');
  
  // Capsule creation state inside group
  const [showPostBox, setShowPostBox] = useState(false);
  const [postType, setPostType] = useState<'texte' | 'audio'>('texte');
  const [postContent, setPostContent] = useState('');
  const [postLang, setPostLang] = useState<'fr' | 'ha' | 'en'>(language);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // Filter capsules for this circle
  const circleCapsules = capsules.filter(c => {
    const matchesCircle = c.circle_id === circle.id || (c as any).circleId === circle.id;
    if (!matchesCircle) return false;
    if (filterType === 'audio') return c.type === 'audio';
    if (filterType === 'texte') return c.type === 'texte';
    return true;
  });

  const handleShareCircle = () => {
    navigator.clipboard?.writeText?.(window.location.href);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 3000);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postContent.trim()) return;
    setIsSubmitting(true);
    try {
      await onCreateCapsule(circle.id, postType, postContent, postLang);
      setPostContent('');
      setShowPostBox(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12" id="circle-group-page-view">
      
      {/* 1. TOP NAVIGATION HEADER BAR */}
      <div className="flex items-center justify-between bg-white border border-slate-100 px-4 py-3 rounded-2xl shadow-xs">
        <button
          type="button"
          onClick={onBack}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center gap-2 transition shadow-2xs hover:text-emerald-700"
          id="btn-back-to-all-circles"
        >
          <ArrowLeft className="w-4 h-4 text-emerald-600" />
          <span>← Retour aux cercles</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 hidden sm:flex">
          <span>Cercles de Savoir</span>
          <span>›</span>
          <span className="font-bold text-slate-900 truncate max-w-[200px]">{circle.nom}</span>
        </div>

        <button
          type="button"
          onClick={handleShareCircle}
          className="p-2 bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-xl border border-slate-200 transition flex items-center gap-1.5 text-xs font-semibold"
          title="Partager ce cercle"
        >
          <Share2 className="w-3.5 h-3.5 text-emerald-600" />
          <span className="hidden sm:inline">{shareCopied ? 'Lien copié !' : 'Partager'}</span>
        </button>
      </div>

      {/* 2. FACEBOOK / WHATSAPP STYLE GROUP BANNER HEADER */}
      <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-xs relative">
        
        {/* Cover Image Banner */}
        <div className="relative h-56 sm:h-72 w-full bg-slate-900 overflow-hidden">
          <img
            src={circle.image}
            alt={circle.nom}
            className="w-full h-full object-cover opacity-85 hover:scale-105 transition-transform duration-700"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
          
          {/* Category Tag Badge Top Right */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <span className="px-3 py-1 bg-emerald-500 text-slate-950 text-xs font-black rounded-xl uppercase tracking-wider shadow-md">
              {circle.categorie}
            </span>
          </div>

          {/* Group Avatar & Info overlay bottom */}
          <div className="absolute bottom-4 left-4 right-4 sm:left-6 sm:right-6 text-white flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex items-end gap-3.5">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-500 text-slate-950 rounded-2xl border-4 border-white shadow-xl flex items-center justify-center font-black text-2xl sm:text-3xl shrink-0">
                {circle.nom.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/30">
                    Cercle de Savoir
                  </span>
                  <span className="text-[10px] text-slate-300 flex items-center gap-1">
                    <Globe className="w-3 h-3 text-emerald-400" /> Groupe Public
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight mt-1">
                  {circle.nom}
                </h1>
              </div>
            </div>

            {/* Quick stats on banner */}
            <div className="flex items-center gap-4 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-700/60 shrink-0 text-xs text-slate-200">
              <div className="text-center">
                <p className="font-black text-emerald-400 text-sm">{capsules.filter(c => c.circle_id === circle.id || (c as any).circleId === circle.id).length}</p>
                <p className="text-[10px] text-slate-400 uppercase font-bold">Capsules</p>
              </div>
              <div className="w-px h-6 bg-slate-700" />
              <div className="text-center">
                <p className="font-black text-white text-sm">{isJoined ? 'Membre' : 'Public'}</p>
                <p className="text-[10px] text-slate-400 uppercase font-bold">Accès</p>
              </div>
            </div>
          </div>
        </div>

        {/* Group Meta & Action Bar */}
        <div className="p-5 sm:p-6 bg-white space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed max-w-4xl font-normal">
            {circle.description}
          </p>

          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            
            {/* Membership status */}
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Connaissances vérifiées & modérées par la communauté</span>
            </div>

            {/* Group Action Buttons */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={onToggleJoin}
                className={`flex-1 sm:flex-initial px-5 py-2.5 text-xs font-extrabold rounded-xl transition flex items-center justify-center gap-2 shadow-xs ${
                  isJoined
                    ? 'bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-700 border border-slate-200'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md'
                }`}
              >
                {isJoined ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Vous êtes membre</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Rejoindre ce groupe</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowPostBox(prev => !prev)}
                className="flex-1 sm:flex-initial px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold rounded-xl transition flex items-center justify-center gap-2 shadow-sm"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Publier une capsule</span>
              </button>
            </div>
          </div>
        </div>

        {/* GROUP TABS BAR */}
        <div className="flex border-t border-slate-100 bg-slate-50/80 px-4 pt-1">
          <button
            type="button"
            onClick={() => setActiveSubTab('feed')}
            className={`px-4 py-3 text-xs font-extrabold border-b-2 transition flex items-center gap-2 ${
              activeSubTab === 'feed'
                ? 'border-emerald-500 text-emerald-700 bg-white rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Discussions & Capsules ({circleCapsules.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('about')}
            className={`px-4 py-3 text-xs font-extrabold border-b-2 transition flex items-center gap-2 ${
              activeSubTab === 'about'
                ? 'border-emerald-500 text-emerald-700 bg-white rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Info className="w-4 h-4" />
            <span>À propos du cercle</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('members')}
            className={`px-4 py-3 text-xs font-extrabold border-b-2 transition flex items-center gap-2 ${
              activeSubTab === 'members'
                ? 'border-emerald-500 text-emerald-700 bg-white rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Règles & Membres</span>
          </button>
        </div>
      </div>

      {/* 3. GROUP MAIN CONTENT AREA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Post Creator & Capsules Feed */}
        <div className="lg:col-span-8 space-y-5">
          
          {/* Post Creator Form inside Circle */}
          {(showPostBox || currentUser) && (
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs transition-all">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                    {currentUser?.avatar ? (
                      <img src={currentUser.avatar} alt="" className="w-full h-full rounded-lg object-cover" />
                    ) : (
                      currentUser?.nom?.charAt(0) || 'U'
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Publier dans {circle.nom}</p>
                    <p className="text-[10px] text-slate-400">Partagez votre savoir avec les membres du groupe</p>
                  </div>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPostType('texte')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      postType === 'texte' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500'
                    }`}
                  >
                    Texte
                  </button>
                  <button
                    type="button"
                    onClick={() => setPostType('audio')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                      postType === 'audio' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500'
                    }`}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Audio</span>
                  </button>
                </div>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                {postType === 'texte' ? (
                  <textarea
                    rows={3}
                    placeholder={`Écrivez votre capsule de connaissance pour le cercle ${circle.nom}...`}
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    className="w-full text-xs p-3.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 leading-relaxed resize-none bg-slate-50/50"
                  />
                ) : (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <p className="text-xs font-bold text-slate-700 mb-2">Enregistrement audio pour {circle.nom}</p>
                    <AudioRecorder
                      onAudioReady={(base64) => setPostContent(base64)}
                      onCancel={() => setPostType('texte')}
                    />
                    {postContent && (
                      <div className="mt-3 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-semibold">
                        ✓ Capsule audio enregistrée avec succès (prête à être publiée)
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Langue :</span>
                    <select
                      value={postLang}
                      onChange={(e) => setPostLang(e.target.value as any)}
                      className="text-xs bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg font-bold text-slate-700 focus:outline-none"
                    >
                      <option value="fr">Français</option>
                      <option value="ha">Hausa (Haoussa)</option>
                      <option value="en">English</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={!postContent.trim() || isSubmitting}
                    className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Publication...' : 'Publier la capsule'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Sub-tab view 1: FEED */}
          {activeSubTab === 'feed' && (
            <div className="space-y-4">
              
              {/* Filter pills */}
              <div className="flex items-center justify-between bg-white border border-slate-100 p-2.5 rounded-2xl shadow-xs">
                <span className="text-xs font-bold text-slate-700 px-2">
                  Flux du groupe ({circleCapsules.length})
                </span>

                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFilterType('all')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                      filterType === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Toutes
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('audio')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                      filterType === 'audio'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>Audios</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('texte')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                      filterType === 'texte'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Textes
                  </button>
                </div>
              </div>

              {/* Feed Capsules List */}
              {circleCapsules.length === 0 ? (
                <div className="bg-white border border-slate-100 rounded-3xl p-8 text-center space-y-3 shadow-xs">
                  <BookOpen className="w-12 h-12 text-slate-300 mx-auto stroke-1" />
                  <h3 className="font-bold text-slate-800 text-base">Aucune capsule dans {circle.nom}</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    Soyez le premier membre à publier une capsule de connaissance ou un conseil pratique dans ce cercle !
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowPostBox(true)}
                    className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-xl transition inline-flex items-center gap-2 shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Créer la première capsule</span>
                  </button>
                </div>
              ) : (
                circleCapsules.map((capsule) => (
                  <CapsuleCard
                    key={capsule.id}
                    capsule={capsule}
                    currentUser={currentUser}
                  />
                ))
              )}
            </div>
          )}

          {/* Sub-tab view 2: ABOUT */}
          {activeSubTab === 'about' && (
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs space-y-6">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Info className="w-5 h-5 text-emerald-600" />
                  <span>Présentation du cercle</span>
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed mt-2">
                  {circle.description}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-extrabold uppercase text-slate-400">Catégorie officielle</p>
                  <p className="text-sm font-bold text-slate-900 mt-1">{circle.categorie}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-extrabold uppercase text-slate-400">Langues acceptées</p>
                  <p className="text-sm font-bold text-slate-900 mt-1">Français, Haoussa, Anglais</p>
                </div>
              </div>
            </div>
          )}

          {/* Sub-tab view 3: MEMBERS & RULES */}
          {activeSubTab === 'members' && (
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs space-y-6">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <span>Règles de communauté du cercle</span>
                </h3>
                <ul className="mt-3 space-y-2 text-xs text-slate-600 leading-relaxed list-disc list-inside">
                  <li>Respect mutuel et bienveillance envers tous les membres du Sahel.</li>
                  <li>Partage exclusif de connaissances pratiques, médicales, scientifiques ou culturelles vérifiées.</li>
                  <li>Les capsules vocales en langues locales (Haoussa, Zarma, etc.) sont très encouragées.</li>
                  <li>Pas de spam, publicité déplacée ou contenu haineux.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Circle Details & Guidelines */}
        <div className="lg:col-span-4 space-y-4">
          
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-wider text-emerald-600">
              <Sparkles className="w-4 h-4" />
              <span>À propos du cercle</span>
            </h3>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex items-center justify-between pb-2 border-b border-slate-50">
                <span className="text-slate-400">Statut :</span>
                <span className="font-bold text-slate-800">Groupe ouvert</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-50">
                <span className="text-slate-400">Nom du groupe :</span>
                <span className="font-bold text-slate-900 truncate max-w-[150px]">{circle.nom}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-50">
                <span className="text-slate-400">Domaine :</span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg">{circle.categorie}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Capsules publiées :</span>
                <span className="font-bold text-slate-900">{circleCapsules.length}</span>
              </div>
            </div>
          </div>

          <div className="bg-emerald-950 text-white rounded-2xl p-5 shadow-sm relative overflow-hidden">
            <div className="relative z-10 space-y-2">
              <span className="px-2 py-0.5 bg-emerald-500 text-slate-950 font-black text-[10px] rounded-md uppercase tracking-wider">
                Partager le savoir
              </span>
              <h4 className="font-bold text-sm text-white">Incitez vos proches à rejoindre ce cercle</h4>
              <p className="text-xs text-emerald-200/80 leading-relaxed">
                Transmettez des connaissances précieuses pour le Sahel et l'Afrique de l'Ouest.
              </p>
              <button
                type="button"
                onClick={handleShareCircle}
                className="mt-2 w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{shareCopied ? 'Lien copié dans le presse-papier !' : 'Partager ce cercle'}</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default CircleGroupPage;
