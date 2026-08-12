import type { BlockType, BlockContent, MediaCategory } from '@woonwork/shared';
import type { MediaAssetDto } from '../../lib/media';
import type { DatabaseDto } from '../../lib/database';

export interface BlockDto {
  id: string;
  tenantId: string;
  pageId: string;
  parentBlockId: string | null;
  type: BlockType;
  content: BlockContent;
  position: number;
  mediaAssetId?: string | null;
  mediaAsset?: MediaAssetDto | null;
  databaseId?: string | null;
  database?: DatabaseDto | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export const SLASH_ITEMS: Array<{
  type: BlockType;
  label: string;
  keywords: string[];
  description: string;
  group?: string;
}> = [
  {
    type: 'PARAGRAPH',
    label: 'Metin',
    keywords: ['metin', 'paragraph', 'text', 'yazı'],
    description: 'Düz metin paragrafı',
    group: 'Temel',
  },
  {
    type: 'HEADING_1',
    label: 'Başlık 1',
    keywords: ['başlık', 'baslik', 'h1', 'heading'],
    description: 'Büyük başlık',
    group: 'Temel',
  },
  {
    type: 'HEADING_2',
    label: 'Başlık 2',
    keywords: ['başlık', 'baslik', 'h2', 'heading'],
    description: 'Orta başlık',
    group: 'Temel',
  },
  {
    type: 'HEADING_3',
    label: 'Başlık 3',
    keywords: ['başlık', 'baslik', 'h3', 'heading'],
    description: 'Küçük başlık',
    group: 'Temel',
  },
  {
    type: 'BULLETED_LIST',
    label: 'Liste',
    keywords: ['madde', 'liste', 'bullet', 'ul'],
    description: 'Madde işaretli liste',
    group: 'Temel',
  },
  {
    type: 'NUMBERED_LIST',
    label: 'Numaralı Liste',
    keywords: ['numara', 'liste', 'numbered', 'ol'],
    description: 'Numaralı liste',
    group: 'Temel',
  },
  {
    type: 'TODO',
    label: 'Yapılacaklar',
    keywords: ['todo', 'yapılacak', 'checkbox', 'görev'],
    description: 'Kontrol listesi',
    group: 'Temel',
  },
  {
    type: 'QUOTE',
    label: 'Alıntı',
    keywords: ['alıntı', 'alinti', 'quote'],
    description: 'Alıntı bloğu',
    group: 'Temel',
  },
  {
    type: 'CALLOUT',
    label: 'Bilgi Kutusu',
    keywords: ['bilgi', 'callout', 'kutu', 'uyarı'],
    description: 'Vurgulu bilgi kutusu',
    group: 'Temel',
  },
  {
    type: 'DIVIDER',
    label: 'Ayırıcı',
    keywords: ['ayırıcı', 'ayirici', 'divider', 'çizgi'],
    description: 'Yatay ayırıcı çizgi',
    group: 'Temel',
  },
  {
    type: 'CODE',
    label: 'Kod',
    keywords: ['kod', 'code', 'javascript', 'sql'],
    description: 'Kod bloğu',
    group: 'Temel',
  },
  {
    type: 'IMAGE',
    label: 'Görsel',
    keywords: ['görsel', 'gorsel', 'image', 'resim', 'foto'],
    description: 'Görsel bloğu',
    group: 'Medya',
  },
  {
    type: 'VIDEO',
    label: 'Video',
    keywords: ['video', 'mp4', 'film'],
    description: 'Video bloğu',
    group: 'Medya',
  },
  {
    type: 'FILE',
    label: 'Dosya',
    keywords: ['dosya', 'file', 'pdf', 'belge'],
    description: 'Dosya ekleme bloğu',
    group: 'Medya',
  },
  {
    type: 'DATABASE',
    label: 'Akıllı Tablo',
    keywords: ['akıllı', 'akilli', 'tablo', 'database', 'veri'],
    description: 'Yapılandırılmış kayıt tablosu',
    group: 'İleri',
  },
  {
    type: 'SUBPAGE',
    label: 'Alt Sayfa',
    keywords: ['alt', 'sayfa', 'subpage', 'child', 'nested'],
    description: 'İç içe sayfa oluştur',
    group: 'İleri',
  },
];

export const CODE_LANGUAGES = [
  { value: 'plaintext', label: 'Plain Text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'json', label: 'JSON' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'sql', label: 'SQL' },
  { value: 'python', label: 'Python' },
] as const;

export const CALLOUT_ICONS = ['💡', '⚠️', '✅', '❌', '📌', '📝', '🔥', 'ℹ️'] as const;

export function getText(content: BlockContent | undefined): string {
  return content?.text ?? '';
}

export function allowedCategoriesForBlock(type: BlockType): MediaCategory[] | undefined {
  if (type === 'IMAGE') return ['IMAGE'];
  if (type === 'VIDEO') return ['VIDEO'];
  if (type === 'FILE') return ['DOCUMENT', 'OTHER'];
  return undefined;
}
