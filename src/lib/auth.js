import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import User from './models/User.js';
import { computeStreaks } from './streak.js';

const COOKIE = 'dsa_token';

export function publicUser(user) {
  const { currentStreak, bestStreak } = computeStreaks(user.activityDates || []);
  return {
    id: String(user._id),
    username: user.username,
    displayName: user.displayName,
    solved: user.solved || [],
    solvedCount: (user.solved || []).length,
    currentStreak,
    bestStreak,
  };
}

export function signToken(user) {
  return jwt.sign(
    { id: String(user._id), username: user.username },
    process.env.JWT_SECRET || 'dsa-tracker-jwt-secret',
    { expiresIn: '30d' }
  );
}

export async function setAuthCookie(token) {
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearAuthCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getAuthUser() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
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
