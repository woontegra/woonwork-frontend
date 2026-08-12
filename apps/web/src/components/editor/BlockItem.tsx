import { forwardRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { defaultBlockContent, type BlockContent, type BlockType } from '@woonwork/shared';
import {
  CalloutBlock,
  CodeBlock,
  DividerBlock,
  FileBlock,
  HeadingBlock,
  ImageBlock,
  ListBlock,
  ParagraphBlock,
  QuoteBlock,
  TodoBlock,
  VideoBlock,
} from './blocks';
import { MediaPickerModal } from '../media/MediaPickerModal';
import { DatabaseBlock } from '../database/DatabaseBlock';
import { allowedCategoriesForBlock, CALLOUT_ICONS, CODE_LANGUAGES, type BlockDto } from './types';
import type { MediaAssetDto } from '../../lib/media';

interface BlockItemProps {
  block: BlockDto;
  isFirstEmpty: boolean;
  focusId: string | null;
  onContentChange: (blockId: string, content: BlockContent) => void;
  onMediaChange: (blockId: string, asset: MediaAssetDto | null) => void;
  onDatabaseChange: (blockId: string, databaseId: string | null) => void;
  onKeyDown: (block: BlockDto, event: KeyboardEvent<HTMLDivElement>) => void;
  onOpenSlash: (blockId: string, rect: DOMRect | null, mode: 'transform' | 'insert') => void;
}

export const BlockItem = forwardRef<HTMLDivElement, BlockItemProps>(function BlockItem(
  {
    block,
    isFirstEmpty,
    focusId,
    onContentChange,
    onMediaChange,
    onDatabaseChange,
    onKeyDown,
    onOpenSlash,
  },
  _ref,
) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    disabled: block.type === 'DATABASE',
  });
  const [pickerOpen, setPickerOpen] = useState(false);

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  };

  const content = (block.content ?? defaultBlockContent(block.type)) as BlockContent;
  const autoFocus = focusId === block.id;
  const placeholder =
    isFirstEmpty && block.type === 'PARAGRAPH'
      ? "Yazmaya başlayın veya '/' ile komut seçin"
      : undefined;

  function renderBody() {
    const common = {
      content,
      onChange: (next: BlockContent) => onContentChange(block.id, next),
      onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => onKeyDown(block, event),
      autoFocus,
      blockId: block.id,
    };

    switch (block.type as BlockType) {
      case 'HEADING_1':
        return <HeadingBlock {...common} level={1} />;
      case 'HEADING_2':
        return <HeadingBlock {...common} level={2} />;
      case 'HEADING_3':
        return <HeadingBlock {...common} level={3} />;
      case 'BULLETED_LIST':
        return <ListBlock {...common} />;
      case 'NUMBERED_LIST':
        return <ListBlock {...common} ordered />;
      case 'TODO':
        return <TodoBlock {...common} />;
      case 'QUOTE':
        return <QuoteBlock {...common} />;
      case 'CALLOUT':
        return <CalloutBlock {...common} icons={CALLOUT_ICONS} />;
      case 'CODE':
        return <CodeBlock {...common} languages={CODE_LANGUAGES} />;
      case 'DIVIDER':
        return <DividerBlock />;
      case 'IMAGE':
        return (
          <ImageBlock
            content={content}
            onChange={(next) => onContentChange(block.id, next)}
            mediaAsset={block.mediaAsset}
            onPickMedia={() => setPickerOpen(true)}
          />
        );
      case 'VIDEO':
        return (
          <VideoBlock
            content={content}
            onChange={(next) => onContentChange(block.id, next)}
            mediaAsset={block.mediaAsset}
            onPickMedia={() => setPickerOpen(true)}
          />
        );
      case 'FILE':
        return (
          <FileBlock
            mediaAsset={block.mediaAsset}
            onPickMedia={() => setPickerOpen(true)}
          />
        );
      case 'DATABASE':
        return (
          <DatabaseBlock
            database={block.database}
            content={content}
            onLink={(databaseId) => onDatabaseChange(block.id, databaseId)}
            onContentChange={(next) => onContentChange(block.id, next)}
          />
        );
      case 'SUBPAGE': {
        const pageId = content.pageId;
        const title = content.text || 'Adsız sayfa';
        if (!pageId) return <ParagraphBlock {...common} placeholder="Alt sayfa" />;
        return (
          <Link
            to={`/notlar/${pageId}`}
            className="flex items-center gap-2 rounded-[var(--ww-control-radius)] border border-[var(--ww-border)] bg-canvas/40 px-3 py-2 text-sm hover:border-ink-300"
          >
            <span>{content.icon || '📄'}</span>
            <span className="font-medium text-[var(--ww-text)]">{title}</span>
            <span className="ml-auto text-[var(--ww-text-muted)]">→</span>
          </Link>
        );
      }
      case 'PARAGRAPH':
      default:
        return <ParagraphBlock {...common} placeholder={placeholder} />;
    }
  }

  const isMedia =
    block.type === 'IMAGE' || block.type === 'VIDEO' || block.type === 'FILE';
  const disableBlockDrag = block.type === 'DATABASE';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-lg px-1 ${isDragging ? 'z-10 scale-[1.01]' : ''}`}
    >
      <div className="absolute -left-12 top-1 flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
        <button
          type="button"
          className="rounded-md p-1 text-navy-400 hover:bg-navy-100 hover:text-navy-700"
          title="Blok ekle"
          onMouseDown={(e) => {
            e.preventDefault();
            onOpenSlash(block.id, e.currentTarget.getBoundingClientRect(), 'insert');
          }}
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          className={`cursor-grab rounded-md p-1 text-navy-400 hover:bg-navy-100 hover:text-navy-700 active:cursor-grabbing ${
            disableBlockDrag ? 'pointer-events-none opacity-30' : ''
          }`}
          title="Sürükle"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </button>
      </div>
      <div className="min-w-0">{renderBody()}</div>

      {isMedia ? (
        <MediaPickerModal
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          title={
            block.type === 'IMAGE'
              ? 'Görsel Seç'
              : block.type === 'VIDEO'
                ? 'Video Seç'
                : 'Dosya Seç'
          }
          allowedCategories={allowedCategoriesForBlock(block.type)}
          onSelect={(asset) => onMediaChange(block.id, asset)}
        />
      ) : null}
    </div>
  );
});
