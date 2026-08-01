import mongoose from 'mongoose';

/**
 * The user's own LeetCode browser session, stored ENCRYPTED at rest.
 * We never store passwords — only a Playwright `storageState` payload the user
 * captured from their own browser. The plaintext is encrypted via
 * `features/leetcode-automation/lib/crypto` before it reaches this collection.
 */
const EncryptedBlobSchema = new mongoose.Schema(
  {
    iv: { type: String, required: true },
    tag: { type: String, required: true },
    data: { type: String, required: true },
  },
  { _id: false }
);

const BrowserSessionSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },

    status: {
      type: String,
      enum: ['connected', 'expired', 'disconnected'],
      default: 'disconnected',
    },

    /** AES-256-GCM encrypted Playwright storageState JSON. Null when disconnected. */
    encrypted: { type: EncryptedBlobSchema, default: null },

    userAgent: { type: String, default: '' },
    /** Non-sensitive hint shown in the UI (e.g. detected LeetCode username). */
    accountHint: { type: String, default: '' },

    lastConnectedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.BrowserSession ||
  mongoose.model('BrowserSession', BrowserSessionSchema);
