import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/** Only used outside production, so a dev machine needs no setup to run the app. */
const DEVELOPMENT_SECRET = 'freelancerhisab-development-only-integration-key';

/**
 * The secret behind token encryption and OAuth state signing.
 *
 * A baked-in fallback in production would make every deployment's stored refresh
 * tokens decryptable by anyone holding this source, so production must supply
 * its own and the app refuses to start a flow without one.
 */
export function getIntegrationSecret(): string {
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'INTEGRATION_ENCRYPTION_KEY (or JWT_SECRET) must be set in production — platform credentials cannot be encrypted without it.',
    );
  }
  return DEVELOPMENT_SECRET;
}

/**
 * Derives a consistent 32-byte encryption key from the environment secret.
 */
function getEncryptionKey(): Buffer {
  return crypto.createHash('sha256').update(getIntegrationSecret()).digest();
}

/**
 * Encrypts sensitive OAuth tokens at rest using AES-256-GCM.
 * Output format: `ivHex:authTagHex:encryptedDataHex`
 */
export function encryptToken(plainText: string): string {
  if (!plainText || plainText.trim() === '') {
    return '';
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts AES-256-GCM encrypted tokens for secure backend-to-platform communication.
 */
export function decryptToken(cipherText: string): string {
  if (!cipherText || cipherText.trim() === '') {
    return '';
  }

  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }

  const [ivHex, authTagHex, encryptedDataHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = getEncryptionKey();

  if (iv.length !== IV_LENGTH || authTag.length !== TAG_LENGTH) {
    throw new Error('Invalid token authentication parameters');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedDataHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
