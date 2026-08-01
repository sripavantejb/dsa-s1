import mongoose from 'mongoose';

/**
 * Immutable record of a single automation run (or reminder). Written by the
 * runner regardless of which engine handled it, so logs stay identical across
 * the reminder-only and Playwright implementations.
 */
const SubmissionLogSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, index: true, lowercase: true, trim: true },
    solutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'StoredSolution', default: null },
    problemName: { type: String, default: '' },
    problemUrl: { type: String, default: '' },

    /** Engine that produced this log entry. */
    engine: { type: String, enum: ['reminder', 'playwright'], default: 'reminder' },

    result: {
      type: String,
      enum: ['success', 'failure', 'reminder', 'skipped'],
      required: true,
    },

    startTime: { type: Date, default: null },
    endTime: { type: Date, default: null },
    /** Wall-clock execution time in milliseconds. */
    executionMs: { type: Number, default: 0 },

    failureReason: { type: String, default: '' },
    /** Optional path/URL to a screenshot captured on failure (Playwright engine). */
    screenshot: { type: String, default: '' },
    browserVersion: { type: String, default: '' },
    retryCount: { type: Number, default: 0 },

    /** Whether this run was triggered manually or by the scheduler/cron. */
    trigger: { type: String, enum: ['manual', 'scheduled'], default: 'scheduled' },
  },
  { timestamps: true }
);

SubmissionLogSchema.index({ username: 1, createdAt: -1 });
SubmissionLogSchema.index({ username: 1, result: 1, createdAt: -1 });

export default mongoose.models.SubmissionLog ||
  mongoose.model('SubmissionLog', SubmissionLogSchema);
