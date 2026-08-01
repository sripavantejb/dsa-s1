import { AutomationEngine } from './AutomationEngine.js';
import { ENGINES } from '../constants.js';

/**
 * The safe, default engine. It never touches a browser and never submits
 * anything to LeetCode. A "run" simply resolves the problem the user should
 * submit today and returns a `reminder` result — the runner then notifies the
 * user through their configured channels. This is fully ToS-compliant.
 */
export class ReminderEngine extends AutomationEngine {
  get name() {
    return ENGINES.REMINDER;
  }

  isAvailable() {
    return true;
  }

  /**
   * @param {import('../types/index.js').EngineRunContext} ctx
   * @returns {Promise<import('../types/index.js').EngineRunResult>}
   */
  async run(ctx) {
    const { solution } = ctx;
    return {
      result: 'reminder',
      message: `Reminder: submit "${solution.problemName}" (${solution.language}) to keep your streak.`,
    };
  }
}

export default ReminderEngine;
