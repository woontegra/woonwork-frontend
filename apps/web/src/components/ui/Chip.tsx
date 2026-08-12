import type { ReactNode } from 'react';

/** Semantic / select-option chip surfaces. Color only for meaning. */
export const CHIP_TONES = {
  gray: 'bg-ink-50 text-ink-600',
  brown: 'bg-amber-50 text-amber-900',
  orange: 'bg-orange-50 text-orange-800',
  yellow: 'bg-amber-50/90 text-amber-800',
  green: 'bg-emerald-50 text-emerald-800',
  blue: 'bg-sky-50 text-sky-800',
  purple: 'bg-violet-50 text-violet-800',
  pink: 'bg-pink-50 text-pink-800',
  red: 'bg-red-50/80 text-red-800/80',
  teal: 'bg-teal-50 text-teal-800',
  danger: 'bg-red-50/80 text-red-800/80',
  warning: 'bg-amber-50 text-amber-800',
  success: 'bg-emerald-50 text-emerald-800',
  info: 'bg-sky-50 text-sky-800',
} as const;

export type ChipTone = keyof typeof CHIP_TONES;

export function optionChipClass(color?: string | null) {
  if (color && color in CHIP_TONES) return CHIP_TONES[color as ChipTone];
  return CHIP_TONES.gray;
}

export function Chip({
  children,
  tone = 'gray',
  className = '',
  title,
}: {
  children: ReactNode;
  tone?: ChipTone | string;
  className?: string;
  title?: string;
}) {
  const surface = tone in CHIP_TONES ? CHIP_TONES[tone as ChipTone] : optionChipClass(tone);
  return (
    <span
      title={title}
      className={`inline-flex h-[20px] max-w-full items-center truncate rounded-[4px] px-1.5 text-[11px] font-medium ${surface} ${className}`}
    >
      {children}
    </span>
  );
}
