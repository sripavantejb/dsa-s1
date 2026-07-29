import mongoose from 'mongoose';

const QuestionSchema = new mongoose.Schema(
  {
    qid: { type: String, required: true, unique: true },
    sheet: { type: String, enum: ['ccbp', 'striver'], default: 'ccbp', index: true },
    order: { type: Number, required: true, index: true },
    topic: { type: String, required: true },
    subtopic: { type: String, default: '' },
    title: { type: String, required: true },
    link: { type: String, default: '' },
    altLink: { type: String, default: '' },
    difficulty: {
      type: String,
      enum: ['EASY', 'MEDIUM', 'HARD', 'UNRATED'],
      default: 'UNRATED',
    },
  },
  { timestamps: true }
);

export default mongoose.models.Question || mongoose.model('Question', QuestionSchema);
