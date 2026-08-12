import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { ChevronDown, Search } from 'lucide-react';

export const formButtonVariants = {
  primary:
    'bg-accent/90 text-white shadow-[0_1px_0_rgb(255_255_255/0.14)_inset] hover:bg-accent-strong hover:brightness-[1.02] active:brightness-95',
  secondary:
    'bg-white text-[var(--ww-text)] ring-1 ring-[var(--ww-border)] hover:bg-ink-50 hover:ring-[var(--ww-border-strong)] active:bg-ink-100/70',
  danger:
    'bg-danger text-white hover:brightness-95 active:brightness-90',
  ghost:
    'bg-transparent text-[var(--ww-text-secondary)] hover:bg-black/[0.04] hover:text-[var(--ww-text)] active:bg-black/[0.06]',
  floating:
    'bg-ink-900 text-white shadow-[var(--ww-shadow-float)] hover:bg-ink-800 hover:-translate-y-px',
};

const variants = formButtonVariants;

const controlRadius = 'rounded-[var(--ww-control-radius)]';

const buttonSizes = {
  sm: `h-8 ${controlRadius} px-2.5 text-[12px] font-medium gap-1.5`,
  toolbar: `h-[30px] rounded-[5px] px-2.5 text-[12px] font-medium leading-[1.25] gap-1`,
  compact: `h-[var(--ww-control-h-sm)] ${controlRadius} px-2.5 text-[13px] font-medium gap-1.5`,
  md: `h-9 ${controlRadius} px-3 text-[13px] font-medium gap-1.5`,
  icon: `h-8 w-8 ${controlRadius} p-0 gap-0`,
};

