import { describe, expect, it } from 'vitest';
import { decryptToken, encryptToken } from '../services/tokenEncryption.service';

describe('tokenEncryptionService', () => {
  it('AES-256-GCM roundtrip', () => {
    const plain = 'EAAG-test-user-token-value';
    const enc = encryptToken(plain);
    expect(enc.ciphertext).toBeTruthy();
    expect(enc.iv).toBeTruthy();
    expect(enc.authTag).toBeTruthy();
    expect(enc.ciphertext).not.toContain(plain);
    expect(decryptToken(enc)).toBe(plain);
  });

  it('farklı IV üretir', () => {
    const a = encryptToken('same-token');
    const b = encryptToken('same-token');
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(decryptToken(a)).toBe('same-token');
    expect(decryptToken(b)).toBe('same-token');
  });

  it('bozuk tag ile çözülemez', () => {
    const enc = encryptToken('secret-token');
    expect(() => decryptToken({ ...enc, authTag: Buffer.from('bad').toString('base64') })).toThrow();
  });
});
