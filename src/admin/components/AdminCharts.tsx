import React, { useState } from 'react';
import { CommunityActivityRank, TimelineBucket } from '../utils/adminAnalytics';

interface TimelineChartProps {
  series: TimelineBucket[];
  periodLabel: string;
}

export const ActivityTimelineChart: React.FC<TimelineChartProps> = ({ series, periodLabel }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const maxVal = Math.max(
    1,
    ...series.map((d) => Math.max(d.newUsers, d.posts, d.comments))
  );

  const width = 680;
  const height = 225;
  const padLeft = 36;
  const padRight = 16;
  const padTop = 18;
  const padBottom = 32;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const getX = (idx: number) =>
    padLeft + (series.length <= 1 ? innerW / 2 : (idx / (series.length - 1)) * innerW);
  const getY = (val: number) => padTop + innerH - (val / maxVal) * innerH;

  const postsPoints = series.map((d, i) => `${getX(i)},${getY(d.posts)}`).join(' ');
  const commentsPoints = series.map((d, i) => `${getX(i)},${getY(d.comments)}`).join(' ');
  const usersPoints = series.map((d, i) => `${getX(i)},${getY(d.newUsers)}`).join(' ');
  const postsArea =
    series.length > 0
      ? `${getX(0)},${padTop + innerH} ${postsPoints} ${getX(series.length - 1)},${padTop + innerH}`
      : '';

  const activePoint = hoverIdx !== null && series[hoverIdx] ? series[hoverIdx] : null;
  const labelStride = Math.max(1, Math.ceil(series.length / 7));

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Activité quotidienne & publications
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Données Firestore réelles · {periodLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
            <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 inline-block" />
            Publications
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
            <span className="w-2.5 h-2.5 rounded-xs bg-indigo-500 inline-block" />
            Commentaires
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
            Inscriptions
          </span>
        </div>
      </div>

      {/* Live Hover Readout Bar */}
      <div className="mb-2 min-h-[28px] px-3 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        {activePoint ? (
          <>
            <span className="font-mono font-bold text-slate-900 dark:text-white">
              Période : {activePoint.label}
            </span>
            <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums text-[11px]">
              <span className="text-blue-600 dark:text-blue-400 font-semibold">
                Posts : {activePoint.posts}
              </span>
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                Commentaires : {activePoint.comments}
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                Inscriptions : {activePoint.newUsers}
              </span>
            </div>
          </>
        ) : (
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Survolez ou touchez un point de la courbe pour inspecter le détail exact de la période.
          </span>
        )}
      </div>

      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[460px] h-56 select-none">
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
                  className="stroke-slate-200 dark:stroke-slate-800"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {hoverIdx !== null && series[hoverIdx] && (
            <line
              x1={getX(hoverIdx)}
              y1={padTop}
              x2={getX(hoverIdx)}
              y2={padTop + innerH}
              className="stroke-slate-300 dark:stroke-slate-700"
              strokeWidth="1"
            />
          )}

          {postsArea && <polygon points={postsArea} fill="rgba(37, 99, 235, 0.08)" />}
          {series.length > 1 && (
            <>
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
                stroke="#6366F1"
                strokeWidth="1.9"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={commentsPoints}
              />
              <polyline
                fill="none"
                stroke="#16A34A"
                strokeWidth="2.1"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={usersPoints}
              />
            </>
          )}

          {series.map((d, i) => {
            const x = getX(i);
            const isActive = hoverIdx === i;
            const colWidth = series.length > 1 ? innerW / (series.length - 1) : innerW;
            return (
              <g key={d.key}>
                <circle
                  cx={x}
                  cy={getY(d.posts)}
                  r={isActive ? 5 : 2.8}
                  fill="#2563EB"
                />
                <circle
                  cx={x}
                  cy={getY(d.comments)}
                  r={isActive ? 4.5 : 2.4}
                  fill="#6366F1"
                />
                <circle
                  cx={x}
                  cy={getY(d.newUsers)}
                  r={isActive ? 4.5 : 2.6}
                  fill="#16A34A"
                />
                {(i % labelStride === 0 || i === series.length - 1) && (
                  <text
                    x={x}
                    y={height - 10}
                    textAnchor="middle"
                    className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono"
                  >
                    {d.label}
                  </text>
                )}
                <rect
                  x={Math.max(padLeft, x - colWidth / 2)}
                  y={padTop}
                  width={Math.max(12, colWidth)}
                  height={innerH}
                  fill="transparent"
                  className="cursor-crosshair"
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                  onClick={() => setHoverIdx(i)}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

interface UserGrowthChartProps {
  series: TimelineBucket[];
  periodLabel: string;
}

export const UserGrowthChart: React.FC<UserGrowthChartProps> = ({ series, periodLabel }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const maxTotal = Math.max(1, ...series.map((d) => d.cumulativeUsers));
  const width = 560;
  const height = 195;
  const padLeft = 36;
  const padRight = 14;
  const padTop = 14;
  const padBottom = 30;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const getX = (idx: number) =>
    padLeft + (series.length <= 1 ? innerW / 2 : (idx / (series.length - 1)) * innerW);
  const getY = (val: number) => padTop + innerH - (val / maxTotal) * innerH;

  const linePoints = series.map((d, i) => `${getX(i)},${getY(d.cumulativeUsers)}`).join(' ');
  const areaPoints =
    series.length > 0
      ? `${getX(0)},${padTop + innerH} ${linePoints} ${getX(series.length - 1)},${padTop + innerH}`
      : '';
  const stride = Math.max(1, Math.ceil(series.length / 6));
  const active = hoverIdx !== null && series[hoverIdx] ? series[hoverIdx] : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Croissance des utilisateurs</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Cumul réel des comptes créés · {periodLabel}
          </p>
        </div>
        {active && (
          <span className="text-[11px] font-mono tabular-nums px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
            {active.label} : {active.cumulativeUsers} total (+{active.newUsers})
          </span>
        )}
      </div>

      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[380px] h-48 select-none">
          {[0, 0.5, 1].map((ratio, idx) => {
            const y = padTop + innerH * (1 - ratio);
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  className="stroke-slate-200 dark:stroke-slate-800"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono"
                >
                  {Math.round(maxTotal * ratio)}
                </text>
              </g>
            );
          })}

          {areaPoints && <polygon points={areaPoints} fill="rgba(16, 185, 129, 0.12)" />}
          {series.length > 1 && (
            <polyline
              fill="none"
              stroke="#10B981"
              strokeWidth="2.3"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={linePoints}
            />
          )}

          {series.map((d, i) => {
            const x = getX(i);
            const colWidth = series.length > 1 ? innerW / (series.length - 1) : innerW;
            return (
              <g key={d.key}>
                <circle
                  cx={x}
                  cy={getY(d.cumulativeUsers)}
                  r={hoverIdx === i ? 4.8 : 2.5}
                  fill="#10B981"
                />
                {(i % stride === 0 || i === series.length - 1) && (
                  <text
                    x={x}
                    y={height - 8}
                    textAnchor="middle"
                    className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono"
                  >
                    {d.label}
                  </text>
                )}
                <rect
                  x={Math.max(padLeft, x - colWidth / 2)}
                  y={padTop}
                  width={Math.max(12, colWidth)}
                  height={innerH}
                  fill="transparent"
                  className="cursor-crosshair"
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                  onClick={() => setHoverIdx(i)}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

interface CommunityActivityChartProps {
  communities: CommunityActivityRank[];
  periodLabel: string;
}

export const CommunityActivityChart: React.FC<CommunityActivityChartProps> = ({
  communities,
  periodLabel
}) => {
  const maxScore = Math.max(1, ...communities.map((c) => Math.max(c.periodPosts + c.periodComments, c.memberCount)));

  return (
    <div>
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Activité des communautés</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
        Communautés les plus actives · {periodLabel}
      </p>

      {communities.length === 0 ? (
        <p className="py-8 text-xs text-slate-500 dark:text-slate-400 text-center">
          Aucune communauté enregistrée dans Firestore.
        </p>
      ) : (
        <div className="space-y-3">
          {communities.map((c) => {
            const periodEvents = c.periodPosts + c.periodComments;
            const barSource = periodEvents > 0 ? periodEvents : c.memberCount;
            const pct = Math.round((barSource / maxScore) * 100);
            return (
              <div key={c.groupId}>
                <div className="flex items-center justify-between gap-2 text-xs mb-1">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {c.name}
                  </span>
                  <span className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                    {c.periodPosts} posts · {c.periodComments} com · {c.memberCount} mb
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      periodEvents > 0 ? 'bg-blue-600' : 'bg-slate-400 dark:bg-slate-600'
                    }`}
                    style={{ width: `${Math.max(barSource > 0 ? 4 : 0, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
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
    { label: 'Fil public (hors communauté)', count: publicPostsCount, color: 'bg-blue-600' },
    { label: 'Publications de communautés', count: circlePostsCount, color: 'bg-indigo-600' },
    { label: 'Capsules de savoir', count: capsulesCount, color: 'bg-emerald-600' },
    { label: 'Commentaires totaux', count: commentsCount, color: 'bg-amber-500' }
  ];

  const total = Math.max(1, items.reduce((sum, i) => sum + i.count, 0));

  return (
    <div>
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Répartition des contenus</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Volumes réels par canal de contribution</p>

      <div className="space-y-3.5">
        {items.map((item) => {
          const pct = Math.round((item.count / total) * 100);
          return (
            <div key={item.label}>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-slate-700 dark:text-slate-300">{item.label}</span>
                <span className="font-mono tabular-nums text-slate-900 dark:text-white font-semibold">
                  {item.count}{' '}
                  <span className="text-slate-400 dark:text-slate-500 font-normal">({pct}%)</span>
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
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
