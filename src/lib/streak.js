export const DAILY_GOAL = 8;
export const CHALLENGE_DAYS = 30;

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(key, delta) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return todayKey(dt);
}

/** Normalize mongoose Map / plain object into { date: string[] } */
export function normalizeDailySolves(dailySolves) {
  if (!dailySolves) return {};
  if (dailySolves instanceof Map) {
    return Object.fromEntries(
      [...dailySolves.entries()].map(([k, v]) => [k, Array.isArray(v) ? [...v] : []])
    );
  }
  const out = {};
  for (const [k, v] of Object.entries(dailySolves)) {
    out[k] = Array.isArray(v) ? [...v] : [];
  }
  return out;
}

export function goalDaysFromDaily(dailySolves = {}, goal = DAILY_GOAL) {
  return Object.entries(normalizeDailySolves(dailySolves))
    .filter(([, qids]) => qids.length >= goal)
    .map(([date]) => date)
    .sort();
}

export function computeStreaks(dailySolves = {}, goal = DAILY_GOAL) {
  const set = new Set(goalDaysFromDaily(dailySolves, goal));
  const today = todayKey();
  const yesterday = addDays(today, -1);

  let current = 0;
  let cursor = set.has(today) ? today : set.has(yesterday) ? yesterday : null;
  while (cursor && set.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  const sorted = [...set].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const day of sorted) {
    if (prev && day === addDays(prev, 1)) run += 1;
    else run = 1;
    best = Math.max(best, run);
    prev = day;
  }

  return { currentStreak: current, bestStreak: best };
}

export function dailyProgress(dailySolves = {}, goal = DAILY_GOAL) {
  const map = normalizeDailySolves(dailySolves);
  const today = todayKey();
  const todayCount = (map[today] || []).length;
  return {
    dailyGoal: goal,
    todayCount: Math.min(todayCount, goal),
    todayRawCount: todayCount,
    todayPct: Math.min(100, Math.round((todayCount / goal) * 100)),
    todayComplete: todayCount >= goal,
  };
}

export function challengeProgress(dailySolves = {}, goal = DAILY_GOAL, challengeDays = CHALLENGE_DAYS) {
  const completedDays = goalDaysFromDaily(dailySolves, goal).length;
  const capped = Math.min(completedDays, challengeDays);
  return {
    challengeDays,
    challengeCompleted: capped,
    challengePct: Math.round((capped / challengeDays) * 100),
  };
}

export function progressPayload(user) {
  const dailySolves = normalizeDailySolves(user.dailySolves);
  const { currentStreak, bestStreak } = computeStreaks(dailySolves);
  const daily = dailyProgress(dailySolves);
  const challenge = challengeProgress(dailySolves);
  return {
    solved: user.solved || [],
    solvedCount: (user.solved || []).length,
    currentStreak,
    bestStreak,
    ...daily,
    ...challenge,
  };
}

/** Add qid to today; sync activityDates for days that hit the goal */
export function recordFinish(user, qid) {
  const map = normalizeDailySolves(user.dailySolves);
  const today = todayKey();
  const day = map[today] || [];
  if (!day.includes(qid)) day.push(qid);
  map[today] = day;
  user.dailySolves = map;
  user.markModified('dailySolves');
  user.activityDates = goalDaysFromDaily(map);
}

/** Remove qid from whichever day it was logged; refresh activityDates */
export function recordReopen(user, qid) {
  const map = normalizeDailySolves(user.dailySolves);
  for (const date of Object.keys(map)) {
    map[date] = (map[date] || []).filter((id) => id !== qid);
    if (map[date].length === 0) delete map[date];
  }
  user.dailySolves = map;
  user.markModified('dailySolves');
  user.activityDates = goalDaysFromDaily(map);
}
