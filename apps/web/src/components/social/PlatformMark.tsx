import type { SocialPlatform } from '@woonwork/shared';
import { platformLabels, platformShort } from '../../lib/social';

export function PlatformMark({
  platform,
  showLabel = false,
}: {
  platform: SocialPlatform;
  showLabel?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--ww-text-secondary)]"
      title={platformLabels[platform]}
    >
      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] bg-ink-50 px-1 text-[9px] font-semibold tracking-wide text-ink-700">
        {platformShort[platform]}
      </span>
      {showLabel ? platformLabels[platform] : null}
    </span>
  );
}

export function PlatformRow({ platforms }: { platforms: SocialPlatform[] }) {
  if (!platforms.length) {
    return <span className="text-[12px] text-[var(--ww-text-muted)]">—</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {platforms.map((p) => (
        <PlatformMark key={p} platform={p} />
      ))}
    </span>
  );
}
