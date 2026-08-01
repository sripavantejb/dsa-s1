import BrowserSession from '@/lib/models/BrowserSession.js';
import { SESSION_STATUS } from '../constants.js';
import { decryptJson, encryptJson } from '../lib/crypto.js';
import { ValidationError, optionalString } from '../lib/validation.js';

/**
 * Non-sensitive session status for the UI. Never returns the decrypted payload.
 */
export async function getSessionStatus(username) {
  const doc = await BrowserSession.findOne({ username }).lean();
  if (!doc) {
    return { status: SESSION_STATUS.DISCONNECTED, lastConnectedAt: null, expiresAt: null, accountHint: '', userAgent: '' };
  }

  let status = doc.status;
  if (status === SESSION_STATUS.CONNECTED && doc.expiresAt && new Date(doc.expiresAt) <= new Date()) {
    status = SESSION_STATUS.EXPIRED;
  }

  return {
    status,
    lastConnectedAt: doc.lastConnectedAt,
    expiresAt: doc.expiresAt,
    accountHint: doc.accountHint || '',
    userAgent: doc.userAgent || '',
  };
}

/**
 * Stores the user's OWN browser session, encrypted. Accepts a Playwright
 * storageState object (or a JSON string of one). Passwords are never accepted.
 */
export async function connectSession(username, body = {}) {
  let storageState = body.storageState;
  if (typeof storageState === 'string') {
    try {
      storageState = JSON.parse(storageState);
    } catch {
      throw new ValidationError('storageState must be valid JSON exported from your browser.');
    }
  }
  if (!storageState || typeof storageState !== 'object') {
    throw new ValidationError('A Playwright storageState payload is required.');
  }
  // Guard against accidentally pasting credentials.
  const asText = JSON.stringify(storageState).toLowerCase();
  if (asText.includes('"password"')) {
    throw new ValidationError('Session payload must not contain a password.');
  }

  const encrypted = encryptJson(storageState);
  const now = new Date();
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

  const doc = await BrowserSession.findOneAndUpdate(
    { username },
    {
      $set: {
        status: SESSION_STATUS.CONNECTED,
        encrypted,
        userAgent: optionalString(body.userAgent, { max: 400 }),
        accountHint: optionalString(body.accountHint, { max: 120 }),
        lastConnectedAt: now,
        expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
      },
    },
    { new: true, upsert: true }
  );

  return getSessionStatus(doc.username);
}

export async function disconnectSession(username) {
  await BrowserSession.findOneAndUpdate(
    { username },
    { $set: { status: SESSION_STATUS.DISCONNECTED, encrypted: null, expiresAt: null } },
    { upsert: true }
  );
  return getSessionStatus(username);
}

export async function markSessionExpired(username) {
  await BrowserSession.updateOne({ username }, { $set: { status: SESSION_STATUS.EXPIRED } });
}

/**
 * SERVER-ONLY. Decrypts and returns the storageState for the worker, or null.
 * Must never be exposed through an API response.
 */
export async function loadStorageState(username) {
  const doc = await BrowserSession.findOne({ username });
  if (!doc || doc.status !== SESSION_STATUS.CONNECTED || !doc.encrypted) return null;
  if (doc.expiresAt && new Date(doc.expiresAt) <= new Date()) {
    doc.status = SESSION_STATUS.EXPIRED;
    await doc.save();
    return null;
  }
  try {
    return decryptJson(doc.encrypted);
  } catch {
    return null;
  }
}
