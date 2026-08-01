import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ensureSeeded } from '@/lib/seed';
import { withAuth, readJson, ok } from '@/features/leetcode-automation/lib/http';
import {
  dashboard,
  runNow,
  setEnabled,
  setPaused,
  tick,
} from '@/features/leetcode-automation/services/automationService';

/** GET /api/automation → dashboard payload for the signed-in user. */
export const GET = withAuth(
  async ({ user }) => ok(await dashboard(user.username)),
  { route: 'automation:get', limit: 60 }
);

/**
 * POST /api/automation
 *  - Cron:   header `x-cron-secret` present → runs all due users (no auth).
 *  - Authed: { action: 'run-now' | 'enable' | 'disable' | 'pause' | 'resume' }
 */
export async function POST(req) {
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret !== null) {
    try {
      await connectDB();
      await ensureSeeded();
      const result = await tick(cronSecret);
      return NextResponse.json({ ok: true, ...result });
    } catch (err) {
      const status = err?.status || 500;
      return NextResponse.json({ message: err.message || 'Cron failed' }, { status });
    }
  }

  return authedPost(req);
}

const authedPost = withAuth(
  async ({ req, user }) => {
    const body = await readJson(req);
    const actor = { username: user.username, displayName: user.displayName };

    switch (body.action) {
      case 'run-now':
        return ok(await runNow(actor));
      case 'enable':
        return ok(await setEnabled(actor, true));
      case 'disable':
        return ok(await setEnabled(actor, false));
      case 'pause':
        return ok(await setPaused(actor, true));
      case 'resume':
        return ok(await setPaused(actor, false));
      default:
        return NextResponse.json({ message: 'Unknown action' }, { status: 400 });
    }
  },
  { route: 'automation:post', limit: 20 }
);
