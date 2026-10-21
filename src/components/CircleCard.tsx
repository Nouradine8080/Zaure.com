import React from 'react';
import { Users, LogIn, Check, ArrowRight } from 'lucide-react';
import { Circle, UserProfile } from '../types';
import { useTranslation } from '../context/LanguageContext';

interface CircleCardProps {
  circle: Circle;
  isJoined: boolean;
  onToggleJoin: () => void;
  onSelect: () => void;
  isActive: boolean;
  currentUser: UserProfile | null;
  key?: React.Key;
}

export default function CircleCard({ circle, isJoined, onToggleJoin, onSelect, isActive, currentUser }: CircleCardProps) {
  const { t } = useTranslation();

  return (
    <article
      className={`group relative rounded-2xl overflow-hidden transition-all duration-200 bg-white flex flex-col justify-between border ${
        isActive 
          ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-md' 
          : 'border-slate-200/80 hover:border-blue-500/40 hover:shadow-md'
      }`}
      id={`circle-card-${circle.id}`}
    >
      {/* Cover Image & Category */}
      <div 
        className="relative h-32 sm:h-36 w-full bg-slate-900 overflow-hidden cursor-pointer select-none" 
        onClick={onSelect}
      >
        <img
          src={circle.image}
          alt={circle.nom}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent" />
        
        {/* Unboxed clean metadata kicker */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 text-[11px] font-semibold text-white/90 drop-shadow-sm">
          <span>{circle.categorie}</span>
          <span aria-hidden="true" className="text-red-400">·</span>
          <span className="text-blue-200 font-medium">Cercle de savoir</span>
        </div>

        {isJoined && (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-blue-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md backdrop-blur-xs shadow-xs">
            <Check className="w-3 h-3 stroke-[3]" />
            <span>Membre</span>
          </div>
        )}

        <div className="absolute bottom-2.5 left-3 right-3">
          <h3 className="font-extrabold text-white text-base leading-tight drop-shadow-sm line-clamp-1 group-hover:text-blue-200 transition-colors">
            {circle.nom}
          </h3>
        </div>
      </div>

      {/* Circle details */}
      <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between gap-3">
        <p 
          className="text-slate-600 text-xs line-clamp-2 leading-relaxed cursor-pointer hover:text-slate-900 transition-colors"
          onClick={onSelect}
        >
          {circle.description}
        </p>

        {/* Action Controls - touch targets >= 44px */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleJoin();
            }}
            className={`min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition flex-1 ${
              isJoined
                ? 'bg-slate-100 hover:bg-red-50 hover:text-red-700 text-slate-700 active:scale-[0.98]'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs active:scale-[0.98]'
            }`}
          >
            {isJoined ? (
              <>
                <Check className="w-3.5 h-3.5 text-blue-600" />
                <span>Membre</span>
              </>
            ) : (
              <>
                <LogIn className="w-3.5 h-3.5" />
                <span>Rejoindre</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className={`min-h-[44px] px-3.5 py-2 text-xs font-bold rounded-xl border transition flex items-center justify-center gap-1 shrink-0 ${
              isActive
                ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
            }`}
            title="Consulter les capsules du cercle"
          >
            <span>Voir</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}
