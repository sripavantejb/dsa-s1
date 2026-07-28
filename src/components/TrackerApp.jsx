'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { SnapAvatar } from './SnapAvatar';

const REACTION_EMOJIS = ['❤️', '👍', '😂', '🔥', '💯', '😮', '😢', '👏'];

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

function popBrowserNotification(title, body) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, { body, icon: '/favicon.ico' });
    } catch {
      /* ignore */
    }
  }
}

function notifToast(n) {
  // Chat stays in the Alerts panel count only — no toast text
  if (n.type === 'chat') return;
  const msg = `${n.title}: ${n.body}`;
  if (n.type === 'finished' || n.type === 'streak' || n.type === 'code') toast.success(msg, { toastId: n.id });
  else if (n.type === 'attempted') toast.info(msg, { toastId: n.id });
  else toast.warn(msg, { toastId: n.id });
  popBrowserNotification(n.title, n.body);
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

function ReadTicks({ seen }) {
  return (
    <span className="ml-1.5 inline-flex items-center align-middle" title={seen ? 'Seen' : 'Sent'} aria-label={seen ? 'Seen' : 'Sent'}>
      <svg width="14" height="10" viewBox="0 0 16 11" fill="none" className="inline">
        <path
          d="M1.5 5.5L4.5 8.5L10.5 1.5"
          stroke={seen ? '#53bdeb' : 'currentColor'}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5.5 5.5L8.5 8.5L14.5 1.5"
          stroke={seen ? '#53bdeb' : 'currentColor'}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={seen ? 1 : 0.55}
        />
      </svg>
    </span>
  );
}

function lastSeenLabel(iso) {
  if (!iso) return 'last seen a while ago';
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 45) return 'last seen just now';
  if (s < 3600) return `last seen ${Math.floor(s / 60) || 1}m ago`;
  if (s < 86400) return `last seen ${Math.floor(s / 3600)}h ago`;
  return `last seen ${Math.floor(s / 86400)}d ago`;
}

