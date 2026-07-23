import mongoose from 'mongoose';

const ActivitySchema = new mongoose.Schema(
  {
    username: { type: String, required: true, index: true },
    displayName: { type: String, required: true },
    qid: { type: String, required: true },
    title: { type: String, required: true },
    topic: { type: String, default: '' },
    action: {
      type: String,
      enum: ['attempted', 'finished', 'reopened'],
      required: true,
    },
  },
  { timestamps: true }
);

ActivitySchema.index({ createdAt: -1 });

export default mongoose.models.Activity || mongoose.model('Activity', ActivitySchema);
