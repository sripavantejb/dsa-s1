import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ensureSeeded } from '@/lib/seed';
import { getAuthUser } from '@/lib/auth';
import Message from '@/lib/models/Message.js';
import ChatSettings, { getChatSettings } from '@/lib/models/ChatSettings.js';
import Presence from '@/lib/models/Presence.js';
import { notifyPartner } from '@/lib/notify';

const ALLOWED_EMOJIS = new Set(['❤️', '👍', '😂', '🔥', '💯', '😮', '😢', '👏']);
const TYPING_MS = 6_000;
const ONLINE_MS = 45_000;

function serialize(m, { readReceipts = true } = {}) {
  const reactions = {};
  for (const r of m.reactions || []) {
    if (!reactions[r.emoji]) reactions[r.emoji] = [];
    reactions[r.emoji].push(r.username);
  }
  const seen = readReceipts && !!m.seenAt;
  return {
    id: String(m._id),
    username: m.username,
    displayName: m.displayName,
    text: m.text,
    createdAt: m.createdAt,
    seenAt: readReceipts ? m.seenAt || null : null,
    seen,
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
    typingIndicators: s.typingIndicators !== false,
    readReceipts: s.readReceipts !== false,
  };
}

async function purgeSeenIfNeeded(settings) {
  if (!settings.disappearingOnSeen) return 0;
  const cutoff = new Date(Date.now() - 8_000);
  const res = await Message.deleteMany({ seenAt: { $ne: null, $lte: cutoff } });
  return res.deletedCount || 0;
}

async function partnerPresence(meUsername) {
  const partnerUsername = meUsername === 'tej' ? 'hafsa' : 'tej';
  const p = await Presence.findOne({ username: partnerUsername }).lean();
  const now = Date.now();
  const lastSeen = p?.lastSeen ? new Date(p.lastSeen).getTime() : 0;
  const typingAt = p?.typingAt ? new Date(p.typingAt).getTime() : 0;
  const online = lastSeen > 0 && now - lastSeen < ONLINE_MS;
  const typing = online && typingAt > 0 && now - typingAt < TYPING_MS;
  return {
    username: partnerUsername,
    typing,
    online,
    lastSeen: p?.lastSeen || null,
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
    const settings = await getChatSettings();
    const opts = { readReceipts: settings.readReceipts !== false };

    if (markSeen && opts.readReceipts) {
      await Message.updateMany(
        { username: { $ne: user.username }, seenAt: null },
        { $set: { seenAt: new Date() } }
      );
    }

    if (settings.disappearingOnSeen) {
      await purgeSeenIfNeeded(settings);
    }

    const messages = await Message.find().sort({ createdAt: -1 }).limit(100).lean();
    const list = messages.reverse();
    const partner = await partnerPresence(user.username);

    return NextResponse.json({
      messages: list.map((m) => serialize(m, opts)),
      settings: settingsView(settings),
      partnerTyping: settings.typingIndicators !== false && partner.typing,
      partnerOnline: partner.online,
      partnerLastSeen: partner.lastSeen,
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

    // Stop typing when a message goes out
    await Presence.findOneAndUpdate({ username: user.username }, { typingAt: null });

    await notifyPartner(user, {
      type: 'chat',
      title: `${user.displayName} sent a message`,
      body: 'Open Chat to read',
      linkTab: 'chat',
    });

    const settings = await getChatSettings();
    return NextResponse.json({
      message: serialize(msg, { readReceipts: settings.readReceipts !== false }),
      settings: settingsView(settings),
    });
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

    if (body.action === 'settings') {
      const updates = {};
      for (const key of ['disappearingOnSeen', 'typingIndicators', 'readReceipts']) {
        if (typeof body[key] === 'boolean') updates[key] = body[key];
      }
      const settings = await ChatSettings.findOneAndUpdate(
        { key: 'main' },
        { $set: updates, $setOnInsert: { key: 'main' } },
        { upsert: true, new: true }
      );

      if (settings.disappearingOnSeen) {
        await purgeSeenIfNeeded(settings);
      }

      return NextResponse.json({ settings: settingsView(settings) });
    }

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

    const settings = await getChatSettings();
    return NextResponse.json({
      message: serialize(msg.toObject(), { readReceipts: settings.readReceipts !== false }),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    await connectDB();
    await ensureSeeded();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ message: 'Login required' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const settings = await getChatSettings();

    if (id) {
      const msg = await Message.findById(id);
      if (!msg) return NextResponse.json({ message: 'Not found' }, { status: 404 });
      if (msg.username !== user.username) {
        return NextResponse.json({ message: 'Can only delete your own messages' }, { status: 403 });
      }
      await msg.deleteOne();
      return NextResponse.json({ ok: true, deletedId: id, settings: settingsView(settings) });
    }

    const res = await Message.deleteMany({});
    await notifyPartner(user, {
      type: 'chat',
      title: `${user.displayName} cleared the chat`,
      body: 'Chat history was wiped',
      linkTab: 'chat',
    });

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
