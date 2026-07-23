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

export function computeStreaks(activityDates = []) {
  const set = new Set(activityDates);
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

export function ensureToday(activityDates = []) {
  const today = todayKey();
  return activityDates.includes(today) ? activityDates : [...activityDates, today];
}
