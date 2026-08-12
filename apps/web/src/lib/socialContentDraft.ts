import type { MediaAssetDto } from './media';

export type DraftMediaPick = {
  asset: MediaAssetDto;
  /** Uploaded during this composer session — safe to delete on discard. */
  uploadedInSession: boolean;
};

export function hasUnsavedNewDraftChanges(input: {
  title: string;
  contentText: string;
  internalNotes: string;
  accountIds: string[];
  draftMedia: DraftMediaPick[];
  platforms: string[];
  scheduledAt: string;
  brandId: string;
  defaultBrandId: string;
  presetScheduledAt?: string | null;
}): boolean {
  if (input.title.trim()) return true;
  if (input.contentText.trim()) return true;
  if (input.internalNotes.trim()) return true;
  if (input.accountIds.length) return true;
  if (input.draftMedia.length) return true;
  if (input.platforms.length) return true;
  if (input.brandId && input.brandId !== input.defaultBrandId) return true;
  if (input.scheduledAt && input.scheduledAt !== toLocalInputValue(input.presetScheduledAt)) return true;
  return false;
}

function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function sessionUploadAssetIds(draftMedia: DraftMediaPick[]): string[] {
  return draftMedia.filter((m) => m.uploadedInSession).map((m) => m.asset.id);
}

export function addDraftMediaPick(
  draftMedia: DraftMediaPick[],
  asset: MediaAssetDto,
  uploadedInSession: boolean,
): DraftMediaPick[] {
  if (draftMedia.some((m) => m.asset.id === asset.id)) return draftMedia;
  return [...draftMedia, { asset, uploadedInSession }];
}

export function removeDraftMediaPick(draftMedia: DraftMediaPick[], assetId: string): DraftMediaPick[] {
  return draftMedia.filter((m) => m.asset.id !== assetId);
}

export function reorderDraftMediaPicks(draftMedia: DraftMediaPick[], from: number, to: number): DraftMediaPick[] {
  if (from === to || from < 0 || to < 0 || from >= draftMedia.length || to >= draftMedia.length) {
    return draftMedia;
  }
  const next = [...draftMedia];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
