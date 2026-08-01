import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ensureSeeded } from '@/lib/seed';
import { getAuthUser } from '@/lib/auth';
import { rateLimit } from './rateLimit.js';
import { ValidationError } from './validation.js';

/**
 * Wraps an automation route handler with the same boilerplate the existing
 * routes use (connect, seed, auth) plus per-user rate limiting and consistent
 * error shaping. Keeps every automation endpoint uniform and secure.
 *
 * @param {(ctx: { req: Request, user: any, params: any }) => Promise<Response>} handler
 * @param {{ route: string, limit?: number, windowMs?: number }} options
 */
export function withAuth(handler, { route, limit = 40, windowMs = 60_000 }) {
  return async function wrapped(req, params) {
    try {
      await connectDB();
      await ensureSeeded();

      const user = await getAuthUser();
      if (!user) {
        return NextResponse.json({ message: 'Login required' }, { status: 401 });
      }

      const gate = rateLimit(`${user.username}:${route}`, limit, windowMs);
      if (!gate.ok) {
        return NextResponse.json(
          { message: 'Too many requests. Slow down and try again shortly.' },
          { status: 429, headers: { 'Retry-After': String(gate.retryAfter) } }
        );
      }

      return await handler({ req, user, params });
    } catch (err) {
      if (err instanceof ValidationError) {
        return NextResponse.json({ message: err.message }, { status: err.status });
      }
      console.error(`[leetcode-automation:${route}]`, err);
      return NextResponse.json(
        { message: err?.message || 'Request failed' },
        { status: 500 }
      );
    }
  };
}

/** Safe JSON body parse — returns {} on empty/invalid bodies. */
export async function readJson(req) {
  try {
    return (await req.json()) || {};
  } catch {
    return {};
  }
}

export function ok(data, init) {
  return NextResponse.json(data, init);
}
