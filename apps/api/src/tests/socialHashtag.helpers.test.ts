import { describe, expect, it } from 'vitest';
import {
  appendHashtagsToText,
  hashtagKey,
  normalizeHashtag,
  parseHashtagsFromText,
  previewBulkHashtags,
  splitBulkHashtagInput,
} from '../../../../packages/shared/src/hashtags';

describe('hashtag normalization', () => {
  it('trim, # ekler ve ardışık # temizler', () => {
    expect(normalizeHashtag('bilirkisihesap')).toBe('#bilirkisihesap');
    expect(normalizeHashtag('#bilirkisihesap')).toBe('#bilirkisihesap');
    expect(normalizeHashtag('##bilirkisihesap')).toBe('#bilirkisihesap');
    expect(normalizeHashtag('  #BilirkisiHesap  ')).toBe('#bilirkisihesap');
  });

  it('case-insensitive aynı anahtarı üretir', () => {
    expect(hashtagKey(normalizeHashtag('BilirkisiHesap')!)).toBe(
      hashtagKey(normalizeHashtag('#bilirkisihesap')!),
    );
    expect(hashtagKey(normalizeHashtag('##bilirkisihesap')!)).toBe('bilirkisihesap');
  });

  it('boşluk ve geçersiz karakterleri reddeder', () => {
    expect(normalizeHashtag('bili kisi')).toBeNull();
    expect(normalizeHashtag('#')).toBeNull();
    expect(normalizeHashtag('')).toBeNull();
    expect(normalizeHashtag('#foo-bar')).toBeNull();
  });

  it('Türkçe karakterleri korur', () => {
    expect(normalizeHashtag('#İşHukuku')).toBe('#işhukuku');
    expect(normalizeHashtag('kıdem')).toBe('#kıdem');
  });
});

describe('contentText hashtag parse', () => {
  it('metindeki hashtagleri okur', () => {
    expect(parseHashtagsFromText('Merhaba #bilirkisihesap ve #ishukuku')).toEqual([
      '#bilirkisihesap',
      '#ishukuku',
    ]);
  });

  it('Türkçe karakterli hashtagleri okur', () => {
    expect(parseHashtagsFromText('Paylaşım #işhukuku #kıdem #fazlamesai')).toEqual([
      '#işhukuku',
      '#kıdem',
      '#fazlamesai',
    ]);
  });

  it('aynı hashtagi bir kez döner', () => {
    expect(parseHashtagsFromText('#foo #FOO #foo')).toEqual(['#foo']);
  });
});

describe('picker duplicate eklemez', () => {
  it('metinde varsa ikinci kez eklemez', () => {
    const next = appendHashtagsToText('Metin #bilirkisihesap', ['#bilirkisihesap', '#ishukuku']);
    expect(next).toBe('Metin #bilirkisihesap\n\n#ishukuku');
    expect(parseHashtagsFromText(next).filter((t) => t === '#bilirkisihesap')).toHaveLength(1);
  });

  it('seçim listesindeki tekrarları da atlar', () => {
    const next = appendHashtagsToText('Merhaba', ['#foo', '#FOO', '##foo']);
    expect(next).toBe('Merhaba\n\n#foo');
  });
});

describe('bulk input split', () => {
  it('satır satır ayırır', () => {
    expect(splitBulkHashtagInput('#bilirkisihesap\n#ishukuku\n#fazlamesai')).toEqual([
      '#bilirkisihesap',
      '#ishukuku',
      '#fazlamesai',
    ]);
  });

  it('boşlukla ayırır', () => {
    expect(splitBulkHashtagInput('#bilirkisihesap #ishukuku #fazlamesai #kidem')).toEqual([
      '#bilirkisihesap',
      '#ishukuku',
      '#fazlamesai',
      '#kidem',
    ]);
  });

  it('virgülle ayırır', () => {
    expect(splitBulkHashtagInput('#bilirkisihesap, #ishukuku, #fazlamesai, #kidem')).toEqual([
      '#bilirkisihesap',
      '#ishukuku',
      '#fazlamesai',
      '#kidem',
    ]);
  });
});

describe('bulk preview', () => {
  it('normalize, tekrar ve geçersizi ayırır', () => {
    const preview = previewBulkHashtags(
      'bilirkisihesap\n#bilirkisihesap\n##bilirkisihesap\n#işhukuku\n#foo-bar',
    );
    expect(preview.unique).toEqual(['#bilirkisihesap', '#işhukuku']);
    expect(preview.duplicateCount).toBe(2);
    expect(preview.duplicates).toEqual(['#bilirkisihesap']);
    expect(preview.invalidCount).toBe(1);
    expect(preview.invalid).toEqual(['#foo-bar']);
  });
});
