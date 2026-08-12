import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { env } from '../config/env';
import { AppError } from '../lib/errors';

export type EncryptedToken = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

function encryptionKey(): Buffer {
  const secret = env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new AppError(
      500,
      'TOKEN_ENCRYPTION_NOT_CONFIGURED',
      'Sosyal token şifreleme anahtarı tanımlı değil',
    );
  }
  if (/^[0-9a-fA-F]{64}$/.test(secret)) {
    return Buffer.from(secret, 'hex');
  }
  return createHash('sha256').update(secret).digest();
}

export function encryptToken(plaintext: string): EncryptedToken {
  if (!plaintext) {
    throw new AppError(500, 'TOKEN_ENCRYPT_FAILED', 'Boş token şifrelenemez');
  }
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

export function decryptToken(payload: EncryptedToken): string {
  if (!payload?.ciphertext || !payload.iv || !payload.authTag) {
    throw new AppError(500, 'TOKEN_DECRYPT_FAILED', 'Şifreli token eksik');
  }
  try {
    const key = encryptionKey();
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(payload.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    throw new AppError(500, 'TOKEN_DECRYPT_FAILED', 'Token çözülemedi');
  }
}

export function hasEncryptedToken(payload: {
  accessTokenEncrypted?: string | null;
  accessTokenIv?: string | null;
  accessTokenTag?: string | null;
}): payload is {
  accessTokenEncrypted: string;
  accessTokenIv: string;
  accessTokenTag: string;
} {
  return Boolean(payload.accessTokenEncrypted && payload.accessTokenIv && payload.accessTokenTag);
}

export function decryptStoredToken(record: {
  accessTokenEncrypted?: string | null;
  accessTokenIv?: string | null;
  accessTokenTag?: string | null;
}): string {
  if (!hasEncryptedToken(record)) {
    throw new AppError(400, 'ACCOUNT_TOKEN_MISSING', 'Hesap erişim jetonu yok veya geçersiz');
  }
  return decryptToken({
    ciphertext: record.accessTokenEncrypted,
    iv: record.accessTokenIv,
    authTag: record.accessTokenTag,
  });
}
