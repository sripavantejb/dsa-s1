import mongoose from 'mongoose';

/**
 * Per-user configuration for the (isolated) LeetCode Streak Automation module.
 * One document per user. Never stores passwords or raw session cookies —
 * the browser session lives encrypted in the BrowserSession collection.
 */

const NotificationChannelSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    /** Channel-specific target: webhook URL, chat id, email, etc. */
    target: { type: String, default: '' },
  },
  { _id: false }
);

const AutomationSettingsSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },

    /** Master switch — when false the runner skips this user entirely. */
    enabled: { type: Boolean, default: false },
    /** Temporary pause that keeps configuration but halts runs. */
    paused: { type: Boolean, default: false },

    /**
     * Which execution engine handles a run. `reminder` is the safe default and
     * only notifies the user to submit manually. `playwright` is opt-in, ToS-risky
     * and disabled unless the deployment explicitly allows it.
     */
    engine: { type: String, enum: ['reminder', 'playwright'], default: 'reminder' },

    /** Local submission time in HH:mm (24h) interpreted in `timezone`. */
    submissionTime: { type: String, default: '09:00' },
    /** IANA timezone, e.g. "Asia/Kolkata". */
    timezone: { type: String, default: 'UTC' },

    /** How the next problem is chosen for a run. */
    rotation: { type: String, enum: ['random', 'sequential', 'specific'], default: 'sequential' },
    /** Used when rotation === 'specific'. */
    specificSolutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'StoredSolution', default: null },
    /** Internal cursor for sequential rotation. */
    sequentialCursor: { type: Number, default: 0 },

    retryFailed: { type: Boolean, default: true },
    maxRetries: { type: Number, default: 2, min: 0, max: 10 },

    /** User-entered streak (used when a live value can't be fetched). */
    manualStreak: { type: Number, default: 0, min: 0 },

    notifications: {
      email: { type: NotificationChannelSchema, default: () => ({}) },
      discord: { type: NotificationChannelSchema, default: () => ({}) },
      telegram: { type: NotificationChannelSchema, default: () => ({}) },
      slack: { type: NotificationChannelSchema, default: () => ({}) },
      webhook: { type: NotificationChannelSchema, default: () => ({}) },
      events: {
        success: { type: Boolean, default: true },
        failure: { type: Boolean, default: true },
        sessionExpired: { type: Boolean, default: true },
        automationDisabled: { type: Boolean, default: true },
      },
    },

    /** Bookkeeping updated by the runner. */
    lastRunAt: { type: Date, default: null },
    nextRunAt: { type: Date, default: null },
    lastRunResult: { type: String, enum: ['success', 'failure', 'reminder', 'skipped', null], default: null },
  },
  { timestamps: true }
);

export default mongoose.models.AutomationSettings ||
  mongoose.model('AutomationSettings', AutomationSettingsSchema);
