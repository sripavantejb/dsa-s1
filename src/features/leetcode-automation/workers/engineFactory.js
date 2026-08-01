import { ENGINES } from '../constants.js';
import { ReminderEngine } from './reminderEngine.js';
import { PlaywrightEngine } from './playwrightEngine.js';

/**
 * Resolves the concrete {@link AutomationEngine} for a settings document.
 *
 * Falls back to the safe ReminderEngine whenever the requested engine is not
 * available in this deployment (e.g. Playwright not enabled). This single
 * choke-point is what makes the module "reminder-only replaceable".
 *
 * @param {import('../types/index.js').AutomationSettingsDTO} settings
 * @returns {import('./AutomationEngine.js').AutomationEngine}
 */
export function getEngine(settings) {
  const requested = settings?.engine || ENGINES.REMINDER;

  if (requested === ENGINES.PLAYWRIGHT) {
    const engine = new PlaywrightEngine();
    if (engine.isAvailable()) return engine;
    // Requested but not permitted → degrade safely.
    return new ReminderEngine();
  }

  return new ReminderEngine();
}
