import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ensureSeeded } from '@/lib/seed';
import { AUTH_COOKIE, apiError, clearAuthCookie, getAuthUser, publicUser } from '@/lib/auth';

export async function GET() {
  try {
    await connectDB();
    await ensureSeeded();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ user: null }, { status: 401 });
    return NextResponse.json({ user: publicUser(user) });
  } catch (err) {
    return NextResponse.json(apiError(err, 'Failed'), { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  try {
    await clearAuthCookie();
  } catch {
    /* response cookie is enough */
  }
  return res;
}
