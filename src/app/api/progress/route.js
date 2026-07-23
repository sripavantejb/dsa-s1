import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ensureSeeded } from '@/lib/seed';
import { getAuthUser } from '@/lib/auth';
import { computeStreaks, ensureToday } from '@/lib/streak';
import Question from '@/lib/models/Question.js';
import Activity from '@/lib/models/Activity.js';

export async function GET() {
  try {
    await connectDB();
    await ensureSeeded();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ message: 'Login required' }, { status: 401 });

    const { currentStreak, bestStreak } = computeStreaks(user.activityDates);
    return NextResponse.json({
      solved: user.solved,
      solvedCount: user.solved.length,
      currentStreak,
      bestStreak,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}

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

    const idx = user.solved.indexOf(qid);
    let action;
    if (idx >= 0) {
      user.solved.splice(idx, 1);
      action = 'reopened';
    } else {
      user.solved.push(qid);
      user.activityDates = ensureToday(user.activityDates);
      action = 'finished';
    }
    await user.save();

    await Activity.create({
      username: user.username,
      displayName: user.displayName,
      qid: question.qid,
      title: question.title,
      topic: question.topic,
      action,
    });

    const { currentStreak, bestStreak } = computeStreaks(user.activityDates);
    return NextResponse.json({
      solved: user.solved,
      solvedCount: user.solved.length,
      currentStreak,
      bestStreak,
      action,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Failed to update' }, { status: 500 });
  }
}
