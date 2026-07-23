'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

function actionLabel(action) {
  if (action === 'finished') return 'finished';
  if (action === 'attempted') return 'attempted';
  if (action === 'reopened') return 'reopened';
  return action;
}

function toastForActivity(a) {
  const verb = actionLabel(a.action);
  const msg = `${a.displayName} ${verb} “${a.title}”`;
  if (a.action === 'finished') toast.success(msg, { toastId: a.id });
  else if (a.action === 'attempted') toast.info(msg, { toastId: a.id });
  else toast.warn(msg, { toastId: a.id });
}

function timeAgo(iso) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3.5 w-3.5">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="grid min-h-screen place-items-center px-6 py-10">
      <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-white p-8 shadow-[var(--shadow)] animate-rise">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">DSA Tracker</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--ink)]">Pick up where you left off</h1>
        <p className="mt-2 text-[var(--muted)]">Mark problems, keep your streak, climb the board.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium">
            Username
            <input
              className="mt-1.5 w-full rounded-[10px] border border-[var(--line)] bg-[#fbfdfc] px-3 py-2.5 outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[rgba(15,122,79,0.15)]"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="tej or hafsa"
              required
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input
              type="password"
              className="mt-1.5 w-full rounded-[10px] border border-[var(--line)] bg-[#fbfdfc] px-3 py-2.5 outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[rgba(15,122,79,0.15)]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-[10px] bg-[var(--accent)] px-4 py-2.5 font-semibold text-white hover:bg-[#0c6541] disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--muted)]">
          <span>
            <code className="rounded bg-[var(--accent-soft)] px-1.5 py-0.5 font-mono text-[var(--accent)]">tej</code> /{' '}
            <code className="rounded bg-[var(--accent-soft)] px-1.5 py-0.5 font-mono text-[var(--accent)]">tej@dsa</code>
          </span>
          <span>
            <code className="rounded bg-[var(--accent-soft)] px-1.5 py-0.5 font-mono text-[var(--accent)]">hafsa</code> /{' '}
            <code className="rounded bg-[var(--accent-soft)] px-1.5 py-0.5 font-mono text-[var(--accent)]">hafsa@dsa</code>
          </span>
        </div>
      </div>
    </section>
  );
}

