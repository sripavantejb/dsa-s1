import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ensureSeeded } from '@/lib/seed';
import User from '@/lib/models/User.js';
import { publicUser, setAuthCookie, signToken, verifyPassword } from '@/lib/auth';

export async function POST(req) {
  try {
    await connectDB();
    await ensureSeeded();

    const body = await req.json();
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');

    const user = await User.findOne({ username });
    if (!user || !(await verifyPassword(user, password))) {
      return NextResponse.json({ message: 'Invalid username or password' }, { status: 401 });
    }

    const token = signToken(user);
    await setAuthCookie(token);
    return NextResponse.json({ user: publicUser(user) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Login failed' }, { status: 500 });
  }
}
