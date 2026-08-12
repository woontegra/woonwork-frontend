import { useEffect, useState } from 'react';
import { FolderInput, Share2, Star } from 'lucide-react';
import type { ContentResourceType } from '@woonwork/shared';
import { Button } from '../ui/Form';
import { useToast } from '../ui/Toast';
import {
  addFavorite,
  listFavorites,
  removeFavorite,
} from '../../lib/library';
import { notifyWorkspaceChanged } from '../../lib/workspace';
import { SharePanel } from './SharePanel';
import { MoveContentModal } from './MoveContentModal';

export function ContentAccessActions({
  resourceType,
  resourceId,
  areaId,
  areaName,
  onMoved,
}: {
  resourceType: ContentResourceType;
  resourceId: string;
  areaId?: string | null;
  areaName?: string | null;
  onMoved?: () => void;
}) {
  const { toast } = useToast();
  const [shareOpen, setShareOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [favorited, setFavorited] = useState(false);

  useEffect(() => {
    void listFavorites(50)
      .then((items) =>
        setFavorited(
          items.some((f) => f.resourceType === resourceType && f.resourceId === resourceId),
        ),
      )
      .catch(() => setFavorited(false));
  }, [resourceType, resourceId]);

  async function toggleFavorite() {
    try {
      if (favorited) {
        await removeFavorite(resourceType, resourceId);
        setFavorited(false);
        toast('Favorilerden çıkarıldı', 'success');
      } else {
        await addFavorite(resourceType, resourceId);
        setFavorited(true);
        toast('Favorilere eklendi', 'success');
      }
      notifyWorkspaceChanged();
    } catch (err) {
      toast((err as Error).message || 'Favori güncellenemedi', 'error');
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => void toggleFavorite()}>
          <Star size={14} className={favorited ? 'fill-accent text-accent' : ''} />
          {favorited ? 'Favoride' : 'Favori'}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => setShareOpen(true)}>
          <Share2 size={14} />
          Paylaş
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => setMoveOpen(true)}>
          <FolderInput size={14} />
          Alana Taşı
        </Button>
      </div>
      <SharePanel
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        resourceType={resourceType}
        resourceId={resourceId}
        areaName={areaName}
      />
      <MoveContentModal
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        resourceType={resourceType}
        resourceId={resourceId}
        currentAreaId={areaId}
        onMoved={onMoved}
      />
    </>
  );
}
