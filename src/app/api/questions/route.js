import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ensureSeeded } from '@/lib/seed';
import { getAuthUser } from '@/lib/auth';
import Question from '@/lib/models/Question.js';

export async function GET() {
  try {
    await connectDB();
    await ensureSeeded();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ message: 'Login required' }, { status: 401 });

    const questions = await Question.find().sort({ order: 1 }).lean();
    return NextResponse.json({
      questions: questions.map((q) => ({
        qid: q.qid,
        order: q.order,
        topic: q.topic,
        title: q.title,
        link: q.link,
        difficulty: q.difficulty,
      })),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Failed to load questions' }, { status: 500 });
  }
}
