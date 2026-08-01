'use client';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ResultBadge,
  Skeleton,
  StatCard,
  formatDate,
  formatDuration,
} from './ui.jsx';
import { ToSWarning } from './ToSWarning.jsx';

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-20 w-full" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-56 w-full" />
    </div>
  );
}

export function AutomationDashboard({ dashboard, loading, acting, onRunNow, onAct, onGoto }) {
  if (loading && !dashboard) return <DashboardSkeleton />;
  if (!dashboard) return <EmptyState title="Nothing here yet" body="Automation data failed to load." />;

  const {
    status,
    settings,
    session,
    today,
    nextRun,
    currentStreak,
    totalRuns,
    successfulRuns,
    failedRuns,
    successRate,
    latestSubmission,
    recentActivity,
  } = dashboard;

  return (
    <div className="space-y-4">
      <ToSWarning />

      <Card className="animate-rise">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="m-0 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
              Automation status
            </p>
            <div className="mt-1 flex items-center gap-2">
              <h2 className="m-0 text-xl font-bold tracking-tight dark:text-white">{status.label}</h2>
              <Badge tone={status.tone}>{settings.engine === 'reminder' ? 'reminder-only' : 'browser'}</Badge>
            </div>
            <p className="mt-1 mb-0 text-sm text-[var(--muted)]">
              Session: <strong className="text-[var(--ink)] dark:text-white/90">{session.status}</strong>
              {session.lastConnectedAt && ` · connected ${formatDate(session.lastConnectedAt)}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onRunNow} disabled={acting}>
              {acting ? 'Running…' : 'Run now'}
            </Button>
            {settings.enabled ? (
              settings.paused ? (
                <Button variant="subtle" onClick={() => onAct('resume')} disabled={acting}>
                  Resume
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => onAct('pause')} disabled={acting}>
                  Pause
                </Button>
              )
            ) : (
              <Button variant="subtle" onClick={() => onAct('enable')} disabled={acting}>
                Enable
              </Button>
            )}
          </div>
        </div>
      </Card>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard tone="accent" label="Current streak" value={currentStreak} hint="days" />
        <StatCard label="Successful runs" value={successfulRuns} hint={`of ${totalRuns} total`} />
        <StatCard label="Failed runs" value={failedRuns} hint="all time" />
        <StatCard label="Success rate" value={`${successRate}%`} hint="of attempts" />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <p className="m-0 text-sm font-bold text-[var(--ink)] dark:text-white">Today&apos;s run</p>
          {today ? (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--muted)]">Result</span>
                <ResultBadge value={today.result} />
              </div>
              <Row label="Problem" value={today.problemName || '—'} />
              <Row label="Ran at" value={formatDate(today.createdAt)} />
              <Row label="Duration" value={formatDuration(today.executionMs)} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">No run yet today.</p>
          )}
          <div className="mt-4 border-t border-[var(--line)] pt-3 dark:border-white/10">
            <Row label="Next run" value={nextRun ? formatDate(nextRun) : 'Not scheduled'} />
          </div>
        </Card>

        <Card>
          <p className="m-0 text-sm font-bold text-[var(--ink)] dark:text-white">Latest submission</p>
          {latestSubmission ? (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--muted)]">Result</span>
                <ResultBadge value={latestSubmission.result} />
              </div>
              <Row label="Problem" value={latestSubmission.problemName || '—'} />
              <Row label="Engine" value={latestSubmission.engine} />
              <Row label="When" value={formatDate(latestSubmission.createdAt)} />
              {latestSubmission.failureReason && (
                <p className="mt-1 rounded-lg bg-[#fdeceb] px-3 py-2 text-xs text-[var(--danger)]">
                  {latestSubmission.failureReason}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">No submissions logged yet.</p>
          )}
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <p className="m-0 text-sm font-bold text-[var(--ink)] dark:text-white">Recent activity</p>
          <button
            type="button"
            className="text-xs font-semibold text-[var(--accent)]"
            onClick={() => onGoto?.('logs')}
          >
            View all logs →
          </button>
        </div>
        {recentActivity?.length ? (
          <ul className="mt-3 divide-y divide-[var(--line)] dark:divide-white/10">
            {recentActivity.map((log) => (
              <li key={log.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="m-0 truncate text-sm font-semibold text-[var(--ink)] dark:text-white">
                    {log.problemName || 'Run'}
                  </p>
                  <p className="m-0 font-mono text-xs text-[var(--muted)]">{formatDate(log.createdAt)}</p>
                </div>
                <ResultBadge value={log.result} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-[var(--muted)]">No activity yet. Try “Run now”.</p>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <span className="truncate text-sm font-semibold text-[var(--ink)] dark:text-white">{value}</span>
    </div>
  );
}
