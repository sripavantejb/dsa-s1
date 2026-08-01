import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ensureSeeded } from '@/lib/seed';
import { getAuthUser } from '@/lib/auth';
import Notification from '@/lib/models/Notification.js';
import { ensureRevisionReminders } from '@/lib/revision';

function serialize(n) {
  return {
    id: String(n._id),
    fromUsername: n.fromUsername,
    fromDisplayName: n.fromDisplayName,
    type: n.type,
    title: n.title,
    body: n.body,
    linkTab: n.linkTab || 'live',
    read: !!n.read,
    createdAt: n.createdAt,
  };
}

export async function GET(req) {
  try {
    await connectDB();
    await ensureSeeded();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ message: 'Login required' }, { status: 401 });

    // Generate day-before / due-today revision reminder alerts (deduped)
    try {
      await ensureRevisionReminders(user);
    } catch (remErr) {
      console.error('revision reminders failed', remErr);
    }

    const { searchParams } = new URL(req.url);
    const since = searchParams.get('since');
    const filter = { toUsername: user.username };
    if (since) {
      const d = new Date(since);
      if (!Number.isNaN(d.getTime())) filter.createdAt = { $gt: d };
    }

    const docs = await Notification.find(filter)
      .sort({ createdAt: since ? 1 : -1 })
      .limit(since ? 40 : 50)
      .lean();

    const list = since ? docs : docs;
    const unread = await Notification.countDocuments({ toUsername: user.username, read: false });

    return NextResponse.json({
      notifications: since ? list.map(serialize) : list.map(serialize),
      unread,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Failed to load notifications' }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    await connectDB();
    await ensureSeeded();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ message: 'Login required' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    if (body.id) {
      await Notification.updateOne(
        { _id: body.id, toUsername: user.username },
        { $set: { read: true } }
      );
    } else {
      await Notification.updateMany({ toUsername: user.username, read: false }, { $set: { read: true } });
    }

    const unread = await Notification.countDocuments({ toUsername: user.username, read: false });
    return NextResponse.json({ ok: true, unread });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Failed to update' }, { status: 500 });
  }
}
