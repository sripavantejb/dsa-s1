'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import {
  ENGINES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENTS,
  SESSION_STATUS,
} from '@/features/leetcode-automation/constants';
import { api } from '@/features/leetcode-automation/hooks/apiClient.js';
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Select,
  Skeleton,
  Textarea,
  ToggleRow,
  formatDate,
} from './ui.jsx';
import { ToSWarning } from './ToSWarning.jsx';

const CHANNEL_HINTS = {
  email: 'Destination email address (requires RESEND_API_KEY)',
  discord: 'Discord webhook URL',
  telegram: 'botToken:chat:chatId  or  botToken|chatId',
  slack: 'Slack incoming webhook URL',
  webhook: 'Any HTTPS endpoint that accepts JSON { title, body }',
};

const EVENT_LABELS = {
  success: 'Success / reminder sent',
  failure: 'Run failed',
  sessionExpired: 'Session expired',
  automationDisabled: 'Automation disabled',
};

export function AutomationSettings({ onChanged }) {
  const [settings, setSettings] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storageStateText, setStorageStateText] = useState('');
  const [accountHint, setAccountHint] = useState('');
  const [draft, setDraft] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sched, sess] = await Promise.all([api('/api/scheduler'), api('/api/session')]);
      setSettings(sched.settings);
      setDraft(sched.settings);
      setSession(sess.session);
      setAccountHint(sess.session?.accountHint || '');
    } catch (err) {
      toast.error(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveSettings(patch) {
    setSaving(true);
    try {
      const data = await api('/api/scheduler', {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
      setSettings(data.settings);
      setDraft(data.settings);
      onChanged?.();
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err.message || 'Save failed');
      setDraft(settings);
    } finally {
      setSaving(false);
    }
  }

  async function connect() {
    setSaving(true);
    try {
      const data = await api('/api/session', {
        method: 'POST',
        body: JSON.stringify({
          storageState: storageStateText,
          accountHint: accountHint.trim(),
        }),
      });
      setSession(data.session);
      setStorageStateText('');
      onChanged?.();
      toast.success('Session connected');
    } catch (err) {
      toast.error(err.message || 'Connect failed');
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    if (!window.confirm('Disconnect and wipe the encrypted session?')) return;
    setSaving(true);
    try {
      const data = await api('/api/session', { method: 'DELETE' });
      setSession(data.session);
      onChanged?.();
      toast.success('Session disconnected');
    } catch (err) {
      toast.error(err.message || 'Disconnect failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !draft) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const statusTone =
    session?.status === SESSION_STATUS.CONNECTED
      ? 'ok'
      : session?.status === SESSION_STATUS.EXPIRED
        ? 'warn'
        : 'muted';

  return (
    <div className="space-y-4">
      <ToSWarning />

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-xl font-bold tracking-tight dark:text-white">Connect account</h2>
            <p className="mt-1 mb-0 text-sm text-[var(--muted)]">
              Paste a Playwright <code className="font-mono text-xs">storageState</code> JSON from
              your own browser. Passwords are rejected. Data is encrypted at rest.
            </p>
          </div>
          <Badge tone={statusTone}>{session?.status || 'disconnected'}</Badge>
        </div>

        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--muted)]">Last connected</dt>
            <dd className="m-0 font-semibold dark:text-white">{formatDate(session?.lastConnectedAt)}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Account hint</dt>
            <dd className="m-0 font-semibold dark:text-white">{session?.accountHint || '—'}</dd>
          </div>
        </dl>

        <div className="mt-4 grid gap-3">
          <Field label="Account hint (optional)" hint="Shown in the UI — e.g. your LeetCode username">
            <Input
              value={accountHint}
              onChange={(e) => setAccountHint(e.target.value)}
              placeholder="leetcode-username"
            />
          </Field>
          <Field
            label="Playwright storageState JSON"
            hint="Export via Playwright codegen or browser extension. Never paste passwords."
          >
            <Textarea
              rows={8}
              value={storageStateText}
              onChange={(e) => setStorageStateText(e.target.value)}
              placeholder='{"cookies":[...],"origins":[...]}'
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={connect} disabled={saving || !storageStateText.trim()}>
            {session?.status === SESSION_STATUS.CONNECTED || session?.status === SESSION_STATUS.EXPIRED
              ? 'Reconnect'
              : 'Connect'}
          </Button>
          {(session?.status === SESSION_STATUS.CONNECTED ||
            session?.status === SESSION_STATUS.EXPIRED) && (
            <Button variant="danger" onClick={disconnect} disabled={saving}>
              Disconnect
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="m-0 text-lg font-bold dark:text-white">Engine & streak</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Default engine is reminder-only (safe). Playwright submissions require{' '}
          <code className="font-mono text-xs">AUTOMATION_ALLOW_PLAYWRIGHT=true</code> and the{' '}
          <code className="font-mono text-xs">playwright</code> package.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Execution engine">
            <Select
              value={draft.engine || ENGINES.REMINDER}
              onChange={(e) => setDraft((d) => ({ ...d, engine: e.target.value }))}
            >
              <option value={ENGINES.REMINDER}>Reminder only (recommended)</option>
              <option value={ENGINES.PLAYWRIGHT}>Playwright automation</option>
            </Select>
          </Field>
          <Field label="Manual streak" hint="Shown on the dashboard when live streak isn’t available">
            <Input
              type="number"
              min={0}
              value={draft.manualStreak ?? 0}
              onChange={(e) =>
                setDraft((d) => ({ ...d, manualStreak: Number(e.target.value) }))
              }
            />
          </Field>
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            disabled={saving}
            onClick={() =>
              saveSettings({ engine: draft.engine, manualStreak: draft.manualStreak })
            }
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="m-0 text-lg font-bold dark:text-white">Notifications</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          In-app alerts always fire when an event is enabled. External channels are optional.
        </p>

        <div className="mt-4 space-y-2">
          {NOTIFICATION_EVENTS.map((ev) => (
            <ToggleRow
              key={ev}
              label={EVENT_LABELS[ev] || ev}
              checked={draft.notifications?.events?.[ev] !== false}
              disabled={saving}
              onChange={(checked) => {
                const events = { ...(draft.notifications?.events || {}), [ev]: checked };
                const next = {
                  ...draft,
                  notifications: { ...draft.notifications, events },
                };
                setDraft(next);
                saveSettings({ notifications: { events } });
              }}
            />
          ))}
        </div>

        <div className="mt-6 space-y-4">
          {NOTIFICATION_CHANNELS.map((ch) => {
            const channel = draft.notifications?.[ch] || { enabled: false, target: '' };
            return (
              <div
                key={ch}
                className="rounded-[12px] border border-[var(--line)] bg-[#fbfdfc] p-3 dark:border-white/10 dark:bg-white/5"
              >
                <ToggleRow
                  label={ch.charAt(0).toUpperCase() + ch.slice(1)}
                  hint={CHANNEL_HINTS[ch]}
                  checked={!!channel.enabled}
                  disabled={saving}
                  onChange={(enabled) => {
                    const patch = { [ch]: { enabled, target: channel.target || '' } };
                    setDraft((d) => ({
                      ...d,
                      notifications: { ...d.notifications, [ch]: patch[ch] },
                    }));
                    saveSettings({ notifications: patch });
                  }}
                />
                <Field label="Target">
                  <Input
                    value={channel.target || ''}
                    placeholder={CHANNEL_HINTS[ch]}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        notifications: {
                          ...d.notifications,
                          [ch]: { ...channel, target: e.target.value },
                        },
                      }))
                    }
                    onBlur={() =>
                      saveSettings({
                        notifications: {
                          [ch]: { enabled: !!channel.enabled, target: draft.notifications?.[ch]?.target || '' },
                        },
                      })
                    }
                  />
                </Field>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
