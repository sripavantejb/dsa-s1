#!/usr/bin/env node
/**
 * Regenerates src/data/striver-a2z.json from the published A2Z sheet dump.
 * Run with: npm run sheet:striver
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SOURCE =
  process.env.STRIVER_SOURCE ||
  'https://raw.githubusercontent.com/khush2808/dsa-sheets/main/data/strivers-a2z-problems.json';

const OUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'data',
  'striver-a2z.json'
);

const DIFFICULTY = {
  easy: 'EASY',
  medium: 'MEDIUM',
  hard: 'HARD',
};

function normalizeDifficulty(value) {
  return DIFFICULTY[String(value || '').toLowerCase()] || 'UNRATED';
}

function primaryLink(problem) {
  return problem.plus || problem.leetcode || problem.article || problem.youtube || '';
}

async function main() {
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`Source fetch failed: ${res.status}`);
  const raw = await res.json();

  const problems = [...(raw.problems || [])].sort(
    (a, b) =>
      a.category_order - b.category_order ||
      a.subcategory_order - b.subcategory_order ||
      a.order - b.order
  );

  if (!problems.length) throw new Error('No problems found in source');

  const questions = problems.map((problem, index) => ({
    id: `a2z-${problem.problem_id}`,
    order: index + 1,
    topic: problem.category_name,
    subtopic: problem.subcategory_name || '',
    title: problem.problem_name,
    link: primaryLink(problem),
    altLink: problem.leetcode || '',
    difficulty: normalizeDifficulty(problem.difficulty),
  }));

  const duplicateIds = questions.length - new Set(questions.map((q) => q.id)).size;
  if (duplicateIds) throw new Error(`Found ${duplicateIds} duplicate problem ids`);

  await writeFile(OUT, `${JSON.stringify(questions, null, 2)}\n`);

  const byDifficulty = questions.reduce((acc, q) => {
    acc[q.difficulty] = (acc[q.difficulty] || 0) + 1;
    return acc;
  }, {});

  console.log(`Wrote ${questions.length} problems to ${OUT}`);
  console.log(`Topics: ${new Set(questions.map((q) => q.topic)).size}`, byDifficulty);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
