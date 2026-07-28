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
    offer: c.offer?.sdp ? { type: c.offer.type, sdp: c.offer.sdp } : null,
    answer: c.answer?.sdp ? { type: c.answer.type, sdp: c.answer.sdp } : null,
    callerIce: c.callerIce || [],
    calleeIce: c.calleeIce || [],
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    endedAt: c.endedAt || null,
    endedBy: c.endedBy || '',
  };
}

async function partnerOf(username) {
  const other = await User.findOne({ username: { $ne: username } }).select('username displayName').lean();
  return other;
}

async function expireStale() {
  const ringCutoff = new Date(Date.now() - 60_000);
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
    const existing = await CallSession.findOne({
      status: { $in: [...ACTIVE] },
      $or: [
        { callerUsername: user.username },
        { calleeUsername: user.username },
        { callerUsername: partner.username },
        { calleeUsername: partner.username },
      ],
    });
    if (existing) {
      return NextResponse.json({ message: 'A call is already in progress', call: serialize(existing) }, { status: 409 });
    }

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
      call.offer = { type: body.type || 'offer', sdp: body.sdp };
      if (call.status === 'ringing' || call.status === 'accepted') call.status = call.status;
      await call.save();
      return NextResponse.json({ call: serialize(call.toObject()) });
    }

    if (action === 'answer') {
      if (!isCallee) return NextResponse.json({ message: 'Only callee can set answer' }, { status: 403 });
      if (!body.sdp) return NextResponse.json({ message: 'Missing SDP' }, { status: 400 });
      call.answer = { type: body.type || 'answer', sdp: body.sdp };
      call.status = 'active';
      await call.save();
      return NextResponse.json({ call: serialize(call.toObject()) });
    }

    if (action === 'ice') {
      const cand = body.candidate;
      if (!cand?.candidate) return NextResponse.json({ message: 'Missing candidate' }, { status: 400 });
      const entry = {
        candidate: cand.candidate,
        sdpMid: cand.sdpMid ?? null,
        sdpMLineIndex: cand.sdpMLineIndex ?? null,
      };
      if (isCaller) call.callerIce.push(entry);
      else call.calleeIce.push(entry);
      // Cap ice lists
      if (call.callerIce.length > 80) call.callerIce = call.callerIce.slice(-80);
      if (call.calleeIce.length > 80) call.calleeIce = call.calleeIce.slice(-80);
      await call.save();
      return NextResponse.json({ call: serialize(call.toObject()) });
    }

    if (action === 'accept') {
      if (!isCallee) return NextResponse.json({ message: 'Only callee can accept' }, { status: 403 });
      if (call.status !== 'ringing') {
        return NextResponse.json({ message: 'Call is not ringing', call: serialize(call.toObject()) }, { status: 400 });
      }
      call.status = 'accepted';
      await call.save();
      return NextResponse.json({ call: serialize(call.toObject()) });
    }

    if (action === 'decline') {
      if (!isCallee) return NextResponse.json({ message: 'Only callee can decline' }, { status: 403 });
      call.status = 'declined';
      call.endedAt = new Date();
      call.endedBy = user.username;
      await call.save();
      return NextResponse.json({ call: serialize(call.toObject()) });
    }

    if (action === 'hangup') {
      if (!ACTIVE.has(call.status) && call.status !== 'accepted') {
        return NextResponse.json({ call: serialize(call.toObject()) });
      }
      call.status = 'ended';
      call.endedAt = new Date();
      call.endedBy = user.username;
      await call.save();
      return NextResponse.json({ call: serialize(call.toObject()) });
    }

    if (action === 'active') {
      if (call.status === 'accepted') {
        call.status = 'active';
        await call.save();
      }
      return NextResponse.json({ call: serialize(call.toObject()) });
    }

    return NextResponse.json({ message: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Failed to update call' }, { status: 500 });
  }
}
