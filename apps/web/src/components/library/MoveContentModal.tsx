import { useEffect, useState } from 'react';
import type { ContentResourceType } from '@woonwork/shared';
import { Modal } from '../ui/Modal';
import { Button, Select } from '../ui/Form';
import { useToast } from '../ui/Toast';
import {
  listAreas,
  moveDatabase,
  movePage,
  moveProject,
  type WorkspaceAreaDto,
} from '../../lib/library';

export function MoveContentModal({
  open,
  onClose,
  resourceType,
  resourceId,
  currentAreaId,
  onMoved,
}: {
  open: boolean;
  onClose: () => void;
  resourceType: ContentResourceType;
  resourceId: string;
  currentAreaId?: string | null;
  onMoved?: () => void;
}) {
  const { toast } = useToast();
  const [areas, setAreas] = useState<WorkspaceAreaDto[]>([]);
  const [target, setTarget] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTarget(currentAreaId ?? '');
    void listAreas()
      .then(setAreas)
      .catch(() => setAreas([]));
  }, [open, currentAreaId]);

  async function submit() {
    setSaving(true);
    try {
      const workspaceAreaId = target === '' ? null : target;
      if (resourceType === 'PAGE') await movePage(resourceId, workspaceAreaId);
      else if (resourceType === 'DATABASE') await moveDatabase(resourceId, workspaceAreaId);
      else await moveProject(resourceId, workspaceAreaId);
      toast('İçerik taşındı', 'success');
      onMoved?.();
      onClose();
    } catch (err) {
      toast((err as Error).message || 'Taşınamadı', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Alana Taşı">
      <div className="space-y-4">
        <Select label="Hedef" value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">Özel</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="button" disabled={saving} onClick={() => void submit()}>
            Taşı
          </Button>
        </div>
      </div>
    </Modal>
  );
}
