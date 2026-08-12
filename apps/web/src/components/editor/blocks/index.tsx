import { useState, type KeyboardEvent } from 'react';
import { FileText, Image as ImageIcon, Video as VideoIcon } from 'lucide-react';
import { EditableText } from '../EditableText';
import type { BlockContent } from '@woonwork/shared';
import { formatBytes, type MediaAssetDto } from '../../../lib/media';

interface CommonProps {
  content: BlockContent;
  onChange: (content: BlockContent) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  placeholder?: string;
  autoFocus?: boolean;
  blockId: string;
}

export function ParagraphBlock({ content, onChange, onKeyDown, placeholder, autoFocus, blockId }: CommonProps) {
  return (
    <EditableText
      data-block-id={blockId}
      value={content.text ?? ''}
      onChange={(text) => onChange({ ...content, text })}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className="min-h-[1.6em] py-1 text-[15px] leading-7 text-navy-900"
    />
  );
}

export function HeadingBlock({
  level,
  content,
  onChange,
  onKeyDown,
  autoFocus,
  blockId,
}: CommonProps & { level: 1 | 2 | 3 }) {
  const sizes = {
    1: 'text-3xl font-semibold tracking-tight py-1',
    2: 'text-2xl font-semibold tracking-tight py-1',
    3: 'text-xl font-semibold tracking-tight py-0.5',
  };
  return (
    <EditableText
      data-block-id={blockId}
      value={content.text ?? ''}
      onChange={(text) => onChange({ ...content, text })}
      onKeyDown={onKeyDown}
      placeholder={`Başlık ${level}`}
      autoFocus={autoFocus}
      className={`min-h-[1.4em] text-navy-950 ${sizes[level]}`}
    />
  );
}

export function ListBlock({
  ordered,
  content,
  onChange,
  onKeyDown,
  autoFocus,
  blockId,
}: CommonProps & { ordered?: boolean }) {
  return (
    <div className="flex items-start gap-2 py-0.5">
      <span className="mt-1.5 w-5 shrink-0 text-center text-sm text-navy-400">
        {ordered ? '1.' : '•'}
      </span>
      <EditableText
        data-block-id={blockId}
        value={content.text ?? ''}
        onChange={(text) => onChange({ ...content, text })}
        onKeyDown={onKeyDown}
        placeholder="Liste öğesi"
        autoFocus={autoFocus}
        className="min-h-[1.6em] flex-1 text-[15px] leading-7 text-navy-900"
      />
    </div>
  );
}

export function TodoBlock({
  content,
  onChange,
  onKeyDown,
  autoFocus,
  blockId,
}: CommonProps) {
  const checked = Boolean(content.checked);
  return (
    <div className="flex items-start gap-2.5 py-0.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange({ ...content, checked: e.target.checked })}
        className="mt-2 h-4 w-4 rounded border-navy-300 text-navy-900"
      />
      <EditableText
        data-block-id={blockId}
        value={content.text ?? ''}
        onChange={(text) => onChange({ ...content, text })}
        onKeyDown={onKeyDown}
        placeholder="Yapılacak"
        autoFocus={autoFocus}
        className={`min-h-[1.6em] flex-1 text-[15px] leading-7 ${
          checked ? 'text-navy-400 line-through opacity-70' : 'text-navy-900'
        }`}
      />
    </div>
  );
}

export function QuoteBlock({ content, onChange, onKeyDown, autoFocus, blockId }: CommonProps) {
  return (
    <div className="border-l-[3px] border-navy-300 pl-4">
      <EditableText
        data-block-id={blockId}
        value={content.text ?? ''}
        onChange={(text) => onChange({ ...content, text })}
        onKeyDown={onKeyDown}
        placeholder="Alıntı"
        autoFocus={autoFocus}
        className="min-h-[1.6em] py-1 text-[15px] italic leading-7 text-navy-700"
      />
    </div>
  );
}

