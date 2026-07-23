import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ensureSeeded } from '@/lib/seed';
import { getAuthUser } from '@/lib/auth';
import { todayKey } from '@/lib/streak';
import Presence from '@/lib/models/Presence.js';
import User from '@/lib/models/User.js';

const ONLINE_MS = 45_000;
const ACTIVE_MS = 30_000;
const MAX_DELTA = 20;

function formatDuration(totalSeconds = 0) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function personView(u, p, meUsername, now = Date.now()) {
  const lastSeen = p?.lastSeen ? new Date(p.lastSeen).getTime() : 0;
  const lastFocused = p?.lastFocusedAt ? new Date(p.lastFocusedAt).getTime() : 0;
  const online = lastSeen > 0 && now - lastSeen < ONLINE_MS;
  const focused = online && lastFocused > 0 && now - lastFocused < ACTIVE_MS;
  let status = 'offline';
  if (focused) status = 'active';
  else if (online) status = 'idle';

  const today = todayKey();
  const secondsToday = p?.activeDate === today ? p.secondsToday || 0 : 0;

  return {
    username: u.username,
    displayName: u.displayName,
    online,
    status,
    lastSeen: p?.lastSeen || null,
    lastFocusedAt: p?.lastFocusedAt || null,
    secondsToday,
    secondsTotal: p?.secondsTotal || 0,
    timeToday: formatDuration(secondsToday),
    timeTotal: formatDuration(p?.secondsTotal || 0),
    isYou: u.username === meUsername,
  };
}

export async function POST(req) {
  try {
    await connectDB();
    await ensureSeeded();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ message: 'Login required' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const focused = !!body.focused;
    const delta = Math.min(MAX_DELTA, Math.max(0, Number(body.deltaSeconds) || 0));
    const today = todayKey();
    const now = new Date();

    const existing = await Presence.findOne({ username: user.username });
    let secondsToday = existing?.activeDate === today ? existing.secondsToday || 0 : 0;
    let secondsTotal = existing?.secondsTotal || 0;

    if (focused && delta > 0) {
      secondsToday += delta;
      secondsTotal += delta;
    }

    const doc = await Presence.findOneAndUpdate(
      { username: user.username },
      {
        username: user.username,
        displayName: user.displayName,
        lastSeen: now,
        activeDate: today,
        secondsToday,
        secondsTotal,
        ...(focused ? { lastFocusedAt: now } : {}),
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      ok: true,
      secondsToday: doc.secondsToday,
      timeToday: formatDuration(doc.secondsToday),
      status: focused ? 'active' : 'idle',
    });
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

    const people = users.map((u) => personView(u, byUser[u.username], me.username, now));

    return NextResponse.json({ people });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}