function ChatToggle({ label, hint, checked, onChange }) {
  return (
    <div className="mb-2 flex items-start justify-between gap-3 rounded-lg border border-[var(--line)] bg-[#fbfdfc] px-3 py-2.5">
      <span>
        <span className="block text-sm font-semibold text-[var(--ink)]">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-[var(--muted)]">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-[var(--accent)]' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
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
      setError(err.message || 'Login failed');
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
  const [todayCount, setTodayCount] = useState(0);
  const [dailyGoal, setDailyGoal] = useState(8);
  const [todayPct, setTodayPct] = useState(0);
  const [todayComplete, setTodayComplete] = useState(false);
  const [challengeCompleted, setChallengeCompleted] = useState(0);
  const [challengeDays, setChallengeDays] = useState(30);
  const [challengePct, setChallengePct] = useState(0);
  const [board, setBoard] = useState(null);
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState('all');
  const [status, setStatus] = useState('all');
  const [diff, setDiff] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const [people, setPeople] = useState([]);
  const [feed, setFeed] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);
  const [replyTo, setReplyTo] = useState(null);
  const [reactMenuId, setReactMenuId] = useState(null);
  const [chatSettings, setChatSettings] = useState({
    disappearingOnSeen: false,
    typingIndicators: true,
    readReceipts: true,
  });
  const [chatSettingsOpen, setChatSettingsOpen] = useState(false);
  const [clearingChat, setClearingChat] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const chatDraftRef = useRef('');
  const typingClearRef = useRef(null);
  const chatSettingsRef = useRef(null);
  const [snippets, setSnippets] = useState([]);
  const [unreadCode, setUnreadCode] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notifUnread, setNotifUnread] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [codeTitle, setCodeTitle] = useState('');
  const [codeLang, setCodeLang] = useState('cpp');
  const [codeBody, setCodeBody] = useState('');
  const [codeNote, setCodeNote] = useState('');
  const [codeQid, setCodeQid] = useState('');
  const [codeSending, setCodeSending] = useState(false);
  const [expandedCodeId, setExpandedCodeId] = useState(null);
  const sinceRef = useRef(null);
  const chatSinceRef = useRef(null);
  const codeSinceRef = useRef(null);
  const notifSinceRef = useRef(null);
  const seenToastIds = useRef(new Set());
  const seenChatIds = useRef(new Set());
  const seenCodeIds = useRef(new Set());
  const seenNotifIds = useRef(new Set());
  const chatEndRef = useRef(null);
  const chatScrollRef = useRef(null);
  const tabRef = useRef(tab);
  const notifPanelRef = useRef(null);

  useEffect(() => {
    tabRef.current = tab;
    if (tab === 'chat') {
      setUnreadChat(0);
      api('/api/chat?markSeen=1')
        .then((data) => {
          setMessages(data.messages || []);
          if (data.settings) setChatSettings(data.settings);
          if (typeof data.partnerTyping === 'boolean') setPartnerTyping(data.partnerTyping);
          if (data.serverTime) chatSinceRef.current = data.serverTime;
        })
        .catch(() => {});
    } else {
      setChatSettingsOpen(false);
    }
    if (tab === 'code') setUnreadCode(0);
  }, [tab]);

  const solvedSet = useMemo(() => new Set(solved), [solved]);

  useEffect(() => {
    if (tab !== 'chat') return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [tab]);

  useEffect(() => {
    if (tab !== 'chat') return;
    const box = chatScrollRef.current;
    if (box) {
      box.scrollTop = box.scrollHeight;
    }
  }, [messages, partnerTyping, tab]);

  useEffect(() => {
    if (!notifOpen) return undefined;
    const onDown = (e) => {
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [notifOpen]);

  useEffect(() => {
    if (!chatSettingsOpen) return undefined;
    const onDown = (e) => {
      if (chatSettingsRef.current && !chatSettingsRef.current.contains(e.target)) {
        setChatSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [chatSettingsOpen]);

  function applyProgress(progress) {
    setSolved(progress.solved || []);
    setCurrentStreak(progress.currentStreak || 0);
    setBestStreak(progress.bestStreak || 0);
    setTodayCount(progress.todayRawCount ?? progress.todayCount ?? 0);
    setDailyGoal(progress.dailyGoal || 8);
    setTodayPct(progress.todayPct || 0);
    setTodayComplete(!!progress.todayComplete);
    setChallengeCompleted(progress.challengeCompleted || 0);
    setChallengeDays(progress.challengeDays || 30);
    setChallengePct(progress.challengePct || 0);
  }

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
    const [qs, progress, act, chat, code, notifs] = await Promise.all([
      api('/api/questions'),
      api('/api/progress'),
      api('/api/activity'),
      api('/api/chat'),
      api('/api/code'),
      api('/api/notifications'),
    ]);
    setQuestions(qs.questions);
    applyProgress(progress);
    setFeed(act.activities || []);
    sinceRef.current = act.serverTime || new Date().toISOString();
    for (const a of act.activities || []) seenToastIds.current.add(a.id);
    setMessages(chat.messages || []);
    if (chat.settings) setChatSettings(chat.settings);
    chatSinceRef.current = chat.serverTime || new Date().toISOString();
    for (const m of chat.messages || []) seenChatIds.current.add(m.id);
    setSnippets([...(code.snippets || [])].reverse());
    codeSinceRef.current = code.serverTime || new Date().toISOString();
    for (const s of code.snippets || []) seenCodeIds.current.add(s.id);
    setNotifications(notifs.notifications || []);
    setNotifUnread(notifs.unread || 0);
    notifSinceRef.current = notifs.serverTime || new Date().toISOString();
    for (const n of notifs.notifications || []) seenNotifIds.current.add(n.id);
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

    let lastBeat = Date.now();

    const isFocused = () =>
      typeof document !== 'undefined' &&
      document.visibilityState === 'visible' &&
      document.hasFocus();

    const beat = () => {
      const now = Date.now();
      const deltaSeconds = Math.min(20, Math.max(0, Math.round((now - lastBeat) / 1000)));
      lastBeat = now;
      const typing =
        tabRef.current === 'chat' && chatDraftRef.current.trim().length > 0 && isFocused();
      const payload = { focused: isFocused(), deltaSeconds };
      if (tabRef.current === 'chat') payload.typing = typing;
      api('/api/presence', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
        .then(() => loadPresence())
        .catch(() => {});
    };

    beat();
    const presenceTimer = setInterval(beat, 15000);
    const presenceRefresh = setInterval(loadPresence, 2000);

    const onVis = () => {
      if (document.visibilityState === 'visible') beat();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', beat);

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
            if (a.username !== user.username && (a.action === 'finished' || a.action === 'reopened')) {
              loadBoard();
            }
          }
        }
        if (data.serverTime) sinceRef.current = data.serverTime;
      } catch {
        /* ignore */
      }
    };
    const activityTimer = setInterval(poll, 3500);

    const pollChat = async () => {
      try {
        const mark = tabRef.current === 'chat' ? '?markSeen=1' : '';
        const data = await api(`/api/chat${mark}`);
        const list = data.messages || [];
        const prevIds = seenChatIds.current;
        for (const m of list) {
          if (!prevIds.has(m.id) && m.username !== user.username && tabRef.current !== 'chat') {
            setUnreadChat((n) => n + 1);
          }
          prevIds.add(m.id);
        }
        setMessages(list);
        if (data.settings) setChatSettings(data.settings);
        if (typeof data.partnerTyping === 'boolean') setPartnerTyping(data.partnerTyping);
        if (data.serverTime) chatSinceRef.current = data.serverTime;
      } catch {
        /* ignore */
      }
    };
    const chatTimer = setInterval(pollChat, 2000);

    const pollCode = async () => {
      try {
        const q = codeSinceRef.current ? `?since=${encodeURIComponent(codeSinceRef.current)}` : '';
        const data = await api(`/api/code${q}`);
        const incoming = data.snippets || [];
        if (incoming.length) {
          setSnippets((prev) => {
            const map = new Map(prev.map((s) => [s.id, s]));
            for (const s of incoming) map.set(s.id, s);
            return [...map.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          });
          for (const s of incoming) {
            if (seenCodeIds.current.has(s.id)) continue;
            seenCodeIds.current.add(s.id);
            if (s.username !== user.username && tabRef.current !== 'code') {
              setUnreadCode((n) => n + 1);
            }
          }
        }
        if (data.serverTime) codeSinceRef.current = data.serverTime;
      } catch {
        /* ignore */
      }
    };
    const codeTimer = setInterval(pollCode, 4000);

    const pollNotifs = async () => {
      try {
        const q = notifSinceRef.current ? `?since=${encodeURIComponent(notifSinceRef.current)}` : '';
        const data = await api(`/api/notifications${q}`);
        const incoming = data.notifications || [];
        if (incoming.length) {
          setNotifications((prev) => {
            const map = new Map(prev.map((n) => [n.id, n]));
            for (const n of incoming) map.set(n.id, n);
            return [...map.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);
          });
          for (const n of incoming) {
            if (seenNotifIds.current.has(n.id)) continue;
            seenNotifIds.current.add(n.id);
            notifToast(n);
          }
        }
        if (typeof data.unread === 'number') setNotifUnread(data.unread);
        if (data.serverTime) notifSinceRef.current = data.serverTime;
      } catch {
        /* ignore */
      }
    };
    const notifTimer = setInterval(pollNotifs, 3000);

    return () => {
      clearInterval(presenceTimer);
      clearInterval(presenceRefresh);
      clearInterval(activityTimer);
      clearInterval(chatTimer);
      clearInterval(codeTimer);
      clearInterval(notifTimer);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', beat);
    };
  }, [user, loadBoard, loadPresence]);

  function statusMeta(status) {
    if (status === 'active') return { label: 'Active', className: 'bg-[var(--accent-soft)] text-[var(--accent)]', dot: 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.25)]' };
    if (status === 'idle') return { label: 'Idle', className: 'bg-[#fef3c7] text-[var(--medium)]', dot: 'bg-amber-400' };
    return { label: 'Offline', className: 'bg-[#eef0f2] text-[var(--muted)]', dot: 'bg-slate-300' };
  }

  async function handleLogin(u) {
    setUser(u);
    setBooting(true);
    seenToastIds.current = new Set();
    seenChatIds.current = new Set();
    seenCodeIds.current = new Set();
    seenNotifIds.current = new Set();
    sinceRef.current = null;
    chatSinceRef.current = null;
    codeSinceRef.current = null;
    notifSinceRef.current = null;
    setUnreadChat(0);
    setUnreadCode(0);
    setNotifUnread(0);
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
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
    setMessages([]);
    setSnippets([]);
    setNotifications([]);
    setChatDraft('');
    setUnreadChat(0);
    setUnreadCode(0);
    setNotifUnread(0);
    setNotifOpen(false);
  }

  async function markNotifsRead(id) {
    try {
      const data = await api('/api/notifications', {
        method: 'PATCH',
        body: JSON.stringify(id ? { id } : {}),
      });
      setNotifUnread(data.unread || 0);
      setNotifications((prev) =>
        prev.map((n) => (id ? (n.id === id ? { ...n, read: true } : n) : { ...n, read: true }))
      );
    } catch {
      /* ignore */
    }
  }

  function openNotification(n) {
    markNotifsRead(n.id);
    setNotifOpen(false);
    if (n.linkTab) setTab(n.linkTab);
  }

  async function sendChat(e) {
    e?.preventDefault?.();
    const text = chatDraft.trim();
    if (!text || chatSending) return;
    setChatSending(true);
    if (typingClearRef.current) clearTimeout(typingClearRef.current);
    try {
      const data = await api('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ text, replyToId: replyTo?.id || '' }),
      });
      setChatDraft('');
      chatDraftRef.current = '';
      setReplyTo(null);
      api('/api/presence', {
        method: 'POST',
        body: JSON.stringify({ focused: true, deltaSeconds: 0, typing: false }),
      }).catch(() => {});
      if (data.message) {
        seenChatIds.current.add(data.message.id);
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }
      if (data.settings) setChatSettings(data.settings);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setChatSending(false);
    }
  }

  async function reactToMessage(id, emoji) {
    try {
      const data = await api('/api/chat', {
        method: 'PATCH',
        body: JSON.stringify({ id, emoji }),
      });
      if (data.message) {
        setMessages((prev) => prev.map((m) => (m.id === data.message.id ? data.message : m)));
      }
      setReactMenuId(null);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function updateChatSetting(patch) {
    try {
      const data = await api('/api/chat', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'settings', ...patch }),
      });
      if (data.settings) setChatSettings(data.settings);
      const mark = tabRef.current === 'chat' ? '?markSeen=1' : '';
      const chat = await api(`/api/chat${mark}`);
      setMessages(chat.messages || []);
      if (chat.settings) setChatSettings(chat.settings);
      if (typeof chat.partnerTyping === 'boolean') setPartnerTyping(chat.partnerTyping);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function clearChat() {
    if (clearingChat) return;
    if (!window.confirm('Clear the entire chat for both of you? This cannot be undone.')) return;
    setClearingChat(true);
    try {
      const data = await api('/api/chat', { method: 'DELETE' });
      setMessages([]);
      seenChatIds.current = new Set();
      setUnreadChat(0);
      setReplyTo(null);
      setReactMenuId(null);
      if (data.settings) setChatSettings(data.settings);
      setChatSettingsOpen(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setClearingChat(false);
    }
  }

  async function deleteMessage(id) {
    try {
      await api(`/api/chat?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      setMessages((prev) => prev.filter((m) => m.id !== id));
      setReactMenuId(null);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function copyMessage(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied', { autoClose: 1200 });
    } catch {
      toast.error('Could not copy');
    }
  }

  function onChatDraftChange(value) {
    setChatDraft(value);
    chatDraftRef.current = value;
    if (typingClearRef.current) clearTimeout(typingClearRef.current);
    if (value.trim()) {
      api('/api/presence', {
        method: 'POST',
        body: JSON.stringify({ focused: true, deltaSeconds: 0, typing: true }),
      }).catch(() => {});
      // Keep typing alive while still composing
      typingClearRef.current = setTimeout(() => {
        if (chatDraftRef.current.trim()) {
          api('/api/presence', {
            method: 'POST',
            body: JSON.stringify({ focused: true, deltaSeconds: 0, typing: true }),
          }).catch(() => {});
          typingClearRef.current = setTimeout(() => {
            if (!chatDraftRef.current.trim()) {
              api('/api/presence', {
                method: 'POST',
                body: JSON.stringify({ focused: true, deltaSeconds: 0, typing: false }),
              }).catch(() => {});
            }
          }, 4000);
        } else {
          api('/api/presence', {
            method: 'POST',
            body: JSON.stringify({ focused: true, deltaSeconds: 0, typing: false }),
          }).catch(() => {});
        }
      }, 2500);
    } else {
      api('/api/presence', {
        method: 'POST',
        body: JSON.stringify({ focused: true, deltaSeconds: 0, typing: false }),
      }).catch(() => {});
    }
  }

  async function shareCode(e) {
    e?.preventDefault?.();
    if (!codeTitle.trim() || !codeBody.trim() || codeSending) return;
    setCodeSending(true);
    try {
      const data = await api('/api/code', {
        method: 'POST',
        body: JSON.stringify({
          title: codeTitle.trim(),
          language: codeLang,
          code: codeBody,
          note: codeNote.trim(),
          qid: codeQid,
        }),
      });
      setCodeTitle('');
      setCodeBody('');
      setCodeNote('');
      setCodeQid('');
      if (data.snippet) {
        seenCodeIds.current.add(data.snippet.id);
        setSnippets((prev) => [data.snippet, ...prev.filter((s) => s.id !== data.snippet.id)]);
        setExpandedCodeId(data.snippet.id);
      }
      toast.success('Code shared');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCodeSending(false);
    }
  }

  async function deleteSnippet(id) {
    try {
      await api(`/api/code?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      setSnippets((prev) => prev.filter((s) => s.id !== id));
      if (expandedCodeId === id) setExpandedCodeId(null);
      toast.info('Share deleted');
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function copyCode(code) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Could not copy');
    }
  }

  async function toggle(qid) {
    setBusyId(qid);
    try {
      const data = await api('/api/progress', {
        method: 'POST',
        body: JSON.stringify({ qid }),
      });
      applyProgress(data);
      loadBoard();
      if (data.toastHint) toast.success(data.toastHint);
      else if (data.action === 'finished') toast.success('Marked as finished');
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
    <div className={tab === 'chat' ? 'flex h-[100dvh] flex-col overflow-hidden' : 'min-h-screen'}>
      <ToastContainer
        position="top-right"
        autoClose={4500}
        newestOnTop
        pauseOnHover
        theme="light"
        toastClassName="!font-[Outfit] !rounded-xl !text-sm"
      />
      <header
        className={`z-20 flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] bg-white/85 px-5 py-3.5 backdrop-blur ${
          tab === 'chat' ? '' : 'sticky top-0'
        }`}
      >
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
            <button
              type="button"
              className={`relative rounded-lg px-3.5 py-1.5 text-sm font-semibold ${tab === 'chat' ? 'bg-white text-[var(--ink)] shadow-sm' : 'text-[var(--muted)]'}`}
              onClick={() => setTab('chat')}
            >
              Chat
              {unreadChat > 0 && tab !== 'chat' && (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--accent)] px-1 font-mono text-[0.6rem] text-white">
                  {unreadChat > 9 ? '9+' : unreadChat}
                </span>
              )}
            </button>
            <button
              type="button"
              className={`relative rounded-lg px-3.5 py-1.5 text-sm font-semibold ${tab === 'code' ? 'bg-white text-[var(--ink)] shadow-sm' : 'text-[var(--muted)]'}`}
              onClick={() => setTab('code')}
            >
              Code
              {unreadCode > 0 && tab !== 'code' && (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--accent)] px-1 font-mono text-[0.6rem] text-white">
                  {unreadCode > 9 ? '9+' : unreadCode}
                </span>
              )}
            </button>
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative" ref={notifPanelRef}>
            <button
              type="button"
              onClick={() => {
                const next = !notifOpen;
                setNotifOpen(next);
                if (next && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
                  Notification.requestPermission().catch(() => {});
                }
              }}
              className="relative rounded-[10px] border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-[var(--ink)]"
              aria-label="Notifications"
            >
              Alerts
              {notifUnread > 0 && (
                <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--accent)] px-1 font-mono text-[0.6rem] text-white">
                  {notifUnread > 9 ? '9+' : notifUnread}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 z-40 mt-2 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[var(--shadow)]">
                <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-2.5">
                  <p className="m-0 text-sm font-bold">Notifications</p>
                  <button
                    type="button"
                    onClick={() => markNotifsRead()}
                    className="text-xs font-semibold text-[var(--accent)]"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="max-h-[420px] overflow-y-auto">
                  {notifications.length === 0 && (
                    <p className="px-3 py-8 text-center text-sm text-[var(--muted)]">No notifications yet.</p>
                  )}
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => openNotification(n)}
                      className={`block w-full border-b border-[var(--line)] px-3 py-3 text-left hover:bg-[#f7faf8] ${n.read ? 'opacity-70' : 'bg-[#f1faf5]'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="m-0 text-sm font-semibold text-[var(--ink)]">{n.title}</p>
                        {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" />}
                      </div>
                      <p className="mt-1 mb-0 text-sm text-[var(--muted)]">{n.body}</p>
                      <p className="mt-1 mb-0 font-mono text-[0.65rem] text-[var(--muted)]">{timeAgo(n.createdAt)}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {people.map((p) => {
              const meta = statusMeta(p.status || (p.online ? 'active' : 'offline'));
              return (
                <div
                  key={p.username}
                  className="flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-xs font-semibold"
                  title={`${meta.label} · ${p.timeToday || '0s'} today`}
                >
                  <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                  <SnapAvatar username={p.username} size={22} className="avatar-pop" />
                  <span className="capitalize">{p.displayName}</span>
                  <span className="font-mono text-[0.65rem] text-[var(--muted)]">{p.timeToday || '0s'}</span>
                  {p.isYou && <span className="font-mono text-[0.65rem] text-[var(--muted)]">you</span>}
                </div>
              );
            })}
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

      <main
        className={
          tab === 'chat'
            ? 'mx-auto flex min-h-0 w-full max-w-[920px] flex-1 flex-col overflow-hidden px-3 py-3 sm:px-4'
            : 'mx-auto w-[min(1100px,calc(100%-2rem))] py-6 pb-12'
        }
      >
        {tab !== 'chat' && (
          <>
        <section className="mb-4 rounded-[18px] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow)] animate-rise">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="m-0 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
                30-day challenge
              </p>
              <h2 className="mt-1 mb-0 text-xl font-bold tracking-tight">8 questions every day</h2>
              <p className="mt-1 mb-0 text-sm text-[var(--muted)]">
                A streak day counts only after you finish {dailyGoal} questions today.
              </p>
            </div>
            <div className="text-right">
              <p className="m-0 text-2xl font-bold tabular-nums">
                {Math.min(todayCount, dailyGoal)}/{dailyGoal}
              </p>
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--muted)]">
                {todayComplete ? 'Daily goal complete' : 'Today toward streak'}
              </p>
            </div>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#e4ece8]">
            <div
              className={`h-full rounded-full transition-all ${todayComplete ? 'bg-[var(--accent)]' : 'bg-[#1d5f8a]'}`}
              style={{ width: `${todayPct}%` }}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="m-0 text-sm text-[var(--muted)]">
              Challenge days completed:{' '}
              <strong className="text-[var(--ink)]">
                {challengeCompleted}/{challengeDays}
              </strong>
            </p>
            <p className="m-0 font-mono text-xs text-[var(--muted)]">{challengePct}%</p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e4ece8]">
            <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${challengePct}%` }} />
          </div>
        </section>

        <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <article className="rounded-[14px] border border-[var(--line)] bg-white p-4 animate-rise">
            <p className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">Solved</p>
            <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{solvedCount}</p>
            <p className="text-sm text-[var(--muted)]">of {total}</p>
          </article>
          <article className="rounded-[14px] border border-transparent bg-gradient-to-br from-[#0f7a4f] to-[#149463] p-4 text-white animate-rise">
            <p className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-white/80">Current streak</p>
            <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{currentStreak}</p>
            <p className="text-sm text-white/80">days @ {dailyGoal}/day</p>
          </article>
          <article className="rounded-[14px] border border-[var(--line)] bg-white p-4 animate-rise">
            <p className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">Best streak</p>
            <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{bestStreak}</p>
            <p className="text-sm text-[var(--muted)]">days</p>
          </article>
          <article className="rounded-[14px] border border-[var(--line)] bg-white p-4 animate-rise">
            <p className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">Sheet progress</p>
            <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{pct}%</p>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#e4ece8]">
              <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${pct}%` }} />
            </div>
          </article>
        </section>
          </>
        )}

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
              Active / idle / offline status plus time spent with the tab focused. Toasts pop when the other person attempts or finishes a question.
            </p>

            <div className="mb-6 grid gap-3 sm:grid-cols-2">
              {people.map((p) => {
                const meta = statusMeta(p.status || (p.online ? 'active' : 'offline'));
                return (
                  <div key={p.username} className="rounded-xl border border-[var(--line)] bg-[#fbfdfc] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative shrink-0">
                          <SnapAvatar username={p.username} size={44} className="avatar-pop" />
                          <span
                            className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
                              p.status === 'active' ? 'bg-emerald-500' : p.status === 'idle' ? 'bg-amber-400' : 'bg-slate-300'
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="m-0 text-lg font-bold capitalize">{p.displayName}</p>
                          <p className="m-0 text-sm text-[var(--muted)]">
                            {p.isYou ? 'That’s you' : p.typing ? 'typing…' : 'Partner'}
                          </p>
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}`}>{meta.label}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--line)] pt-3">
                      <div>
                        <p className="m-0 text-[0.68rem] font-semibold uppercase tracking-[0.05em] text-[var(--muted)]">Time today</p>
                        <p className="m-0 font-mono text-sm font-semibold tabular-nums">{p.timeToday || '0s'}</p>
                      </div>
                      <div>
                        <p className="m-0 text-[0.68rem] font-semibold uppercase tracking-[0.05em] text-[var(--muted)]">All time</p>
                        <p className="m-0 font-mono text-sm font-semibold tabular-nums">{p.timeTotal || '0s'}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
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

        {tab === 'chat' && (
          <section className="chat-shell flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px] border border-[var(--line)] bg-white shadow-[var(--shadow)]">
            <div className="chat-shell-top flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] bg-white px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                {(() => {
                  const partner = people.find((p) => !p.isYou) || {
                    username: user.username === 'tej' ? 'hafsa' : 'tej',
                    displayName: user.username === 'tej' ? 'Hafsa' : 'Tej',
                    typing: false,
                    status: 'offline',
                    lastSeen: null,
                  };
                  const meta = statusMeta(partner.status || 'offline');
                  const showTyping = chatSettings.typingIndicators !== false && (partnerTyping || partner.typing);
                  return (
                    <>
                      <div className="relative">
                        <SnapAvatar username={partner.username} size={48} className="avatar-pop" />
                        <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${meta.dot}`} />
                      </div>
                      <div className="min-w-0">
                        <h2 className="m-0 text-xl font-bold tracking-tight capitalize">{partner.displayName}</h2>
                        <p className="m-0 text-sm text-[var(--muted)]">
                          {showTyping ? (
                            <span className="typing-dots text-[var(--accent)] font-semibold">typing</span>
                          ) : partner.status === 'offline' ? (
                            lastSeenLabel(partner.lastSeen)
                          ) : (
                            meta.label
                          )}
                          {partner.timeToday ? ` · ${partner.timeToday} today` : ''}
                          {chatSettings.disappearingOnSeen ? ' · vanish on seen' : ''}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
              <div className="relative" ref={chatSettingsRef}>
                <button
                  type="button"
                  onClick={() => setChatSettingsOpen((o) => !o)}
                  className="rounded-[10px] border border-[var(--line)] px-3 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-[#fbfdfc]"
                  aria-label="Chat settings"
                >
                  Settings
                </button>
                {chatSettingsOpen && (
                  <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-[var(--line)] bg-white p-3 shadow-[var(--shadow)]">
                    <p className="m-0 mb-3 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">Chat toggles</p>
                    <ChatToggle
                      label="Typing indicator"
                      hint="Show when the other person is typing"
                      checked={chatSettings.typingIndicators !== false}
                      onChange={(v) => updateChatSetting({ typingIndicators: v })}
                    />
                    <ChatToggle
                      label="Read receipts"
                      hint="Blue ticks when messages are seen"
                      checked={chatSettings.readReceipts !== false}
                      onChange={(v) => updateChatSetting({ readReceipts: v })}
                    />
                    <ChatToggle
                      label="Disappearing on seen"
                      hint="Messages vanish a few seconds after they’re read"
                      checked={!!chatSettings.disappearingOnSeen}
                      onChange={(v) => updateChatSetting({ disappearingOnSeen: v })}
                    />
                    <button
                      type="button"
                      onClick={clearChat}
                      disabled={clearingChat || messages.length === 0}
                      className="mt-1 w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      {clearingChat ? 'Clearing…' : 'Clear chat'}
                    </button>
                    <p className="mb-0 mt-2 text-[0.7rem] text-[var(--muted)]">Clear wipes history for both of you.</p>
                  </div>
                )}
              </div>
            </div>
            <div ref={chatScrollRef} className="chat-shell-messages">
              {messages.length === 0 && (
                <p className="py-12 text-center text-[var(--muted)]">No messages yet. Say hi and start the grind talk.</p>
              )}
              {messages.map((m, idx) => {
                const mine = m.username === user.username;
                const reactionEntries = Object.entries(m.reactions || {});
                return (
                  <div
                    key={m.id}
                    className={`chat-bubble-in flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}
                    style={{ animationDelay: `${Math.min(idx, 8) * 20}ms` }}
                  >
                    {!mine && <SnapAvatar username={m.username} size={32} />}
                    <div className="group relative max-w-[min(520px,78%)]">
                      <div
                        className={`rounded-2xl px-3.5 py-2.5 shadow-sm ${
                          mine ? 'rounded-br-md bg-[var(--accent)] text-white' : 'rounded-bl-md bg-white text-[var(--ink)]'
                        }`}
                      >
                        {m.replyTo && (
                          <div className={`mb-2 rounded-lg border-l-2 px-2 py-1 text-xs ${mine ? 'border-white/50 bg-white/10' : 'border-[var(--accent)] bg-[#eef4f0]'}`}>
                            <p className="m-0 font-semibold capitalize opacity-80">{m.replyTo.displayName}</p>
                            <p className="m-0 truncate opacity-80">{m.replyTo.text}</p>
                          </div>
                        )}
                        {!mine && <p className="m-0 mb-1 text-xs font-semibold capitalize opacity-80">{m.displayName}</p>}
                        <p className="m-0 whitespace-pre-wrap break-words text-sm leading-relaxed">{m.text}</p>
                        <p className={`m-0 mt-1 flex items-center justify-end gap-0.5 font-mono text-[0.65rem] ${mine ? 'text-white/70' : 'text-[var(--muted)]'}`}>
                          {chatSettings.disappearingOnSeen && (
                            <span className="mr-1" title="Disappears when seen" aria-label="Disappears when seen">
                              ◌
                            </span>
                          )}
                          <span>{timeAgo(m.createdAt)}</span>
                          {mine && chatSettings.readReceipts !== false && <ReadTicks seen={!!m.seen} />}
                        </p>
                      </div>
                      {reactionEntries.length > 0 && (
                        <div className={`mt-1 flex flex-wrap gap-1 ${mine ? 'justify-end' : 'justify-start'}`}>
                          {reactionEntries.map(([emoji, users]) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => reactToMessage(m.id, emoji)}
                              className={`rounded-full border border-[var(--line)] bg-white px-1.5 py-0.5 text-xs shadow-sm ${
                                users.includes(user.username) ? 'ring-1 ring-[var(--accent)]' : ''
                              }`}
                            >
                              {emoji} {users.length > 1 ? users.length : ''}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className={`absolute -bottom-2 ${mine ? 'left-0' : 'right-0'} hidden gap-1 group-hover:flex`}>
                        <button
                          type="button"
                          onClick={() => setReactMenuId(reactMenuId === m.id ? null : m.id)}
                          className="rounded-full border border-[var(--line)] bg-white px-2 py-0.5 text-[0.65rem] font-semibold shadow"
                        >
                          React
                        </button>
                        <button
                          type="button"
                          onClick={() => setReplyTo({ id: m.id, text: m.text, displayName: m.displayName })}
                          className="rounded-full border border-[var(--line)] bg-white px-2 py-0.5 text-[0.65rem] font-semibold shadow"
                        >
                          Reply
                        </button>
                        <button
                          type="button"
                          onClick={() => copyMessage(m.text)}
                          className="rounded-full border border-[var(--line)] bg-white px-2 py-0.5 text-[0.65rem] font-semibold shadow"
                        >
                          Copy
                        </button>
                        {mine && (
                          <button
                            type="button"
                            onClick={() => deleteMessage(m.id)}
                            className="rounded-full border border-red-200 bg-white px-2 py-0.5 text-[0.65rem] font-semibold text-red-600 shadow"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                      {reactMenuId === m.id && (
                        <div className={`absolute z-10 mt-2 flex gap-1 rounded-full border border-[var(--line)] bg-white p-1 shadow ${mine ? 'right-0' : 'left-0'}`}>
                          {REACTION_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => reactToMessage(m.id, emoji)}
                              className="rounded-full px-1.5 py-0.5 text-sm hover:scale-125 transition-transform"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {mine && <SnapAvatar username={m.username} size={32} />}
                  </div>
                );
              })}
              {chatSettings.typingIndicators !== false && (partnerTyping || people.some((p) => !p.isYou && p.typing)) && (
                <div className="chat-bubble-in flex items-end gap-2">
                  <SnapAvatar username={people.find((p) => !p.isYou)?.username} size={32} />
                  <div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm">
                    <span className="typing-dots text-[var(--muted)]">typing</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            {replyTo && (
              <div className="chat-shell-top flex shrink-0 items-center justify-between border-t border-[var(--line)] bg-[#f1faf5] px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="m-0 font-semibold text-[var(--accent)]">Replying to {replyTo.displayName}</p>
                  <p className="m-0 truncate text-[var(--muted)]">{replyTo.text}</p>
                </div>
                <button type="button" onClick={() => setReplyTo(null)} className="font-semibold text-[var(--muted)]">
                  ✕
                </button>
              </div>
            )}
            <form onSubmit={sendChat} className="chat-shell-top flex shrink-0 gap-2 border-t border-[var(--line)] bg-white p-3">
              <SnapAvatar username={user.username} size={36} className="mt-0.5" />
              <input
                value={chatDraft}
                onChange={(e) => onChatDraftChange(e.target.value)}
                placeholder="Type a message…"
                maxLength={2000}
                className="flex-1 rounded-[10px] border border-[var(--line)] bg-[#fbfdfc] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
              />
              <button
                type="submit"
                disabled={chatSending || !chatDraft.trim()}
                className="rounded-[10px] bg-[var(--accent)] px-4 py-2.5 font-semibold text-white hover:bg-[#0c6541] disabled:opacity-50"
              >
                {chatSending ? '…' : 'Send'}
              </button>
            </form>
          </section>
        )}

        {tab === 'code' && (
          <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
            <form onSubmit={shareCode} className="rounded-[18px] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow)]">
              <h2 className="m-0 text-xl font-bold tracking-tight">Share code</h2>
              <p className="mt-1 mb-4 text-sm text-[var(--muted)]">Post a solution so your partner can review and copy it.</p>
              <label className="mb-3 block text-sm font-medium">
                Title
                <input
                  value={codeTitle}
                  onChange={(e) => setCodeTitle(e.target.value)}
                  placeholder="e.g. Kadane DP approach"
                  required
                  className="mt-1.5 w-full rounded-[10px] border border-[var(--line)] bg-[#fbfdfc] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                />
              </label>
              <label className="mb-3 block text-sm font-medium">
                Language
                <select
                  value={codeLang}
                  onChange={(e) => setCodeLang(e.target.value)}
                  className="mt-1.5 w-full rounded-[10px] border border-[var(--line)] bg-[#fbfdfc] px-3 py-2.5"
                >
                  <option value="cpp">C++</option>
                  <option value="java">Java</option>
                  <option value="python">Python</option>
                  <option value="javascript">JavaScript</option>
                  <option value="c">C</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="mb-3 block text-sm font-medium">
                Linked question (optional)
                <select
                  value={codeQid}
                  onChange={(e) => setCodeQid(e.target.value)}
                  className="mt-1.5 w-full rounded-[10px] border border-[var(--line)] bg-[#fbfdfc] px-3 py-2.5"
                >
                  <option value="">No linked question</option>
                  {questions.map((q) => (
                    <option key={q.qid} value={q.qid}>
                      #{q.order} {q.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mb-3 block text-sm font-medium">
                Note (optional)
                <input
                  value={codeNote}
                  onChange={(e) => setCodeNote(e.target.value)}
                  placeholder="Time complexity, tip, etc."
                  className="mt-1.5 w-full rounded-[10px] border border-[var(--line)] bg-[#fbfdfc] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                />
              </label>
              <label className="mb-3 block text-sm font-medium">
                Code
                <textarea
                  value={codeBody}
                  onChange={(e) => setCodeBody(e.target.value)}
                  required
                  rows={12}
                  placeholder="Paste your solution…"
                  className="mt-1.5 w-full resize-y rounded-[10px] border border-[var(--line)] bg-[#0f1714] px-3 py-2.5 font-mono text-xs leading-relaxed text-[#d8f3e6] outline-none focus:border-[var(--accent)]"
                />
              </label>
              <button
                type="submit"
                disabled={codeSending || !codeTitle.trim() || !codeBody.trim()}
                className="w-full rounded-[10px] bg-[var(--accent)] px-4 py-2.5 font-semibold text-white hover:bg-[#0c6541] disabled:opacity-50"
              >
                {codeSending ? 'Sharing…' : 'Share with partner'}
              </button>
            </form>

            <div className="rounded-[18px] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow)]">
              <h2 className="m-0 text-xl font-bold tracking-tight">Shared solutions</h2>
              <p className="mt-1 mb-4 text-sm text-[var(--muted)]">Newest first — expand to view or copy.</p>
              <div className="grid gap-3">
                {snippets.length === 0 && <p className="py-10 text-center text-[var(--muted)]">No shared code yet.</p>}
                {snippets.map((s) => {
                  const open = expandedCodeId === s.id;
                  return (
                    <article key={s.id} className="rounded-xl border border-[var(--line)] bg-[#fbfdfc] p-3.5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="m-0 text-base font-bold">{s.title}</h3>
                          <p className="mt-1 m-0 font-mono text-xs text-[var(--muted)]">
                            <span className="capitalize text-[var(--accent)]">{s.displayName}</span>
                            {' · '}
                            {s.language}
                            {s.questionTitle ? ` · ${s.questionTitle}` : ''}
                            {' · '}
                            {timeAgo(s.createdAt)}
                          </p>
                          {s.note && <p className="mt-1 mb-0 text-sm text-[var(--muted)]">{s.note}</p>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setExpandedCodeId(open ? null : s.id)}
                            className="rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-xs font-semibold"
                          >
                            {open ? 'Hide' : 'View'}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyCode(s.code)}
                            className="rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-xs font-semibold"
                          >
                            Copy
                          </button>
                          {s.username === user.username && (
                            <button
                              type="button"
                              onClick={() => deleteSnippet(s.id)}
                              className="rounded-lg border border-[#fee4e2] bg-white px-2.5 py-1.5 text-xs font-semibold text-[var(--danger)]"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                      {open && (
                        <pre className="mt-3 max-h-[420px] overflow-auto rounded-xl bg-[#0f1714] p-3 font-mono text-xs leading-relaxed text-[#d8f3e6] whitespace-pre-wrap break-words">
                          {s.code}
                        </pre>
                      )}
                    </article>
                  );
                })}
              </div>
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
                        <label className="block text-[0.72rem] font-semibold uppercase tracking-[0.05em] text-[var(--muted)]">Today</label>
                        <strong className="text-xl tabular-nums">
                          {row.todayCount}/{row.dailyGoal}
                        </strong>
                      </div>
                      <div>
                        <label className="block text-[0.72rem] font-semibold uppercase tracking-[0.05em] text-[var(--muted)]">Challenge</label>
                        <strong className="text-xl tabular-nums">
                          {row.challengeCompleted}/{row.challengeDays}
                        </strong>
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
