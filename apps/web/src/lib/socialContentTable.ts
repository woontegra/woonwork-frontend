import type { SocialContentStatus } from '@woonwork/shared';
import type { SocialContentDto } from './social';
import { statusLabels } from './social';

export type WorkflowField = 'edited' | 'approved' | 'readyToPublish';

export type TableCellField =
  | 'socialBrandId'
  | 'scheduledAt'
  | 'title'
  | 'contentText'
  | 'internalNotes'
  | 'contentType'
  | 'status';

export type EditingCell = {
  contentId: string;
  field: TableCellField;
};

export type DrawerOpenTrigger = 'menu-edit' | 'none';

/** Drawer yalnızca ... menüsünden "Düzenle" ile açılır. */
export function drawerOpenTriggerForTarget(target: string): DrawerOpenTrigger {
  if (target === 'menu-edit') return 'menu-edit';
  return 'none';
}

export function shouldOpenDrawerOnRowClick(): false {
  return false;
}

export type WorkflowToggleResult = { ok: true } | { ok: false; message: string };

/** Backend social-workflow.util kurallarıyla uyumlu ön doğrulama. */
export function validateWorkflowToggle(
  item: Pick<SocialContentDto, 'edited' | 'approved' | 'readyToPublish' | 'published'>,
  field: WorkflowField,
  nextValue: boolean,
): WorkflowToggleResult {
  if (field === 'approved' && nextValue === false) {
    if (item.readyToPublish || item.published) {
      return {
        ok: false,
        message: 'Onay kaldırılmadan önce yayına hazır işareti kapatılmalı.',
      };
    }
  }

  if (field === 'approved' && nextValue === true && !item.edited) {
    return {
      ok: false,
      message: 'İçerik onaylanmadan önce düzenlendi olarak işaretlenmelidir.',
    };
  }

  if (field === 'readyToPublish' && nextValue === true && !item.approved) {
    return {
      ok: false,
      message: 'Yayına hazır için önce onay gerekir.',
    };
  }

  if (field === 'readyToPublish' && nextValue === false && item.published) {
    return {
      ok: false,
      message: 'Yayınlanmış içerikte yayına hazır kapatılamaz.',
    };
  }

  if (field === 'edited' && nextValue === false && item.approved) {
    return {
      ok: false,
      message: 'Onay kaldırılmadan önce düzenlendi işareti kapatılamaz.',
    };
  }

  return { ok: true };
}

export function workflowToggleToast(field: WorkflowField, value: boolean): string {
  if (field === 'edited') {
    return value ? 'Düzenlendi olarak işaretlendi.' : 'Düzenlendi işareti kaldırıldı.';
  }
  if (field === 'approved') {
    return value ? 'Onaylandı.' : 'Onay kaldırıldı.';
  }
  return value ? 'Yayına hazır olarak işaretlendi.' : 'Yayına hazır işareti kaldırıldı.';
}

export function workflowSwitchDisabled(
  item: Pick<SocialContentDto, 'published' | 'status'>,
  field: WorkflowField,
): boolean {
  if (item.status === 'CANCELLED') return true;
  if (item.published) return true;
  if (field === 'readyToPublish' && item.published) return true;
  return false;
}

export type DisplayStatusVariant = 'default' | 'published' | 'partial' | 'failed';

export function getPublicationDisplayStatus(item: SocialContentDto): {
  label: string;
  variant: DisplayStatusVariant;
  readOnly: boolean;
} {
  const destinations = item.destinations ?? [];
  const publishedCount = destinations.filter((d) => d.publicationStatus === 'PUBLISHED').length;
  const failedCount = destinations.filter((d) => d.publicationStatus === 'FAILED').length;
  const hasDestinations = destinations.length > 0;

  if (hasDestinations && publishedCount > 0 && failedCount > 0) {
    return { label: 'Kısmi Hata', variant: 'partial', readOnly: true };
  }
  if (hasDestinations && failedCount > 0 && publishedCount === 0) {
    return { label: 'Başarısız', variant: 'failed', readOnly: true };
  }
  if (item.published || (hasDestinations && publishedCount === destinations.length && publishedCount > 0)) {
    return { label: 'Yayınlandı', variant: 'published', readOnly: true };
  }

  return {
    label: statusLabels[item.status] ?? item.status,
    variant: 'default',
    readOnly: false,
  };
}

