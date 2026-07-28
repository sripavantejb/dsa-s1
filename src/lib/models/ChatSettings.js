import mongoose from 'mongoose';

/** Shared chat prefs for the Tej ↔ Hafsa room (single doc). */
const ChatSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'main', unique: true },
    disappearingOnSeen: { type: Boolean, default: false },
    typingIndicators: { type: Boolean, default: true },
    readReceipts: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const ChatSettings = mongoose.models.ChatSettings || mongoose.model('ChatSettings', ChatSettingsSchema);

export async function getChatSettings() {
  let doc = await ChatSettings.findOne({ key: 'main' });
  if (!doc) {
    doc = await ChatSettings.create({
      key: 'main',
      disappearingOnSeen: false,
      typingIndicators: true,
      readReceipts: true,
    });
  }
  return doc;
}

export default ChatSettings;
