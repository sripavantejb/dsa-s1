'use client';

import { useEffect, useMemo, useState } from 'react';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function badgeClass(tone) {
  if (tone === 'danger') return 'bg-[#fee4e2] text-[#b42318]';
  if (tone === 'warn') return 'bg-[#fef3c7] text-[#b54708]';
  if (tone === 'ok') return 'bg-[#d8f3e6] text-[var(--easy)]';
  if (tone === 'info') return 'bg-[#e0f2fe] text-[#0369a1]';
  return 'bg-[#eef0f2] text-[#667085]';
}

function toDateInput(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function RevisionCard({ item, busyId, onRevise, onReset, onSchedule, onOpen }) {
  const busy = busyId === item.id;
  const [scheduleDate, setScheduleDate] = useState(() => toDateInput(item.nextRevisionAt));

  useEffect(() => {
    setScheduleDate(toDateInput(item.nextRevisionAt));
  }, [item.nextRevisionAt]);

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[#fbfdfc] px-3.5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[0.98rem] font-semibold text-[var(--ink)]">{item.title}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {item.topic && (
              <span className="rounded-md bg-[#e8f0ec] px-1.5 py-0.5 font-mono text-[0.68rem] uppercase text-[var(--muted)]">
                {item.topic}
              </span>
            )}
            <span className="rounded-md bg-[#eef0f2] px-1.5 py-0.5 font-mono text-[0.68rem] uppercase text-[#667085]">
              {item.difficulty}
            </span>
            {item.source === 'manual' && (
              <span className="rounded-md bg-[#f3e8ff] px-1.5 py-0.5 font-mono text-[0.68rem] uppercase text-[#7c3aed]">
                External
              </span>
            )}
            {item.badge && (
              <span className={`rounded-md px-1.5 py-0.5 font-mono text-[0.68rem] font-semibold ${badgeClass(item.badge.tone)}`}>
                {item.badge.label}
              </span>
            )}
          </div>
          <p className="mt-1.5 mb-0 font-mono text-xs text-[var(--muted)]">
            Solved {formatDate(item.solvedAt)} · Week {item.stage} · Next {formatDate(item.nextRevisionAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(item.link || item.qid) && (
            <button
              type="button"
              onClick={() => onOpen(item)}
              className="rounded-[10px] border border-[var(--line)] bg-white px-2.5 py-1.5 text-xs font-semibold text-[var(--accent)]"
            >
              Open
            </button>
          )}
          {item.trackingActive && (item.status === 'due_today' || item.status === 'overdue' || item.status === 'upcoming') && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onRevise(item.id)}
              className="rounded-[10px] border border-transparent bg-[var(--accent)] px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              Mark revised
            </button>
          )}
          <label className="flex items-center gap-1 rounded-[10px] border border-[var(--line)] bg-white px-2 py-1 text-xs font-semibold text-[var(--muted)]">
            Schedule
            <input
              type="date"
              value={scheduleDate}
              disabled={busy}
              onChange={(event) => setScheduleDate(event.target.value)}
              className="bg-transparent text-xs text-[var(--ink)] outline-none"
            />
          </label>
          <button
            type="button"
            disabled={busy || !scheduleDate || scheduleDate === toDateInput(item.nextRevisionAt)}
            onClick={() => onSchedule(item.id, scheduleDate)}
            className="rounded-[10px] border border-[var(--accent)] bg-white px-2.5 py-1.5 text-xs font-semibold text-[var(--accent)] disabled:border-[var(--line)] disabled:text-[var(--muted)] disabled:opacity-50"
          >
            Save date
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm('Reset revision schedule? History of completed weeks will be cleared.')) {
                onReset(item.id);
              }
            }}
            className="rounded-[10px] border border-[var(--line)] bg-white px-2.5 py-1.5 text-xs font-semibold text-[var(--muted)]"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

