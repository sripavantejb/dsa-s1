import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ensureSeeded } from '@/lib/seed';
import { getAuthUser } from '@/lib/auth';
import CallSession from '@/lib/models/CallSession.js';
import User from '@/lib/models/User.js';
import { notifyPartner } from '@/lib/notify';

const ACTIVE = new Set(['ringing', 'accepted', 'active']);

function serialize(c) {
  if (!c) return null;
  // Support both flat and legacy nested offer/answer shapes
  const offerSdp = c.offerSdp || c.offer?.sdp || '';
  const answerSdp = c.answerSdp || c.answer?.sdp || '';
  const offerType = c.offerType || c.offer?.type || 'offer';
  const answerType = c.answerType || c.answer?.type || 'answer';
  return {
    id: String(c._id),
    callerUsername: c.callerUsername,
    callerDisplayName: c.callerDisplayName,
    calleeUsername: c.calleeUsername,
    calleeDisplayName: c.calleeDisplayName,
    mode: c.mode,
    status: c.status,
    encryption: c.encryption || 'dtls-srtp',
    e2e: true,
    offer: offerSdp ? { type: offerType, sdp: offerSdp } : null,
    answer: answerSdp ? { type: answerType, sdp: answerSdp } : null,
    callerIce: c.callerIce || [],
    calleeIce: c.calleeIce || [],
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    endedAt: c.endedAt || null,
    endedBy: c.endedBy || '',
  };
}

async function partnerOf(username) {
  return User.findOne({ username: { $ne: username } }).select('username displayName').lean();
}

async function expireStale() {
  const ringCutoff = new Date(Date.now() - 90_000);
  const activeCutoff = new Date(Date.now() - 3 * 60 * 60_000);
  await CallSession.updateMany(
    { status: 'ringing', createdAt: { $lt: ringCutoff } },
    { $set: { status: 'missed', endedAt: new Date() } }
  );
  await CallSession.updateMany(
    { status: { $in: ['accepted', 'active'] }, updatedAt: { $lt: activeCutoff } },
    { $set: { status: 'ended', endedAt: new Date(), endedBy: 'timeout' } }
  );
}

export async function GET() {
  try {
    await connectDB();
    await ensureSeeded();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ message: 'Login required' }, { status: 401 });

    await expireStale();

    const call = await CallSession.findOne({
      status: { $in: [...ACTIVE] },
      $or: [{ callerUsername: user.username }, { calleeUsername: user.username }],
    })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      call: serialize(call),
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Failed to load call' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await connectDB();
    await ensureSeeded();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ message: 'Login required' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const mode = body.mode === 'video' ? 'video' : 'audio';
    const partner = await partnerOf(user.username);
    if (!partner) return NextResponse.json({ message: 'No partner found' }, { status: 400 });

    await expireStale();

    // Clear any stuck live calls for this pair so a fresh call can start
    await CallSession.updateMany(
      {
        status: { $in: [...ACTIVE] },
        $or: [
          { callerUsername: user.username },
          { calleeUsername: user.username },
          { callerUsername: partner.username },
          { calleeUsername: partner.username },
        ],
      },
      { $set: { status: 'ended', endedAt: new Date(), endedBy: 'replaced' } }
    );

    const call = await CallSession.create({
      callerUsername: user.username,
      callerDisplayName: user.displayName,
      calleeUsername: partner.username,
      calleeDisplayName: partner.displayName,
      mode,
      status: 'ringing',
      encryption: 'dtls-srtp',
    });

    await notifyPartner(user, {
      type: 'call',
      title: `${user.displayName} is calling`,
      body: mode === 'video' ? 'Incoming video call · E2E encrypted' : 'Incoming voice call · E2E encrypted',
      linkTab: 'chat',
    });

    return NextResponse.json({ call: serialize(call) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Failed to start call' }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    await connectDB();
    await ensureSeeded();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ message: 'Login required' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const id = String(body.id || '');
    const action = String(body.action || '');
    if (!id || !action) return NextResponse.json({ message: 'Missing id/action' }, { status: 400 });

    const call = await CallSession.findById(id);
    if (!call) return NextResponse.json({ message: 'Call not found' }, { status: 404 });

    const isCaller = call.callerUsername === user.username;
    const isCallee = call.calleeUsername === user.username;
    if (!isCaller && !isCallee) {
      return NextResponse.json({ message: 'Not your call' }, { status: 403 });
    }

    if (action === 'offer') {
      if (!isCaller) return NextResponse.json({ message: 'Only caller can set offer' }, { status: 403 });
      if (!body.sdp) return NextResponse.json({ message: 'Missing SDP' }, { status: 400 });
      const updated = await CallSession.findByIdAndUpdate(
        id,
        {
          $set: {
            offerType: body.type || 'offer',
            offerSdp: body.sdp,
          },
        },
        { new: true }
      ).lean();
      return NextResponse.json({ call: serialize(updated) });
    }

    if (action === 'answer') {
      if (!isCallee) return NextResponse.json({ message: 'Only callee can set answer' }, { status: 403 });
      if (!body.sdp) return NextResponse.json({ message: 'Missing SDP' }, { status: 400 });
      const updated = await CallSession.findByIdAndUpdate(
        id,
        {
          $set: {
            answerType: body.type || 'answer',
            answerSdp: body.sdp,
            status: 'active',
          },
        },
        { new: true }
      ).lean();
      return NextResponse.json({ call: serialize(updated) });
    }

    if (action === 'ice') {
      const cand = body.candidate;
      if (!cand?.candidate) return NextResponse.json({ message: 'Missing candidate' }, { status: 400 });
      const entry = {
        candidate: cand.candidate,
        sdpMid: cand.sdpMid ?? null,
        sdpMLineIndex: typeof cand.sdpMLineIndex === 'number' ? cand.sdpMLineIndex : null,
      };
      const field = isCaller ? 'callerIce' : 'calleeIce';
      const updated = await CallSession.findByIdAndUpdate(
        id,
        { $push: { [field]: { $each: [entry], $slice: -100 } } },
        { new: true }
      ).lean();
      return NextResponse.json({ call: serialize(updated) });
    }

    if (action === 'accept') {
      if (!isCallee) return NextResponse.json({ message: 'Only callee can accept' }, { status: 403 });
      if (call.status !== 'ringing' && call.status !== 'accepted') {
        return NextResponse.json({ message: 'Call is not ringing', call: serialize(call.toObject()) }, { status: 400 });
      }
      const updated = await CallSession.findByIdAndUpdate(
        id,
        { $set: { status: 'accepted' } },
        { new: true }
      ).lean();
      return NextResponse.json({ call: serialize(updated) });
    }

    if (action === 'decline') {
      if (!isCallee) return NextResponse.json({ message: 'Only callee can decline' }, { status: 403 });
      const updated = await CallSession.findByIdAndUpdate(
        id,
        { $set: { status: 'declined', endedAt: new Date(), endedBy: user.username } },
        { new: true }
      ).lean();
      return NextResponse.json({ call: serialize(updated) });
    }

    if (action === 'hangup') {
      const updated = await CallSession.findByIdAndUpdate(
        id,
        { $set: { status: 'ended', endedAt: new Date(), endedBy: user.username } },
        { new: true }
      ).lean();
      return NextResponse.json({ call: serialize(updated) });
    }

    if (action === 'active') {
      const updated = await CallSession.findByIdAndUpdate(
        id,
        { $set: { status: 'active' } },
        { new: true }
      ).lean();
      return NextResponse.json({ call: serialize(updated) });
    }

    return NextResponse.json({ message: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Failed to update call' }, { status: 500 });
  }
}
