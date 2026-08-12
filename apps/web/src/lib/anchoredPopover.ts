export const TABLE_FLOATING_Z = 35;
/** Above composer drawer (z-50) so pickers are not trapped under the panel. */
export const COMPOSER_FLOATING_Z = 60;
export const VIEWPORT_PAD = 8;
export const ANCHOR_GAP = 4;

export const HASHTAG_PICKER_WIDTH = 460;
export const HASHTAG_PICKER_MAX_HEIGHT = 460;

export function clampPopoverWidth(desired: number, viewportWidth: number, padding = 12): number {
  return Math.min(desired, Math.max(0, viewportWidth - padding * 2));
}

export type PopoverAlign = 'start' | 'end';

export type AnchorRect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export function computeAnchoredPosition(opts: {
  anchor: AnchorRect;
  width: number;
  height: number;
  align?: PopoverAlign;
  gap?: number;
  padding?: number;
  viewportWidth: number;
  viewportHeight: number;
}): { top: number; left: number; placed: 'below' | 'above' } {
  const gap = opts.gap ?? ANCHOR_GAP;
  const pad = opts.padding ?? VIEWPORT_PAD;
  const align = opts.align ?? 'start';
  const { anchor, width, height, viewportWidth, viewportHeight } = opts;

  const spaceBelow = viewportHeight - pad - (anchor.bottom + gap);
  const spaceAbove = anchor.top - gap - pad;
  const placed: 'below' | 'above' =
    spaceBelow >= height || spaceBelow >= spaceAbove ? 'below' : 'above';

  let top = placed === 'below' ? anchor.bottom + gap : anchor.top - gap - height;
  let left = align === 'end' ? anchor.right - width : anchor.left;

  left = Math.min(left, viewportWidth - pad - width);
  left = Math.max(pad, left);
  top = Math.min(top, viewportHeight - pad - height);
  top = Math.max(pad, top);

  return { top, left, placed };
}
