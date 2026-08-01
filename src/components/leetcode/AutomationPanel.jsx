'use client';

import { useState } from 'react';
import { toast } from 'react-toastify';
import { AUTOMATION_PAGES } from '@/features/leetcode-automation/constants';
import { useAutomation } from '@/features/leetcode-automation/hooks/useAutomation.js';
import { AutomationDashboard } from './AutomationDashboard.jsx';
import { AutomationSettings } from './AutomationSettings.jsx';
import { FlameIcon } from './ui.jsx';
import { SchedulerPanel } from './SchedulerPanel.jsx';
import { SolutionsLibrary } from './SolutionsLibrary.jsx';
import { SubmissionLogs } from './SubmissionLogs.jsx';

/**
 * Top-level shell for the LeetCode Streak Automation feature.
 * Mounted as a tab inside TrackerApp — keeps the module visually and logically
 * isolated from the sheet / revise / chat surfaces.
 */
export function AutomationPanel() {
  const [page, setPage] = useState('dashboard');
  const { dashboard, loading, error, acting, reload, act, runNow } = useAutomation();

  async function handleAct(action) {
    try {
      await act(action);
      toast.success(
        action === 'enable'
          ? 'Automation enabled'
          : action === 'disable'
            ? 'Automation disabled'
            : action === 'pause'
              ? 'Paused'
              : 'Resumed'
      );
    } catch (err) {
      toast.error(err.message || 'Action failed');
      reload();
    }
  }

  async function handleRunNow() {
    try {
      const data = await runNow();
      const result = data?.log?.result;
      if (result === 'success' || result === 'reminder') {
        toast.success(result === 'reminder' ? 'Reminder sent' : 'Run succeeded');
      } else if (result === 'skipped') {
        toast.info(data?.log?.failureReason || 'Run skipped');
      } else {
        toast.error(data?.log?.failureReason || 'Run failed');
      }
    } catch (err) {
      toast.error(err.message || 'Run failed');
      reload();
    }
  }

  return (
    <section className="animate-rise">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="m-0 flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
            <FlameIcon className="h-3.5 w-3.5" />
            LeetCode Automation
          </p>
          <h1 className="m-0 mt-1 text-2xl font-bold tracking-tight md:text-3xl">Streak automation</h1>
          <p className="mb-0 mt-1.5 max-w-2xl text-sm text-[var(--muted)] md:text-base">
            Schedule daily reminders — or opt into browser submissions of solutions you already
            saved. Isolated module; safe default is reminder-only.
          </p>
        </div>
      </div>

      <nav
        className="mb-5 flex flex-wrap gap-1 rounded-[12px] bg-[#e8f0ec] p-1 dark:bg-white/10"
        aria-label="Automation pages"
      >
        {AUTOMATION_PAGES.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPage(p.id)}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${
              page === p.id
                ? 'bg-white text-[var(--ink)] shadow-sm dark:bg-white/20 dark:text-white'
                : 'text-[var(--muted)] hover:text-[var(--ink)] dark:hover:text-white'
            }`}
          >
            {p.label}
          </button>
        ))}
      </nav>

      {error && page === 'dashboard' && (
        <p className="mb-4 rounded-[12px] border border-[var(--danger)] bg-[#fdeceb] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      {page === 'dashboard' && (
        <AutomationDashboard
          dashboard={dashboard}
          loading={loading}
          acting={acting}
          onRunNow={handleRunNow}
          onAct={handleAct}
          onGoto={setPage}
        />
      )}
      {page === 'solutions' && <SolutionsLibrary />}
      {page === 'scheduler' && <SchedulerPanel onChanged={reload} />}
      {page === 'logs' && <SubmissionLogs />}
      {page === 'settings' && <AutomationSettings onChanged={reload} />}
    </section>
  );
}
