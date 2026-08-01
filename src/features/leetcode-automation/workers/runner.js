import AutomationSettings from '@/lib/models/AutomationSettings.js';
import { getEngine } from './engineFactory.js';
import { getSettingsDoc, recomputeNextRun, serializeSettings } from '../services/settingsService.js';
import { pickNextSolution } from '../services/solutionService.js';
import { loadStorageState, markSessionExpired } from '../services/sessionService.js';
import { createLog } from '../services/logService.js';
import { notifyAutomation } from '../services/notificationService.js';

/**
 * Orchestrates a single run for one user. Engine-agnostic: it picks a problem,
 * asks whichever engine is configured to run it, retries on failure per the
 * user's settings, records a log, updates scheduling bookkeeping, and notifies.
 *
 * @param {{ username: string, displayName?: string }} user
 * @param {{ trigger?: 'manual' | 'scheduled' }} [opts]
 * @returns {Promise<import('../types/index.js').SubmissionLogDTO>}
 */
export async function runForUser(user, { trigger = 'scheduled' } = {}) {
  const doc = await getSettingsDoc(user.username);
  const settings = serializeSettings(doc);

  if (!settings.enabled || settings.paused) {
    return finalize(user, doc, {
      solutionId: null,
      problemName: '',
      problemUrl: '',
      engine: settings.engine,
      result: 'skipped',
      failureReason: settings.paused ? 'Automation is paused.' : 'Automation is disabled.',
      trigger,
      retryCount: 0,
      startTime: new Date(),
      endTime: new Date(),
      executionMs: 0,
    });
  }

  const { solution, nextCursor } = await pickNextSolution(user.username, settings);
  if (!solution) {
    return finalize(user, doc, {
      solutionId: null,
      problemName: '',
      problemUrl: '',
      engine: settings.engine,
      result: 'skipped',
      failureReason: 'No stored solutions to run. Add one in the Solutions page.',
      trigger,
      retryCount: 0,
      startTime: new Date(),
      endTime: new Date(),
      executionMs: 0,
    });
  }

  const engine = getEngine(settings);
  const ctx = {
    user,
    solution,
    settings,
    loadSession: () => loadStorageState(user.username),
  };

  const maxAttempts = settings.retryFailed ? settings.maxRetries + 1 : 1;
  const startTime = new Date();
  let last = { result: 'failure', failureReason: 'Run did not execute.' };
  let attempt = 0;

  for (attempt = 0; attempt < maxAttempts; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    last = await safeRun(engine, ctx);
    if (last.result === 'success' || last.result === 'reminder' || last.result === 'skipped') break;
  }

  const endTime = new Date();

  if (last.failureReason && /session expired/i.test(last.failureReason)) {
    await markSessionExpired(user.username);
  }

  // Advance sequential cursor only when we actually consumed a problem.
  if (settings.rotation === 'sequential') {
    doc.sequentialCursor = nextCursor;
  }

  const log = await finalize(user, doc, {
    solutionId: solution.id,
    problemName: solution.problemName,
    problemUrl: solution.problemUrl,
    engine: engine.name,
    result: last.result,
    failureReason: last.failureReason || '',
    screenshot: last.screenshot || '',
    browserVersion: last.browserVersion || '',
    retryCount: Math.max(0, attempt - (last.result === 'failure' ? 0 : 1)),
    trigger,
    startTime,
    endTime,
    executionMs: endTime - startTime,
  });

  await sendRunNotification(user, doc, solution, last);
  return log;
}

async function safeRun(engine, ctx) {
  try {
    return await engine.run(ctx);
  } catch (err) {
    return { result: 'failure', failureReason: err?.message || 'Engine crashed.' };
  }
}

/** Writes the log and updates the settings bookkeeping atomically-ish. */
async function finalize(user, doc, logData) {
  doc.lastRunAt = new Date();
  doc.lastRunResult = logData.result;
  recomputeNextRun(doc, doc.lastRunAt);
  await doc.save();
  return createLog(user.username, logData);
}

async function sendRunNotification(user, doc, solution, last) {
  const settings = serializeSettings(doc);
  const map = {
    success: {
      event: 'success',
      title: 'LeetCode run succeeded',
      body: `"${solution.problemName}" was submitted successfully.`,
    },
    reminder: {
      event: 'success',
      title: 'Time to keep your streak',
      body: last.message || `Submit "${solution.problemName}" today to keep your streak.`,
    },
    failure: {
      event: /session expired/i.test(last.failureReason || '') ? 'sessionExpired' : 'failure',
      title: 'LeetCode run failed',
      body: last.failureReason || `Could not submit "${solution.problemName}".`,
    },
    skipped: null,
  };
  const payload = map[last.result];
  if (payload) await notifyAutomation(user, settings, payload);
}

/**
 * Runs every enabled, non-paused user whose nextRunAt is due. Intended to be
 * called by an external scheduler (Vercel Cron / GitHub Action) via /api/automation.
 * @returns {Promise<{ ran: number, results: object[] }>}
 */
export async function runDue({ now = new Date() } = {}) {
  const due = await AutomationSettings.find({
    enabled: true,
    paused: false,
    nextRunAt: { $ne: null, $lte: now },
  })
    .select('username')
    .lean();

  const User = (await import('@/lib/models/User.js')).default;
  const results = [];

  for (const s of due) {
    // eslint-disable-next-line no-await-in-loop
    const userDoc = await User.findOne({ username: s.username }).select('username displayName').lean();
    if (!userDoc) continue;
    // eslint-disable-next-line no-await-in-loop
    const log = await runForUser(
      { username: userDoc.username, displayName: userDoc.displayName },
      { trigger: 'scheduled' }
    );
    results.push({ username: s.username, result: log.result });
  }

  return { ran: results.length, results };
}
