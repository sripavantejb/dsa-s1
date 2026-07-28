import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, index: true },
    displayName: { type: String, required: true },
    text: { type: String, required: true, maxlength: 2000 },
    /** When the other person opened/read the chat */
    seenAt: { type: Date, default: null },
  },
  { timestamps: true }
);

MessageSchema.index({ createdAt: -1 });
MessageSchema.index({ username: 1, seenAt: 1 });

export default mongoose.models.Message || mongoose.model('Message', MessageSchema);
