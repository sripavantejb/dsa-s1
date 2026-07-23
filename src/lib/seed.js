import bcrypt from 'bcryptjs';
import questions from '@/data/questions.json';
import Question from './models/Question.js';
import User from './models/User.js';

const USERS = [
  { username: 'tej', displayName: 'Tej', password: 'tej@dsa' },
  { username: 'hafsa', displayName: 'Hafsa', password: 'hafsa@dsa' },
];

export async function ensureSeeded() {
  const count = await Question.countDocuments();
  if (count !== questions.length) {
    await Question.deleteMany({});
    await Question.insertMany(
      questions.map((q) => ({
        qid: q.id,
        order: q.order,
        topic: q.topic,
        title: q.title,
        link: q.link || '',
        difficulty: q.difficulty || 'UNRATED',
      }))
    );
    console.log(`Seeded ${questions.length} questions (CSV order)`);
  }

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
