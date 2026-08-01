import RevisionItem from './models/RevisionItem.js';
import Question from './models/Question.js';
import Activity from './models/Activity.js';
import Notification from './models/Notification.js';
import { normalizeDailySolves } from './streak.js';

const MS_DAY = 24 * 60 * 60 * 1000;
export const REVISION_INTERVAL_DAYS = 7;

export function startOfLocalDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDaysDate(date, days) {
  const d = startOfLocalDay(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function dateKeyFromDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(date));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/** Compute badge / queue status for a revision item relative to today */
export function revisionStatus(item, now = new Date()) {
  if (!item?.trackingActive) return 'paused';
  const today = startOfLocalDay(now);
  const next = startOfLocalDay(item.nextRevisionAt);
  const diffDays = Math.round((next.getTime() - today.getTime()) / MS_DAY);
  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'due_today';
  return 'upcoming';
}

export function badgeForRevision(item, now = new Date()) {
  if (!item) return null;
  if (!item.trackingActive) {
    return { key: 'paused', label: 'Revision paused', tone: 'muted' };
  }
  const status = revisionStatus(item, now);
  const week = item.stage || 1;
  if (status === 'overdue') {
    return { key: 'overdue', label: `Week ${week} Overdue`, tone: 'danger' };
  }
  if (status === 'due_today') {
    return { key: 'due_today', label: `Week ${week} Due Today`, tone: 'warn' };
  }
  if (item.lastRevisedAt && item.history?.some((h) => h.completedAt)) {
    return { key: 'scheduled', label: `Week ${week} · ${formatShortDate(item.nextRevisionAt)}`, tone: 'ok' };
  }
  return { key: 'scheduled', label: `Revision · ${formatShortDate(item.nextRevisionAt)}`, tone: 'info' };
}

export function formatShortDate(date) {
  if (!date) return '';
  return startOfLocalDay(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function firstSchedule(solvedAt) {
  const solvedDay = startOfLocalDay(solvedAt);
  const next = addDaysDate(solvedDay, REVISION_INTERVAL_DAYS);
  return {
    stage: 1,
    nextRevisionAt: next,
    history: [
      {
        week: 1,
        scheduledFor: next,
        completedAt: null,
      },
    ],
  };
}

/**
 * Upsert revision tracking when a problem-set question is solved.
 * Never creates duplicates for the same username + qid.
 */
export async function ensureRevisionForSolved(username, question, solvedAt = new Date()) {
  if (!username || !question?.qid) return null;

  const existing = await RevisionItem.findOne({ username, qid: question.qid });
  if (existing) {
    // Re-activate tracking if it was paused, but never duplicate / reset unless asked
    if (!existing.trackingActive) {
      existing.trackingActive = true;
      await existing.save();
    }
    return existing;
  }

  const schedule = firstSchedule(solvedAt);
  return RevisionItem.create({
    username,
    qid: question.qid,
    source: 'problem_set',
    trackingActive: true,
    title: question.title,
    link: question.link || '',
    topic: question.topic || '',
    difficulty: question.difficulty || 'UNRATED',
    notes: '',
    platform: '',
    solvedAt: startOfLocalDay(solvedAt),
    ...schedule,
  });
}

/** Mark current revision done and schedule next weekly revision */
export async function markRevised(item, when = new Date()) {
  if (!item) throw new Error('Revision item required');
  const doneAt = new Date(when);
  const week = item.stage || 1;

  const hist = [...(item.history || [])];
  const openIdx = hist.findIndex((h) => h.week === week && !h.completedAt);
  if (openIdx >= 0) {
    hist[openIdx] = { ...hist[openIdx].toObject?.() ?? hist[openIdx], completedAt: doneAt };
  } else {
    hist.push({
      week,
      scheduledFor: item.nextRevisionAt || doneAt,
      completedAt: doneAt,
    });
  }

  const nextWeek = week + 1;
  const nextDate = addDaysDate(doneAt, REVISION_INTERVAL_DAYS);
  hist.push({
    week: nextWeek,
    scheduledFor: nextDate,
    completedAt: null,
  });

  item.history = hist;
  item.stage = nextWeek;
  item.nextRevisionAt = nextDate;
  item.lastRevisedAt = doneAt;
  item.trackingActive = true;
  item.markModified('history');
  await item.save();
  return item;
}

/** Set the next revision date on an item (updates open history entry). Caller saves. */
export function applyScheduleDate(item, scheduledFor) {
  item.nextRevisionAt = scheduledFor;
  item.trackingActive = true;
  const history = [...(item.history || [])];
  const currentIndex = history.findIndex(
    (entry) => entry.week === item.stage && !entry.completedAt
  );
  if (currentIndex >= 0) {
    history[currentIndex].scheduledFor = scheduledFor;
  } else {
    history.push({
      week: item.stage || 1,
      scheduledFor,
      completedAt: null,
    });
  }
  item.history = history;
  item.markModified('history');
}

/**
 * Schedule every problem solved between fromDate and toDate (inclusive) for
 * revision on scheduledFor. Auto-tracks solved-but-untracked problems whose
 * solve date falls in the range.
 */
export async function bulkScheduleRevisions(username, user, fromDate, toDate, scheduledFor) {
  const from = startOfLocalDay(fromDate);
  const endExclusive = addDaysDate(toDate, 1);

  const items = await RevisionItem.find({
    username,
    solvedAt: { $gte: from, $lt: endExclusive },
  });

  let created = 0;
  const trackedQids = new Set(
    (await RevisionItem.find({ username, qid: { $ne: null } }).select('qid').lean()).map(
      (i) => i.qid
    )
  );
  const untrackedQids = (user?.solved || []).filter((qid) => !trackedQids.has(qid));
  for (const qid of untrackedQids) {
    let solvedAt = guessSolvedAt(user, qid);
    if (!solvedAt) solvedAt = await guessSolvedAtFromActivity(username, qid);
    if (!solvedAt) continue;
    const day = startOfLocalDay(solvedAt);
    if (day < from || day >= endExclusive) continue;
    const question = await Question.findOne({ qid }).lean();
    if (!question) continue;
    const item = await ensureRevisionForSolved(username, question, solvedAt);
    const doc = await RevisionItem.findById(item._id);
    if (doc) {
      items.push(doc);
      created += 1;
    }
  }

  for (const item of items) {
    applyScheduleDate(item, scheduledFor);
    await item.save();
  }

  return { scheduled: items.length, created };
}

/**
 * Create "due tomorrow" / "due today" reminder alerts for the user's scheduled
 * revisions. Deduped per item + revision date via reminderKey — safe to call
 * on every notifications poll.
 */
export async function ensureRevisionReminders(user) {
  const username = user?.username;
  if (!username) return;

  const today = startOfLocalDay(new Date());
  const tomorrow = addDaysDate(today, 1);
  const dayAfter = addDaysDate(today, 2);

  const items = await RevisionItem.find({
    username,
    trackingActive: true,
    nextRevisionAt: { $gte: today, $lt: dayAfter },
  });

  const pending = items.filter(
    (item) => (item.reminderKey || '') !== dateKeyFromDate(item.nextRevisionAt)
  );
  if (!pending.length) return;

  const dueTomorrow = pending.filter(
    (item) => startOfLocalDay(item.nextRevisionAt).getTime() === tomorrow.getTime()
  );
  const dueToday = pending.filter(
    (item) => startOfLocalDay(item.nextRevisionAt).getTime() === today.getTime()
  );

  const summarize = (list) => {
    const titles = list.slice(0, 3).map((item) => item.title);
    const extra = list.length - titles.length;
    return titles.join(', ') + (extra > 0 ? ` +${extra} more` : '');
  };

  const notifs = [];
  if (dueTomorrow.length) {
    notifs.push({
      toUsername: username,
      fromUsername: username,
      fromDisplayName: user.displayName || username,
      type: 'revision',
      title: `Revision reminder — ${dueTomorrow.length} due tomorrow`,
      body: summarize(dueTomorrow),
      linkTab: 'revise',
      read: false,
    });
  }
  if (dueToday.length) {
    notifs.push({
      toUsername: username,
      fromUsername: username,
      fromDisplayName: user.displayName || username,
      type: 'revision',
      title: `Revision due today — ${dueToday.length} problem${dueToday.length === 1 ? '' : 's'}`,
      body: summarize(dueToday),
      linkTab: 'revise',
      read: false,
    });
  }
  if (notifs.length) await Notification.insertMany(notifs);

  for (const item of pending) {
    item.reminderKey = dateKeyFromDate(item.nextRevisionAt);
    await item.save();
  }
}

/** Reset schedule from a start date (Week 1 = start + 7 days) */
export async function resetRevisionSchedule(item, fromDate = new Date()) {
  const schedule = firstSchedule(fromDate);
  item.solvedAt = startOfLocalDay(fromDate);
  item.stage = schedule.stage;
  item.nextRevisionAt = schedule.nextRevisionAt;
  item.lastRevisedAt = null;
  item.history = schedule.history;
  item.trackingActive = true;
  item.markModified('history');
  await item.save();
  return item;
}

export function serializeRevision(item, question = null) {
  const plain = typeof item.toObject === 'function' ? item.toObject() : item;
  const title = question?.title || plain.title;
  const topic = question?.topic || plain.topic;
  const link = question?.link ?? plain.link;
  const difficulty = question?.difficulty || plain.difficulty || 'UNRATED';
  const status = revisionStatus(plain);
  const badge = badgeForRevision(plain);

  return {
    id: String(plain._id),
    username: plain.username,
    qid: plain.qid || null,
    source: plain.source,
    trackingActive: !!plain.trackingActive,
    title,
    platform: plain.platform || '',
    link: link || '',
    topic: topic || '',
    difficulty,
    notes: plain.notes || '',
    solvedAt: plain.solvedAt,
    stage: plain.stage,
    nextRevisionAt: plain.nextRevisionAt,
    lastRevisedAt: plain.lastRevisedAt,
    status,
    badge,
    history: (plain.history || []).map((h) => ({
      week: h.week,
      scheduledFor: h.scheduledFor,
      completedAt: h.completedAt,
    })),
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

/** Guess original solved date from dailySolves or Activity */
export function guessSolvedAt(user, qid) {
  const map = normalizeDailySolves(user?.dailySolves);
  const dates = Object.keys(map)
    .filter((d) => (map[d] || []).includes(qid))
    .sort();
  if (dates.length) {
    const [y, m, d] = dates[0].split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return null;
}

export async function guessSolvedAtFromActivity(username, qid) {
  const act = await Activity.findOne({ username, qid, action: 'finished' })
    .sort({ createdAt: 1 })
    .lean();
  return act?.createdAt ? new Date(act.createdAt) : null;
}

export async function buildRevisionDashboard(username, user) {
  const dailyMap = normalizeDailySolves(user?.dailySolves);
  const [items, activities] = await Promise.all([
    RevisionItem.find({ username }).sort({ nextRevisionAt: 1 }).lean(),
    Activity.find({
      username,
      action: { $in: ['finished', 'reopened'] },
    })
      .sort({ createdAt: 1 })
      .lean(),
  ]);
  const qids = [
    ...new Set([
      ...items.map((i) => i.qid).filter(Boolean),
      ...activities.map((activity) => activity.qid).filter(Boolean),
      ...Object.values(dailyMap).flat().filter(Boolean),
    ]),
  ];
  const questions = qids.length
    ? await Question.find({ qid: { $in: qids } }).lean()
    : [];
  const qMap = Object.fromEntries(questions.map((q) => [q.qid, q]));

  const serialized = items.map((i) => serializeRevision(i, i.qid ? qMap[i.qid] : null));
  const now = new Date();
  const today = startOfLocalDay(now);
  const todayKeyStr = dateKeyFromDate(today);
  const weekStart = addDaysDate(today, -((today.getDay() + 6) % 7)); // Monday
  const weekEnd = addDaysDate(weekStart, 7);

  const byStatus = {
    overdue: [],
    due_today: [],
    upcoming: [],
    paused: [],
  };
  for (const s of serialized) {
    byStatus[s.status]?.push(s);
  }

  const addedToday = serialized.filter((s) => dateKeyFromDate(s.solvedAt) === todayKeyStr);
  const revisedToday = serialized.filter(
    (s) => s.lastRevisedAt && dateKeyFromDate(s.lastRevisedAt) === todayKeyStr
  );

  const solvedTodayQids = dailyMap[todayKeyStr] || [];
  const solvedTodayQuestions = solvedTodayQids.length
    ? await Question.find({ qid: { $in: solvedTodayQids } }).lean()
    : [];

  const weekSolvedQids = new Set();
  for (const [day, qidsDay] of Object.entries(dailyMap)) {
    const [y, m, d] = day.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (dt >= weekStart && dt < weekEnd) {
      for (const q of qidsDay) weekSolvedQids.add(q);
    }
  }

  const revisionsDue = [...byStatus.overdue, ...byStatus.due_today];
  const revisionsCompletedToday = revisedToday.length;

  const weekRevised = serialized.filter((s) => {
    if (!s.lastRevisedAt) return false;
    const t = startOfLocalDay(s.lastRevisedAt);
    return t >= weekStart && t < weekEnd;
  }).length;

  const weekDueApprox = serialized.filter((s) => {
    const n = startOfLocalDay(s.nextRevisionAt);
    return s.trackingActive && n >= weekStart && n < weekEnd;
  }).length;

  const weekCompletedHist = serialized.reduce((acc, s) => {
    for (const h of s.history || []) {
      if (!h.completedAt) continue;
      const t = startOfLocalDay(h.completedAt);
      if (t >= weekStart && t < weekEnd) acc += 1;
    }
    return acc;
  }, 0);

  const weekDueTotal = Math.max(weekDueApprox, weekCompletedHist);
  const weekCompletionPct =
    weekDueTotal > 0 ? Math.round((weekCompletedHist / weekDueTotal) * 100) : 100;

  const trackedQids = new Set(items.filter((i) => i.qid).map((i) => i.qid));
  const solved = user?.solved || [];
  const untrackedQids = solved.filter((qid) => !trackedQids.has(qid));
  let untracked = [];
  if (untrackedQids.length) {
    const uqs = await Question.find({ qid: { $in: untrackedQids } }).lean();
    untracked = await Promise.all(
      uqs.map(async (q) => {
        let solvedAt = guessSolvedAt(user, q.qid);
        if (!solvedAt) solvedAt = await guessSolvedAtFromActivity(username, q.qid);
        return {
          qid: q.qid,
          title: q.title,
          topic: q.topic,
          difficulty: q.difficulty,
          link: q.link || '',
          order: q.order,
          guessedSolvedAt: solvedAt,
          needsDate: !solvedAt,
        };
      })
    );
    untracked.sort((a, b) => a.order - b.order);
  }

  const byQid = {};
  for (const s of serialized) {
    if (s.qid) byQid[s.qid] = s;
  }

  const timelineByDate = {};
  const addTimelineEvent = (date, event) => {
    if (!date) return;
    const key = dateKeyFromDate(date);
    if (!timelineByDate[key]) {
      timelineByDate[key] = {
        date: key,
        solved: [],
        external: [],
        revised: [],
        due: [],
        reopened: [],
      };
    }
    timelineByDate[key][event.type].push(event);
  };

  const activityFinishedQids = new Set();
  for (const activity of activities) {
    const question = qMap[activity.qid];
    const tracked = byQid[activity.qid];
    const base = {
      eventId: `activity-${activity._id}`,
      id: tracked?.id || null,
      qid: activity.qid,
      title: question?.title || activity.title,
      topic: question?.topic || activity.topic || '',
      difficulty: question?.difficulty || tracked?.difficulty || 'UNRATED',
      source: 'problem_set',
      link: question?.link || tracked?.link || '',
      platform: '',
      at: activity.createdAt,
    };
    if (activity.action === 'finished') {
      activityFinishedQids.add(activity.qid);
      addTimelineEvent(activity.createdAt, { ...base, type: 'solved' });
    } else if (activity.action === 'reopened') {
      addTimelineEvent(activity.createdAt, { ...base, type: 'reopened' });
    }
  }

  for (const [day, dayQids] of Object.entries(dailyMap)) {
    for (const qid of dayQids || []) {
      if (activityFinishedQids.has(qid)) continue;
      const question = qMap[qid];
      const tracked = byQid[qid];
      addTimelineEvent(day, {
        eventId: `daily-solve-${day}-${qid}`,
        id: tracked?.id || null,
        qid,
        title: question?.title || tracked?.title || qid,
        topic: question?.topic || tracked?.topic || '',
        difficulty: question?.difficulty || tracked?.difficulty || 'UNRATED',
        source: 'problem_set',
        link: question?.link || tracked?.link || '',
        platform: '',
        type: 'solved',
        at: day,
      });
      activityFinishedQids.add(qid);
    }
  }

  for (const item of serialized) {
    const base = {
      id: item.id,
      qid: item.qid,
      title: item.title,
      topic: item.topic,
      difficulty: item.difficulty,
      source: item.source,
      link: item.link,
      platform: item.platform,
    };

    if (item.source === 'manual') {
      addTimelineEvent(item.solvedAt, {
        ...base,
        eventId: `external-${item.id}`,
        type: 'external',
        at: item.solvedAt,
      });
    } else if (!activityFinishedQids.has(item.qid)) {
      addTimelineEvent(item.solvedAt, {
        ...base,
        eventId: `tracked-solve-${item.id}`,
        type: 'solved',
        at: item.solvedAt,
      });
    }

    for (const history of item.history || []) {
      addTimelineEvent(history.scheduledFor, {
        ...base,
        eventId: `due-${item.id}-${history.week}`,
        type: 'due',
        stage: history.week,
        at: history.scheduledFor,
        completedAt: history.completedAt,
      });
      if (history.completedAt) {
        addTimelineEvent(history.completedAt, {
          ...base,
          eventId: `revised-${item.id}-${history.week}`,
          type: 'revised',
          stage: history.week,
          at: history.completedAt,
          scheduledFor: history.scheduledFor,
        });
      }
    }
  }

  const timelineDates = Object.keys(timelineByDate).sort();
  const timeline = {
    byDate: timelineByDate,
    dates: timelineDates,
    firstDate: timelineDates[0] || todayKeyStr,
    lastDate: timelineDates[timelineDates.length - 1] || todayKeyStr,
  };

  return {
    items: serialized,
    byQid,
    queues: {
      overdue: byStatus.overdue,
      dueToday: byStatus.due_today,
      upcoming: byStatus.upcoming,
      paused: byStatus.paused,
    },
    today: {
      date: todayKeyStr,
      problemsSolved: solvedTodayQids.length,
      addedToRevision: addedToday.length,
      revisionsDue: revisionsDue.length,
      revisionsCompleted: revisionsCompletedToday,
      solved: solvedTodayQuestions.map((q) => ({
        qid: q.qid,
        title: q.title,
        topic: q.topic,
      })),
      revised: revisedToday.map((s) => ({ id: s.id, qid: s.qid, title: s.title, stage: s.stage })),
      pendingRevision: revisionsDue.map((s) => ({
        id: s.id,
        qid: s.qid,
        title: s.title,
        status: s.status,
        stage: s.stage,
      })),
    },
    week: {
      problemsSolved: weekSolvedQids.size,
      addedToRevision: serialized.filter((s) => {
        const t = startOfLocalDay(s.solvedAt);
        return t >= weekStart && t < weekEnd;
      }).length,
      revisionsDue: weekDueTotal,
      revisionsCompleted: weekCompletedHist,
      revisionCompletion: weekCompletionPct,
      alsoRevisedCount: weekRevised,
    },
    untracked: {
      count: untracked.length,
      questions: untracked,
    },
    timeline,
  };
}
