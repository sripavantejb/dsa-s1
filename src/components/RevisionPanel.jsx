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

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromKey(key) {
  const [year, month, day] = String(key).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function eventTone(type) {
  if (type === 'solved') return 'border-[#b7dfca] bg-[#f1faf5] text-[var(--easy)]';
  if (type === 'external') return 'border-[#d8b4fe] bg-[#faf5ff] text-[#7c3aed]';
  if (type === 'revised') return 'border-[#bae6fd] bg-[#f0f9ff] text-[#0369a1]';
  if (type === 'due') return 'border-[#f6d9a8] bg-[#fffbeb] text-[#b54708]';
  return 'border-[#e2e8f0] bg-[#f8fafc] text-[#64748b]';
}

function eventLabel(type) {
  if (type === 'solved') return 'Solved';
  if (type === 'external') return 'External problem';
  if (type === 'revised') return 'Revision completed';
  if (type === 'due') return 'Revision due';
  return 'Marked unsolved';
}

const MS_DAY = 24 * 60 * 60 * 1000;

function solvedCountOn(timeline, key) {
  const events = timeline.byDate?.[key];
  return (events?.solved?.length || 0) + (events?.external?.length || 0);
}

function CalendarTimeline({ revision, busyId, onSchedule, onBulkSchedule, onOpenItem }) {
  const timeline = revision?.timeline || { byDate: {}, dates: [] };
  const items = revision?.items || [];
  const today = dateKey();
  const [selectedDate, setSelectedDate] = useState(today);
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [planItemId, setPlanItemId] = useState('');
  const [rangeMode, setRangeMode] = useState(false);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [weekFrom, setWeekFrom] = useState('');
  const [weekTo, setWeekTo] = useState('');
  const [bulkDate, setBulkDate] = useState(() => dateKey(new Date(Date.now() + 7 * MS_DAY)));
  const [bulkSaving, setBulkSaving] = useState(false);

  // Group solve days into Mon–Sun weeks, numbered from your first solve week
  const solveWeeks = useMemo(() => {
    const dates = (timeline.dates || []).filter((key) => solvedCountOn(timeline, key) > 0);
    if (!dates.length) return [];
    const first = dateFromKey(dates[0]);
    const firstMonday = new Date(first);
    firstMonday.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    firstMonday.setHours(0, 0, 0, 0);
    const weeks = new Map();
    for (const key of dates) {
      const idx = Math.floor((dateFromKey(key) - firstMonday) / (7 * MS_DAY));
      const count = solvedCountOn(timeline, key);
      const existing = weeks.get(idx);
      if (existing) {
        existing.count += count;
      } else {
        const start = new Date(firstMonday);
        start.setDate(firstMonday.getDate() + idx * 7);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        weeks.set(idx, { num: idx + 1, startKey: dateKey(start), endKey: dateKey(end), count });
      }
    }
    return [...weeks.values()].sort((a, b) => a.num - b.num);
  }, [timeline]);

  const rangeCount = useMemo(() => {
    if (!rangeStart) return 0;
    const end = rangeEnd || rangeStart;
    let count = 0;
    for (const key of timeline.dates || []) {
      if (key < rangeStart || key > end) continue;
      count += solvedCountOn(timeline, key);
    }
    return count;
  }, [rangeStart, rangeEnd, timeline]);

  const applyWeekRange = (fromNum, toNum) => {
    const from = solveWeeks.find((w) => w.num === Number(fromNum));
    const to = solveWeeks.find((w) => w.num === Number(toNum));
    if (!from || !to) return;
    const [a, b] = from.num <= to.num ? [from, to] : [to, from];
    setRangeStart(a.startKey);
    setRangeEnd(b.endKey);
  };

  const onPickWeekFrom = (value) => {
    setWeekFrom(value);
    if (value) applyWeekRange(value, weekTo || value);
  };

  const onPickWeekTo = (value) => {
    setWeekTo(value);
    if (value) applyWeekRange(weekFrom || value, value);
  };

  const clearRange = () => {
    setRangeStart('');
    setRangeEnd('');
    setWeekFrom('');
    setWeekTo('');
  };

  const onDayClick = (key) => {
    if (!rangeMode) {
      setSelectedDate(key);
      return;
    }
    setWeekFrom('');
    setWeekTo('');
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(key);
      setRangeEnd('');
    } else if (key < rangeStart) {
      setRangeEnd(rangeStart);
      setRangeStart(key);
    } else {
      setRangeEnd(key);
    }
  };

  const submitBulk = async () => {
    if (!rangeStart || !bulkDate || bulkSaving) return;
    setBulkSaving(true);
    try {
      await onBulkSchedule({
        fromDate: rangeStart,
        toDate: rangeEnd || rangeStart,
        date: bulkDate,
      });
    } finally {
      setBulkSaving(false);
    }
  };

  const calendarDays = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const cells = Array(firstWeekday).fill(null);
    for (let day = 1; day <= totalDays; day += 1) {
      cells.push(new Date(year, month, day));
    }
    while (cells.length % 7) cells.push(null);
    return cells;
  }, [monthCursor]);

  const selected = timeline.byDate?.[selectedDate] || {
    solved: [],
    external: [],
    revised: [],
    due: [],
    reopened: [],
  };
  const selectedEvents = [
    ...(selected.solved || []),
    ...(selected.external || []),
    ...(selected.revised || []),
    ...(selected.due || []),
    ...(selected.reopened || []),
  ];

  const moveMonth = (delta) => {
    setMonthCursor(
      (current) => new Date(current.getFullYear(), current.getMonth() + delta, 1)
    );
  };

  const jumpToDate = (key) => {
    const next = dateFromKey(key);
    setSelectedDate(key);
    setMonthCursor(new Date(next.getFullYear(), next.getMonth(), 1));
  };

  const scheduleSelected = async () => {
    if (!planItemId || !selectedDate) return;
    await onSchedule(planItemId, selectedDate);
    setPlanItemId('');
  };

  return (
    <section className="rounded-[18px] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="m-0 text-xl font-bold">Calendar & timeline</h3>
          <p className="mb-0 mt-1 text-sm text-[var(--muted)]">
            See what you solved each day, external links added, and every revision date.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setRangeMode((v) => {
                if (v) clearRange();
                return !v;
              });
            }}
            className={`rounded-[10px] border px-3 py-2 text-xs font-semibold ${
              rangeMode
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'border-[var(--line)] bg-white text-[var(--muted)]'
            }`}
          >
            {rangeMode ? 'Range mode on' : 'Select range'}
          </button>
          <button
            type="button"
            onClick={() => jumpToDate(today)}
            className="rounded-[10px] border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-[var(--accent)]"
          >
            Today
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <div className="rounded-[14px] border border-[var(--line)] bg-[#fbfdfc] p-3">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--line)] bg-white text-lg"
              aria-label="Previous month"
            >
              ‹
            </button>
            <p className="m-0 text-sm font-bold">
              {monthCursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--line)] bg-white text-lg"
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <span
                key={day}
                className="py-1 font-mono text-[0.62rem] font-semibold uppercase text-[var(--muted)]"
              >
                {day}
              </span>
            ))}
            {calendarDays.map((date, index) => {
              if (!date) return <span key={`blank-${index}`} className="aspect-square" />;
              const key = dateKey(date);
              const events = timeline.byDate?.[key];
              const solvedCount = (events?.solved?.length || 0) + (events?.external?.length || 0);
              const revisedCount = events?.revised?.length || 0;
              const dueCount = events?.due?.length || 0;
              const active = !rangeMode && selectedDate === key;
              const rangeEndKey = rangeEnd || (rangeStart && !rangeEnd ? rangeStart : '');
              const inRange =
                rangeMode && rangeStart && key >= rangeStart && key <= (rangeEndKey || rangeStart);
              const isRangeEdge = rangeMode && (key === rangeStart || key === rangeEnd);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onDayClick(key)}
                  className={`relative aspect-square rounded-lg border p-1 text-sm transition ${
                    isRangeEdge
                      ? 'border-[var(--accent)] bg-[var(--accent)] font-bold text-white'
                      : inRange
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] font-semibold text-[var(--accent)]'
                        : active
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)] font-bold text-[var(--accent)]'
                          : key === today
                            ? 'border-[#9acbb2] bg-white'
                            : 'border-transparent bg-white hover:border-[var(--line)]'
                  }`}
                  title={`${solvedCount} solved/added, ${revisedCount} revised, ${dueCount} due`}
                >
                  <span>{date.getDate()}</span>
                  {(solvedCount > 0 || revisedCount > 0 || dueCount > 0) && (
                    <span className="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-0.5">
                      {solvedCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                      {revisedCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />}
                      {dueCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-3 border-t border-[var(--line)] pt-2 font-mono text-[0.65rem] text-[var(--muted)]">
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />Solved / external</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-500" />Revised</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500" />Due</span>
          </div>
        </div>

        <div className="min-w-0">
          <div className="rounded-[14px] border border-[var(--line)] bg-[#fbfdfc] p-3">
            <p className="m-0 text-sm font-bold">{formatDate(selectedDate)}</p>
            <p className="mt-0.5 mb-3 font-mono text-[0.68rem] text-[var(--muted)]">
              {selectedEvents.length} timeline event{selectedEvents.length === 1 ? '' : 's'}
            </p>

            <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {selectedEvents.length === 0 && (
                <p className="py-8 text-center text-sm text-[var(--muted)]">
                  No activity or revisions on this date.
                </p>
              )}
              {selectedEvents.map((event) => (
                <div
                  key={event.eventId}
                  className={`rounded-xl border px-3 py-2.5 ${eventTone(event.type)}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="m-0 text-xs font-bold uppercase tracking-[0.04em]">
                        {eventLabel(event.type)}
                        {event.stage ? ` · Week ${event.stage}` : ''}
                      </p>
                      <p className="mt-0.5 mb-0 truncate text-sm font-semibold text-[var(--ink)]">
                        {event.title}
                      </p>
                      <p className="mt-0.5 mb-0 font-mono text-[0.65rem] text-[var(--muted)]">
                        {[event.platform, event.topic, event.difficulty]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    {(event.link || event.qid) && (
                      <button
                        type="button"
                        onClick={() => onOpenItem(event)}
                        className="shrink-0 rounded-lg border border-current bg-white/70 px-2 py-1 text-xs font-semibold"
                      >
                        Open
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 rounded-[14px] border border-[var(--line)] bg-white p-3">
            <p className="m-0 text-sm font-bold">Plan revision on selected date</p>
            <p className="mt-1 mb-2 text-xs text-[var(--muted)]">
              Choose any tracked or external problem and schedule it for {formatDate(selectedDate)}.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={planItemId}
                onChange={(event) => setPlanItemId(event.target.value)}
                className="min-w-0 flex-1 rounded-[10px] border border-[var(--line)] bg-[#fbfdfc] px-3 py-2 text-sm"
              >
                <option value="">Select a problem…</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.source === 'manual' ? '[External] ' : ''}
                    {item.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!planItemId || busyId === planItemId}
                onClick={scheduleSelected}
                className="rounded-[10px] bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Schedule here
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-[14px] border border-[var(--line)] bg-[#fbfdfc] p-3.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="m-0 text-sm font-bold">Bulk revision scheduling</p>
            <p className="mt-1 mb-0 text-xs text-[var(--muted)]">
              Pick a date range (or solve weeks) — every problem you solved in that period gets
              scheduled for revision on the day you choose. You&apos;ll get an alert the day before as a
              reminder.
            </p>
          </div>
          {(rangeStart || weekFrom || weekTo) && (
            <button
              type="button"
              onClick={clearRange}
              className="rounded-[10px] border border-[var(--line)] bg-white px-2.5 py-1.5 text-xs font-semibold text-[var(--muted)]"
            >
              Clear selection
            </button>
          )}
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--line)] bg-white p-3">
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--muted)]">
              By date range
            </p>
            <p className="mt-1 mb-2 text-[0.7rem] text-[var(--muted)]">
              Type dates below, or turn on “Select range” and tap two days on the calendar.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs font-semibold text-[var(--muted)]">
                From
                <input
                  type="date"
                  value={rangeStart}
                  onChange={(e) => {
                    setRangeStart(e.target.value);
                    setWeekFrom('');
                    setWeekTo('');
                  }}
                  className="mt-1 block rounded-[10px] border border-[var(--line)] bg-[#fbfdfc] px-2.5 py-2 text-sm text-[var(--ink)]"
                />
              </label>
              <label className="text-xs font-semibold text-[var(--muted)]">
                To
                <input
                  type="date"
                  value={rangeEnd}
                  min={rangeStart || undefined}
                  onChange={(e) => {
                    setRangeEnd(e.target.value);
                    setWeekFrom('');
                    setWeekTo('');
                  }}
                  className="mt-1 block rounded-[10px] border border-[var(--line)] bg-[#fbfdfc] px-2.5 py-2 text-sm text-[var(--ink)]"
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-white p-3">
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--muted)]">
              By solve week
            </p>
            <p className="mt-1 mb-2 text-[0.7rem] text-[var(--muted)]">
              Week 1 = the week (Mon–Sun) of your first solve.
            </p>
            {solveWeeks.length === 0 ? (
              <p className="mb-0 mt-2 text-sm text-[var(--muted)]">No solved problems yet.</p>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs font-semibold text-[var(--muted)]">
                  From week
                  <select
                    value={weekFrom}
                    onChange={(e) => onPickWeekFrom(e.target.value)}
                    className="mt-1 block rounded-[10px] border border-[var(--line)] bg-[#fbfdfc] px-2.5 py-2 text-sm text-[var(--ink)]"
                  >
                    <option value="">Select…</option>
                    {solveWeeks.map((w) => (
                      <option key={w.num} value={w.num}>
                        Week {w.num} · {w.count} solved
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-[var(--muted)]">
                  To week
                  <select
                    value={weekTo}
                    onChange={(e) => onPickWeekTo(e.target.value)}
                    className="mt-1 block rounded-[10px] border border-[var(--line)] bg-[#fbfdfc] px-2.5 py-2 text-sm text-[var(--ink)]"
                  >
                    <option value="">Select…</option>
                    {solveWeeks.map((w) => (
                      <option key={w.num} value={w.num}>
                        Week {w.num} · {w.count} solved
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-3 rounded-xl border border-[var(--line)] bg-white p-3">
          <div>
            <p className="m-0 text-sm font-semibold text-[var(--ink)]">
              {rangeStart ? (
                <>
                  {formatDate(rangeStart)} → {formatDate(rangeEnd || rangeStart)} ·{' '}
                  <span className="text-[var(--accent)]">{rangeCount} problem{rangeCount === 1 ? '' : 's'}</span>{' '}
                  solved in this range
                </>
              ) : (
                'No range selected yet'
              )}
            </p>
            <p className="mt-0.5 mb-0 font-mono text-[0.68rem] text-[var(--muted)]">
              Reminder alert arrives the day before the revision date.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-semibold text-[var(--muted)]">
              Revise on
              <input
                type="date"
                value={bulkDate}
                onChange={(e) => setBulkDate(e.target.value)}
                className="mt-1 block rounded-[10px] border border-[var(--line)] bg-[#fbfdfc] px-2.5 py-2 text-sm text-[var(--ink)]"
              />
            </label>
            <button
              type="button"
              disabled={!rangeStart || !bulkDate || rangeCount === 0 || bulkSaving}
              onClick={submitBulk}
              className="rounded-[10px] bg-[var(--accent)] px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {bulkSaving ? 'Scheduling…' : `Schedule ${rangeCount || ''} for revision`}
            </button>
          </div>
        </div>
      </div>
    </section>
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
  onBulkSchedule,
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
    nextRevisionDate: dateKey(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
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
        nextRevisionDate: dateKey(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
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

      <CalendarTimeline
        revision={revision}
        busyId={busyId}
        onSchedule={onSchedule}
        onBulkSchedule={onBulkSchedule}
        onOpenItem={onOpenItem}
      />

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
              type="url"
              value={manual.link}
              onChange={(e) => setManual((m) => ({ ...m, link: e.target.value }))}
              placeholder="External problem link (https://…)"
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
            <label className="text-xs font-semibold text-[var(--muted)]">
              Date solved
              <input
                type="date"
                required
                value={manual.dateSolved}
                onChange={(e) => setManual((m) => ({ ...m, dateSolved: e.target.value }))}
                className="mt-1 block w-full rounded-[10px] border border-[var(--line)] bg-[#fbfdfc] px-3 py-2.5 text-sm text-[var(--ink)]"
              />
            </label>
            <label className="text-xs font-semibold text-[var(--muted)]">
              First revision date
              <input
                type="date"
                required
                value={manual.nextRevisionDate}
                onChange={(e) =>
                  setManual((m) => ({ ...m, nextRevisionDate: e.target.value }))
                }
                className="mt-1 block w-full rounded-[10px] border border-[var(--line)] bg-[#fbfdfc] px-3 py-2.5 text-sm text-[var(--ink)]"
              />
            </label>
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