export function Button({
  children,
  variant = 'primary',
  className = '',
  size = 'compact',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: keyof typeof variants;
  size?: keyof typeof buttonSizes;
}) {
  return (
    <button
      className={`inline-flex items-center justify-center whitespace-nowrap transition-[transform,background-color,box-shadow,color,filter] duration-[var(--ww-motion-fast)] ease-[var(--ww-ease)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 ${variants[variant]} ${buttonSizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({
  children,
  className = '',
  label,
  size = 'sm',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  label: string;
  size?: 'sm' | 'md';
}) {
  const sizes = {
    sm: `h-8 w-8 ${controlRadius}`,
    md: `h-9 w-9 ${controlRadius}`,
  };
  return (
    <button
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center text-[var(--ww-text-secondary)] transition duration-[var(--ww-motion-fast)] hover:bg-black/[0.04] hover:text-[var(--ww-text)] ww-focus-ring ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export type FieldTone = 'default' | 'editorial';
export type FieldSize = 'sm' | 'toolbar' | 'compact' | 'md';

const labelStyles: Record<FieldTone, string> = {
  default: 'text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ww-text-muted)]',
  editorial: 'text-[12px] font-medium tracking-normal text-[var(--ww-text-muted)]',
};

const fieldBaseByTone: Record<FieldTone, string> = {
  default: `${controlRadius} border border-[var(--ww-border)] bg-white text-[var(--ww-text)] outline-none transition duration-[var(--ww-motion-fast)] placeholder:text-[var(--ww-text-muted)] focus:border-accent/55 focus:shadow-[0_0_0_3px_var(--ww-accent-soft)]`,
  editorial: `${controlRadius} border border-[var(--ww-border)] bg-white font-normal text-[var(--ww-text)] outline-none transition duration-[var(--ww-motion-fast)] placeholder:text-ink-300 hover:border-[var(--ww-border-strong)] focus:border-accent/40 focus:shadow-[0_0_0_2px_rgb(67_97_238/0.1)]`,
};

const fieldHeights: Record<FieldSize, string> = {
  sm: 'h-8 px-2.5 text-[12px]',
  toolbar: 'h-[30px] !rounded-[5px] px-2 font-sans text-[12px] font-normal leading-[1.25]',
  compact: 'h-[var(--ww-control-h-sm)] px-2.5 text-[13px] font-normal',
  md: 'h-9 px-2.5 text-[13px]',
};

const selectEndPad: Record<FieldSize, string> = {
  sm: 'pr-6',
  toolbar: 'pr-6',
  compact: 'pr-7',
  md: 'pr-8',
};

const chevronPx: Record<FieldSize, number> = {
  sm: 12,
  toolbar: 11,
  compact: 12,
  md: 14,
};

function fieldStackClass(tone: FieldTone) {
  return tone === 'editorial' ? 'block space-y-0.5' : 'block space-y-1';
}

export function FieldLabel({
  children,
  tone = 'editorial',
  className = '',
}: {
  children: ReactNode;
  tone?: FieldTone;
  className?: string;
}) {
  return <span className={`${labelStyles[tone]} ${className}`}>{children}</span>;
}

export function Input({
  label,
  className = '',
  size = 'compact',
  tone = 'editorial',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label?: string;
  size?: FieldSize;
  tone?: FieldTone;
}) {
  const input = (
    <input
      className={`w-full ${fieldBaseByTone[tone]} ${fieldHeights[size]} ${className}`}
      {...props}
    />
  );
  if (!label) return input;
  return (
    <label className={fieldStackClass(tone)}>
      <FieldLabel tone={tone}>{label}</FieldLabel>
      {input}
    </label>
  );
}

export function Select({
  label,
  className = '',
  size = 'compact',
  tone = 'editorial',
  children,
  ...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
  label?: string;
  size?: FieldSize;
  tone?: FieldTone;
  children: ReactNode;
}) {
  const select = (
    <span className={`relative inline-flex min-w-0 shrink-0 items-center ${label ? 'w-full' : className || 'w-full'}`}>
      <select
        className={`w-full appearance-none font-sans ${fieldBaseByTone[tone]} ${fieldHeights[size]} ${selectEndPad[size]} ${label ? className : ''}`}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={chevronPx[size]}
        strokeWidth={1.75}
        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-400"
        aria-hidden
      />
    </span>
  );

  if (!label) return select;

  return (
    <label className={fieldStackClass(tone)}>
      <FieldLabel tone={tone}>{label}</FieldLabel>
      {select}
    </label>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Ara...',
  className = '',
  size = 'compact',
  tone = 'editorial',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  size?: FieldSize;
  tone?: FieldTone;
}) {
  const toolbar = size === 'toolbar';
  return (
    <div className={`relative flex-1 ${toolbar ? 'min-w-[160px]' : 'min-w-[180px]'} ${className}`}>
      <Search
        size={toolbar ? 12 : size === 'md' ? 14 : 13}
        strokeWidth={1.75}
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-400 ${toolbar ? 'left-2' : 'left-2.5'}`}
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full ${fieldBaseByTone[tone]} ${fieldHeights[size]} ${toolbar ? 'pl-7 pr-2' : 'pl-8 pr-2.5'}`}
      />
    </div>
  );
}

export function TextArea({
  label,
  className = '',
  tone = 'editorial',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  tone?: FieldTone;
}) {
  return (
    <label className={fieldStackClass(tone)}>
      {label ? <FieldLabel tone={tone}>{label}</FieldLabel> : null}
      <textarea
        className={`w-full ${fieldBaseByTone[tone]} min-h-[88px] px-2.5 py-2 text-[13px] font-normal leading-[1.5] ${className}`}
        {...props}
      />
    </label>
  );
}

export function FilterChip({
  label,
  onClear,
}: {
  label: string;
  onClear?: () => void;
}) {
  return (
    <span className={`inline-flex h-8 max-w-[220px] items-center gap-1 ${controlRadius} bg-ink-50 px-2 text-[12px] text-[var(--ww-text-secondary)]`}>
      <span className="truncate">{label}</span>
      {onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 text-[var(--ww-text-muted)] hover:text-[var(--ww-text)]"
          aria-label="Filtreyi kaldır"
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'blue' | 'green' | 'amber' | 'rose';
}) {
  const tones = {
    neutral: 'bg-ink-50 text-ink-700',
    blue: 'bg-accent-soft text-accent-strong',
    green: 'bg-success-soft text-success',
    amber: 'bg-warning-soft text-warning',
    rose: 'bg-danger-soft text-danger',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[var(--ww-radius-sm)] px-1.5 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function StatusChip({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'blue' | 'green' | 'amber' | 'rose';
}) {
  const dots = {
    neutral: 'bg-ink-400',
    blue: 'bg-accent',
    green: 'bg-success',
    amber: 'bg-warning',
    rose: 'bg-danger',
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ww-text-secondary)]">
      <span className={`h-1.5 w-1.5 rounded-full ${dots[tone]}`} />
      {label}
    </span>
  );
}

export function PriorityMark({
  label,
  level,
}: {
  label: string;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | string;
}) {
  const bars =
    level === 'URGENT' ? 4 : level === 'HIGH' ? 3 : level === 'MEDIUM' ? 2 : 1;
  const color =
    level === 'URGENT' || level === 'HIGH'
      ? 'bg-danger'
      : level === 'MEDIUM'
        ? 'bg-warning'
        : 'bg-ink-300';
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-[var(--ww-text-secondary)]">
      <span className="flex items-end gap-0.5" aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (
          <span
            key={i}
            className={`w-0.5 rounded-full ${i < bars ? color : 'bg-ink-100'}`}
            style={{ height: 4 + i * 2 }}
          />
        ))}
      </span>
      {label}
    </span>
  );
}
