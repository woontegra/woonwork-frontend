import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { defaultBlockContent, type BlockContent, type BlockType } from '@woonwork/shared';
import { apiRequest } from '../../lib/api';
import { useToast } from '../ui/Toast';
import { BlockItem } from './BlockItem';
import { SlashMenu } from './SlashMenu';
import { focusBlock } from './EditableText';
import { useDebouncedCallback } from './useDebouncedCallback';
import type { BlockDto, SaveStatus } from './types';
import { createSubpage, notifyWorkspaceChanged } from '../../lib/workspace';

interface BlockEditorProps {
  pageId: string;
  onSaveStatusChange?: (status: SaveStatus) => void;
}

export function BlockEditor({ pageId, onSaveStatusChange }: BlockEditorProps) {
  const { toast } = useToast();
  const [blocks, setBlocks] = useState<BlockDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [slash, setSlash] = useState<{
    open: boolean;
    blockId: string | null;
    query: string;
    mode: 'transform' | 'insert';
    rect: DOMRect | null;
  }>({ open: false, blockId: null, query: '', mode: 'transform', rect: null });

  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  const setStatus = useCallback(
    (status: SaveStatus) => onSaveStatusChange?.(status),
    [onSaveStatusChange],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<BlockDto[]>(`/pages/${pageId}/blocks`);
      setBlocks(data);
    } catch (err) {
      toast((err as Error).message || 'Bloklar yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  }, [pageId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const persistContent = useDebouncedCallback(async (blockId: string, content: BlockContent) => {
    setStatus('saving');
    try {
      await apiRequest(`/pages/${pageId}/blocks/${blockId}`, {
        method: 'PATCH',
        body: { content },
      });
      setStatus('saved');
    } catch (err) {
      setStatus('error');
      toast((err as Error).message || 'Blok kaydedilemedi', 'error');
    }
  }, 650);

  const onMediaChange = useCallback(
    async (blockId: string, asset: import('../../lib/media').MediaAssetDto | null) => {
      const snapshot = blocksRef.current;
      setBlocks((prev) =>
        prev.map((b) =>
          b.id === blockId
            ? { ...b, mediaAssetId: asset?.id ?? null, mediaAsset: asset }
            : b,
        ),
      );
      setStatus('saving');
      try {
        const updated = await apiRequest<BlockDto>(`/pages/${pageId}/blocks/${blockId}`, {
          method: 'PATCH',
          body: { mediaAssetId: asset?.id ?? null },
        });
        setBlocks((prev) => prev.map((b) => (b.id === blockId ? updated : b)));
        setStatus('saved');
      } catch (err) {
        setBlocks(snapshot);
        setStatus('error');
        toast((err as Error).message || 'Medya bağlanamadı', 'error');
      }
    },
    [pageId, setStatus, toast],
  );

  const onDatabaseChange = useCallback(
    async (blockId: string, databaseId: string | null) => {
      const snapshot = blocksRef.current;
      setStatus('saving');
      try {
        const updated = await apiRequest<BlockDto>(`/pages/${pageId}/blocks/${blockId}`, {
          method: 'PATCH',
          body: { databaseId },
        });
        setBlocks((prev) => prev.map((b) => (b.id === blockId ? updated : b)));
        setStatus('saved');
      } catch (err) {
        setBlocks(snapshot);
        setStatus('error');
        toast((err as Error).message || 'Tablo bağlanamadı', 'error');
      }
    },
    [pageId, setStatus, toast],
  );

  const onContentChange = useCallback(
    (blockId: string, content: BlockContent) => {
      setBlocks((prev) =>
        prev.map((b) => (b.id === blockId ? { ...b, content } : b)),
      );

      const current = blocksRef.current.find((b) => b.id === blockId);
      if (!current) return;

      const text = content.text ?? '';
      if (text.startsWith('/')) {
        const el = document.querySelector(`[data-block-id="${blockId}"]`);
        setSlash({
          open: true,
          blockId,
          query: text.slice(1),
          mode: 'transform',
          rect: el?.getBoundingClientRect() ?? null,
        });
      } else if (slash.open && slash.blockId === blockId && slash.mode === 'transform') {
        setSlash((s) => ({ ...s, open: false, query: '' }));
      }

      persistContent(blockId, content);
    },
    [persistContent, slash.blockId, slash.mode, slash.open],
  );

  const createBlock = useCallback(
    async (afterBlockId: string, type: BlockType = 'PARAGRAPH', content?: BlockContent) => {
      const tempId = `temp-${crypto.randomUUID()}`;
      const after = blocksRef.current.find((b) => b.id === afterBlockId);
      const optimistic: BlockDto = {
        id: tempId,
        tenantId: after?.tenantId ?? '',
        pageId,
        parentBlockId: null,
        type,
        content: content ?? defaultBlockContent(type),
        position: (after?.position ?? 0) + 0.5,
        mediaAssetId: null,
        mediaAsset: null,
        databaseId: null,
        database: null,
        createdById: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setBlocks((prev) => {
        const idx = prev.findIndex((b) => b.id === afterBlockId);
        if (idx === -1) return [...prev, optimistic];
        const next = [...prev];
        next.splice(idx + 1, 0, optimistic);
        return next;
      });
      setFocusId(tempId);

      try {
        const created = await apiRequest<BlockDto>(`/pages/${pageId}/blocks`, {
          method: 'POST',
          body: {
            type,
            content: content ?? defaultBlockContent(type),
            afterBlockId,
          },
        });
        setBlocks((prev) => prev.map((b) => (b.id === tempId ? created : b)));
        setFocusId(created.id);
        window.setTimeout(() => focusBlock(created.id), 0);
        return created;
      } catch (err) {
        setBlocks((prev) => prev.filter((b) => b.id !== tempId));
        toast((err as Error).message || 'Blok eklenemedi', 'error');
        return null;
      }
    },
    [pageId, toast],
  );

  const deleteBlock = useCallback(
    async (blockId: string, focusPrev = true) => {
      const snapshot = blocksRef.current;
      const index = snapshot.findIndex((b) => b.id === blockId);
      if (index === -1) return;
      const prevId = snapshot[index - 1]?.id ?? null;

      setBlocks((prev) => prev.filter((b) => b.id !== blockId));
      if (focusPrev && prevId) {
        setFocusId(prevId);
        window.setTimeout(() => focusBlock(prevId), 0);
      }

      try {
        const result = await apiRequest<{
          deleted: boolean;
          emptied: boolean;
          block?: BlockDto | null;
        }>(`/pages/${pageId}/blocks/${blockId}`, { method: 'DELETE' });

        if (result.emptied && result.block) {
          setBlocks([result.block]);
          setFocusId(result.block.id);
        }
      } catch (err) {
        setBlocks(snapshot);
        toast((err as Error).message || 'Blok silinemedi', 'error');
      }
    },
    [pageId, toast],
  );

  const transformBlock = useCallback(
    async (blockId: string, type: BlockType) => {
      const current = blocksRef.current.find((b) => b.id === blockId);
      if (!current) return;

      const nextContent =
        type === 'DIVIDER'
          ? {}
          : {
              ...defaultBlockContent(type),
              text: '',
              ...(type === 'TODO' ? { checked: false } : {}),
              ...(type === 'CODE' ? { language: 'javascript' } : {}),
              ...(type === 'CALLOUT' ? { icon: '💡' } : {}),
            };

      const snapshot = blocksRef.current;
      setBlocks((prev) =>
        prev.map((b) =>
          b.id === blockId
            ? { ...b, type, content: nextContent, mediaAssetId: null, mediaAsset: null, databaseId: null, database: null }
            : b,
        ),
      );
      setSlash({ open: false, blockId: null, query: '', mode: 'transform', rect: null });
      window.setTimeout(() => focusBlock(blockId), 0);

      try {
        await apiRequest(`/pages/${pageId}/blocks/${blockId}`, {
          method: 'PATCH',
          body: { type, content: nextContent, mediaAssetId: null, databaseId: null },
        });
      } catch (err) {
        setBlocks(snapshot);
        toast((err as Error).message || 'Blok tipi değiştirilemedi', 'error');
      }
    },
    [pageId, toast],
  );

  const onKeyDown = useCallback(
    (block: BlockDto, event: KeyboardEvent<HTMLDivElement>) => {
      if (slash.open && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) {
        return;
      }

      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        const nextType: BlockType =
          block.type === 'BULLETED_LIST' ||
          block.type === 'NUMBERED_LIST' ||
          block.type === 'TODO'
            ? block.type
            : 'PARAGRAPH';
        void createBlock(block.id, nextType);
        return;
      }

      if (event.key === 'Backspace') {
        const text = (block.content as BlockContent)?.text ?? '';
        const selection = window.getSelection();
        const atStart =
          selection?.anchorOffset === 0 &&
          selection.focusOffset === 0 &&
          selection.isCollapsed;

        if (!text && atStart) {
          event.preventDefault();
          if (blocksRef.current.length <= 1) return;
          void deleteBlock(block.id, true);
        }
        return;
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        const list = blocksRef.current;
        const idx = list.findIndex((b) => b.id === block.id);
        const target = event.key === 'ArrowUp' ? list[idx - 1] : list[idx + 1];
        if (!target) return;

        const selection = window.getSelection();
        const el = event.currentTarget;
        const atEdge =
          event.key === 'ArrowUp'
            ? selection?.anchorOffset === 0
            : selection?.anchorOffset === (el.innerText?.length ?? 0);

        if (atEdge) {
          event.preventDefault();
          focusBlock(target.id, event.key === 'ArrowUp');
        }
      }
    },
    [createBlock, deleteBlock, slash.open],
  );

  const onSlashSelect = useCallback(
    async (type: BlockType) => {
      if (!slash.blockId) return;
      if (type === 'SUBPAGE') {
        const sourceId = slash.blockId;
        const mode = slash.mode;
        setSlash({ open: false, blockId: null, query: '', mode: 'transform', rect: null });
        try {
          await createSubpage(pageId, {
            title: 'Adsız sayfa',
            afterBlockId: sourceId,
          });
          if (mode === 'transform') {
            const source = blocksRef.current.find((b) => b.id === sourceId);
            const text = (source?.content as BlockContent | undefined)?.text ?? '';
            if (source && !text.replace('/', '').trim() && blocksRef.current.length > 1) {
              await deleteBlock(sourceId, false);
            }
          }
          await load();
          notifyWorkspaceChanged();
        } catch (err) {
          toast((err as Error).message || 'Alt sayfa oluşturulamadı', 'error');
        }
        return;
      }
      if (slash.mode === 'insert') {
        setSlash({ open: false, blockId: null, query: '', mode: 'transform', rect: null });
        await createBlock(slash.blockId, type);
        return;
      }
      await transformBlock(slash.blockId, type);
    },
    [createBlock, deleteBlock, load, pageId, slash.blockId, slash.mode, toast, transformBlock],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;

      const snapshot = blocks;
      const next = arrayMove(blocks, oldIndex, newIndex);
      setBlocks(next);

      try {
        const updated = await apiRequest<BlockDto[]>(`/pages/${pageId}/blocks/reorder`, {
          method: 'POST',
          body: { orderedIds: next.map((b) => b.id) },
        });
        setBlocks(updated);
      } catch (err) {
        setBlocks(snapshot);
        toast((err as Error).message || 'Sıralama kaydedilemedi', 'error');
      }
    },
    [blocks, pageId, toast],
  );

  const isFirstEmpty = useMemo(() => {
    if (blocks.length !== 1) return false;
    const only = blocks[0];
    return only.type === 'PARAGRAPH' && !(only.content as BlockContent)?.text;
  }, [blocks]);

  if (loading) {
    return <div className="animate-pulse space-y-3 py-4">
      <div className="h-6 rounded bg-navy-100/80" />
      <div className="h-6 w-4/5 rounded bg-navy-100/70" />
      <div className="h-6 w-3/5 rounded bg-navy-100/60" />
    </div>;
  }

  return (
    <div className="relative pl-12">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={(e) => void onDragEnd(e)}
      >
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {blocks.map((block) => (
              <BlockItem
                key={block.id}
                block={block}
                isFirstEmpty={isFirstEmpty && block.id === blocks[0]?.id}
                focusId={focusId}
                onContentChange={onContentChange}
                onMediaChange={(blockId, asset) => void onMediaChange(blockId, asset)}
                onDatabaseChange={(blockId, databaseId) => void onDatabaseChange(blockId, databaseId)}
                onKeyDown={onKeyDown}
                onOpenSlash={(blockId, rect, mode) =>
                  setSlash({ open: true, blockId, query: '', mode, rect })
                }
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <SlashMenu
        open={slash.open}
        query={slash.query}
        anchorRect={slash.rect}
        onSelect={(type) => void onSlashSelect(type)}
        onClose={() =>
          setSlash({ open: false, blockId: null, query: '', mode: 'transform', rect: null })
        }
      />
    </div>
  );
}
