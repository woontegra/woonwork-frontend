export function CompactSwitch({
  checked,
  disabled,
  loading,
  onChange,
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  disabled?: boolean;
  loading?: boolean;
  onChange: (next: boolean) => void;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled || loading}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled && !loading) onChange(!checked);
      }}
      className={`relative inline-flex h-[16px] w-[30px] shrink-0 items-center rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-45 ${
        checked ? 'bg-accent' : 'bg-ink-200'
      } ${loading ? 'opacity-60' : ''}`}
    >
      <span
        className={`inline-block h-[12px] w-[12px] rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.18)] transition-transform duration-150 ${
          checked ? 'translate-x-[15px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  );
}
