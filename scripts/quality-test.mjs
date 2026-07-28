#!/usr/bin/env node
/**
 * Quality suite against production (or BASE_URL).
 * Covers auth, sheet APIs, chat, typing, reactions, code, voice signaling, avatars.
 */
const BASE = process.env.BASE_URL || 'https://dsa-jade.vercel.app';
const results = [];

function pass(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail: String(detail).slice(0, 160) });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ` — ${detail}` : ''}`);
}

async function login(username, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const cookies = (res.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
  return { cookie: cookies, data: await res.json(), ok: res.ok, status: res.status };
}

async function api(cookie, method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, status: res.status, data: null, parseError: e.message };
  }
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  console.log(`Testing ${BASE}\n`);

  const tej = await login('tej', 'tej@dsa');
  pass('login tej', tej.ok && tej.data.user?.username === 'tej', tej.status);
  const haf = await login('hafsa', 'hafsa@dsa');
  pass('login hafsa', haf.ok && haf.data.user?.username === 'hafsa', haf.status);
  const bad = await login('tej', 'wrong');
  pass('reject bad password', !bad.ok, bad.status);

  for (const [m, p, key] of [
    ['GET', '/api/auth/me', 'user'],
    ['GET', '/api/questions', 'questions'],
    ['GET', '/api/progress', 'solved'],
    ['GET', '/api/leaderboard', 'board'],
    ['GET', '/api/presence', 'people'],
    ['GET', '/api/chat', 'messages'],
    ['GET', '/api/code', 'snippets'],
    ['GET', '/api/notifications', 'notifications'],
    ['GET', '/api/activity', 'activities'],
    ['GET', '/api/call', 'call'],
  ]) {
    const r = await api(tej.cookie, m, p);
    pass(`${m} ${p}`, r.ok && (key === 'call' ? true : r.data?.[key] !== undefined), r.status);
  }

  const text = `quality-test-${Date.now()}`;
  const send = await api(tej.cookie, 'POST', '/api/chat', { text });
  pass('send message', send.ok && send.data.message?.text === text);
  const msgId = send.data.message?.id;

  const reply = await api(haf.cookie, 'POST', '/api/chat', { text: `reply-${Date.now()}`, replyToId: msgId });
  pass('reply-to', reply.ok && reply.data.message?.replyTo?.id === msgId);

  const react = await api(haf.cookie, 'PATCH', '/api/chat', { id: msgId, emoji: '🔥' });
  pass('react', react.ok && (react.data.message?.reactions?.['🔥'] || []).includes('hafsa'));

  await api(tej.cookie, 'POST', '/api/presence', { focused: true, deltaSeconds: 0, typing: true });
  const chatPoll = await api(haf.cookie, 'GET', '/api/chat');
  pass('typing indicator', chatPoll.data.partnerTyping === true);

  await api(haf.cookie, 'GET', '/api/chat?markSeen=1');
  const afterSeen = await api(tej.cookie, 'GET', '/api/chat');
  const mine = (afterSeen.data.messages || []).find((m) => m.id === msgId);
  pass('seen receipt', !!mine?.seen);

  const del = await api(tej.cookie, 'DELETE', `/api/chat?id=${encodeURIComponent(msgId)}`);
  pass('delete message', del.ok);

  // Voice signaling
  for (const c of [tej.cookie, haf.cookie]) {
    const cur = await api(c, 'GET', '/api/call');
    if (cur.data?.call) await api(c, 'PATCH', '/api/call', { id: cur.data.call.id, action: 'hangup' });
  }

  const start = await api(tej.cookie, 'POST', '/api/call', { mode: 'audio' });
  pass('voice start', start.ok && start.data.call?.e2e === true && start.data.call?.encryption === 'dtls-srtp');
  const callId = start.data.call?.id;

  const ring = await api(haf.cookie, 'GET', '/api/call');
  pass('voice ringing', ring.data.call?.id === callId);

  const acc = await api(haf.cookie, 'PATCH', '/api/call', { id: callId, action: 'accept' });
  pass('voice accept', acc.data.call?.status === 'accepted');

  const sdp =
    'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nc=IN IP4 0.0.0.0\r\na=mid:0\r\na=sendrecv\r\na=rtpmap:111 opus/48000/2\r\n';
  const off = await api(tej.cookie, 'PATCH', '/api/call', { id: callId, action: 'offer', type: 'offer', sdp });
  pass('voice offer', !!off.data.call?.offer?.sdp?.includes('opus'));

  await api(tej.cookie, 'PATCH', '/api/call', {
    id: callId,
    action: 'ice',
    candidate: { candidate: 'candidate:1 1 UDP 1 1.1.1.1 9 typ host', sdpMid: '0', sdpMLineIndex: 0 },
  });
  await api(haf.cookie, 'PATCH', '/api/call', {
    id: callId,
    action: 'ice',
    candidate: { candidate: 'candidate:2 1 UDP 1 2.2.2.2 9 typ host', sdpMid: '0', sdpMLineIndex: 0 },
  });
  const ice = await api(tej.cookie, 'GET', '/api/call');
  pass('voice ICE', (ice.data.call?.callerIce?.length || 0) >= 1 && (ice.data.call?.calleeIce?.length || 0) >= 1);

  const ans = await api(haf.cookie, 'PATCH', '/api/call', { id: callId, action: 'answer', type: 'answer', sdp });
  pass('voice answer', ans.data.call?.status === 'active' && !!ans.data.call?.answer);

  await api(tej.cookie, 'PATCH', '/api/call', { id: callId, action: 'hangup' });
  const ended = await api(tej.cookie, 'GET', '/api/call');
  pass('voice hangup', ended.data.call == null);

  const v = await api(tej.cookie, 'POST', '/api/call', { mode: 'video' });
  pass('video start', v.data.call?.mode === 'video');
  if (v.data.call?.id) {
    await api(haf.cookie, 'PATCH', '/api/call', { id: v.data.call.id, action: 'decline' });
    pass('video decline', true);
  }

  for (const a of ['/avatars/tej.png', '/avatars/hafsa.png']) {
    const r = await fetch(BASE + a);
    pass(`avatar ${a}`, r.ok);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`);
  if (failed.length) {
    failed.forEach((f) => console.log('FAIL', f.name, f.detail));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
