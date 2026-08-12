import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { formButtonVariants, type FieldSize, type FieldTone } from '../ui/Form';
import { AnchoredPopover } from './AnchoredPopover';
import { COMPOSER_FLOATING_Z } from '../../lib/anchoredPopover';
import {
  SOCIAL_BODY_STYLE,
  optionsFromSelectChildren,
  selectedOptionLabel,
} from '../../lib/socialControlTypography';

/**
 * Sosyal Medya control standardı — tablo secondary body ile aynı stack:
 * 12px / 400 / 1.25 / inherit font. Native <select> kullanılmaz.
 */
export const SOCIAL_CONTROL_CLASS = 'ww-social-field';
export const SOCIAL_TOOLBAR_CONTROL_CLASS = 'ww-social-field ww-social-toolbar';
export const SOCIAL_DATE_CLASS = `${SOCIAL_CONTROL_CLASS} [color-scheme:light]`;
export const SOCIAL_TOOLBAR_DATE_CLASS = `${SOCIAL_TOOLBAR_CONTROL_CLASS} w-[120px] shrink-0 [color-scheme:light]`;
export const SOCIAL_TEXTAREA_CLASS =
  'ww-social-textarea w-full rounded-[var(--ww-control-radius)] border border-[var(--ww-border)] bg-white px-2.5 py-2 text-[var(--ww-text)] outline-none transition duration-[var(--ww-motion-fast)] placeholder:text-ink-300 hover:border-[var(--ww-border-strong)] focus:border-accent/40 focus:shadow-[0_0_0_2px_rgb(67_97_238/0.1)]';

function isToolbarSize(size?: FieldSize) {
  return size === 'toolbar' || size === 'sm';
}

function fieldClass(size?: FieldSize) {
  return isToolbarSize(size) ? SOCIAL_TOOLBAR_CONTROL_CLASS : SOCIAL_CONTROL_CLASS;
}

export function FieldLabel({
  children,
  className = '',
  tone: _tone = 'editorial',
}: {
  children: ReactNode;
  className?: string;
  tone?: FieldTone;
}) {
  return (
    <span
      className={`text-[11px] font-medium leading-[1.25] tracking-normal text-[var(--ww-text-muted)] ${className}`}
    >
      {children}
    </span>
  );
}

export function SocialFilterToolbar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex w-full min-w-0 flex-wrap items-center gap-1.5 ${className}`}>
      {children}
    </div>
  );
}

export function Button({
  size = 'compact',
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: keyof typeof formButtonVariants;
  size?: FieldSize | 'icon';
}) {
  const density =
    size === 'toolbar' || size === 'sm'
      ? 'ww-social-toolbar'
      : size === 'icon'
        ? 'ww-social-icon'
        : '';
  return (
    <button
      className={`ww-social-btn ${density} ${formButtonVariants[variant]} ${variant === 'primary' ? 'shadow-none' : ''} transition duration-[var(--ww-motion-fast)] disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
      {...props}
      style={{
        fontFamily: 'inherit',
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1.25,
        letterSpacing: 0,
        ...props.style,
      }}
    >
      {children}
    </button>
  );
}

export function Input({
  label,
  className = '',
  size = 'compact',
  tone: _tone,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label?: string;
  size?: FieldSize;
  tone?: FieldTone;
}) {
  const input = (
    <input
      className={`${fieldClass(size)} ${className}`}
      {...props}
      style={{ ...SOCIAL_BODY_STYLE, ...props.style }}
    />
  );
  if (!label) return input;
  return (
    <label className="block space-y-0.5">
      <FieldLabel>{label}</FieldLabel>
      {input}
    </label>
  );
}

export function Select({
  label,
  className = '',
  size = 'compact',
  tone: _tone,
  children,
  value,
  disabled,
  name,
  id,
  onChange,
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
  label?: string;
  size?: FieldSize;
  tone?: FieldTone;
  children: ReactNode;
}) {
  const options = useMemo(() => optionsFromSelectChildren(children), [children]);
  const current = value == null ? '' : String(value);
  const display = selectedOptionLabel(options, current);
  const isEmpty = current === '';
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [menuWidth, setMenuWidth] = useState(160);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    setMenuWidth(Math.max(anchorRef.current.getBoundingClientRect().width, 140));
  }, [open]);

  function pick(next: string) {
    onChange?.({
      target: { value: next, name: name ?? '' },
      currentTarget: { value: next, name: name ?? '' },
    } as Parameters<NonNullable<typeof onChange>>[0]);
    setOpen(false);
  }

  const trigger = (
    <span className={`relative inline-flex min-w-0 shrink-0 items-center ${label ? 'w-full' : className || 'w-full'}`}>
      <button
        ref={anchorRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`${fieldClass(size)} w-full pr-6 text-left ${label ? className : ''} ${open ? 'border-accent/40' : ''}`}
        style={SOCIAL_BODY_STYLE}
      >
        <span
          className={`min-w-0 flex-1 truncate ${isEmpty ? 'text-[var(--ww-text-muted)]' : 'text-[var(--ww-text)]'}`}
          style={SOCIAL_BODY_STYLE}
        >
          {display || '—'}
        </span>
      </button>
      <ChevronDown
        size={11}
        strokeWidth={1.75}
        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-400"
        aria-hidden
      />
      <AnchoredPopover
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        width={menuWidth}
        zIndex={COMPOSER_FLOATING_Z}
        className="max-h-[220px] overflow-y-auto py-1"
      >
        {options.map((opt) => (
          <button
            key={opt.value || '__empty'}
            type="button"
            role="option"
            disabled={opt.disabled}
            aria-selected={opt.value === current}
            onClick={() => pick(opt.value)}
            className={`flex w-full items-center px-2.5 py-1.5 text-left hover:bg-ink-50 disabled:opacity-40 ${
              opt.value === current ? 'text-accent-strong' : 'text-[var(--ww-text)]'
            }`}
            style={SOCIAL_BODY_STYLE}
          >
            {opt.label}
          </button>
        ))}
      </AnchoredPopover>
    </span>
  );

  if (!label) return trigger;
  return (
    <div className="block space-y-0.5">
      <FieldLabel>{label}</FieldLabel>
      {trigger}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Ara...',
  className = '',
  size = 'compact',
  tone: _tone,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  size?: FieldSize;
  tone?: FieldTone;
}) {
  const toolbar = isToolbarSize(size);
  return (
    <div className={`relative flex-1 ${toolbar ? 'min-w-[160px]' : 'min-w-[180px]'} ${className}`}>
      <Search
        size={12}
        strokeWidth={1.75}
        className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-400"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${fieldClass(size)} w-full pl-7 pr-2`}
        style={SOCIAL_BODY_STYLE}
      />
    </div>
  );
}

export function TextArea({
  label,
  className = '',
  tone: _tone,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  tone?: FieldTone;
}) {
  return (
    <label className="block space-y-0.5">
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <textarea
        className={`${SOCIAL_TEXTAREA_CLASS} ${className}`}
        {...props}
        style={{ ...SOCIAL_BODY_STYLE, lineHeight: 1.45, ...props.style }}
      />
    </label>
  );
}

export function DateInput({
  className = '',
  density = 'compact',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { density?: 'compact' | 'toolbar' }) {
  return (
    <input
      lang="tr"
      className={`${density === 'toolbar' ? SOCIAL_TOOLBAR_DATE_CLASS : SOCIAL_DATE_CLASS} ${className}`}
      {...props}
      style={{ ...SOCIAL_BODY_STYLE, ...props.style }}
    />
  );
}