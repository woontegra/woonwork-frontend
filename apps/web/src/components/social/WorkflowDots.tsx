import { Check } from 'lucide-react';

const STEPS = [
  { key: 'edited', label: 'Kontrol', short: 'Kontrol' },
  { key: 'approved', label: 'Onay', short: 'Onay' },
  { key: 'readyToPublish', label: 'Yayına Hazır', short: 'Hazır' },
  { key: 'published', label: 'Yayınlandı', short: 'Yayın' },
] as const;

export type WorkflowFlags = {
  edited: boolean;
  approved: boolean;
  readyToPublish: boolean;
  published: boolean;
};

function currentStepIndex(flags: WorkflowFlags) {
  if (flags.published) return 3;
  if (flags.readyToPublish) return 2;
  if (flags.approved) return 1;
  if (flags.edited) return 0;
  return -1;
}

/** Compact icon dots for list rows. */
export function WorkflowDots({
  flags,
  onToggle,
  disabled,
}: {
  flags: WorkflowFlags;
  onToggle?: (key: keyof WorkflowFlags, value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-0.5" role="group" aria-label="İş akışı">
      {STEPS.map((step) => {
        const on = flags[step.key];
        const locked =
          (step.key === 'readyToPublish' && !flags.approved) ||
          (step.key === 'published' && !flags.readyToPublish);
        return (
          <button
            key={step.key}
            type="button"
            title={step.label}
            disabled={disabled || (locked && !on)}
            onClick={() => onToggle?.(step.key, !on)}
            className={`inline-flex h-6 w-6 items-center justify-center rounded-[4px] transition ${
              on
                ? 'bg-[rgb(67_97_238/0.1)] text-accent-strong'
                : 'text-[var(--ww-text-muted)] hover:bg-ink-50'
            } disabled:opacity-35`}
          >
            {on ? <Check size={12} strokeWidth={2.4} /> : <span className="h-1.5 w-1.5 rounded-full bg-ink-200" />}
          </button>
        );
      })}
    </div>
  );
}

/** Interactive compact step rail for the composer. */
export function WorkflowStepRail({
  flags,
  onToggle,
  disabled,
}: {
  flags: WorkflowFlags;
  onToggle?: (key: keyof WorkflowFlags, value: boolean) => void;
  disabled?: boolean;
}) {
  const currentIdx = currentStepIndex(flags);
  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1" role="group" aria-label="İş akışı">
      <span
        className={`inline-flex h-7 items-center rounded-[6px] px-2 text-[12px] ${
          currentIdx < 0
            ? 'bg-[rgb(67_97_238/0.1)] font-medium text-accent-strong'
            : 'text-[var(--ww-text-muted)]'
        }`}
      >
        Hazırlık
      </span>
      <span className="text-[11px] text-[var(--ww-text-muted)]" aria-hidden>
        →
      </span>
      {STEPS.map((step, i) => {
        const on = flags[step.key];
        const locked =
          (step.key === 'readyToPublish' && !flags.approved) ||
          (step.key === 'published' && !flags.readyToPublish);
        const isCurrent = currentIdx === i;
        return (
          <div key={step.key} className="inline-flex items-center gap-1">
            <button
              type="button"
              title={step.label}
              aria-pressed={on}
              disabled={disabled || (locked && !on)}
              onClick={() => onToggle?.(step.key, !on)}
              className={`inline-flex h-7 items-center gap-1.5 rounded-[6px] px-2 text-[12px] transition ${
                isCurrent
                  ? 'bg-[rgb(67_97_238/0.1)] font-medium text-accent-strong'
                  : on
                    ? 'text-[var(--ww-text-secondary)]'
                    : 'text-[var(--ww-text-muted)] hover:bg-ink-50'
              } disabled:opacity-35`}
            >
              {on ? (
                <Check size={12} strokeWidth={2.4} className="text-accent-strong/80" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-ink-200" />
              )}
              {step.label}
            </button>
            {i < STEPS.length - 1 ? (
              <span className="text-[11px] text-[var(--ww-text-muted)]" aria-hidden>
                →
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function WorkflowRail({ flags }: { flags: WorkflowFlags }) {
  const steps = [
    {
      label: 'Hazırlık',
      on: true,
      current: !flags.edited && !flags.approved && !flags.readyToPublish && !flags.published,
    },
    { label: 'Kontrol', on: flags.edited, current: flags.edited && !flags.approved },
    { label: 'Onay', on: flags.approved, current: flags.approved && !flags.readyToPublish },
    {
      label: 'Yayına Hazır',
      on: flags.readyToPublish,
      current: flags.readyToPublish && !flags.published,
    },
    { label: 'Yayınlandı', on: flags.published, current: flags.published },
  ];
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 text-[12px]" aria-label="İş akışı özeti">
      {steps.map((s, i) => (
        <li key={s.label} className="inline-flex items-center gap-1">
          <span
            className={`inline-flex h-6 items-center gap-1 rounded-[5px] px-1.5 ${
              s.current
                ? 'bg-[rgb(67_97_238/0.1)] font-medium text-accent-strong'
                : s.on
                  ? 'text-[var(--ww-text-secondary)]'
                  : 'text-[var(--ww-text-muted)]'
            }`}
          >
            {s.on && !s.current ? <Check size={11} strokeWidth={2.4} className="opacity-70" /> : null}
            {s.label}
          </span>
          {i < steps.length - 1 ? (
            <span className="text-[var(--ww-text-muted)]" aria-hidden>
              →
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
