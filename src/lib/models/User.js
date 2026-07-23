import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, required: true },
    passwordHash: { type: String, required: true },
    solved: [{ type: String }],
    /** date (YYYY-MM-DD) -> qids finished that day — streak needs 8/day */
    dailySolves: { type: mongoose.Schema.Types.Mixed, default: {} },
    activityDates: [{ type: String }],
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model('User', UserSchema);
