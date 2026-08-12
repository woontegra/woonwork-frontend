import { useRef, useState } from 'react';
import type { SocialPlatform } from '@woonwork/shared';
import { platformLabels, type SocialDestinationDto } from '../../lib/social';
import { SocialPlatformIcon } from './SocialPlatformIcon';
import { AnchoredPopover } from './AnchoredPopover';

function accountLine(dest: SocialDestinationDto): string {
  const label = platformLabels[dest.platform] ?? dest.platform;
  const acct = dest.account;
  const handle = acct?.username ? `@${acct.username}` : acct?.name ?? '';
  const base = handle ? `${label} · ${handle}` : label;
  if (dest.publicationStatus === 'FAILED') {
    return `${base}\nYayın başarısız`;
  }
  return base;
}

function groupDestinationsByPlatform(destinations: SocialDestinationDto[]) {
  const order: SocialPlatform[] = [];
  const groups = new Map<SocialPlatform, SocialDestinationDto[]>();

  for (const dest of destinations) {
    if (!groups.has(dest.platform)) {
      order.push(dest.platform);
      groups.set(dest.platform, []);
    }
    groups.get(dest.platform)!.push(dest);
  }

  return order.map((platform) => ({
    platform,
    destinations: groups.get(platform)!,
  }));
}

function PlatformIconWithTooltip({
  platform,
  dests,
  iconSize,
}: {
  platform: SocialPlatform;
  dests: SocialDestinationDto[];
  iconSize: number;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const hasFailed = dests.some((d) => d.publicationStatus === 'FAILED');
  const extra = dests.length > 1 ? dests.length - 1 : 0;
  const tooltip = dests.map(accountLine).join('\n');

  return (
    <>
      <span
        ref={anchorRef}
        className="relative inline-flex items-center gap-0.5"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <SocialPlatformIcon platform={platform} size={iconSize} />
        {extra > 0 ? (
          <span className="text-[9px] font-medium leading-none text-ink-400">+{extra}</span>
        ) : null}
        {hasFailed ? (
          <span
            className="absolute -right-0.5 -top-0.5 h-[5px] w-[5px] rounded-full bg-red-500 ring-[1.5px] ring-white"
            aria-hidden
          />
        ) : null}
      </span>
      <AnchoredPopover
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        width={280}
        closeOnOutside={false}
        closeOnEscape={false}
        className="pointer-events-none px-2.5 py-1.5"
      >
        <p className="whitespace-pre-wrap text-[11px] leading-snug text-[var(--ww-text-secondary)]">
          {tooltip}
        </p>
      </AnchoredPopover>
    </>
  );
}

export function DestinationPlatformIcons({
  destinations,
  iconSize = 15,
}: {
  destinations?: SocialDestinationDto[];
  iconSize?: number;
}) {
  if (!destinations?.length) {
    return <span className="text-[11px] text-ink-300">—</span>;
  }

  const groups = groupDestinationsByPlatform(destinations);

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {groups.map(({ platform, destinations: dests }) => (
        <PlatformIconWithTooltip key={platform} platform={platform} dests={dests} iconSize={iconSize} />
      ))}
    </span>
  );
}
