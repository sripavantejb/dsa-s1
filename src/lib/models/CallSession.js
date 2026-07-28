import mongoose from 'mongoose';

const IceSchema = new mongoose.Schema(
  {
    candidate: String,
    sdpMid: String,
    sdpMLineIndex: Number,
  },
  { _id: false }
);

const CallSessionSchema = new mongoose.Schema(
  {
    callerUsername: { type: String, required: true, index: true },
    callerDisplayName: { type: String, required: true },
    calleeUsername: { type: String, required: true, index: true },
    calleeDisplayName: { type: String, required: true },
    mode: { type: String, enum: ['audio', 'video'], default: 'audio' },
    status: {
      type: String,
      enum: ['ringing', 'accepted', 'active', 'ended', 'declined', 'missed'],
      default: 'ringing',
      index: true,
    },
    encryption: { type: String, default: 'dtls-srtp' },
    // Flat fields avoid mongoose nested "type" quirks
    offerType: { type: String, default: '' },
    offerSdp: { type: String, default: '' },
    answerType: { type: String, default: '' },
    answerSdp: { type: String, default: '' },
    callerIce: { type: [IceSchema], default: [] },
    calleeIce: { type: [IceSchema], default: [] },
    endedAt: { type: Date, default: null },
    endedBy: { type: String, default: '' },
  },
  { timestamps: true }
);

CallSessionSchema.index({ status: 1, updatedAt: -1 });

export default mongoose.models.CallSession || mongoose.model('CallSession', CallSessionSchema);
