import React from 'react';
import { Users, LogIn, LogOut, Check } from 'lucide-react';
import { Circle, UserProfile } from '../types';

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
  return (
    <div
      className={`border rounded-2xl overflow-hidden transition-all duration-200 bg-white flex flex-col justify-between ${
        isActive 
          ? 'border-emerald-500 ring-2 ring-emerald-500/10' 
          : 'border-slate-100 hover:border-slate-200 hover:shadow-sm'
      }`}
      id={`circle-card-${circle.id}`}
    >
      {/* Cover Image */}
      <div className="relative h-28 w-full bg-slate-100 overflow-hidden cursor-pointer" onClick={onSelect}>
        <img
          src={circle.image}
          alt={circle.nom}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent" />
        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 bg-slate-900/80 text-white text-[10px] font-semibold rounded-md backdrop-blur-sm border border-slate-700/50 uppercase tracking-wider">
          {circle.categorie}
        </span>
      </div>

      {/* Circle details */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div className="cursor-pointer" onClick={onSelect}>
          <h4 className="font-bold text-slate-900 text-sm leading-snug tracking-tight hover:text-emerald-600 transition-colors">
            {circle.nom}
          </h4>
          <p className="text-slate-500 text-xs mt-1.5 line-clamp-3 leading-relaxed">
            {circle.description}
          </p>
        </div>

        {/* Action Controls */}
        <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between gap-2">
          {currentUser ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleJoin();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition w-full justify-center ${
                isJoined
                  ? 'bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 active:bg-red-100'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm active:bg-emerald-600'
              }`}
            >
              {isJoined ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Membre</span>
                </>
              ) : (
                <>
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Rejoindre</span>
                </>
              )}
            </button>
          ) : (
            <span className="text-[10px] text-slate-400 italic">Inscrivez-vous pour rejoindre</span>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition ${
              isActive
                ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Voir
          </button>
        </div>
      </div>
    </div>
  );
}
