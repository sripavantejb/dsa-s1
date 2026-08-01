/**
 * The automation engine interface (SOLID: dependency inversion).
 *
 * Everything above the engine — services, API, UI — depends only on this
 * contract, never on a concrete implementation. That is what lets the whole
 * automation module be disabled or swapped for a reminder-only build without
 * touching callers. Two implementations ship today:
 *
 *   - ReminderEngine   (default, safe, never submits)
 *   - PlaywrightEngine (opt-in, ToS-risky, disabled unless explicitly allowed)
 *
 * @typedef {import('../types/index.js').EngineRunContext} EngineRunContext
 * @typedef {import('../types/index.js').EngineRunResult} EngineRunResult
 */

/**
 * Abstract base. Concrete engines extend this and implement `run`.
 * @abstract
 */
export class AutomationEngine {
  /** @returns {import('../types/index.js').EngineName} */
  get name() {
    throw new Error('AutomationEngine.name must be implemented.');
  }

  /**
   * Whether this engine is allowed to run in the current deployment.
   * @returns {boolean}
   */
  isAvailable() {
    return true;
  }

  /**
   * Execute one run for a single problem.
   * @param {EngineRunContext} _ctx
   * @returns {Promise<EngineRunResult>}
   */
  // eslint-disable-next-line no-unused-vars
  async run(_ctx) {
    throw new Error('AutomationEngine.run must be implemented.');
  }
}
