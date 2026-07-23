import mongoose from 'mongoose';

const PresenceSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    displayName: { type: String, required: true },
    lastSeen: { type: Date, required: true, index: true },
    /** YYYY-MM-DD for which secondsToday applies */
    activeDate: { type: String, default: '' },
    /** Focused study seconds accumulated today */
    secondsToday: { type: Number, default: 0 },
    /** Lifetime focused seconds */
    secondsTotal: { type: Number, default: 0 },
    /** Last time they were focused in-tab */
    lastFocusedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.Presence || mongoose.model('Presence', PresenceSchema);
