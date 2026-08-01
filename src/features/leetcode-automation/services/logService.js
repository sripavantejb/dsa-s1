import SubmissionLog from '@/lib/models/SubmissionLog.js';
import { DEFAULT_PAGE_SIZE } from '../constants.js';
import { intValue } from '../lib/validation.js';

/** @returns {import('../types/index.js').SubmissionLogDTO} */
export function serializeLog(doc) {
  return {
    id: String(doc._id),
    solutionId: doc.solutionId ? String(doc.solutionId) : null,
    problemName: doc.problemName || '',
    problemUrl: doc.problemUrl || '',
    engine: doc.engine,
    result: doc.result,
    startTime: doc.startTime,
    endTime: doc.endTime,
    executionMs: doc.executionMs || 0,
    failureReason: doc.failureReason || '',
    screenshot: doc.screenshot || '',
    browserVersion: doc.browserVersion || '',
    retryCount: doc.retryCount || 0,
    trigger: doc.trigger || 'scheduled',
    createdAt: doc.createdAt,
  };
}

export async function createLog(username, data) {
  const doc = await SubmissionLog.create({ username, ...data });
  return serializeLog(doc);
}

export async function listLogs(username, query = {}) {
  const page = intValue(query.page, { min: 1, max: 100000, fallback: 1 });
  const pageSize = intValue(query.pageSize, { min: 1, max: 100, fallback: DEFAULT_PAGE_SIZE });

  const filter = { username };
  if (query.result && query.result !== 'all') filter.result = query.result;

  const total = await SubmissionLog.countDocuments(filter);
  const items = await SubmissionLog.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean();

  return {
    items: items.map(serializeLog),
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function clearLogs(username) {
  const res = await SubmissionLog.deleteMany({ username });
  return res.deletedCount || 0;
}

/**
 * Aggregate run statistics used by the dashboard.
 * @returns {Promise<{ total:number, success:number, failure:number, reminder:number, skipped:number, successRate:number, latest:object|null }>}
 */
export async function getStats(username) {
  const rows = await SubmissionLog.aggregate([
    { $match: { username } },
    { $group: { _id: '$result', count: { $sum: 1 } } },
  ]);

  const counts = { success: 0, failure: 0, reminder: 0, skipped: 0 };
  for (const r of rows) counts[r._id] = r.count;

  const total = counts.success + counts.failure + counts.reminder + counts.skipped;
  // Success rate is measured against runs that actually attempted a submission.
  const attempted = counts.success + counts.failure;
  const successRate = attempted ? Math.round((counts.success / attempted) * 100) : 0;

  const latestDoc = await SubmissionLog.findOne({ username }).sort({ createdAt: -1 }).lean();

  return {
    total,
    ...counts,
    successRate,
    latest: latestDoc ? serializeLog(latestDoc) : null,
  };
}

export async function recentLogs(username, limit = 6) {
  const items = await SubmissionLog.find({ username }).sort({ createdAt: -1 }).limit(limit).lean();
  return items.map(serializeLog);
}
