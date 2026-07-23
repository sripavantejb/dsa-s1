import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ensureSeeded } from '@/lib/seed';
import { getAuthUser } from '@/lib/auth';
import Presence from '@/lib/models/Presence.js';
import User from '@/lib/models/User.js';

const ONLINE_MS = 45_000;

export async function POST() {
  try {
    await connectDB();
    await ensureSeeded();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ message: 'Login required' }, { status: 401 });

    await Presence.findOneAndUpdate(
      { username: user.username },
      {
        username: user.username,
        displayName: user.displayName,
        lastSeen: new Date(),
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}

export async function GET() {
  try {
    await connectDB();
    await ensureSeeded();
    const me = await getAuthUser();
    if (!me) return NextResponse.json({ message: 'Login required' }, { status: 401 });

    const users = await User.find().select('username displayName').lean();
    const presence = await Presence.find({
      username: { $in: users.map((u) => u.username) },
    }).lean();
    const byUser = Object.fromEntries(presence.map((p) => [p.username, p]));
    const now = Date.now();

    const people = users.map((u) => {
      const p = byUser[u.username];
      const lastSeen = p?.lastSeen ? new Date(p.lastSeen).getTime() : 0;
      const online = lastSeen > 0 && now - lastSeen < ONLINE_MS;
      return {
        username: u.username,
        displayName: u.displayName,
        online,
        lastSeen: p?.lastSeen || null,
        isYou: u.username === me.username,
      };
    });

    return NextResponse.json({ people });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}
