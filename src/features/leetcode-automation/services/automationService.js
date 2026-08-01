import { getDashboard } from './dashboardService.js';
import { getSettingsDoc, recomputeNextRun, serializeSettings } from './settingsService.js';
import { notifyAutomation } from './notificationService.js';
import { runForUser, runDue } from '../workers/runner.js';

/** Dashboard payload for the current user. */
export async function dashboard(username) {
  return getDashboard(username);
}

/** Manually trigger a single run now (respects enabled/paused inside runner). */
export async function runNow(user) {
  const log = await runForUser(user, { trigger: 'manual' });
  const data = await getDashboard(user.username);
  return { log, dashboard: data };
}

export async function setEnabled(user, enabled) {
  const doc = await getSettingsDoc(user.username);
  const was = doc.enabled;
  doc.enabled = !!enabled;
  if (!enabled) doc.paused = false;
  recomputeNextRun(doc);
  await doc.save();

  if (was && !enabled) {
    await notifyAutomation(user, serializeSettings(doc), {
      event: 'automationDisabled',
      title: 'Automation disabled',
      body: 'LeetCode streak automation has been turned off.',
    });
  }
  return getDashboard(user.username);
}

export async function setPaused(user, paused) {
  const doc = await getSettingsDoc(user.username);
  doc.paused = !!paused;
  recomputeNextRun(doc);
  await doc.save();
  return getDashboard(user.username);
}

/**
 * Cron entry point. Guarded by a shared secret so it can be safely exposed to
 * an external scheduler without authentication cookies.
 * @param {string | null} providedSecret
 */
export async function tick(providedSecret) {
  const expected = process.env.AUTOMATION_CRON_SECRET;
  if (expected && providedSecret !== expected) {
    const err = new Error('Invalid cron secret.');
    err.status = 401;
    throw err;
  }
  return runDue({ now: new Date() });
}
