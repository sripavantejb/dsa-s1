import mongoose from 'mongoose';

const RevisionHistorySchema = new mongoose.Schema(
  {
    week: { type: Number, required: true },
    scheduledFor: { type: Date, required: true },
    completedAt: { type: Date, default: null },
  },
  { _id: false }
);

const RevisionItemSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, index: true, lowercase: true, trim: true },
    /** Problem Set qid — null for manually added external problems */
    qid: { type: String, default: null, index: true },
    source: { type: String, enum: ['problem_set', 'manual'], required: true },
    trackingActive: { type: Boolean, default: true },
    /** Cached / required for manual entries; problem_set prefers live Question join */
    title: { type: String, required: true },
    platform: { type: String, default: '' },
    link: { type: String, default: '' },
    topic: { type: String, default: '' },
    difficulty: {
      type: String,
      enum: ['EASY', 'MEDIUM', 'HARD', 'UNRATED'],
      default: 'UNRATED',
    },
    notes: { type: String, default: '' },
    solvedAt: { type: Date, required: true },
    /** Next revision week number (1 = first weekly revision) */
    stage: { type: Number, default: 1 },
    nextRevisionAt: { type: Date, required: true, index: true },
    lastRevisedAt: { type: Date, default: null },
    history: { type: [RevisionHistorySchema], default: [] },
  },
  { timestamps: true }
);

/** One revision tracker per user + problem-set question */
RevisionItemSchema.index(
  { username: 1, qid: 1 },
  {
    unique: true,
    partialFilterExpression: { qid: { $type: 'string' } },
  }
);

RevisionItemSchema.index({ username: 1, nextRevisionAt: 1 });
RevisionItemSchema.index({ username: 1, trackingActive: 1 });

export default mongoose.models.RevisionItem || mongoose.model('RevisionItem', RevisionItemSchema);
