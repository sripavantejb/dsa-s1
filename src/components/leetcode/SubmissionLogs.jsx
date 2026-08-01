'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { RESULTS } from '@/features/leetcode-automation/constants';
import { api, qs } from '@/features/leetcode-automation/hooks/apiClient.js';
import {
  Button,
  Card,
  EmptyState,
  Field,
  ResultBadge,
  Select,
  Skeleton,
  formatDate,
  formatDuration,
} from './ui.jsx';

export function SubmissionLogs() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api(`/api/logs${qs({ page, pageSize: 15, result })}`);
      setItems(data.items || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (err) {
      toast.error(err.message || 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  }, [page, result]);

  useEffect(() => {
    load();
  }, [load]);

  async function clearAll() {
    if (!window.confirm('Clear all submission logs? This cannot be undone.')) return;
    setBusy(true);
    try {
      await api('/api/logs', { method: 'DELETE' });
      toast.success('Logs cleared');
      setPage(1);
      await load();
    } catch (err) {
      toast.error(err.message || 'Clear failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="m-0 text-xl font-bold tracking-tight dark:text-white">Submission logs</h2>
            <p className="mt-1 mb-0 text-sm text-[var(--muted)]">
              Every run — success, failure, reminder, or skipped — is recorded here.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Result">
              <Select
                value={result}
                onChange={(e) => {
                  setPage(1);
                  setResult(e.target.value);
                }}
              >
                <option value="all">All</option>
                {RESULTS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </Field>
            <Button variant="danger" onClick={clearAll} disabled={busy || total === 0}>
              Clear all
            </Button>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="No logs yet" body="Trigger a run from the dashboard to see activity here." />
      ) : (
        <ul className="m-0 space-y-3 p-0">
          {items.map((log) => (
            <li key={log.id}>
              <Card className="!p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="m-0 truncate text-base font-bold dark:text-white">
                        {log.problemName || 'Untitled run'}
                      </h3>
                      <ResultBadge value={log.result} />
                    </div>
                    <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                      <Row label="Start" value={formatDate(log.startTime)} />
                      <Row label="End" value={formatDate(log.endTime)} />
                      <Row label="Duration" value={formatDuration(log.executionMs)} />
                      <Row label="Engine" value={log.engine} />
                      <Row label="Trigger" value={log.trigger} />
                      <Row label="Retries" value={String(log.retryCount ?? 0)} />
                      {log.browserVersion && <Row label="Browser" value={log.browserVersion} />}
                    </dl>
                    {log.failureReason && (
                      <p className="mt-3 mb-0 rounded-lg bg-[#fdeceb] px-3 py-2 text-xs text-[var(--danger)]">
                        {log.failureReason}
                      </p>
                    )}
                    {log.screenshot && (
                      <a
                        href={log.screenshot}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-xs font-semibold text-[var(--accent)]"
                      >
                        View screenshot →
                      </a>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <p className="m-0 text-sm text-[var(--muted)]">
            {total} log{total === 1 ? '' : 's'} · page {page}/{pages}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3 sm:block">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="m-0 font-semibold text-[var(--ink)] dark:text-white/90">{value}</dd>
    </div>
  );
}
