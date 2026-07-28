import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ensureSeeded } from '@/lib/seed';
import { getAuthUser } from '@/lib/auth';
import Message from '@/lib/models/Message.js';
import ChatSettings, { getChatSettings } from '@/lib/models/ChatSettings.js';
import { notifyPartner } from '@/lib/notify';

const ALLOWED_EMOJIS = new Set(['❤️', '👍', '😂', '🔥', '💯', '😮', '😢', '👏']);

function serialize(m) {
  const reactions = {};
  for (const r of m.reactions || []) {
    if (!reactions[r.emoji]) reactions[r.emoji] = [];
    reactions[r.emoji].push(r.username);
  }
  return {
    id: String(m._id),
    username: m.username,
    displayName: m.displayName,
    text: m.text,
    createdAt: m.createdAt,
    seenAt: m.seenAt || null,
    seen: !!m.seenAt,
    reactions,
    replyTo: m.replyTo?.id
      ? {
          id: m.replyTo.id,
          text: m.replyTo.text,
          displayName: m.replyTo.displayName,
        }
      : null,
  };
}

function settingsView(s) {
  return {
    disappearingOnSeen: !!s.disappearingOnSeen,
  };
}

async function purgeSeenIfNeeded(settings) {
  if (!settings.disappearingOnSeen) return 0;
  // Keep just-seen messages readable briefly, then wipe for both
  const cutoff = new Date(Date.now() - 8_000);
  const res = await Message.deleteMany({ seenAt: { $ne: null, $lte: cutoff } });
  return res.deletedCount || 0;
}

export async function GET(req) {
  try {
    await connectDB();
    await ensureSeeded();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ message: 'Login required' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const markSeen = searchParams.get('markSeen') === '1';
    const settings = await getChatSettings();

    if (markSeen) {
      await Message.updateMany(
        { username: { $ne: user.username }, seenAt: null },
        { $set: { seenAt: new Date() } }
      );
      await purgeSeenIfNeeded(settings);
    } else if (settings.disappearingOnSeen) {
      // Partner may have marked your messages seen — drop them on poll
      await purgeSeenIfNeeded(settings);
    }

    const messages = await Message.find().sort({ createdAt: -1 }).limit(100).lean();
    const list = messages.reverse();

    return NextResponse.json({
      messages: list.map(serialize),
      settings: settingsView(settings),
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

    let replyTo = { id: '', text: '', displayName: '' };
    if (body.replyToId) {
      const parent = await Message.findById(body.replyToId).lean();
      if (parent) {
        replyTo = {
          id: String(parent._id),
          text: String(parent.text).slice(0, 120),
          displayName: parent.displayName,
        };
      }
    }

    const msg = await Message.create({
      username: user.username,
      displayName: user.displayName,
      text,
      seenAt: null,
      reactions: [],
      replyTo,
    });

    await notifyPartner(user, {
      type: 'chat',
      title: `${user.displayName} sent a message`,
      body: 'Open Chat to read',
      linkTab: 'chat',
    });

    const settings = await getChatSettings();
    return NextResponse.json({ message: serialize(msg), settings: settingsView(settings) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Failed to send' }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    await connectDB();
    await ensureSeeded();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ message: 'Login required' }, { status: 401 });

    const body = await req.json();

    // Chat settings toggles
    if (body.action === 'settings') {
      const updates = {};
      if (typeof body.disappearingOnSeen === 'boolean') {
        updates.disappearingOnSeen = body.disappearingOnSeen;
      }
      const settings = await ChatSettings.findOneAndUpdate(
        { key: 'main' },
        { $set: updates, $setOnInsert: { key: 'main' } },
        { upsert: true, new: true }
      );

      // If just enabled, wipe anything already seen
      if (settings.disappearingOnSeen) {
        await purgeSeenIfNeeded(settings);
      }

      return NextResponse.json({ settings: settingsView(settings) });
    }

    // Reactions
    const id = String(body.id || '');
    const emoji = String(body.emoji || '');
    if (!id || !ALLOWED_EMOJIS.has(emoji)) {
      return NextResponse.json({ message: 'Invalid reaction' }, { status: 400 });
    }

    const msg = await Message.findById(id);
    if (!msg) return NextResponse.json({ message: 'Not found' }, { status: 404 });

    const existing = (msg.reactions || []).find((r) => r.username === user.username && r.emoji === emoji);
    if (existing) {
      msg.reactions = msg.reactions.filter((r) => !(r.username === user.username && r.emoji === emoji));
    } else {
      msg.reactions = [
        ...(msg.reactions || []).filter((r) => r.username !== user.username || r.emoji !== emoji),
        { emoji, username: user.username },
      ];
    }
    await msg.save();

    return NextResponse.json({ message: serialize(msg.toObject()) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await connectDB();
    await ensureSeeded();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ message: 'Login required' }, { status: 401 });

    const res = await Message.deleteMany({});
    await notifyPartner(user, {
      type: 'chat',
      title: `${user.displayName} cleared the chat`,
      body: 'Chat history was wiped',
      linkTab: 'chat',
    });

    const settings = await getChatSettings();
    return NextResponse.json({
      ok: true,
      deleted: res.deletedCount || 0,
      settings: settingsView(settings),
      messages: [],
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Failed to clear chat' }, { status: 500 });
  }
}
