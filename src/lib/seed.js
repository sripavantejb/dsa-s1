import bcrypt from 'bcryptjs';
import ccbpQuestions from '@/data/questions.json';
import striverQuestions from '@/data/striver-a2z.json';
import Question from './models/Question.js';
import User from './models/User.js';

const USERS = [
  { username: 'tej', displayName: 'Tej', password: 'tej@dsa' },
  { username: 'hafsa', displayName: 'Hafsa', password: 'hafsa@dsa' },
];

const SHEET_SOURCES = [
  { sheet: 'ccbp', questions: ccbpQuestions },
  { sheet: 'striver', questions: striverQuestions },
];

function toDocument(sheet, q) {
  return {
    qid: q.id,
    sheet,
    order: q.order,
    topic: q.topic,
    subtopic: q.subtopic || '',
    title: q.title,
    link: q.link || '',
    altLink: q.altLink || '',
    difficulty: q.difficulty || 'UNRATED',
  };
}

/**
 * Upserts every sheet by qid so existing solved/revision references stay valid.
 * Only runs when the stored counts drift from the bundled data.
 */
async function syncQuestions() {
  const checks = await Promise.all(
    SHEET_SOURCES.map(async ({ sheet, questions }) => ({
      sheet,
      questions,
      stored: await Question.countDocuments({ sheet }),
    }))
  );

  const stale = checks.filter(({ questions, stored }) => stored !== questions.length);
  if (!stale.length) return;

  const documents = SHEET_SOURCES.flatMap(({ sheet, questions }) =>
    questions.map((q) => toDocument(sheet, q))
  );

  await Question.bulkWrite(
    documents.map((doc) => ({
      updateOne: {
        filter: { qid: doc.qid },
        update: { $set: doc },
        upsert: true,
      },
    })),
    { ordered: false }
  );

  await Question.deleteMany({ qid: { $nin: documents.map((d) => d.qid) } });

  for (const { sheet, questions } of stale) {
    console.log(`Synced ${questions.length} questions for sheet "${sheet}"`);
  }
}

export async function ensureSeeded() {
  await syncQuestions();

  for (const u of USERS) {
    const existing = await User.findOne({ username: u.username });
    if (existing) continue;
    await User.create({
      username: u.username,
      displayName: u.displayName,
      passwordHash: await bcrypt.hash(u.password, 10),
      solved: [],
      activityDates: [],
    });
    console.log(`Created user ${u.username}`);
  }
}
