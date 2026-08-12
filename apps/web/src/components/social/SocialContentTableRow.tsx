import { useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { SocialContentStatus, SocialContentType } from '@woonwork/shared';
import { formatRelative } from '../../lib/labels';
import {
  ALL_STATUSES,
  ALL_TYPES,
  contentTypeLabels,
  type SocialBrandDto,
  type SocialContentDto,
} from '../../lib/social';
import {
  canEditStatus,
  canPublishNow,
  canRetryPublish,
  failedDestinationIds,
  getPublicationDisplayStatus,
  getStatusBadgeLabel,
  statusDisplayLabels,
  type EditingCell,
  type TableCellField,
  type WorkflowField,
  workflowSwitchDisabled,
} from '../../lib/socialContentTable';
import { AnchoredPopover } from './AnchoredPopover';
import { CompactSwitch } from './CompactSwitch';
import { DestinationPlatformIcons } from './DestinationPlatformIcons';
import { TableBadgePopover } from './TableBadgePopover';
import { EditableDateTimeCell } from './tableCells/EditableDateTimeCell';
import { EditableLongTextCell } from './tableCells/EditableLongTextCell';
import { EditableTextCell } from './tableCells/EditableTextCell';

const typeStyle: Record<string, string> = {
  POST: 'bg-ink-50 text-ink-600',
  CAROUSEL: 'bg-sky-50 text-sky-700',
  REEL: 'bg-pink-50 text-pink-700',
  STORY: 'bg-orange-50 text-orange-700',
  VIDEO: 'bg-red-50 text-red-700',
  SHORT: 'bg-fuchsia-50 text-fuchsia-700',
  ARTICLE: 'bg-teal-50 text-teal-700',
  PIN: 'bg-rose-50 text-rose-700',
};

const statusBadgeStyle: Record<string, string> = {
  default: 'bg-ink-50 text-ink-600',
  published: 'bg-emerald-50 text-emerald-700',
  partial: 'bg-amber-50 text-amber-700',
  failed: 'bg-red-50 text-red-700',
  IDEA: 'bg-ink-50 text-ink-500',
  DRAFT: 'bg-amber-50 text-amber-700',
  IN_REVIEW: 'bg-blue-50 text-blue-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  SCHEDULED: 'bg-violet-50 text-violet-700',
  CANCELLED: 'bg-ink-50 text-ink-400',
};

const TD = 'px-2 py-0 align-middle';

function ActionMenu({
  item,
  onEdit,
  onDuplicate,
  onPublish,
  onRetry,
  onDelete,
}: {
  item: SocialContentDto;
  onEdit: () => void;
  onDuplicate: () => void;
  onPublish: () => void;
  onRetry: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const actions = [
    { label: 'Düzenle', show: true, onClick: onEdit },
    { label: 'Çoğalt', show: true, onClick: onDuplicate },
    { label: 'Şimdi Yayınla', show: canPublishNow(item), onClick: onPublish },
    { label: 'Yeniden Dene', show: canRetryPublish(item), onClick: onRetry },
    {
      label: 'Gönderiyi Aç',
      show: !!item.destinations?.some((d) => d.permalink),
      onClick: () => {
        const link = item.destinations?.find((d) => d.permalink)?.permalink;
        if (link) window.open(link, '_blank');
      },
    },
    { label: 'Sil', show: item.status !== 'PUBLISHED', onClick: onDelete, danger: true },
  ].filter((a) => a.show);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="inline-flex h-6 w-6 items-center justify-center rounded-[4px] text-ink-400 hover:bg-ink-50 hover:text-ink-600"
      >
        <MoreHorizontal size={14} />
      </button>
      <AnchoredPopover
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        align="end"
        width={160}
        className="py-1"
      >
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => {
              setOpen(false);
              a.onClick();
            }}
            className={`flex w-full items-center px-3 py-1.5 text-[12px] hover:bg-ink-50 ${
              'danger' in a && a.danger ? 'text-red-600' : 'text-[var(--ww-text)]'
            }`}
          >
            {a.label}
          </button>
        ))}
      </AnchoredPopover>
    </>
  );
}