export default function TrackerApp() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [tab, setTab] = useState('sheet');
  const [questions, setQuestions] = useState([]);
  const [solved, setSolved] = useState([]);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [board, setBoard] = useState(null);
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState('all');
  const [status, setStatus] = useState('all');
  const [diff, setDiff] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const [people, setPeople] = useState([]);
  const [feed, setFeed] = useState([]);
  const sinceRef = useRef(null);
  const seenToastIds = useRef(new Set());

  const solvedSet = useMemo(() => new Set(solved), [solved]);

  const loadBoard = useCallback(async () => {
    const data = await api('/api/leaderboard');
    setBoard(data);
  }, []);

  const loadPresence = useCallback(async () => {
    try {
      const data = await api('/api/presence');
      setPeople(data.people || []);
    } catch {
      /* ignore */
    }
  }, []);

  const loadAll = useCallback(async () => {
    const [qs, progress, act] = await Promise.all([
      api('/api/questions'),
      api('/api/progress'),
      api('/api/activity'),
    ]);
    setQuestions(qs.questions);
    setSolved(progress.solved);
    setCurrentStreak(progress.currentStreak);
    setBestStreak(progress.bestStreak);
    setFeed(act.activities || []);
    sinceRef.current = act.serverTime || new Date().toISOString();
    for (const a of act.activities || []) seenToastIds.current.add(a.id);
    await loadBoard();
    await loadPresence();
  }, [loadBoard, loadPresence]);

  useEffect(() => {
    (async () => {
      try {
        const me = await api('/api/auth/me');
        setUser(me.user);
        await loadAll();
      } catch {
        setUser(null);
      } finally {
        setBooting(false);
      }
    })();
  }, [loadAll]);

  // Heartbeat + live activity polling while logged in
  useEffect(() => {
    if (!user) return undefined;

    const beat = () => {
      api('/api/presence', { method: 'POST' }).catch(() => {});
    };
    beat();
    const presenceTimer = setInterval(beat, 15000);
    const presenceRefresh = setInterval(loadPresence, 10000);

    const poll = async () => {
      try {
        const q = sinceRef.current ? `?since=${encodeURIComponent(sinceRef.current)}` : '';
        const data = await api(`/api/activity${q}`);
        const incoming = data.activities || [];
        if (incoming.length) {
          setFeed((prev) => {
            const map = new Map(prev.map((a) => [a.id, a]));
            for (const a of incoming) map.set(a.id, a);
            return [...map.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 40);
          });
          for (const a of incoming) {
            if (seenToastIds.current.has(a.id)) continue;
            seenToastIds.current.add(a.id);
            if (a.username !== user.username) {
              toastForActivity(a);
              if (a.action === 'finished' || a.action === 'reopened') loadBoard();
            }
          }
        }
        if (data.serverTime) sinceRef.current = data.serverTime;
      } catch {
        /* ignore */
      }
    };
    const activityTimer = setInterval(poll, 3500);

    return () => {
      clearInterval(presenceTimer);
      clearInterval(presenceRefresh);
      clearInterval(activityTimer);
    };
  }, [user, loadBoard, loadPresence]);

  async function handleLogin(u) {
    setUser(u);
    setBooting(true);
    seenToastIds.current = new Set();
    sinceRef.current = null;
    try {
      await loadAll();
    } finally {
      setBooting(false);
    }
  }

  async function logout() {
    await api('/api/auth/me', { method: 'DELETE' });
    setUser(null);
    setQuestions([]);
    setSolved([]);
    setBoard(null);
    setPeople([]);
    setFeed([]);
  }

  async function toggle(qid) {
    setBusyId(qid);
    try {
      const data = await api('/api/progress', {
        method: 'POST',
        body: JSON.stringify({ qid }),
      });
      setSolved(data.solved);
      setCurrentStreak(data.currentStreak);
      setBestStreak(data.bestStreak);
      loadBoard();
      if (data.action === 'finished') toast.success('Marked as finished');
      else if (data.action === 'reopened') toast.info('Marked as todo again');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function openQuestion(q) {
    api('/api/activity', { method: 'POST', body: JSON.stringify({ qid: q.qid }) }).catch(() => {});
    if (q.link) window.open(q.link, '_blank', 'noopener,noreferrer');
  }

  const topics = useMemo(() => {
    const seen = [];
    for (const q of questions) {
      if (!seen.includes(q.topic)) seen.push(q.topic);
    }
    return seen;
  }, [questions]);

  const topicCounts = useMemo(() => {
    const map = {};
    for (const q of questions) {
      if (!map[q.topic]) map[q.topic] = { total: 0, done: 0 };
      map[q.topic].total += 1;
      if (solvedSet.has(q.qid)) map[q.topic].done += 1;
    }
    return map;
  }, [questions, solvedSet]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return questions.filter((item) => {
      if (topic !== 'all' && item.topic !== topic) return false;
      if (diff !== 'all' && item.difficulty !== diff) return false;
      const done = solvedSet.has(item.qid);
      if (status === 'done' && !done) return false;
      if (status === 'todo' && done) return false;
      if (q && !item.title.toLowerCase().includes(q) && !item.topic.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [questions, search, topic, status, diff, solvedSet]);

  const total = questions.length;
  const solvedCount = solved.length;
  const pct = total ? Math.round((solvedCount / total) * 100) : 0;

  if (booting) {
    return (
      <div className="grid min-h-screen place-content-center text-center">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">DSA Tracker</p>
        <p className="mt-2 text-[var(--muted)]">Loading…</p>
      </div>
    );
  }

  if (!user) return <Login onLogin={handleLogin} />;

  return (
    <div className="min-h-screen">
      <ToastContainer
        position="top-right"
        autoClose={4500}
        newestOnTop
        pauseOnHover
        theme="light"
        toastClassName="!font-[Outfit] !rounded-xl !text-sm"
      />
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] bg-white/85 px-5 py-3.5 backdrop-blur">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">DSA Tracker</span>
          <nav className="flex gap-1 rounded-[10px] bg-[#e8f0ec] p-1">
            <button
              type="button"
              className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold ${tab === 'sheet' ? 'bg-white text-[var(--ink)] shadow-sm' : 'text-[var(--muted)]'}`}
              onClick={() => setTab('sheet')}
            >
              Sheet
            </button>
            <button
              type="button"
              className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold ${tab === 'board' ? 'bg-white text-[var(--ink)] shadow-sm' : 'text-[var(--muted)]'}`}
              onClick={() => {
                setTab('board');
                loadBoard();
              }}
            >
              Leaderboard
            </button>
            <button
              type="button"
              className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold ${tab === 'live' ? 'bg-white text-[var(--ink)] shadow-sm' : 'text-[var(--muted)]'}`}
              onClick={() => setTab('live')}
            >
              Live
            </button>
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            {people.map((p) => (
              <div
                key={p.username}
                className="flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-xs font-semibold"
                title={p.online ? 'Active now' : 'Offline'}
              >
                <span className={`h-2 w-2 rounded-full ${p.online ? 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.25)]' : 'bg-slate-300'}`} />
                <span className="capitalize">{p.displayName}</span>
                {p.isYou && <span className="font-mono text-[0.65rem] text-[var(--muted)]">you</span>}
              </div>
            ))}
          </div>
          <span className="font-mono text-sm font-medium">{user.displayName}</span>
          <button
            type="button"
            onClick={logout}
            className="rounded-[10px] border border-[var(--line)] px-3 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-white"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto w-[min(1100px,calc(100%-2rem))] py-6 pb-12">
        <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <article className="rounded-[14px] border border-[var(--line)] bg-white p-4 animate-rise">
            <p className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">Solved</p>
            <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{solvedCount}</p>
            <p className="text-sm text-[var(--muted)]">of {total}</p>
          </article>
          <article className="rounded-[14px] border border-transparent bg-gradient-to-br from-[#0f7a4f] to-[#149463] p-4 text-white animate-rise">
            <p className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-white/80">Current streak</p>
            <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{currentStreak}</p>
            <p className="text-sm text-white/80">days</p>
          </article>
          <article className="rounded-[14px] border border-[var(--line)] bg-white p-4 animate-rise">
            <p className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">Best streak</p>
            <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{bestStreak}</p>
            <p className="text-sm text-[var(--muted)]">days</p>
          </article>
          <article className="rounded-[14px] border border-[var(--line)] bg-white p-4 animate-rise">
            <p className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">Progress</p>
            <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{pct}%</p>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#e4ece8]">
              <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${pct}%` }} />
            </div>
          </article>
        </section>

        {tab === 'sheet' && (
          <section className="rounded-[18px] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow)]">
            <div className="mb-3.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search questions…"
                className="rounded-[10px] border border-[var(--line)] bg-[#fbfdfc] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
              />
              <select value={topic} onChange={(e) => setTopic(e.target.value)} className="rounded-[10px] border border-[var(--line)] bg-[#fbfdfc] px-3 py-2.5">
                <option value="all">All topics</option>
                {topics.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-[10px] border border-[var(--line)] bg-[#fbfdfc] px-3 py-2.5">
                <option value="all">All status</option>
                <option value="todo">Todo</option>
                <option value="done">Done</option>
              </select>
              <select value={diff} onChange={(e) => setDiff(e.target.value)} className="rounded-[10px] border border-[var(--line)] bg-[#fbfdfc] px-3 py-2.5">
                <option value="all">All difficulty</option>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
                <option value="UNRATED">Unrated</option>
              </select>
            </div>

            <div className="mb-3.5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTopic('all')}
                className={`rounded-full border px-2.5 py-1.5 text-xs font-semibold ${topic === 'all' ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-transparent bg-[#eef4f0] text-[var(--muted)]'}`}
              >
                All <span className="ml-1 font-mono">{solvedCount}/{total}</span>
              </button>
              {topics.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTopic(t)}
                  className={`rounded-full border px-2.5 py-1.5 text-xs font-semibold ${topic === t ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-transparent bg-[#eef4f0] text-[var(--muted)]'}`}
                >
                  {t}{' '}
                  <span className="ml-1 font-mono">
                    {topicCounts[t]?.done || 0}/{topicCounts[t]?.total || 0}
                  </span>
                </button>
              ))}
            </div>

            <div className="grid gap-2">
              {filtered.length === 0 && <p className="py-10 text-center text-[var(--muted)]">No questions match your filters.</p>}
              {filtered.map((q) => {
                const done = solvedSet.has(q.qid);
                return (
                  <div
                    key={q.qid}
                    className={`grid grid-cols-[auto_1fr] items-center gap-3 rounded-xl border px-3.5 py-3 sm:grid-cols-[auto_1fr_auto] ${done ? 'border-[#c5e6d4] bg-[#f1faf5]' : 'border-[var(--line)] hover:border-[#b9cfc3] hover:bg-[#fbfdfc]'}`}
                  >
                    <button
                      type="button"
                      disabled={busyId === q.qid}
                      onClick={() => toggle(q.qid)}
                      className={`grid h-[22px] w-[22px] place-items-center rounded-md border-2 ${done ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[#9bb5a8] bg-white text-transparent'}`}
                      aria-label={done ? 'Mark incomplete' : 'Mark complete'}
                    >
                      <CheckIcon />
                    </button>
                    <div>
                      <p className={`m-0 text-[0.98rem] font-semibold ${done ? 'text-[var(--muted)] line-through' : ''}`}>
                        <span className="mr-2 font-mono text-xs font-medium text-[var(--muted)]">#{q.order}</span>
                        {q.title}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <span className="rounded-md bg-[#e8f0ec] px-1.5 py-0.5 font-mono text-[0.68rem] uppercase text-[var(--muted)]">{q.topic}</span>
                        <span
                          className={`rounded-md px-1.5 py-0.5 font-mono text-[0.68rem] uppercase ${
                            q.difficulty === 'EASY'
                              ? 'bg-[#d8f3e6] text-[var(--easy)]'
                              : q.difficulty === 'MEDIUM'
                                ? 'bg-[#fef3c7] text-[var(--medium)]'
                                : q.difficulty === 'HARD'
                                  ? 'bg-[#fee4e2] text-[var(--hard)]'
                                  : 'bg-[#eef0f2] text-[#667085]'
                          }`}
                        >
                          {q.difficulty}
                        </span>
                      </div>
                    </div>
                    {q.link ? (
                      <button
                        type="button"
                        onClick={() => openQuestion(q)}
                        className="justify-self-start font-mono text-xs font-medium text-[var(--accent)] hover:underline sm:justify-self-end"
                      >
                        Open →
                      </button>
                    ) : (
                      <span className="font-mono text-xs text-[var(--muted)] sm:justify-self-end">No link</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {tab === 'live' && (
          <section className="rounded-[18px] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow)]">
            <h2 className="m-0 text-2xl font-bold tracking-tight">Live activity</h2>
            <p className="mb-5 mt-1.5 text-[var(--muted)]">
              See when Tej or Hafsa attempt or finish a question. Toasts also pop for the other person in real time.
            </p>

            <div className="mb-6 grid gap-3 sm:grid-cols-2">
              {people.map((p) => (
                <div key={p.username} className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[#fbfdfc] px-4 py-3">
                  <div>
                    <p className="m-0 text-lg font-bold capitalize">{p.displayName}</p>
                    <p className="m-0 text-sm text-[var(--muted)]">{p.isYou ? 'That’s you' : 'Partner'}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      p.online ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'bg-[#eef0f2] text-[var(--muted)]'
                    }`}
                  >
                    {p.online ? 'Active now' : 'Offline'}
                  </span>
                </div>
              ))}
            </div>

            <h3 className="mb-3 mt-0 text-lg font-semibold">Recent events</h3>
            <div className="grid gap-2">
              {feed.length === 0 && <p className="py-8 text-center text-[var(--muted)]">No activity yet — open or finish a question.</p>}
              {feed.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--line)] px-3.5 py-3">
                  <div>
                    <p className="m-0 text-sm font-semibold">
                      <span className="capitalize text-[var(--accent)]">{a.displayName}</span>{' '}
                      {actionLabel(a.action)} <span className="text-[var(--ink)]">“{a.title}”</span>
                    </p>
                    <p className="mt-1 m-0 font-mono text-xs text-[var(--muted)]">
                      {a.topic} · #{a.qid}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 font-mono text-[0.68rem] uppercase ${
                        a.action === 'finished'
                          ? 'bg-[#d8f3e6] text-[var(--easy)]'
                          : a.action === 'attempted'
                            ? 'bg-[#e0f2fe] text-[#0369a1]'
                            : 'bg-[#fef3c7] text-[var(--medium)]'
                      }`}
                    >
                      {a.action}
                    </span>
                    <span className="font-mono text-xs text-[var(--muted)]">{timeAgo(a.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === 'board' && board && (
          <section className="rounded-[18px] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow)]">
            <h2 className="m-0 text-2xl font-bold tracking-tight">Leaderboard</h2>
            <p className="mb-5 mt-1.5 text-[var(--muted)]">Tej vs Hafsa — solved count, streaks, and topic pace.</p>
            <div className="mb-7 grid gap-3 md:grid-cols-2">
              {board.board.map((row, i) => (
                <article
                  key={row.username}
                  className={`relative rounded-2xl border p-5 ${i === 0 ? 'border-[#8fd0b0] bg-gradient-to-br from-[#f1faf5] to-white' : 'border-[var(--line)] bg-[#fbfdfc]'}`}
                >
                  {i === 0 && (
                    <span className="absolute right-3 top-3 rounded-md bg-[var(--accent-soft)] px-2 py-1 font-mono text-[0.65rem] font-semibold tracking-[0.08em] text-[var(--accent)]">
                      LEADING
                    </span>
                  )}
                  <p className="m-0 font-mono text-sm text-[var(--muted)]">#{i + 1}</p>
                  <h3 className="m-0 text-2xl font-bold capitalize tracking-tight">{row.displayName}</h3>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[0.72rem] font-semibold uppercase tracking-[0.05em] text-[var(--muted)]">Solved</label>
                      <strong className="text-xl tabular-nums">
                        {row.solvedCount}/{board.totalQuestions}
                      </strong>
                    </div>
                    <div>
                      <label className="block text-[0.72rem] font-semibold uppercase tracking-[0.05em] text-[var(--muted)]">Streak</label>
                      <strong className="text-xl tabular-nums">{row.currentStreak}d</strong>
                    </div>
                    <div>
                      <label className="block text-[0.72rem] font-semibold uppercase tracking-[0.05em] text-[var(--muted)]">Best</label>
                      <strong className="text-xl tabular-nums">{row.bestStreak}d</strong>
                    </div>
                    <div>
                      <label className="block text-[0.72rem] font-semibold uppercase tracking-[0.05em] text-[var(--muted)]">Done</label>
                      <strong className="text-xl tabular-nums">{row.pct}%</strong>
                    </div>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e4ece8]">
                    <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${row.pct}%` }} />
                  </div>
                </article>
              ))}
            </div>

            <h3 className="mb-3 mt-0 text-lg font-semibold">Topic race</h3>
            <div className="grid gap-2.5">
              {board.topics.map((t) => {
                const totalT = board.topicTotals[t] || 1;
                return (
                  <div key={t} className="grid items-center gap-3 md:grid-cols-[160px_1fr]">
                    <div className="text-sm font-semibold text-[var(--muted)]">{t}</div>
                    <div className="grid gap-1">
                      {board.board.map((row) => {
                        const n = row.byTopic[t] || 0;
                        const w = Math.round((n / totalT) * 100);
                        return (
                          <div key={row.username} className="grid grid-cols-[48px_1fr_40px] items-center gap-2 font-mono text-[0.72rem]">
                            <span>{row.username}</span>
                            <div className="h-2 overflow-hidden rounded-full bg-[#e4ece8]">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${w}%`,
                                  background: row.username === 'tej' ? '#0f7a4f' : '#1d5f8a',
                                }}
                              />
                            </div>
                            <span>
                              {n}/{totalT}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