export function CalloutBlock({
  content,
  onChange,
  onKeyDown,
  autoFocus,
  blockId,
  icons,
}: CommonProps & { icons: readonly string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex gap-3 rounded-xl border border-navy-100 bg-navy-50/60 px-3 py-2.5">
      <div className="relative">
        <button
          type="button"
          className="rounded-lg px-1 text-lg hover:bg-white"
          title="İkon seç"
          onClick={() => setOpen((v) => !v)}
        >
          {content.icon || '💡'}
        </button>
        {open ? (
          <div className="absolute left-0 top-8 z-20 grid grid-cols-4 gap-1 rounded-xl border border-navy-100 bg-white p-2 shadow-lg">
            {icons.map((icon) => (
              <button
                key={icon}
                type="button"
                className="rounded-lg p-1.5 text-base hover:bg-navy-50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange({ ...content, icon });
                  setOpen(false);
                }}
              >
                {icon}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <EditableText
        data-block-id={blockId}
        value={content.text ?? ''}
        onChange={(text) => onChange({ ...content, text })}
        onKeyDown={onKeyDown}
        placeholder="Bilgi metni"
        autoFocus={autoFocus}
        className="min-h-[1.6em] flex-1 text-[15px] leading-7 text-navy-900"
      />
    </div>
  );
}

export function CodeBlock({
  content,
  onChange,
  onKeyDown,
  autoFocus,
  blockId,
  languages,
}: CommonProps & { languages: ReadonlyArray<{ value: string; label: string }> }) {
  return (
    <div className="overflow-hidden rounded-xl border border-navy-800/20 bg-navy-950 text-navy-50">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
        <select
          value={content.language || 'javascript'}
          onChange={(e) => onChange({ ...content, language: e.target.value })}
          className="rounded-md border-0 bg-transparent text-xs text-navy-200 outline-none"
        >
          {languages.map((lang) => (
            <option key={lang.value} value={lang.value} className="text-navy-900">
              {lang.label}
            </option>
          ))}
        </select>
      </div>
      <EditableText
        data-block-id={blockId}
        value={content.text ?? ''}
        onChange={(text) => onChange({ ...content, text })}
        onKeyDown={onKeyDown}
        placeholder="Kod yazın..."
        autoFocus={autoFocus}
        className="min-h-[4rem] px-4 py-3 font-mono text-[13px] leading-6 text-navy-50"
      />
    </div>
  );
}

export function DividerBlock() {
  return <hr className="my-3 border-0 border-t border-navy-200" />;
}

export function ImageBlock({
  content,
  onChange,
  mediaAsset,
  onPickMedia,
}: {
  content: BlockContent;
  onChange: (content: BlockContent) => void;
  mediaAsset?: MediaAssetDto | null;
  onPickMedia: () => void;
}) {
  const align = content.align ?? 'center';
  const alignClass =
    align === 'left' ? 'mr-auto' : align === 'right' ? 'ml-auto' : 'mx-auto';

  if (!mediaAsset?.url) {
    return (
      <button
        type="button"
        onClick={onPickMedia}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-navy-200 bg-navy-50/50 px-4 py-10 text-sm text-navy-500 transition hover:border-navy-300 hover:bg-navy-50"
      >
        <ImageIcon size={22} className="text-navy-400" />
        Görsel seç veya yükle
      </button>
    );
  }

  return (
    <div className="space-y-2 py-1">
      <div className={`w-full max-w-3xl ${alignClass}`}>
        <img
          src={mediaAsset.url}
          alt={content.alt || mediaAsset.originalFileName}
          className="h-auto w-full rounded-lg object-contain"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-xs text-navy-500 hover:bg-navy-50"
          onClick={onPickMedia}
        >
          Değiştir
        </button>
        {(['left', 'center', 'right'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange({ ...content, align: value })}
            className={`rounded-lg px-2 py-1 text-xs ${
              align === value ? 'bg-navy-900 text-white' : 'text-navy-500 hover:bg-navy-50'
            }`}
          >
            {value === 'left' ? 'Sol' : value === 'right' ? 'Sağ' : 'Orta'}
          </button>
        ))}
      </div>
      <input
        value={content.alt ?? ''}
        onChange={(e) => onChange({ ...content, alt: e.target.value })}
        placeholder="Alt metin"
        className="w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-xs text-navy-600 outline-none placeholder:text-navy-300 focus:border-navy-100"
      />
      <input
        value={content.caption ?? ''}
        onChange={(e) => onChange({ ...content, caption: e.target.value })}
        placeholder="Başlık ekle..."
        className="w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-center text-sm text-navy-500 outline-none placeholder:text-navy-300 focus:border-navy-100"
      />
    </div>
  );
}

export function VideoBlock({
  content,
  onChange,
  mediaAsset,
  onPickMedia,
}: {
  content: BlockContent;
  onChange: (content: BlockContent) => void;
  mediaAsset?: MediaAssetDto | null;
  onPickMedia: () => void;
}) {
  if (!mediaAsset?.url) {
    return (
      <button
        type="button"
        onClick={onPickMedia}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-navy-200 bg-navy-50/50 px-4 py-10 text-sm text-navy-500 transition hover:border-navy-300 hover:bg-navy-50"
      >
        <VideoIcon size={22} className="text-navy-400" />
        Video seç veya yükle
      </button>
    );
  }

  return (
    <div className="space-y-2 py-1">
      <video
        src={mediaAsset.url}
        controls
        autoPlay={false}
        className="aspect-video w-full rounded-lg bg-navy-950"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-xs text-navy-500 hover:bg-navy-50"
          onClick={onPickMedia}
        >
          Değiştir
        </button>
      </div>
      <input
        value={content.caption ?? ''}
        onChange={(e) => onChange({ ...content, caption: e.target.value })}
        placeholder="Başlık ekle..."
        className="w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-center text-sm text-navy-500 outline-none placeholder:text-navy-300 focus:border-navy-100"
      />
    </div>
  );
}

export function FileBlock({
  mediaAsset,
  onPickMedia,
}: {
  mediaAsset?: MediaAssetDto | null;
  onPickMedia: () => void;
}) {
  if (!mediaAsset) {
    return (
      <button
        type="button"
        onClick={onPickMedia}
        className="flex w-full items-center gap-3 rounded-xl border border-dashed border-navy-200 bg-navy-50/50 px-4 py-4 text-sm text-navy-500 transition hover:border-navy-300 hover:bg-navy-50"
      >
        <FileText size={18} className="text-navy-400" />
        Dosya seç veya yükle
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-navy-100 bg-navy-50/40 px-3 py-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-navy-500 ring-1 ring-navy-100">
        <FileText size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-navy-900">{mediaAsset.originalFileName}</p>
        <p className="text-xs text-navy-400">{formatBytes(mediaAsset.size)}</p>
      </div>
      {mediaAsset.url ? (
        <a
          href={mediaAsset.url}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-navy-700 hover:bg-white"
        >
          Aç / İndir
        </a>
      ) : null}
      <button
        type="button"
        className="rounded-lg px-2 py-1 text-xs text-navy-500 hover:bg-white"
        onClick={onPickMedia}
      >
        Değiştir
      </button>
    </div>
  );
}
