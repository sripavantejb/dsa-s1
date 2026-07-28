import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ensureSeeded } from '@/lib/seed';
import { getAuthUser } from '@/lib/auth';
import Message from '@/lib/models/Message.js';
import { notifyPartner } from '@/lib/notify';

function serialize(m) {
  return {
    id: String(m._id),
    username: m.username,
    displayName: m.displayName,
    text: m.text,
    createdAt: m.createdAt,
    seenAt: m.seenAt || null,
    seen: !!m.seenAt,
  };
}

export async function GET(req) {
  try {
    await connectDB();
    await ensureSeeded();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ message: 'Login required' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const markSeen = searchParams.get('markSeen') === '1';

    if (markSeen) {
      await Message.updateMany(
        { username: { $ne: user.username }, seenAt: null },
        { $set: { seenAt: new Date() } }
      );
    }

    const messages = await Message.find().sort({ createdAt: -1 }).limit(100).lean();
    const list = messages.reverse();

    return NextResponse.json({
      messages: list.map(serialize),
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Failed to load chat' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await connectDB();
    await ensureSeeded();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ message: 'Login required' }, { status: 401 });

    const body = await req.json();
    const text = String(body.text || '').trim();
    if (!text) return NextResponse.json({ message: 'Message cannot be empty' }, { status: 400 });
    if (text.length > 2000) return NextResponse.json({ message: 'Message too long' }, { status: 400 });

    const msg = await Message.create({
      username: user.username,
      displayName: user.displayName,
      text,
      seenAt: null,
    });

    await notifyPartner(user, {
      type: 'chat',
      title: `Message from ${user.displayName}`,
      body: text.slice(0, 120),
      linkTab: 'chat',
    });

    return NextResponse.json({ message: serialize(msg) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Failed to send' }, { status: 500 });
  }
}
