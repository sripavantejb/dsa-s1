import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ensureSeeded } from '@/lib/seed';
import { getAuthUser } from '@/lib/auth';
import Message from '@/lib/models/Message.js';

function serialize(m) {
  return {
    id: String(m._id),
    username: m.username,
    displayName: m.displayName,
    text: m.text,
    createdAt: m.createdAt,
  };
}

export async function GET(req) {
  try {
    await connectDB();
    await ensureSeeded();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ message: 'Login required' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const since = searchParams.get('since');
    const filter = {};
    if (since) {
      const d = new Date(since);
      if (!Number.isNaN(d.getTime())) filter.createdAt = { $gt: d };
    }

    const messages = await Message.find(filter).sort({ createdAt: since ? 1 : -1 }).limit(since ? 100 : 80).lean();
    const list = since ? messages : messages.reverse();

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
    });

    return NextResponse.json({ message: serialize(msg) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Failed to send' }, { status: 500 });
  }
}
