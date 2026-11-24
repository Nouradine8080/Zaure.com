import React from 'react';

export type ZaureBackdropVariant = 'hero' | 'canvas' | 'night' | 'auth';

interface ZaureGeometricBackdropProps {
  variant?: ZaureBackdropVariant;
  className?: string;
}

/**
 * Décor géométrique vectoriel léger (arcs concentriques, grille de points et halo radial).
 * Conçu sans filtres blur lourds pour garder une fluidité 60fps sur smartphone Android.
 */
export const ZaureGeometricBackdrop: React.FC<ZaureGeometricBackdropProps> = ({
  variant = 'hero',
  className = '',
}) => {
  if (variant === 'canvas') {
    return (
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 overflow-hidden z-0 ${className}`}
      >
        <svg
          className="absolute -top-24 -right-24 w-[420px] h-[420px] text-blue-600/[0.045] dark:text-sky-400/[0.06]"
          viewBox="0 0 400 400"
          fill="none"
        >
          <circle cx="200" cy="200" r="180" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="200" cy="200" r="132" stroke="currentColor" strokeWidth="1.25" strokeDasharray="8 8" />
          <circle cx="200" cy="200" r="82" stroke="currentColor" strokeWidth="1" />
        </svg>
        <svg
          className="hidden sm:block absolute bottom-8 -left-24 w-[360px] h-[360px] text-indigo-600/[0.04] dark:text-blue-400/[0.055]"
          viewBox="0 0 360 360"
          fill="none"
        >
          <rect
            x="60"
            y="60"
            width="240"
            height="240"
            rx="48"
            transform="rotate(24 180 180)"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect
            x="105"
            y="105"
            width="150"
            height="150"
            rx="32"
            transform="rotate(24 180 180)"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </svg>
      </div>
    );
  }

  if (variant === 'auth') {
    return (
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 overflow-hidden z-0 ${className}`}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 18% 15%, rgba(37, 99, 235, 0.14), transparent 46%), radial-gradient(circle at 86% 82%, rgba(14, 165, 233, 0.15), transparent 48%)',
          }}
        />
        <svg
          className="absolute -top-28 -right-28 w-[460px] h-[460px] text-blue-600/[0.09] dark:text-sky-400/[0.1]"
          viewBox="0 0 460 460"
          fill="none"
        >
          <circle cx="230" cy="230" r="210" stroke="currentColor" strokeWidth="1.75" />
          <circle cx="230" cy="230" r="155" stroke="currentColor" strokeWidth="1.5" strokeDasharray="10 10" />
          <circle cx="230" cy="230" r="98" fill="currentColor" fillOpacity="0.18" />
        </svg>
        <svg
          className="absolute -bottom-24 -left-24 w-[380px] h-[380px] text-indigo-600/[0.08] dark:text-blue-400/[0.09]"
          viewBox="0 0 380 380"
          fill="none"
        >
          <rect
            x="65"
            y="65"
            width="250"
            height="250"
            rx="56"
            transform="rotate(28 190 190)"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <circle cx="190" cy="190" r="78" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
    );
  }

  if (variant === 'night') {
    return (
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 85% 12%, rgba(56, 189, 248, 0.16), transparent 52%), radial-gradient(circle at 12% 88%, rgba(37, 99, 235, 0.18), transparent 55%)',
          }}
        />
        <svg
          className="absolute -right-14 -top-14 w-56 h-56 text-sky-400/10"
          viewBox="0 0 220 220"
          fill="none"
        >
          <circle cx="110" cy="110" r="95" stroke="currentColor" strokeWidth="1.25" />
          <circle cx="110" cy="110" r="62" stroke="currentColor" strokeWidth="1" strokeDasharray="5 5" />
        </svg>
      </div>
    );
  }

  // variant === 'hero'
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 92% 16%, rgba(255, 255, 255, 0.24), transparent 44%), radial-gradient(circle at 10% 90%, rgba(14, 165, 233, 0.35), transparent 48%)',
        }}
      />
      <svg
        className="absolute -right-12 -top-12 w-56 h-56 sm:w-72 sm:h-72 text-white/14"
        viewBox="0 0 280 280"
        fill="none"
      >
        <circle cx="140" cy="140" r="126" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="140" cy="140" r="88" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 8" />
        <circle cx="140" cy="140" r="52" fill="currentColor" fillOpacity="0.22" />
      </svg>
      <svg
        className="hidden sm:block absolute left-1/3 -bottom-16 w-48 h-48 text-white/10"
        viewBox="0 0 200 200"
        fill="none"
      >
        <rect
          x="36"
          y="36"
          width="128"
          height="128"
          rx="32"
          transform="rotate(24 100 100)"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
      <svg
        className="absolute left-3 top-3 w-20 h-20 text-white/15"
        viewBox="0 0 80 80"
        fill="none"
      >
        {[0, 1, 2, 3].map((row) =>
          [0, 1, 2, 3].map((col) => (
            <circle
              key={`${row}-${col}`}
              cx={8 + col * 18}
              cy={8 + row * 18}
              r="1.6"
              fill="currentColor"
            />
          ))
        )}
      </svg>
    </div>
  );
};

export default ZaureGeometricBackdrop;
