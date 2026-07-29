import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ensureSeeded } from '@/lib/seed';
import { getAuthUser } from '@/lib/auth';
import Question from '@/lib/models/Question.js';
import { DEFAULT_SHEET, SHEETS } from '@/lib/sheets';

export async function GET() {
  try {
    await connectDB();
    await ensureSeeded();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ message: 'Login required' }, { status: 401 });

    const questions = await Question.find().sort({ sheet: 1, order: 1 }).lean();
    return NextResponse.json({
      sheets: SHEETS,
      questions: questions.map((q) => ({
        qid: q.qid,
        sheet: q.sheet || DEFAULT_SHEET,
        order: q.order,
        topic: q.topic,
        subtopic: q.subtopic || '',
        title: q.title,
        link: q.link,
        altLink: q.altLink || '',
        difficulty: q.difficulty,
      })),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Failed to load questions' }, { status: 500 });
  }
}