export function RevisionPanel({
  revision,
  loading,
  busyId,
  onRefresh,
  onRevise,
  onReset,
  onSchedule,
  onEnableTracking,
  onAddManual,
  onOpenItem,
  questionsByQid,
}) {
  const [showMigrate, setShowMigrate] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [defaultDate, setDefaultDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({
    title: '',
    platform: 'LeetCode',
    link: '',
    topic: '',
    difficulty: 'UNRATED',
    notes: '',
    dateSolved: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);

  const untracked = revision?.untracked?.questions || [];
  const today = revision?.today;
  const week = revision?.week;

  const queues = useMemo(() => {
    const q = revision?.queues || {};
    return {
      due: [...(q.overdue || []), ...(q.dueToday || [])],
      upcoming: q.upcoming || [],
      paused: q.paused || [],
    };
  }, [revision]);

  function toggleSelect(qid) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(qid)) next.delete(qid);
      else next.add(qid);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(untracked.map((q) => q.qid)));
  }

  async function enableSelected() {
    setSaving(true);
    try {
      const items = untracked
        .filter((q) => selected.has(q.qid))
        .map((q) => ({
          qid: q.qid,
          startDate: q.guessedSolvedAt || defaultDate,
        }));
      await onEnableTracking({ items, defaultStartDate: defaultDate });
      setSelected(new Set());
      setShowMigrate(false);
    } finally {
      setSaving(false);
    }
  }

  async function enableAll() {
    setSaving(true);
    try {
      await onEnableTracking({ enableAll: true, defaultStartDate: defaultDate });
      setSelected(new Set());
      setShowMigrate(false);
    } finally {
      setSaving(false);
    }
  }

  async function submitManual(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await onAddManual(manual);
      setManual({
        title: '',
        platform: 'LeetCode',
        link: '',
        topic: '',
        difficulty: 'UNRATED',
        notes: '',
        dateSolved: new Date().toISOString().slice(0, 10),
      });
      setShowManual(false);
    } finally {
      setSaving(false);
    }
  }

  if (loading && !revision) {
    return <p className="py-10 text-center text-[var(--muted)]">Loading revision tracker…</p>;
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-[18px] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-2xl font-bold tracking-tight">Revision Tracker</h2>
            <p className="mb-0 mt-1.5 text-sm text-[var(--muted)]">
              Solved Problem Set questions are tracked automatically. Revise weekly — mark revised to schedule the next week.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-[10px] border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-[var(--muted)]"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowManual((v) => !v)}
              className="rounded-[10px] border border-transparent bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
            >
              Add external
            </button>
          </div>
        </div>

        {today && (
          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            <article className="rounded-[14px] border border-[var(--line)] bg-[#fbfdfc] p-3">
              <p className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.05em] text-[var(--muted)]">Solved today</p>
              <p className="mt-1 mb-0 text-2xl font-bold tabular-nums">{today.problemsSolved}</p>
            </article>
            <article className="rounded-[14px] border border-[var(--line)] bg-[#fbfdfc] p-3">
              <p className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.05em] text-[var(--muted)]">Added to revision</p>
              <p className="mt-1 mb-0 text-2xl font-bold tabular-nums">{today.addedToRevision}</p>
            </article>
            <article className="rounded-[14px] border border-[var(--line)] bg-[#fbfdfc] p-3">
              <p className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.05em] text-[var(--muted)]">Revisions due</p>
              <p className="mt-1 mb-0 text-2xl font-bold tabular-nums">{today.revisionsDue}</p>
            </article>
            <article className="rounded-[14px] border border-[var(--line)] bg-[#fbfdfc] p-3">
              <p className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.05em] text-[var(--muted)]">Revised today</p>
              <p className="mt-1 mb-0 text-2xl font-bold tabular-nums">{today.revisionsCompleted}</p>
            </article>
          </div>
        )}

        {week && (
          <div className="mt-3 rounded-[14px] border border-[var(--line)] bg-[#f1faf5] px-3.5 py-3">
            <p className="m-0 text-sm font-bold text-[var(--ink)]">This week</p>
            <p className="mt-1 mb-0 text-sm text-[var(--muted)]">
              Solved <strong className="text-[var(--ink)]">{week.problemsSolved}</strong>
              {' · '}Added to revision <strong className="text-[var(--ink)]">{week.addedToRevision}</strong>
              {' · '}Due <strong className="text-[var(--ink)]">{week.revisionsDue}</strong>
              {' · '}Completed <strong className="text-[var(--ink)]">{week.revisionsCompleted}</strong>
              {' · '}
              <strong className="text-[var(--accent)]">{week.revisionCompletion}%</strong> completion
            </p>
          </div>
        )}
      </section>

      {revision?.untracked?.count > 0 && (
        <section className="rounded-[18px] border border-[#f6d9a8] bg-[#fffbeb] p-4 shadow-[var(--shadow)]">
          <p className="m-0 text-sm font-bold text-[var(--ink)]">Track existing solved problems</p>
          <p className="mt-1 mb-0 text-sm text-[var(--muted)]">
            You have <strong className="text-[var(--ink)]">{revision.untracked.count}</strong> solved questions that are not
            currently tracked for revision.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setShowMigrate(true);
                selectAll();
              }}
              className="rounded-[10px] border border-transparent bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
            >
              Review questions
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={enableAll}
              className="rounded-[10px] border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-[var(--ink)] disabled:opacity-50"
            >
              Enable all
            </button>
          </div>

          {showMigrate && (
            <div className="mt-4 border-t border-[#f6d9a8] pt-3">
              <div className="mb-3 flex flex-wrap items-end gap-3">
                <label className="text-xs font-semibold text-[var(--muted)]">
                  Default start date (if unknown)
                  <input
                    type="date"
                    value={defaultDate}
                    onChange={(e) => setDefaultDate(e.target.value)}
                    className="mt-1 block rounded-[10px] border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)]"
                  />
                </label>
                <button type="button" onClick={selectAll} className="text-xs font-semibold text-[var(--accent)]">
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="text-xs font-semibold text-[var(--muted)]"
                >
                  Clear
                </button>
              </div>
              <div className="max-h-[320px] space-y-2 overflow-y-auto">
                {untracked.map((q) => (
                  <label
                    key={q.qid}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(q.qid)}
                      onChange={() => toggleSelect(q.qid)}
                      className="mt-1"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{q.title}</span>
                      <span className="mt-0.5 block font-mono text-[0.68rem] text-[var(--muted)]">
                        {q.topic} · {q.difficulty}
                        {q.guessedSolvedAt
                          ? ` · solved ~ ${formatDate(q.guessedSolvedAt)}`
                          : ' · no solved date — will use default'}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                disabled={saving || selected.size === 0}
                onClick={enableSelected}
                className="mt-3 rounded-[10px] border border-transparent bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Enable revision tracking ({selected.size})
              </button>
            </div>
          )}
        </section>
      )}

      {showManual && (
        <section className="rounded-[18px] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow)]">
          <h3 className="m-0 text-lg font-bold">Add external problem</h3>
          <p className="mt-1 mb-3 text-sm text-[var(--muted)]">
            For questions outside this Problem Set (e.g. LeetCode). Same weekly revision schedule.
          </p>
          <form onSubmit={submitManual} className="grid gap-2.5 sm:grid-cols-2">
            <input
              required
              value={manual.title}
              onChange={(e) => setManual((m) => ({ ...m, title: e.target.value }))}
              placeholder="Problem name"
              className="rounded-[10px] border border-[var(--line)] bg-[#fbfdfc] px-3 py-2.5 sm:col-span-2"
            />
            <input
              value={manual.platform}
              onChange={(e) => setManual((m) => ({ ...m, platform: e.target.value }))}
              placeholder="Platform"
              className="rounded-[10px] border border-[var(--line)] bg-[#fbfdfc] px-3 py-2.5"
            />
            <input
              value={manual.link}
              onChange={(e) => setManual((m) => ({ ...m, link: e.target.value }))}
              placeholder="Problem link"
              className="rounded-[10px] border border-[var(--line)] bg-[#fbfdfc] px-3 py-2.5"
            />
            <input
              value={manual.topic}
              onChange={(e) => setManual((m) => ({ ...m, topic: e.target.value }))}
              placeholder="Topic"
              className="rounded-[10px] border border-[var(--line)] bg-[#fbfdfc] px-3 py-2.5"
            />
            <select
              value={manual.difficulty}
              onChange={(e) => setManual((m) => ({ ...m, difficulty: e.target.value }))}
              className="rounded-[10px] border border-[var(--line)] bg-[#fbfdfc] px-3 py-2.5"
            >
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
              <option value="UNRATED">Unrated</option>
            </select>
            <input
              type="date"
              required
              value={manual.dateSolved}
              onChange={(e) => setManual((m) => ({ ...m, dateSolved: e.target.value }))}
              className="rounded-[10px] border border-[var(--line)] bg-[#fbfdfc] px-3 py-2.5"
            />
            <textarea
              value={manual.notes}
              onChange={(e) => setManual((m) => ({ ...m, notes: e.target.value }))}
              placeholder="Notes (optional)"
              rows={2}
              className="rounded-[10px] border border-[var(--line)] bg-[#fbfdfc] px-3 py-2.5 sm:col-span-2"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-[10px] border border-transparent bg-[var(--accent)] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2"
            >
              Track for revision
            </button>
          </form>
        </section>
      )}

      {today && (today.solved?.length > 0 || today.revised?.length > 0 || today.pendingRevision?.length > 0) && (
        <section className="rounded-[18px] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow)]">
          <h3 className="m-0 text-lg font-bold">Today&apos;s activity</h3>
          <p className="mt-1 mb-3 text-sm text-[var(--muted)]">{formatDate(today.date)}</p>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--muted)]">Solved</p>
              <ul className="mt-2 mb-0 list-disc space-y-1 pl-4 text-sm">
                {(today.solved || []).length === 0 && <li className="text-[var(--muted)]">None yet</li>}
                {(today.solved || []).map((q) => (
                  <li key={q.qid}>{q.title}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--muted)]">Revised</p>
              <ul className="mt-2 mb-0 list-disc space-y-1 pl-4 text-sm">
                {(today.revised || []).length === 0 && <li className="text-[var(--muted)]">None yet</li>}
                {(today.revised || []).map((q) => (
                  <li key={q.id}>{q.title}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--muted)]">Pending revision</p>
              <ul className="mt-2 mb-0 list-disc space-y-1 pl-4 text-sm">
                {(today.pendingRevision || []).length === 0 && <li className="text-[var(--muted)]">None due</li>}
                {(today.pendingRevision || []).map((q) => (
                  <li key={q.id}>
                    {q.title}{' '}
                    <span className="font-mono text-[0.68rem] text-[var(--muted)]">W{q.stage}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-[18px] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow)]">
        <h3 className="m-0 text-lg font-bold">Due now</h3>
        <p className="mt-1 mb-3 text-sm text-[var(--muted)]">Overdue and due today</p>
        <div className="grid gap-2">
          {queues.due.length === 0 && <p className="py-6 text-center text-sm text-[var(--muted)]">Nothing due — nice work.</p>}
          {queues.due.map((item) => (
            <RevisionCard
              key={item.id}
              item={item}
              busyId={busyId}
              onRevise={onRevise}
              onReset={onReset}
              onSchedule={onSchedule}
              onOpen={onOpenItem}
            />
          ))}
        </div>
      </section>

      <section className="rounded-[18px] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow)]">
        <h3 className="m-0 text-lg font-bold">Upcoming</h3>
        <p className="mt-1 mb-3 text-sm text-[var(--muted)]">
          {queues.upcoming.length} scheduled · including new solves this week
        </p>
        <div className="grid gap-2">
          {queues.upcoming.length === 0 && (
            <p className="py-6 text-center text-sm text-[var(--muted)]">
              Mark questions solved on the Sheet — they appear here automatically.
            </p>
          )}
          {queues.upcoming.map((item) => (
            <RevisionCard
              key={item.id}
              item={item}
              busyId={busyId}
              onRevise={onRevise}
              onReset={onReset}
              onSchedule={onSchedule}
              onOpen={onOpenItem}
            />
          ))}
        </div>
      </section>

      {/* silence unused prop lint if questionsByQid unused — keep for future deep links */}
      {questionsByQid ? null : null}
    </div>
  );
}

export function revisionBadgeToneClass(tone) {
  return badgeClass(tone);
}
