import mongoose from 'mongoose';

const SharedCodeSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, index: true },
    displayName: { type: String, required: true },
    title: { type: String, required: true, maxlength: 200 },
    language: {
      type: String,
      enum: ['cpp', 'java', 'python', 'javascript', 'c', 'other'],
      default: 'cpp',
    },
    code: { type: String, required: true, maxlength: 50000 },
    note: { type: String, default: '', maxlength: 1000 },
    qid: { type: String, default: '' },
    questionTitle: { type: String, default: '' },
    topic: { type: String, default: '' },
  },
  { timestamps: true }
);

SharedCodeSchema.index({ createdAt: -1 });

export default mongoose.models.SharedCode || mongoose.model('SharedCode', SharedCodeSchema);
