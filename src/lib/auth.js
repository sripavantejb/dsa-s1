import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import User from './models/User.js';
import { progressPayload } from './streak.js';

export const AUTH_COOKIE = 'dsa_token';

export function publicUser(user) {
  const progress = progressPayload(user);
  return {
    id: String(user._id),
    username: user.username,
    displayName: user.displayName,
    ...progress,
  };
}

export function signToken(user) {
  return jwt.sign(
    { id: String(user._id), username: user.username },
    process.env.JWT_SECRET || 'dsa-tracker-jwt-secret',
    { expiresIn: '30d' }
  );
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  };
}

export async function clearAuthCookie() {
  const jar = await cookies();
  jar.delete(AUTH_COOKIE);
}

export async function getAuthUser() {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dsa-tracker-jwt-secret');
    const user = await User.findById(payload.id);
    return user || null;
  } catch {
    return null;
  }
}

export async function verifyPassword(user, password) {
  return bcrypt.compare(password, user.passwordHash);
}

export function apiError(err, fallback = 'Request failed') {
  console.error(err);
  const message =
    err?.message?.includes('MONGODB_URI')
      ? err.message
      : err?.name === 'MongoServerSelectionError' || err?.message?.includes('querySrv')
        ? 'Cannot reach MongoDB. In Atlas → Network Access, allow 0.0.0.0/0 and check MONGODB_URI on Vercel.'
        : fallback;
  return { message };
}
