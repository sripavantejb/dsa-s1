import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ensureSeeded } from '@/lib/seed';
import { getAuthUser } from '@/lib/auth';
import SharedCode from '@/lib/models/SharedCode.js';
import Question from '@/lib/models/Question.js';
import { notifyPartner } from '@/lib/notify';

const LANGS = new Set(['cpp', 'java', 'python', 'javascript', 'c', 'other']);

function serialize(doc) {
  return {
    id: String(doc._id),
    username: doc.username,
    displayName: doc.displayName,
    title: doc.title,
    language: doc.language,
    code: doc.code,
    note: doc.note || '',
    qid: doc.qid || '',
    questionTitle: doc.questionTitle || '',
    topic: doc.topic || '',
    createdAt: doc.createdAt,
  };
}

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

    const docs = await SharedCode.find(filter)
      .sort({ createdAt: since ? 1 : -1 })
      .limit(since ? 50 : 60)
      .lean();
    const list = since ? docs : docs.reverse();

    return NextResponse.json({
      snippets: list.map(serialize),
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Failed to load shared code' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await connectDB();
    await ensureSeeded();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ message: 'Login required' }, { status: 401 });

    const body = await req.json();
    const title = String(body.title || '').trim();
    const code = String(body.code || '');
    const note = String(body.note || '').trim();
    const language = LANGS.has(body.language) ? body.language : 'cpp';
    const qid = String(body.qid || '').trim();

    if (!title) return NextResponse.json({ message: 'Title required' }, { status: 400 });
    if (!code.trim()) return NextResponse.json({ message: 'Code cannot be empty' }, { status: 400 });
    if (code.length > 50000) return NextResponse.json({ message: 'Code too long' }, { status: 400 });

    let questionTitle = '';
    let topic = '';
    if (qid) {
      const q = await Question.findOne({ qid }).lean();
      if (q) {
        questionTitle = q.title;
        topic = q.topic;
      }
    }

    const doc = await SharedCode.create({
      username: user.username,
      displayName: user.displayName,
      title,
      language,
      code,
      note,
      qid,
      questionTitle,
      topic,
    });

    await notifyPartner(user, {
      type: 'code',
      title: `${user.displayName} shared code`,
      body: title,
      linkTab: 'code',
    });

    return NextResponse.json({ snippet: serialize(doc) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Failed to share code' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    await connectDB();
    await ensureSeeded();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ message: 'Login required' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ message: 'id required' }, { status: 400 });

    const doc = await SharedCode.findById(id);
    if (!doc) return NextResponse.json({ message: 'Not found' }, { status: 404 });
    if (doc.username !== user.username) {
      return NextResponse.json({ message: 'You can only delete your own shares' }, { status: 403 });
    }
    await doc.deleteOne();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Failed to delete' }, { status: 500 });
  }
}
