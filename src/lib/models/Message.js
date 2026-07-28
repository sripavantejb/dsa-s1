import mongoose from 'mongoose';

const ReactionSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true },
    username: { type: String, required: true },
  },
  { _id: false }
);

const MessageSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, index: true },
    displayName: { type: String, required: true },
    text: { type: String, required: true, maxlength: 2000 },
    seenAt: { type: Date, default: null },
    reactions: { type: [ReactionSchema], default: [] },
    replyTo: {
      id: { type: String, default: '' },
      text: { type: String, default: '' },
      displayName: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

MessageSchema.index({ createdAt: -1 });
MessageSchema.index({ username: 1, seenAt: 1 });

export default mongoose.models.Message || mongoose.model('Message', MessageSchema);
