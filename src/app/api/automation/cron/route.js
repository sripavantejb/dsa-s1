import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ensureSeeded } from '@/lib/seed';
import { runDue } from '@/features/leetcode-automation/workers/runner.js';

/**
 * Vercel Cron entry (GET). Authenticates via either:
 *  - Authorization: Bearer <AUTOMATION_CRON_SECRET|CRON_SECRET>
 *  - x-cron-secret: <AUTOMATION_CRON_SECRET|CRON_SECRET>
 *
 * Keeps POST /api/automation available for external schedulers.
 */
export async function GET(req) {
  try {
    const expected = process.env.AUTOMATION_CRON_SECRET || process.env.CRON_SECRET;
    const headerSecret = req.headers.get('x-cron-secret');
    const auth = req.headers.get('authorization') || '';
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';

    if (expected && headerSecret !== expected && bearer !== expected) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    await ensureSeeded();
    const result = await runDue({ now: new Date() });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const status = err?.status || 500;
    return NextResponse.json({ message: err.message || 'Cron failed' }, { status });
  }
}
