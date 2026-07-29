import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ensureSeeded } from '@/lib/seed';
import { getAuthUser } from '@/lib/auth';
import { challengeProgress, computeStreaks, dailyProgress } from '@/lib/streak';
import Question from '@/lib/models/Question.js';
import User from '@/lib/models/User.js';
import { DEFAULT_SHEET, SHEETS } from '@/lib/sheets';

export async function GET() {
  try {
    await connectDB();
    await ensureSeeded();
    const me = await getAuthUser();
    if (!me) return NextResponse.json({ message: 'Login required' }, { status: 401 });

    const totalQuestions = await Question.countDocuments();
    const questions = await Question.find()
      .select('qid topic order sheet')
      .sort({ sheet: 1, order: 1 })
      .lean();
    const users = await User.find().select('-passwordHash').lean();
    const topicOf = Object.fromEntries(questions.map((q) => [q.qid, q.topic]));
    const sheetOf = Object.fromEntries(
      questions.map((q) => [q.qid, q.sheet || DEFAULT_SHEET])
    );
    const topics = [...new Set(questions.map((q) => q.topic))];
    const topicTotals = {};
    const sheetTotals = {};
    const topicsBySheet = {};
    for (const q of questions) {
      const sheet = q.sheet || DEFAULT_SHEET;
      topicTotals[q.topic] = (topicTotals[q.topic] || 0) + 1;
      sheetTotals[sheet] = (sheetTotals[sheet] || 0) + 1;
      if (!topicsBySheet[sheet]) topicsBySheet[sheet] = [];
      if (!topicsBySheet[sheet].includes(q.topic)) topicsBySheet[sheet].push(q.topic);
    }

    const board = users
      .map((u) => {
        const { currentStreak, bestStreak } = computeStreaks(u.dailySolves || {});
        const daily = dailyProgress(u.dailySolves || {});
        const challenge = challengeProgress(u.dailySolves || {});
        const byTopic = Object.fromEntries(topics.map((t) => [t, 0]));
        const bySheet = Object.fromEntries(Object.keys(sheetTotals).map((s) => [s, 0]));
        for (const id of u.solved || []) {
          const t = topicOf[id];
          if (t) byTopic[t] += 1;
          const s = sheetOf[id];
          if (s && bySheet[s] !== undefined) bySheet[s] += 1;
        }
        return {
          username: u.username,
          displayName: u.displayName,
          solvedCount: (u.solved || []).length,
          currentStreak,
          bestStreak,
          todayCount: daily.todayRawCount,
          dailyGoal: daily.dailyGoal,
          todayComplete: daily.todayComplete,
          challengeCompleted: challenge.challengeCompleted,
          challengeDays: challenge.challengeDays,
          pct: totalQuestions ? Math.round(((u.solved || []).length / totalQuestions) * 100) : 0,
          byTopic,
          bySheet,
        };
      })
      .sort((a, b) => b.solvedCount - a.solvedCount || b.currentStreak - a.currentStreak);

    return NextResponse.json({
      board,
      totalQuestions,
      topics,
      topicTotals,
      sheets: SHEETS,
      sheetTotals,
      topicsBySheet,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}
