import crypto from 'node:crypto';

/**
 * AES-256-GCM encryption for browser-session data at rest.
 *
 * The key is derived (scrypt) from AUTOMATION_ENCRYPTION_KEY. We deliberately
 * fall back to JWT_SECRET so the feature works in existing deployments, but log
 * a warning because a dedicated key is strongly recommended. No secret is ever
 * written to disk or returned to the client.
 */

const ALGO = 'aes-256-gcm';
const KEY_LEN = 32;
const SALT = 'leetcode-automation:v1';

let cachedKey = null;
let warned = false;

function resolveSecret() {
  const secret = process.env.AUTOMATION_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'Cannot encrypt session data: set AUTOMATION_ENCRYPTION_KEY (recommended) or JWT_SECRET.'
    );
  }
  if (!process.env.AUTOMATION_ENCRYPTION_KEY && !warned) {
    warned = true;
    console.warn(
      '[leetcode-automation] AUTOMATION_ENCRYPTION_KEY not set — falling back to JWT_SECRET. ' +
        'Set a dedicated 32+ char key in production.'
    );
  }
  return secret;
}

function getKey() {
  if (cachedKey) return cachedKey;
  cachedKey = crypto.scryptSync(resolveSecret(), SALT, KEY_LEN);
  return cachedKey;
}

/**
 * Encrypts any JSON-serialisable value.
 * @param {unknown} value
 * @returns {{ iv: string, tag: string, data: string }}
 */
export function encryptJson(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  };
}

/**
 * Decrypts a blob produced by {@link encryptJson}.
 * @param {{ iv: string, tag: string, data: string } | null | undefined} blob
 * @returns {unknown}
 */
export function decryptJson(blob) {
  if (!blob || !blob.iv || !blob.tag || !blob.data) {
    throw new Error('Invalid encrypted payload.');
  }
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(blob.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(blob.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(blob.data, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString('utf8'));
}
