import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ensureSeeded } from '@/lib/seed';
import { getAuthUser } from '@/lib/auth';
import Question from '@/lib/models/Question.js';
import RevisionItem from '@/lib/models/RevisionItem.js';
import {
  buildRevisionDashboard,
  ensureRevisionForSolved,
  markRevised,
  resetRevisionSchedule,
  serializeRevision,
  startOfLocalDay,
} from '@/lib/revision';

function parseDateInput(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return startOfLocalDay(d);
}

export async function GET() {
  try {
    await connectDB();
    await ensureSeeded();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ message: 'Login required' }, { status: 401 });

    const dashboard = await buildRevisionDashboard(user.username, user);
    return NextResponse.json(dashboard);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Failed to load revision data' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await connectDB();
    await ensureSeeded();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ message: 'Login required' }, { status: 401 });

    const body = await req.json();
    const action = body.action || 'manual';

    if (action === 'enable' || action === 'migrate') {
      const selections = Array.isArray(body.items) ? body.items : [];
      const qids = body.qids || selections.map((s) => s.qid).filter(Boolean);
      if (!qids.length && body.enableAll) {
        const dash = await buildRevisionDashboard(user.username, user);
        const created = [];
        for (const q of dash.untracked.questions) {
          const solvedAt =
            parseDateInput(body.defaultStartDate) ||
            (q.guessedSolvedAt ? new Date(q.guessedSolvedAt) : null) ||
            startOfLocalDay(new Date());
          const question = await Question.findOne({ qid: q.qid }).lean();
          if (!question) continue;
          const item = await ensureRevisionForSolved(user.username, question, solvedAt);
          created.push(serializeRevision(item, question));
        }
        const dashboard = await buildRevisionDashboard(user.username, user);
        return NextResponse.json({ created: created.length, items: created, ...dashboard });
      }

      const created = [];
      for (const entry of selections.length ? selections : qids.map((qid) => ({ qid }))) {
        const qid = entry.qid;
        if (!qid) continue;
        const question = await Question.findOne({ qid }).lean();
        if (!question) continue;
        const solvedAt =
          parseDateInput(entry.solvedAt || entry.startDate || body.defaultStartDate) ||
          startOfLocalDay(new Date());
        const item = await ensureRevisionForSolved(user.username, question, solvedAt);
        // If just created with wrong date and user provided date, and history still week 1 open — allow set
        if (entry.solvedAt || entry.startDate) {
          const existing = await RevisionItem.findById(item._id);
          if (existing && !existing.lastRevisedAt && existing.history?.length <= 1) {
            await resetRevisionSchedule(existing, solvedAt);
          }
        }
        const fresh = await RevisionItem.findOne({ username: user.username, qid });
        created.push(serializeRevision(fresh, question));
      }
      const dashboard = await buildRevisionDashboard(user.username, user);
      return NextResponse.json({ created: created.length, items: created, ...dashboard });
    }

    if (action === 'manual') {
      const title = String(body.title || '').trim();
      if (!title) return NextResponse.json({ message: 'Problem name required' }, { status: 400 });
      const solvedAt = parseDateInput(body.solvedAt || body.dateSolved) || startOfLocalDay(new Date());
      if (!solvedAt) return NextResponse.json({ message: 'Invalid solved date' }, { status: 400 });

      const next = startOfLocalDay(solvedAt);
      next.setDate(next.getDate() + 7);

      const item = await RevisionItem.create({
        username: user.username,
        qid: null,
        source: 'manual',
        trackingActive: body.track !== false,
        title,
        platform: String(body.platform || '').trim(),
        link: String(body.link || '').trim(),
        topic: String(body.topic || '').trim(),
        difficulty: ['EASY', 'MEDIUM', 'HARD', 'UNRATED'].includes(body.difficulty)
          ? body.difficulty
          : 'UNRATED',
        notes: String(body.notes || '').trim(),
        solvedAt,
        stage: 1,
        nextRevisionAt: next,
        lastRevisedAt: null,
        history: [{ week: 1, scheduledFor: next, completedAt: null }],
      });

      const dashboard = await buildRevisionDashboard(user.username, user);
      return NextResponse.json({ item: serializeRevision(item), ...dashboard });
    }

    return NextResponse.json({ message: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: err.message || 'Failed to save' }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    await connectDB();
    await ensureSeeded();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ message: 'Login required' }, { status: 401 });

    const body = await req.json();
    const { id, action } = body;
    if (!id || !action) {
      return NextResponse.json({ message: 'id and action required' }, { status: 400 });
    }

    const item = await RevisionItem.findOne({ _id: id, username: user.username });
    if (!item) return NextResponse.json({ message: 'Revision item not found' }, { status: 404 });

    if (action === 'revise') {
      await markRevised(item);
    } else if (action === 'reset') {
      const from = parseDateInput(body.fromDate || body.solvedAt) || startOfLocalDay(new Date());
      await resetRevisionSchedule(item, from);
    } else if (action === 'pause') {
      item.trackingActive = false;
      await item.save();
    } else if (action === 'resume') {
      item.trackingActive = true;
      await item.save();
    } else {
      return NextResponse.json({ message: 'Unknown action' }, { status: 400 });
    }

    const question = item.qid ? await Question.findOne({ qid: item.qid }).lean() : null;
    const dashboard = await buildRevisionDashboard(user.username, user);
    return NextResponse.json({
      item: serializeRevision(item, question),
      ...dashboard,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: err.message || 'Failed to update' }, { status: 500 });
  }
}
