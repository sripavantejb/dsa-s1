import mongoose from 'mongoose';

const PresenceSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    displayName: { type: String, required: true },
    lastSeen: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

export default mongoose.models.Presence || mongoose.model('Presence', PresenceSchema);
