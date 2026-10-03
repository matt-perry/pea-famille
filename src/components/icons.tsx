/** Icônes au trait, dans l'esprit des symboles SF. */
type IconProps = { size?: number; title?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const IconChart = ({ size = 26 }: IconProps) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M3 17l5-5 4 3 6-7 3 3" />
    <path d="M3 21h18" />
  </svg>
);

export const IconList = ({ size = 26 }: IconProps) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1" fill="currentColor" />
    <circle cx="4.5" cy="12" r="1" fill="currentColor" />
    <circle cx="4.5" cy="18" r="1" fill="currentColor" />
  </svg>
);

export const IconProjection = ({ size = 26 }: IconProps) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M3 20c5 0 9-2 12-7s4-8 6-9" />
    <path d="M3 20c5 0 9-1 12-4s4-5 6-6" strokeDasharray="2 3" />
  </svg>
);

export const IconPlus = ({ size = 22 }: IconProps) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconGear = ({ size = 22 }: IconProps) => (
  <svg {...base(size)} aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);

export const IconChevronRight = ({ size = 14 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1.5 1.5 6.5 7l-5 5.5" />
  </svg>
);

export const IconChevronLeft = ({ size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 12 20" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 2 2 10l8 8" />
  </svg>
);

export const IconRefresh = ({ size = 20 }: IconProps) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />
    <path d="M4 3v5h5" />
    <path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" />
    <path d="M20 21v-5h-5" />
  </svg>
);

export const IconWarning = ({ size = 18 }: IconProps) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M12 3 2 20h20L12 3z" />
    <path d="M12 10v4M12 17h.01" />
  </svg>
);
