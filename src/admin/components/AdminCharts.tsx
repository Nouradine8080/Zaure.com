import React, { useMemo } from 'react';
import { GroupPost, Capsule, UserProfile } from '../../types';

interface ActivityChartProps {
  users: UserProfile[];
  groupPosts: GroupPost[];
  capsules: Capsule[];
}

export const ActivityTimelineChart: React.FC<ActivityChartProps> = ({
  users,
  groupPosts,
  capsules
}) => {
  const days = useMemo(() => {
    const result: {
      key: string;
      label: string;
      usersCount: number;
      postsCount: number;
    }[] = [];

    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      result.push({ key, label, usersCount: 0, postsCount: 0 });
    }

    const indexByDate = new Map(result.map((r, idx) => [r.key, idx]));

    users.forEach((u) => {
      const dateKey = (u.created_at || '').slice(0, 10);
      const idx = indexByDate.get(dateKey);
      if (idx !== undefined) result[idx].usersCount += 1;
    });

    groupPosts.forEach((p) => {
      const dateKey = (p.createdAt || '').slice(0, 10);
      const idx = indexByDate.get(dateKey);
      if (idx !== undefined) result[idx].postsCount += 1;
    });

    capsules.forEach((c) => {
      const dateKey = (c.created_at || '').slice(0, 10);
      const idx = indexByDate.get(dateKey);
      if (idx !== undefined) result[idx].postsCount += 1;
    });

    return result;
  }, [users, groupPosts, capsules]);

  const maxVal = Math.max(
    1,
    ...days.map((d) => Math.max(d.usersCount, d.postsCount))
  );

  const width = 680;
  const height = 210;
  const padLeft = 32;
  const padRight = 14;
  const padTop = 16;
  const padBottom = 32;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const getX = (idx: number) =>
    padLeft + (idx / Math.max(1, days.length - 1)) * innerW;
  const getY = (val: number) =>
    padTop + innerH - (val / maxVal) * innerH;

  const postsPoints = days.map((d, i) => `${getX(i)},${getY(d.postsCount)}`).join(' ');
  const usersPoints = days.map((d, i) => `${getX(i)},${getY(d.usersCount)}`).join(' ');

  const postsArea = `${padLeft},${padTop + innerH} ${postsPoints} ${getX(days.length - 1)},${padTop + innerH}`;

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Activité sur 14 jours</h3>
          <p className="text-xs text-slate-500">Inscriptions et publications enregistrées dans Firestore</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5 text-slate-700 font-medium">
            <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 inline-block" />
            Publications
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-700 font-medium">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
            Inscriptions
          </span>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[460px] h-52">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const y = padTop + innerH * (1 - ratio);
            const val = Math.round(maxVal * ratio);
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#E2E8F0"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-400 text-[10px] font-mono"
                >
                  {val}
                </text>
              </g>
            );
          })}

          <polygon points={postsArea} fill="rgba(37, 99, 235, 0.08)" />
          <polyline
            fill="none"
            stroke="#2563EB"
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={postsPoints}
          />
          <polyline
            fill="none"
            stroke="#16A34A"
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={usersPoints}
          />

          {days.map((d, i) => (
            <g key={d.key}>
              <circle cx={getX(i)} cy={getY(d.postsCount)} r="3" fill="#2563EB" />
              <circle cx={getX(i)} cy={getY(d.usersCount)} r="3" fill="#16A34A" />
              {i % 2 === 0 && (
                <text
                  x={getX(i)}
                  y={height - 10}
                  textAnchor="middle"
                  className="fill-slate-500 text-[10px] font-mono"
                >
                  {d.label}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
};

interface ContentDistributionProps {
  publicPostsCount: number;
  circlePostsCount: number;
  capsulesCount: number;
  commentsCount: number;
}

export const ContentBreakdownChart: React.FC<ContentDistributionProps> = ({
  publicPostsCount,
  circlePostsCount,
  capsulesCount,
  commentsCount
}) => {
  const items = [
    { label: 'Fil public (hors cercle)', count: publicPostsCount, color: 'bg-blue-600' },
    { label: 'Publications de Cercles', count: circlePostsCount, color: 'bg-indigo-600' },
    { label: 'Capsules de savoir', count: capsulesCount, color: 'bg-emerald-600' },
    { label: 'Commentaires totaux', count: commentsCount, color: 'bg-amber-600' }
  ];

  const total = Math.max(1, items.reduce((sum, i) => sum + i.count, 0));

  return (
    <div>
      <h3 className="text-sm font-bold text-slate-900">Répartition des contenus</h3>
      <p className="text-xs text-slate-500 mb-4">Volumes réels par canal de contribution</p>

      <div className="space-y-3.5">
        {items.map((item) => {
          const pct = Math.round((item.count / total) * 100);
          return (
            <div key={item.label}>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-slate-700">{item.label}</span>
                <span className="font-mono tabular-nums text-slate-900 font-semibold">
                  {item.count} <span className="text-slate-400 font-normal">({pct}%)</span>
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${item.color} transition-all duration-300`}
                  style={{ width: `${Math.max(item.count > 0 ? 3 : 0, pct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
