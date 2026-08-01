'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { ROTATIONS } from '@/features/leetcode-automation/constants';
import { api, qs } from '@/features/leetcode-automation/hooks/apiClient.js';
import {
  Button,
  Card,
  Field,
  Input,
  Select,
  Skeleton,
  ToggleRow,
  formatDate,
} from './ui.jsx';
import { ToSWarning } from './ToSWarning.jsx';

const COMMON_TZ = [
  'UTC',
  'Asia/Kolkata',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Europe/London',
  'Europe/Paris',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

export function SchedulerPanel({ onChanged }) {
  const [settings, setSettings] = useState(null);
  const [solutions, setSolutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sched, sols] = await Promise.all([
        api('/api/scheduler'),
        api(`/api/solutions${qs({ pageSize: 100 })}`),
      ]);
      setSettings(sched.settings);
      setDraft(sched.settings);
      setSolutions(sols.items || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load scheduler');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(patch) {
    setSaving(true);
    const next = { ...draft, ...patch };
    setDraft(next);
    try {
      const data = await api('/api/scheduler', {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
      setSettings(data.settings);
      setDraft(data.settings);
      onChanged?.();
      toast.success('Schedule saved');
    } catch (err) {
      setDraft(settings);
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !draft) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ToSWarning />

      <Card>
        <h2 className="m-0 text-xl font-bold tracking-tight dark:text-white">Scheduler</h2>
        <p className="mt-1 mb-0 text-sm text-[var(--muted)]">
          Pick when to run, how problems rotate, and whether failed jobs retry.
          {settings?.nextRunAt && (
            <>
              {' '}
              Next run: <strong className="text-[var(--ink)] dark:text-white">{formatDate(settings.nextRunAt)}</strong>
            </>
          )}
        </p>

        <div className="mt-4 space-y-2">
          <ToggleRow
            label="Automation enabled"
            hint="Master switch. Off = no runs at all."
            checked={!!draft.enabled}
            disabled={saving}
            onChange={(enabled) => save({ enabled })}
          />
          <ToggleRow
            label="Paused"
            hint="Keeps config but skips runs until resumed."
            checked={!!draft.paused}
            disabled={saving || !draft.enabled}
            onChange={(paused) => save({ paused })}
          />
          <ToggleRow
            label="Retry failed jobs"
            hint={`Up to ${draft.maxRetries} extra attempt(s) on failure.`}
            checked={!!draft.retryFailed}
            disabled={saving}
            onChange={(retryFailed) => save({ retryFailed })}
          />
        </div>
      </Card>

      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Submission time" hint="24-hour local time (HH:mm)">
            <Input
              type="time"
              value={draft.submissionTime || '09:00'}
              onChange={(e) => setDraft((d) => ({ ...d, submissionTime: e.target.value }))}
            />
          </Field>
          <Field label="Timezone" hint="IANA timezone used for the schedule">
            <Select
              value={draft.timezone || 'UTC'}
              onChange={(e) => setDraft((d) => ({ ...d, timezone: e.target.value }))}
            >
              {[draft.timezone, ...COMMON_TZ].filter((v, i, a) => v && a.indexOf(v) === i).map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Max retries" hint="0–10 extra attempts when retry is on">
            <Input
              type="number"
              min={0}
              max={10}
              value={draft.maxRetries ?? 2}
              onChange={(e) =>
                setDraft((d) => ({ ...d, maxRetries: Number(e.target.value) }))
              }
            />
          </Field>
          <Field label="Problem rotation">
            <Select
              value={draft.rotation || 'sequential'}
              onChange={(e) => setDraft((d) => ({ ...d, rotation: e.target.value }))}
            >
              {ROTATIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
          {draft.rotation === 'specific' && (
            <Field label="Specific problem" hint="Required when rotation is specific">
              <Select
                value={draft.specificSolutionId || ''}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, specificSolutionId: e.target.value || null }))
                }
              >
                <option value="">Select a solution…</option>
                {solutions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.problemName}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            disabled={saving}
            onClick={() =>
              save({
                submissionTime: draft.submissionTime,
                timezone: draft.timezone,
                maxRetries: draft.maxRetries,
                rotation: draft.rotation,
                specificSolutionId: draft.specificSolutionId,
              })
            }
          >
            {saving ? 'Saving…' : 'Save schedule'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
