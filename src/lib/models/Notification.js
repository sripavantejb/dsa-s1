import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema(
  {
    toUsername: { type: String, required: true, index: true },
    fromUsername: { type: String, required: true },
    fromDisplayName: { type: String, required: true },
    type: {
      type: String,
      enum: ['finished', 'attempted', 'reopened', 'chat', 'code', 'streak', 'call', 'automation', 'revision'],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    linkTab: { type: String, default: 'live' },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

NotificationSchema.index({ toUsername: 1, createdAt: -1 });

export default mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
