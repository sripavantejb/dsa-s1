import mongoose from 'mongoose';

/**
 * A solution the user has already written and saved, ready to be (re)submitted
 * or used as a reminder. Scoped per user by username to match existing models.
 */
const StoredSolutionSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, index: true, lowercase: true, trim: true },
    problemName: { type: String, required: true, trim: true },
    problemUrl: { type: String, default: '', trim: true },
    language: {
      type: String,
      enum: [
        'cpp',
        'java',
        'python',
        'python3',
        'javascript',
        'typescript',
        'c',
        'csharp',
        'go',
        'rust',
        'kotlin',
        'swift',
        'ruby',
        'scala',
        'php',
      ],
      default: 'cpp',
    },
    sourceCode: { type: String, required: true },
    difficulty: {
      type: String,
      enum: ['EASY', 'MEDIUM', 'HARD', 'UNRATED'],
      default: 'UNRATED',
    },
    tags: [{ type: String, trim: true }],
    favorite: { type: Boolean, default: false },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

StoredSolutionSchema.index({ username: 1, favorite: -1, updatedAt: -1 });
StoredSolutionSchema.index({ username: 1, problemName: 'text', tags: 'text' });

export default mongoose.models.StoredSolution ||
  mongoose.model('StoredSolution', StoredSolutionSchema);