export function SocialContentTableRow({
  item,
  brands,
  pending,
  editingCell,
  onStartEdit,
  onStopEdit,
  registerCommit,
  onOpenEditor,
  onPatch,
  onWorkflowToggle,
  onDuplicate,
  onPublish,
  onRetry,
  onDelete,
}: {
  item: SocialContentDto;
  brands: SocialBrandDto[];
  pending: Set<string>;
  editingCell: EditingCell | null;
  onStartEdit: (field: TableCellField) => void;
  onStopEdit: () => void;
  registerCommit: (fn: (() => Promise<void>) | null) => void;
  onOpenEditor: () => void;
  onPatch: (
    body: Record<string, unknown>,
    opts?: { retainOnError?: boolean },
  ) => Promise<boolean>;
  onWorkflowToggle: (field: WorkflowField, value: boolean) => Promise<void>;
  onDuplicate: () => void;
  onPublish: () => void;
  onRetry: () => void;
  onDelete: () => void;
}) {
  const isPending = (field: string) => pending.has(field);
  const isEditing = (field: TableCellField) =>
    editingCell?.contentId === item.id && editingCell.field === field;

  const brandName = item.brand?.name ?? brands.find((b) => b.id === item.socialBrandId)?.name ?? '';
  const brandOptions = [
    { value: '' as const, label: '—' },
    ...brands.map((b) => ({ value: b.id, label: b.name })),
  ];

  const statusDisplay = getPublicationDisplayStatus(item);
  const statusLabel = getStatusBadgeLabel(item);
  const statusEditable = canEditStatus(item);
  const statusBadgeClass =
    statusBadgeStyle[statusDisplay.variant] ??
    statusBadgeStyle[item.status] ??
    statusBadgeStyle.default;
  const statusOptions = ALL_STATUSES.filter((s) => s !== 'PUBLISHED').map((s) => ({
    value: s,
    label: statusDisplayLabels[s],
  }));

  return (
    <tr className="group hover:bg-ink-50/40">
      <td className={`${TD} w-[160px] max-w-[160px]`}>
        <TableBadgePopover
          value={item.socialBrandId ?? ''}
          label={brandName}
          placeholder="—"
          disabled={isPending('socialBrandId')}
          badgeClassName="bg-ink-50/80 text-ink-600"
          options={brandOptions}
          open={isEditing('socialBrandId')}
          onOpenChange={(open) => (open ? onStartEdit('socialBrandId') : onStopEdit())}
          onSelect={(v) => void onPatch({ socialBrandId: v || null }).then((ok) => ok && onStopEdit())}
        />
      </td>

      <td className={`${TD} w-[115px] whitespace-nowrap`}>
        <EditableDateTimeCell
          scheduledAt={item.scheduledAt}
          isEditing={isEditing('scheduledAt')}
          pending={isPending('scheduledAt')}
          onStartEdit={() => onStartEdit('scheduledAt')}
          onCancelEdit={onStopEdit}
          onSave={async (iso) => {
            const ok = await onPatch({ scheduledAt: iso });
            if (ok) onStopEdit();
          }}
          onClear={async () => {
            const ok = await onPatch({ scheduledAt: null });
            if (ok) onStopEdit();
          }}
        />
      </td>

      <td className={`${TD} w-[200px] max-w-[200px]`}>
        <EditableTextCell
          value={item.title}
          isEditing={isEditing('title')}
          pending={isPending('title')}
          placeholder="Adsız içerik"
          onStartEdit={() => onStartEdit('title')}
          onCancelEdit={onStopEdit}
          registerCommit={registerCommit}
          onSave={(next) =>
            onPatch({ title: next.trim() || 'Adsız içerik' }, { retainOnError: true })
          }
        />
      </td>

      <td className={`${TD} w-[300px] max-w-[300px] overflow-hidden`}>
        <EditableLongTextCell
          value={item.contentText}
          isEditing={isEditing('contentText')}
          pending={isPending('contentText')}
          popoverWidth={460}
          onStartEdit={() => onStartEdit('contentText')}
          onCancelEdit={onStopEdit}
          registerCommit={registerCommit}
          onSave={(next) => onPatch({ contentText: next }, { retainOnError: true })}
        />
      </td>

      <td className={`${TD} w-[135px] max-w-[135px] overflow-hidden`}>
        <EditableLongTextCell
          value={item.internalNotes}
          isEditing={isEditing('internalNotes')}
          pending={isPending('internalNotes')}
          popoverWidth={400}
          className="text-ink-400/90"
          onStartEdit={() => onStartEdit('internalNotes')}
          onCancelEdit={onStopEdit}
          registerCommit={registerCommit}
          onSave={(next) => onPatch({ internalNotes: next }, { retainOnError: true })}
        />
      </td>

      <td className={`${TD} w-[95px]`}>
        <TableBadgePopover
          value={item.contentType}
          label={contentTypeLabels[item.contentType]}
          disabled={isPending('contentType')}
          badgeClassName={typeStyle[item.contentType] ?? 'bg-ink-50 text-ink-600'}
          options={ALL_TYPES.map((t) => ({ value: t, label: contentTypeLabels[t] }))}
          open={isEditing('contentType')}
          onOpenChange={(open) => (open ? onStartEdit('contentType') : onStopEdit())}
          onSelect={(v) => {
            if (v) void onPatch({ contentType: v as SocialContentType }).then((ok) => ok && onStopEdit());
          }}
        />
      </td>

      <td className={`${TD} w-[85px]`}>
        <DestinationPlatformIcons destinations={item.destinations} />
      </td>

      <td className={`${TD} w-[46px] text-center`}>
        <div className="flex justify-center">
          <CompactSwitch
            checked={item.edited}
            disabled={workflowSwitchDisabled(item, 'edited')}
            loading={isPending('edited')}
            aria-label="Düzenlendi"
            onChange={(v) => void onWorkflowToggle('edited', v)}
          />
        </div>
      </td>

      <td className={`${TD} w-[46px] text-center`}>
        <div className="flex justify-center">
          <CompactSwitch
            checked={item.approved}
            disabled={workflowSwitchDisabled(item, 'approved')}
            loading={isPending('approved')}
            aria-label="Onay"
            onChange={(v) => void onWorkflowToggle('approved', v)}
          />
        </div>
      </td>

      <td className={`${TD} w-[46px] text-center`}>
        <div className="flex justify-center">
          <CompactSwitch
            checked={item.readyToPublish}
            disabled={workflowSwitchDisabled(item, 'readyToPublish')}
            loading={isPending('readyToPublish')}
            aria-label="Yayına hazır"
            onChange={(v) => void onWorkflowToggle('readyToPublish', v)}
          />
        </div>
      </td>

      <td className={`${TD} w-[100px] min-w-[90px]`}>
        <TableBadgePopover
          value={item.status}
          label={statusLabel}
          disabled={!statusEditable || isPending('status')}
          badgeClassName={statusBadgeClass}
          options={statusOptions}
          open={isEditing('status')}
          onOpenChange={(open) => (open ? onStartEdit('status') : onStopEdit())}
          onSelect={(v) => {
            if (v) void onPatch({ status: v as SocialContentStatus }).then((ok) => ok && onStopEdit());
          }}
        />
      </td>

      <td className={`${TD} w-[95px] whitespace-nowrap text-[11px] text-ink-400`}>
        {formatRelative(item.updatedAt)}
      </td>

      <td className={`${TD} w-[30px]`}>
        <ActionMenu
          item={item}
          onEdit={onOpenEditor}
          onDuplicate={onDuplicate}
          onPublish={onPublish}
          onRetry={onRetry}
          onDelete={onDelete}
        />
      </td>
    </tr>
  );
}

export { failedDestinationIds };
