import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ensureSeeded } from '@/lib/seed';
import { getAuthUser } from '@/lib/auth';
import { DAILY_GOAL, progressPayload, recordFinish, recordReopen } from '@/lib/streak';
import Question from '@/lib/models/Question.js';
import Activity from '@/lib/models/Activity.js';
import { notifyPartner } from '@/lib/notify';
import { ensureRevisionForSolved } from '@/lib/revision';

export async function GET() {
  try {
    await connectDB();
    await ensureSeeded();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ message: 'Login required' }, { status: 401 });

    return NextResponse.json(progressPayload(user));
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
      recordReopen(user, qid);
      action = 'reopened';
    } else {
      user.solved.push(qid);
      recordFinish(user, qid);
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

    let revision = null;
    if (action === 'finished') {
      // Auto-add to revision tracker (no-op if already tracked — no duplicates)
      try {
        revision = await ensureRevisionForSolved(user.username, question, new Date());
      } catch (revErr) {
        console.error('revision auto-track failed', revErr);
      }
    }

    const progress = progressPayload(user);
    let toastHint = null;
    if (action === 'finished') {
      if (progress.todayComplete && progress.todayRawCount === DAILY_GOAL) {
        toastHint = `Daily goal hit! ${DAILY_GOAL}/8 done — streak day counted.`;
        await notifyPartner(user, {
          type: 'streak',
          title: 'Daily goal complete',
          body: `${user.displayName} finished ${DAILY_GOAL} questions today`,
          linkTab: 'live',
        });
      } else if (!progress.todayComplete) {
        toastHint = `Today ${progress.todayRawCount}/${DAILY_GOAL} toward streak · added to revision`;
      } else {
        toastHint = 'Marked as finished · added to revision';
      }
    }

    const verb = action === 'finished' ? 'finished' : action === 'reopened' ? 'reopened' : action;
    await notifyPartner(user, {
      type: action,
      title: `${user.displayName} ${verb} a question`,
      body: question.title,
      linkTab: 'sheet',
    });

    return NextResponse.json({
      ...progress,
      action,
      toastHint,
      revisionId: revision?._id ? String(revision._id) : null,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Failed to update' }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    await connectDB();
    await ensureSeeded();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ message: 'Login required' }, { status: 401 });

    const { qid, action } = await req.json();
    if (!qid || !['star', 'doubt'].includes(action)) {
      return NextResponse.json({ message: 'qid and valid action required' }, { status: 400 });
    }

    const questionExists = await Question.exists({ qid });
    if (!questionExists) {
      return NextResponse.json({ message: 'Question not found' }, { status: 404 });
    }

    const field = action === 'star' ? 'starred' : 'doubts';
    const values = Array.isArray(user[field]) ? user[field] : [];
    const index = values.indexOf(qid);
    const active = index < 0;
    if (active) values.push(qid);
    else values.splice(index, 1);
    user[field] = values;
    await user.save();

    return NextResponse.json({
      ...progressPayload(user),
      action,
      active,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Failed to update question flag' }, { status: 500 });
  }
}
