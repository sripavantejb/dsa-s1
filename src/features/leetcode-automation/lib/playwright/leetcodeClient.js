/**
 * Low-level Playwright client scaffold for LeetCode.
 *
 * ⚠️  READ THIS FIRST
 * -------------------------------------------------------------------------
 * Automating submissions to LeetCode may violate their Terms of Service.
 * This file is a SCAFFOLD. It is:
 *   - isolated in lib/playwright so it can be deleted without touching the app,
 *   - inert unless `AUTOMATION_ALLOW_PLAYWRIGHT=true` AND the optional
 *     `playwright` package is installed (it is NOT a project dependency),
 *   - only ever operates on the user's OWN, self-provided browser session.
 *
 * `playwright` is imported dynamically so the default build and the safe
 * reminder engine never depend on it.
 * -------------------------------------------------------------------------
 */

/** Loads playwright lazily; throws a friendly error if it isn't installed. */
async function loadPlaywright() {
  try {
    // Dynamic package name so Next/Turbopack does not hard-fail when the
    // optional dependency is absent from package.json.
    const pkg = 'play' + 'wright';
    const mod = await import(/* webpackIgnore: true */ pkg);
    return mod.chromium;
  } catch {
    throw new Error(
      'The optional "playwright" package is not installed. Run `npm i -D playwright` ' +
        'and `npx playwright install chromium` to enable the (ToS-risky) browser engine.'
    );
  }
}

/**
 * Restores a session, opens the problem, pastes the solution and submits it,
 * then reads the verdict. Returns a normalised result object.
 *
 * @param {Object} args
 * @param {Object} args.storageState  Playwright storageState captured by the user.
 * @param {string} args.problemUrl
 * @param {string} args.sourceCode
 * @param {string} args.language
 * @param {number} [args.timeoutMs]
 * @returns {Promise<{ ok: boolean, verdict: string, browserVersion: string, screenshot?: string }>}
 */
export async function submitSolution({
  storageState,
  problemUrl,
  sourceCode,
  language,
  timeoutMs = 90_000,
}) {
  const chromium = await loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  const browserVersion = browser.version();

  const context = await browser.newContext({ storageState });
  const page = await context.newPage();

  try {
    if (!problemUrl) throw new Error('Solution has no problem URL to open.');
    await page.goto(problemUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

    // Detect an expired/invalid session early.
    if (/\/accounts\/login/.test(page.url())) {
      return { ok: false, verdict: 'SESSION_EXPIRED', browserVersion };
    }

    // NOTE: LeetCode's editor is a Monaco instance and its DOM changes often.
    // These selectors are intentionally conservative and may need updates.
    await page.waitForSelector('.monaco-editor', { timeout: timeoutMs });
    await page.click('.monaco-editor');
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifier}+A`);
    await page.keyboard.press('Delete');
    await page.keyboard.insertText(sourceCode);

    await page.getByRole('button', { name: /submit/i }).click();

    // Poll the result panel for a verdict.
    const verdict = await page
      .waitForSelector('[data-e2e-locator="submission-result"]', { timeout: timeoutMs })
      .then((el) => el.textContent())
      .catch(() => null);

    const accepted = !!verdict && /accepted/i.test(verdict);
    return {
      ok: accepted,
      verdict: verdict ? verdict.trim() : 'UNKNOWN',
      browserVersion,
    };
  } catch (err) {
    let screenshot;
    try {
      const buf = await page.screenshot();
      screenshot = `data:image/png;base64,${buf.toString('base64')}`;
    } catch {
      /* screenshot is best-effort */
    }
    return {
      ok: false,
      verdict: err?.message || 'RUNTIME_ERROR',
      browserVersion,
      screenshot,
    };
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

/** Language ids kept for parity with LeetCode's selector; used by callers. */
export const LEETCODE_LANG_ALIASES = {
  python: 'python3',
  js: 'javascript',
};
