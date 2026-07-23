import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ensureSeeded } from '@/lib/seed';
import { getAuthUser } from '@/lib/auth';
import Question from '@/lib/models/Question.js';
import Activity from '@/lib/models/Activity.js';

/** Log that the user opened / attempted a question */
export async function POST(req) {
  try {
    await connectDB();
    await ensureSeeded();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ message: 'Login required' }, { status: 401 });

    const { qid } = await req.json();
    if (!qid) return NextResponse.json({ message: 'qid required' }, { status: 400 });

    const question = await Question.findOne({ qid }).lean();
    if (!question) return NextResponse.json({ message: 'Question not found' }, { status: 404 });

    // Avoid spam: same user attempting same question within 2 minutes
    const recent = await Activity.findOne({
      username: user.username,
      qid,
      action: 'attempted',
      createdAt: { $gte: new Date(Date.now() - 2 * 60 * 1000) },
    }).lean();

    if (!recent) {
      await Activity.create({
        username: user.username,
        displayName: user.displayName,
        qid: question.qid,
        title: question.title,
        topic: question.topic,
        action: 'attempted',
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}

/** Poll recent live events (for toasts + feed) */
export async function GET(req) {
  try {
    await connectDB();
    await ensureSeeded();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ message: 'Login required' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const since = searchParams.get('since');
    const filter = {};
    if (since) {
      const d = new Date(since);
      if (!Number.isNaN(d.getTime())) filter.createdAt = { $gt: d };
    }

    const activities = await Activity.find(filter).sort({ createdAt: -1 }).limit(40).lean();

    return NextResponse.json({
      activities: activities.map((a) => ({
        id: String(a._id),
        username: a.username,
        displayName: a.displayName,
        qid: a.qid,
        title: a.title,
        topic: a.topic,
        action: a.action,
        createdAt: a.createdAt,
      })),
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}
