import AutomationSettings from '@/lib/models/AutomationSettings.js';
import { NOTIFICATION_CHANNELS } from '../constants.js';
import { nextRunAt } from '../lib/time.js';
import {
  boolValue,
  intValue,
  optionalString,
  timeOfDay,
  timezone,
  validators,
} from '../lib/validation.js';

/** Loads (or lazily creates) the settings document for a user. */
export async function getSettingsDoc(username) {
  let doc = await AutomationSettings.findOne({ username });
  if (!doc) {
    doc = await AutomationSettings.create({ username });
  }
  return doc;
}

/** @returns {import('../types/index.js').AutomationSettingsDTO} */
export function serializeSettings(doc) {
  return {
    id: String(doc._id),
    enabled: !!doc.enabled,
    paused: !!doc.paused,
    engine: doc.engine,
    submissionTime: doc.submissionTime,
    timezone: doc.timezone,
    rotation: doc.rotation,
    specificSolutionId: doc.specificSolutionId ? String(doc.specificSolutionId) : null,
    retryFailed: !!doc.retryFailed,
    maxRetries: doc.maxRetries,
    manualStreak: doc.manualStreak,
    notifications: normalizeNotifications(doc.notifications),
    lastRunAt: doc.lastRunAt,
    nextRunAt: doc.nextRunAt,
    lastRunResult: doc.lastRunResult,
    updatedAt: doc.updatedAt,
  };
}

function normalizeNotifications(n) {
  const out = { events: { ...(n?.events || {}) } };
  for (const ch of NOTIFICATION_CHANNELS) {
    out[ch] = {
      enabled: !!n?.[ch]?.enabled,
      // Targets can contain webhook URLs / chat ids — safe to return to the owner.
      target: n?.[ch]?.target || '',
    };
  }
  return out;
}

/** Recomputes nextRunAt from the schedule fields; null when inactive. */
export function recomputeNextRun(doc, from = new Date()) {
  if (!doc.enabled || doc.paused) {
    doc.nextRunAt = null;
    return doc;
  }
  doc.nextRunAt = nextRunAt(doc.submissionTime, doc.timezone, from);
  return doc;
}

/**
 * Validates and applies a partial update. Only known fields are touched, so the
 * endpoint is safe to call with arbitrary client payloads.
 */
export async function updateSettings(username, body = {}) {
  const doc = await getSettingsDoc(username);

  if ('enabled' in body) doc.enabled = boolValue(body.enabled, doc.enabled);
  if ('paused' in body) doc.paused = boolValue(body.paused, doc.paused);
  if ('engine' in body) doc.engine = validators.engine(body.engine, doc.engine);
  if ('submissionTime' in body) doc.submissionTime = timeOfDay(body.submissionTime, doc.submissionTime);
  if ('timezone' in body) doc.timezone = timezone(body.timezone, doc.timezone);
  if ('rotation' in body) doc.rotation = validators.rotation(body.rotation, doc.rotation);
  if ('specificSolutionId' in body) {
    doc.specificSolutionId = body.specificSolutionId || null;
  }
  if ('retryFailed' in body) doc.retryFailed = boolValue(body.retryFailed, doc.retryFailed);
  if ('maxRetries' in body) doc.maxRetries = intValue(body.maxRetries, { min: 0, max: 10, fallback: doc.maxRetries });
  if ('manualStreak' in body) doc.manualStreak = intValue(body.manualStreak, { min: 0, max: 100000, fallback: doc.manualStreak });

  if (body.notifications) applyNotificationPatch(doc, body.notifications);

  recomputeNextRun(doc);
  await doc.save();
  return doc;
}

function applyNotificationPatch(doc, patch) {
  doc.notifications = doc.notifications || {};
  for (const ch of NOTIFICATION_CHANNELS) {
    if (patch[ch]) {
      doc.notifications[ch] = {
        enabled: boolValue(patch[ch].enabled, doc.notifications[ch]?.enabled || false),
        target: optionalString(patch[ch].target, { max: 500, fallback: doc.notifications[ch]?.target || '' }),
      };
    }
  }
  if (patch.events) {
    doc.notifications.events = {
      success: boolValue(patch.events.success, doc.notifications.events?.success ?? true),
      failure: boolValue(patch.events.failure, doc.notifications.events?.failure ?? true),
      sessionExpired: boolValue(patch.events.sessionExpired, doc.notifications.events?.sessionExpired ?? true),
      automationDisabled: boolValue(
        patch.events.automationDisabled,
        doc.notifications.events?.automationDisabled ?? true
      ),
    };
  }
  doc.markModified('notifications');
}
