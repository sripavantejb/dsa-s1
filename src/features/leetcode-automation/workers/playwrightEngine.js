import { AutomationEngine } from './AutomationEngine.js';
import { ENGINES } from '../constants.js';

/**
 * Opt-in browser engine that drives the user's own LeetCode session via
 * Playwright. DISABLED unless `AUTOMATION_ALLOW_PLAYWRIGHT=true` and the
 * optional `playwright` package is installed. See the ToS warning in
 * lib/playwright/leetcodeClient.js. Isolated so it can be removed entirely.
 */
export class PlaywrightEngine extends AutomationEngine {
  get name() {
    return ENGINES.PLAYWRIGHT;
  }

  isAvailable() {
    return process.env.AUTOMATION_ALLOW_PLAYWRIGHT === 'true';
  }

  /**
   * @param {import('../types/index.js').EngineRunContext} ctx
   * @returns {Promise<import('../types/index.js').EngineRunResult>}
   */
  async run(ctx) {
    if (!this.isAvailable()) {
      return {
        result: 'skipped',
        failureReason:
          'Playwright engine is disabled. Set AUTOMATION_ALLOW_PLAYWRIGHT=true to enable it (ToS risk).',
      };
    }

    const storageState = await ctx.loadSession();
    if (!storageState) {
      return { result: 'failure', failureReason: 'No connected LeetCode session.' };
    }

    // Imported lazily so the app never bundles playwright by default.
    const { submitSolution } = await import('../lib/playwright/leetcodeClient.js');

    const res = await submitSolution({
      storageState,
      problemUrl: ctx.solution.problemUrl,
      sourceCode: ctx.solution.sourceCode,
      language: ctx.solution.language,
    });

    if (res.verdict === 'SESSION_EXPIRED') {
      return {
        result: 'failure',
        failureReason: 'LeetCode session expired. Reconnect your account.',
        browserVersion: res.browserVersion,
      };
    }

    return {
      result: res.ok ? 'success' : 'failure',
      failureReason: res.ok ? '' : `Verdict: ${res.verdict}`,
      screenshot: res.screenshot || '',
      browserVersion: res.browserVersion || '',
      message: res.ok ? `Accepted: ${ctx.solution.problemName}` : `Not accepted: ${res.verdict}`,
    };
  }
}

export default PlaywrightEngine;