export const EDITABLE_STATUSES: SocialContentStatus[] = [
  'IDEA',
  'DRAFT',
  'IN_REVIEW',
  'APPROVED',
  'SCHEDULED',
  'CANCELLED',
];

export function canEditStatus(item: SocialContentDto): boolean {
  const display = getPublicationDisplayStatus(item);
  if (display.readOnly) return false;
  return EDITABLE_STATUSES.includes(item.status);
}

export function canPublishNow(item: SocialContentDto): boolean {
  if (item.contentType === 'STORY') return false;
  if (!item.approved || !item.readyToPublish) return false;
  if (item.published && !item.destinations?.some((d) => d.publicationStatus === 'FAILED')) {
    return false;
  }
  const pending = item.destinations?.filter((d) => d.publicationStatus !== 'PUBLISHED') ?? [];
  return pending.length > 0 || (item.destinations?.length ?? 0) > 0;
}

export function canRetryPublish(item: SocialContentDto): boolean {
  return (item.destinations?.some((d) => d.publicationStatus === 'FAILED') ?? false);
}

export function failedDestinationIds(item: SocialContentDto): string[] {
  return (item.destinations ?? []).filter((d) => d.publicationStatus === 'FAILED').map((d) => d.id);
}

/** Switch yalnızca workflow alanını günceller; Meta publisher çağırmaz. */
export function workflowPatchBody(field: WorkflowField, value: boolean): Record<string, boolean> {
  return { [field]: value };
}

/** publishContent API ayrı çağrılır; switch ile karıştırılmamalı. */
export function isRealPublishApiCall(_field: WorkflowField): false {
  return false;
}

/** Tablo durum badge etiketleri (display-only, enum değiştirmez). */
export const statusDisplayLabels: Record<SocialContentStatus, string> = {
  IDEA: 'Fikir',
  DRAFT: 'Taslak',
  IN_REVIEW: 'Kontrolde',
  APPROVED: 'Onaylandı',
  SCHEDULED: 'Planlandı',
  PUBLISHED: 'Yayınlandı',
  CANCELLED: 'İptal',
};

export function getStatusBadgeLabel(item: SocialContentDto): string {
  const display = getPublicationDisplayStatus(item);
  if (display.readOnly) return display.label;
  if (item.readyToPublish && !item.published && !item.scheduledAt) return 'Yayına Hazır';
  return statusDisplayLabels[item.status] ?? item.status;
}

export type TableColumnKey =
  | 'brand'
  | 'schedule'
  | 'title'
  | 'description'
  | 'notes'
  | 'type'
  | 'platforms'
  | 'edited'
  | 'approved'
  | 'ready'
  | 'status'
  | 'updated'
  | 'menu';

export function tableCellFieldForColumn(column: TableColumnKey): TableCellField | null {
  const map: Partial<Record<TableColumnKey, TableCellField>> = {
    brand: 'socialBrandId',
    schedule: 'scheduledAt',
    title: 'title',
    description: 'contentText',
    notes: 'internalNotes',
    type: 'contentType',
    status: 'status',
  };
  return map[column] ?? null;
}

/** Hücre read-mode'da badge/text; edit-mode yalnızca tıklanınca açılır. */
export function cellUsesBadgeEditMode(cell: TableColumnKey): boolean {
  return cell === 'brand' || cell === 'type' || cell === 'status';
}

export function cellIsInlineEditable(cell: TableColumnKey): boolean {
  return (
    cell === 'brand' ||
    cell === 'schedule' ||
    cell === 'title' ||
    cell === 'description' ||
    cell === 'notes' ||
    cell === 'type' ||
    cell === 'status'
  );
}

export function tableColumnValues(item: SocialContentDto) {
  return {
    title: item.title,
    description: item.contentText,
    notes: item.internalNotes,
  };
}
