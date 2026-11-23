import React from 'react';

interface NavIconProps {
  className?: string;
}

/** Solid Home icon matching ZAURE mockup */
export function SolidHomeIcon({ className = 'w-5 h-5' }: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M11.35 3.24a1 1 0 0 1 1.3 0l8.5 7.36a1 1 0 0 1-.65 1.75H19v7.4a1.25 1.25 0 0 1-1.25 1.25h-3.5a.75.75 0 0 1-.75-.75v-4.5a1.5 1.5 0 0 0-3 0v4.5a.75.75 0 0 1-.75.75h-3.5A1.25 1.25 0 0 1 5 19.75v-7.4H3.5a1 1 0 0 1-.65-1.75l8.5-7.36Z" />
    </svg>
  );
}

/** Solid Two-Person Circle icon matching ZAURE mockup ("Cercles") */
export function SolidCirclesIcon({ className = 'w-5 h-5' }: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <circle cx="9.2" cy="8.2" r="3.4" />
      <path d="M3.2 19.2c0-3.1 2.6-5.4 6-5.4s6 2.3 6 5.4c0 .44-.36.8-.8.8H4a.8.8 0 0 1-.8-.8Z" />
      <circle cx="16.2" cy="9.4" r="2.7" />
      <path d="M15.8 14.3c2.75.25 5 2.25 5 4.9a.8.8 0 0 1-.8.8h-3.35c.08-.34.12-.7.12-1.08 0-1.78-.75-3.4-1.97-4.54.33-.06.66-.09 1-.08Z" />
    </svg>
  );
}

/** Solid Three-Person Communities icon matching ZAURE mockup ("Communautés") */
export function SolidCommunitiesIcon({ className = 'w-5 h-5' }: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <circle cx="12" cy="7.6" r="3.1" />
      <path d="M7 19.2c0-2.9 2.2-5 5-5s5 2.1 5 5c0 .44-.36.8-.8.8H7.8a.8.8 0 0 1-.8-.8Z" />
      <circle cx="5.4" cy="9.8" r="2.3" />
      <path d="M1.8 19.1c0-2.1 1.65-3.85 3.85-4.1-.35 1.1-.45 2.4-.45 4.2 0 .28.05.55.14.8H2.6a.8.8 0 0 1-.8-.8Z" />
      <circle cx="18.6" cy="9.8" r="2.3" />
      <path d="M22.2 19.1c0 .44-.36.8-.8.8h-2.74c.09-.25.14-.52.14-.8 0-1.8-.1-3.1-.45-4.2 2.2.25 3.85 2 3.85 4.1Z" />
    </svg>
  );
}

/** Solid Chat Bubble icon matching ZAURE mockup ("Messages") */
export function SolidMessagesIcon({ className = 'w-5 h-5' }: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 3.5c-5.1 0-9.2 3.65-9.2 8.15 0 2.38 1.15 4.53 3 6.02-.17 1.1-.66 2.18-1.45 3a.55.55 0 0 0 .43.93c1.68-.1 3.24-.66 4.46-1.48.88.24 1.8.38 2.76.38 5.1 0 9.2-3.65 9.2-8.15S17.1 3.5 12 3.5Z" />
    </svg>
  );
}

/** Solid Notification Bell icon matching ZAURE mockup ("Notifications") */
export function SolidBellIcon({ className = 'w-5 h-5' }: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 2.75a1.25 1.25 0 0 1 1.25 1.25v.36A6.5 6.5 0 0 1 18.5 10.7v4.12l1.46 2.08a.85.85 0 0 1-.7 1.35H4.74a.85.85 0 0 1-.7-1.35L5.5 14.82V10.7a6.5 6.5 0 0 1 5.25-6.34V4A1.25 1.25 0 0 1 12 2.75Zm-2.4 16.5h4.8a2.4 2.4 0 0 1-4.8 0Z" />
    </svg>
  );
}

/** Solid Profile Silhouette icon matching ZAURE mockup ("Profil") */
export function SolidProfileIcon({ className = 'w-5 h-5' }: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <circle cx="12" cy="7.8" r="3.8" />
      <path d="M4.5 19.6c0-3.65 3.35-6.1 7.5-6.1s7.5 2.45 7.5 6.1a1.1 1.1 0 0 1-1.1 1.1H5.6a1.1 1.1 0 0 1-1.1-1.1Z" />
    </svg>
  );
}
