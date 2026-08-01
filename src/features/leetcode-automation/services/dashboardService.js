import { getSettingsDoc, serializeSettings } from './settingsService.js';
import { getSessionStatus } from './sessionService.js';
import { getStats, recentLogs } from './logService.js';
import { PlaywrightEngine } from '../workers/playwrightEngine.js';

/**
 * Assembles everything the Dashboard page shows in one round trip:
 * status, today's run, next run, streak, run tallies, success rate,
 * latest submission and recent activity.
 */
export async function getDashboard(username) {
  const [doc, session, stats] = await Promise.all([
    getSettingsDoc(username),
    getSessionStatus(username),
    getStats(username),
  ]);

  const settings = serializeSettings(doc);
  const recent = await recentLogs(username, 8);

  const status = deriveStatus(settings, session);
  const today = todaysRun(recent);

  return {
    status,
    settings,
    session,
    today,
    nextRun: settings.nextRunAt,
    currentStreak: settings.manualStreak,
    totalRuns: stats.total,
    successfulRuns: stats.success,
    failedRuns: stats.failure,
    reminderRuns: stats.reminder,
    successRate: stats.successRate,
    latestSubmission: stats.latest,
    recentActivity: recent,
    playwrightAvailable: new PlaywrightEngine().isAvailable(),
  };
}

function deriveStatus(settings, session) {
  if (!settings.enabled) return { label: 'Disabled', tone: 'muted' };
  if (settings.paused) return { label: 'Paused', tone: 'warn' };
  if (settings.engine === 'playwright' && session.status !== 'connected') {
    return { label: 'Needs connection', tone: 'warn' };
  }
  if (session.status === 'expired') return { label: 'Session expired', tone: 'danger' };
  return { label: 'Active', tone: 'ok' };
}

function todaysRun(recent) {
  if (!recent.length) return null;
  const now = new Date();
  const sameDay = recent.find((log) => {
    const d = new Date(log.createdAt);
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  });
  return sameDay || null;
}
