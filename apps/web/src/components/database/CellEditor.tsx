import { useEffect, useMemo, useRef, useState } from 'react';
import type { DatabasePropertyType, SelectOption } from '@woonwork/shared';
import type { DatabasePropertyDto, TenantMemberOption } from '../../lib/database';
import { Chip } from '../ui/Chip';
import { CompactSwitch } from '../ui/CompactSwitch';

const fieldClass =
  'h-[30px] w-full rounded-[6px] border border-[var(--ww-border)] bg-white px-2 font-sans text-[13px] font-normal leading-[1.25] text-[var(--ww-text)] outline-none focus:border-accent/40 focus:shadow-[0_0_0_2px_rgb(67_97_238/0.1)]';

export function CellEditor({
  property,
  value,
  members,
  autoFocus,
  onChange,
  onCommit,
  onCancel,
  onCreateOption,
}: {
  property: DatabasePropertyDto;
  value: unknown;
  members: TenantMemberOption[];
  autoFocus?: boolean;
  onChange: (next: unknown) => void;
  onCommit: (next: unknown) => void;
  onCancel: () => void;
  onCreateOption?: (name: string) => Promise<SelectOption | null>;
}) {
  const type = property.type as DatabasePropertyType;
  const options = (property.config?.options ?? []) as SelectOption[];
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);
  const [newOption, setNewOption] = useState('');

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  if (type === 'CHECKBOX') {
    return (
      <CompactSwitch
        checked={Boolean(value)}
        aria-label={property.name}
        onChange={(next) => onCommit(next)}
      />
    );
  }

  if (type === 'SELECT' || type === 'STATUS') {
    return (
      <div className="space-y-1">
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          value={typeof value === 'string' ? value : ''}
          className={fieldClass}
          onChange={(e) => onCommit(e.target.value || null)}
          onBlur={() => {
            if (!newOption.trim()) onCancel();
          }}
        >
          <option value="">—</option>
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name}
            </option>
          ))}
        </select>
        {onCreateOption ? (
          <input
            value={newOption}
            placeholder="Yeni seçenek"
            className={fieldClass}
            onChange={(e) => setNewOption(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newOption.trim()) {
                e.preventDefault();
                void onCreateOption(newOption.trim()).then((opt) => {
                  setNewOption('');
                  if (opt) onCommit(opt.id);
                });
              }
              if (e.key === 'Escape') onCancel();
            }}
          />
        ) : null}
      </div>
    );
  }

  if (type === 'MULTI_SELECT') {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="max-h-40 space-y-1 overflow-y-auto rounded-[6px] border border-[var(--ww-border)] bg-white p-1.5">
        {options.map((opt) => {
          const checked = selected.includes(opt.id);
          return (
            <label key={opt.id} className="flex cursor-pointer items-center gap-2 px-1 py-0.5 text-[12px]">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  const next = checked
                    ? selected.filter((id) => id !== opt.id)
                    : [...selected, opt.id];
                  onCommit(next);
                }}
              />
              <Chip tone={opt.color}>{opt.name}</Chip>
            </label>
          );
        })}
      </div>
    );
  }

  if (type === 'PERSON') {
    return (
      <select
        ref={inputRef as React.RefObject<HTMLSelectElement>}
        value={typeof value === 'string' ? value : ''}
        className={fieldClass}
        onChange={(e) => onCommit(e.target.value || null)}
        onBlur={onCancel}
      >
        <option value="">—</option>
        {members.map((m) => (
          <option key={m.user.id} value={m.user.id}>
            {m.user.firstName} {m.user.lastName}
          </option>
        ))}
      </select>
    );
  }

  if (type === 'DATE') {
    const dateValue =
      typeof value === 'string' && value ? value.slice(0, 10) : '';
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="date"
        lang="tr"
        value={dateValue}
        className={fieldClass}
        onChange={(e) => onCommit(e.target.value ? new Date(e.target.value).toISOString() : null)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
        }}
      />
    );
  }

  if (type === 'NUMBER') {
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="number"
        value={typeof value === 'number' ? value : value === null || value === undefined ? '' : String(value)}
        className={fieldClass}
        onChange={(e) => {
          const next = e.target.value === '' ? null : Number(e.target.value);
          onChange(next);
        }}
        onBlur={() => onCommit(value === '' ? null : value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCommit(value === '' ? null : value);
          if (e.key === 'Escape') onCancel();
        }}
      />
    );
  }

  const inputType =
    type === 'EMAIL' ? 'email' : type === 'URL' ? 'url' : type === 'PHONE' ? 'tel' : 'text';

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type={inputType}
      value={typeof value === 'string' ? value : ''}
      className={fieldClass}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => onCommit(typeof value === 'string' ? value : '')}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit(typeof value === 'string' ? value : '');
        if (e.key === 'Escape') onCancel();
      }}
    />
  );
}

export function CellDisplay({
  property,
  value,
  members,
  onToggleCheckbox,
}: {
  property: DatabasePropertyDto;
  value: unknown;
  members: TenantMemberOption[];
  onToggleCheckbox?: (next: boolean) => void;
}) {
  const options = (property.config?.options ?? []) as SelectOption[];

  if (property.type === 'CHECKBOX') {
    return (
      <CompactSwitch
        checked={Boolean(value)}
        aria-label={property.name}
        onChange={(next) => onToggleCheckbox?.(next)}
      />
    );
  }
  if (property.type === 'SELECT' || property.type === 'STATUS') {
    const opt = options.find((o) => o.id === value);
    if (!opt) return <span className="text-[13px] text-ink-300">—</span>;
    return <Chip tone={opt.color}>{opt.name}</Chip>;
  }
  if (property.type === 'MULTI_SELECT') {
    const ids = Array.isArray(value) ? (value as string[]) : [];
    if (!ids.length) return <span className="text-[13px] text-ink-300">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {ids.map((id) => {
          const opt = options.find((o) => o.id === id);
          if (!opt) return null;
          return (
            <Chip key={id} tone={opt.color}>
              {opt.name}
            </Chip>
          );
        })}
      </div>
    );
  }
  if (property.type === 'PERSON') {
    const member = members.find((m) => m.user.id === value);
    if (!member) return <span className="text-[13px] text-ink-300">—</span>;
    const name = `${member.user.firstName} ${member.user.lastName}`.trim();
    const initial = (member.user.firstName || name).slice(0, 1).toUpperCase();
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] text-[var(--ww-text)]">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-ink-100 text-[10px] font-medium text-ink-600">
          {initial}
        </span>
        {name}
      </span>
    );
  }
  if (property.type === 'DATE' && typeof value === 'string') {
    return <span className="text-[13px] text-[var(--ww-text)]">{value.slice(0, 10)}</span>;
  }
  if (property.type === 'URL' && typeof value === 'string' && value) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="truncate text-[13px] text-accent-strong hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {value}
      </a>
    );
  }
  if (value === null || value === undefined || value === '') {
    return <span className="text-[13px] text-ink-300">—</span>;
  }
  return <span className="truncate text-[13px] text-[var(--ww-text)]">{String(value)}</span>;
}

export function useOptionLabelMap(properties: DatabasePropertyDto[]) {
  return useMemo(() => {
    const map = new Map<string, SelectOption[]>();
    for (const p of properties) {
      map.set(p.id, (p.config?.options ?? []) as SelectOption[]);
    }
    return map;
  }, [properties]);
}
