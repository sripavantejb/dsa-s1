'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SnapAvatar } from './SnapAvatar';

/** Multiple STUN/TURN so calls connect across Wi‑Fi / mobile NATs */
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    // freeTURN (no signup)
    { urls: 'turn:freeturn.net:3478', username: 'free', credential: 'free' },
    { urls: 'turn:freeturn.net:3478?transport=tcp', username: 'free', credential: 'free' },
    { urls: 'turns:freeturn.net:5349', username: 'free', credential: 'free' },
    // Metered Open Relay
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
  iceCandidatePoolSize: 8,
};

const LIVE = new Set(['ringing', 'accepted', 'active']);

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

function formatCallTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17 8h-1V6a4 4 0 10-8 0v2H7a2 2 0 00-2 2v8a2 2 0 002 2h10a2 2 0 002-2v-8a2 2 0 00-2-2zm-7-2a2 2 0 114 0v2h-4V6z" />
    </svg>
  );
}

export function CallController({ user, partner, startButtonsClassName = '' }) {
  const [call, setCall] = useState(null);
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState('');
  const [pcState, setPcState] = useState('');
  const [needGesture, setNeedGesture] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const callIdRef = useRef(null);
  const appliedIceRef = useRef(new Set());
  const pendingIceRef = useRef([]);
  const offerSentRef = useRef(false);
  const answerSentRef = useRef(false);
  const remoteDescSetRef = useRef(false);
  const startedAtRef = useRef(null);
  const busyRef = useRef(false);
  const handleSignalRef = useRef(async () => {});

  const playRemote = useCallback(async () => {
    const audio = remoteAudioRef.current;
    const video = remoteVideoRef.current;
    const stream = remoteStreamRef.current;
    if (stream) {
      if (audio && audio.srcObject !== stream) audio.srcObject = stream;
      if (video && video.srcObject !== stream) video.srcObject = stream;
    }
    try {
      if (audio) {
        audio.muted = false;
        audio.volume = 1;
        await audio.play();
      }
      if (video) await video.play();
      setNeedGesture(false);
    } catch {
      setNeedGesture(true);
    }
  }, []);

  const attachRemoteStream = useCallback(
    (stream) => {
      if (!stream) return;
      remoteStreamRef.current = stream;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
      playRemote();
    },
    [playRemote]
  );

  const cleanupMedia = useCallback(() => {
    if (pcRef.current) {
      try {
        pcRef.current.onicecandidate = null;
        pcRef.current.ontrack = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.oniceconnectionstatechange = null;
        pcRef.current.close();
      } catch {
        /* ignore */
      }
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    remoteStreamRef.current = null;
    offerSentRef.current = false;
    answerSentRef.current = false;
    remoteDescSetRef.current = false;
    appliedIceRef.current = new Set();
    pendingIceRef.current = [];
    busyRef.current = false;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
  }, []);

  const resetCallUi = useCallback(() => {
    cleanupMedia();
    setCall(null);
    callIdRef.current = null;
    startedAtRef.current = null;
    setElapsed(0);
    setPhase('');
    setPcState('');
    setMuted(false);
    setCamOff(false);
    setError('');
    setNeedGesture(false);
  }, [cleanupMedia]);

  const flushPendingIce = useCallback(async () => {
    const pc = pcRef.current;
    // Flush locally gathered ICE that waited for call id
    if (callIdRef.current) {
      const localQueued = pendingIceRef.current.filter((c) => c._local);
      pendingIceRef.current = pendingIceRef.current.filter((c) => !c._local);
      for (const c of localQueued) {
        api('/api/call', {
          method: 'PATCH',
          body: JSON.stringify({
            id: callIdRef.current,
            action: 'ice',
            candidate: {
              candidate: c.candidate,
              sdpMid: c.sdpMid,
              sdpMLineIndex: c.sdpMLineIndex,
            },
          }),
        }).catch(() => {});
      }
    }
    if (!pc || !remoteDescSetRef.current) return;
    const queued = pendingIceRef.current.splice(0);
    for (const c of queued) {
      if (c._local) continue;
      const key = c.candidate;
      if (!key || appliedIceRef.current.has(key)) continue;
      appliedIceRef.current.add(key);
      try {
        await pc.addIceCandidate(
          new RTCIceCandidate({
            candidate: c.candidate,
            sdpMid: c.sdpMid,
            sdpMLineIndex: c.sdpMLineIndex,
          })
        );
      } catch {
        /* ignore */
      }
    }
  }, []);

  const ensurePc = useCallback(
    async (mode) => {
      if (pcRef.current) return pcRef.current;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: mode === 'video' ? { facingMode: 'user' } : false,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        localVideoRef.current.play().catch(() => {});
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const remote = new MediaStream();
      remoteStreamRef.current = remote;
      pc.ontrack = (ev) => {
        if (ev.track) remote.addTrack(ev.track);
        attachRemoteStream(remote);
      };

      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return;
        const entry = {
          candidate: ev.candidate.candidate,
          sdpMid: ev.candidate.sdpMid,
          sdpMLineIndex: ev.candidate.sdpMLineIndex,
        };
        if (!callIdRef.current) {
          // Queue until call id exists
          pendingIceRef.current.push({ ...entry, _local: true });
          return;
        }
        api('/api/call', {
          method: 'PATCH',
          body: JSON.stringify({
            id: callIdRef.current,
            action: 'ice',
            candidate: entry,
          }),
        }).catch(() => {});
      };

      const markConnected = () => {
        if (startedAtRef.current) return;
        startedAtRef.current = Date.now();
        setPhase('connected');
        playRemote();
        api('/api/call', {
          method: 'PATCH',
          body: JSON.stringify({ id: callIdRef.current, action: 'active' }),
        }).catch(() => {});
      };

      const onConn = () => {
        const ice = pc.iceConnectionState;
        const conn = pc.connectionState;
        setPcState(conn || ice);
        if (conn === 'connected' || ice === 'connected' || ice === 'completed') {
          markConnected();
        }
        if (conn === 'failed' || ice === 'failed') {
          setError('Could not connect — both open the site, allow mic, try again');
          try {
            pc.restartIce();
          } catch {
            /* ignore */
          }
        }
      };
      pc.onconnectionstatechange = onConn;
      pc.oniceconnectionstatechange = onConn;

      return pc;
    },
    [attachRemoteStream, playRemote]
  );

  const applyRemoteIce = useCallback(async (list) => {
    if (!list?.length) return;
    for (const c of list) {
      if (!c?.candidate) continue;
      if (appliedIceRef.current.has(c.candidate)) continue;
      if (!remoteDescSetRef.current || !pcRef.current) {
        pendingIceRef.current.push(c);
        continue;
      }
      appliedIceRef.current.add(c.candidate);
      try {
        await pcRef.current.addIceCandidate(
          new RTCIceCandidate({
            candidate: c.candidate,
            sdpMid: c.sdpMid,
            sdpMLineIndex: c.sdpMLineIndex,
          })
        );
      } catch {
        /* ignore */
      }
    }
  }, []);

  const handleSignal = useCallback(
    async (c) => {
      if (!c || !LIVE.has(c.status)) return;
      callIdRef.current = c.id;
      const iAmCaller = c.callerUsername === user.username;

      if (iAmCaller && (c.status === 'accepted' || c.status === 'active') && !offerSentRef.current) {
        if (busyRef.current) return;
        busyRef.current = true;
        setPhase('connecting');
        try {
          const pc = await ensurePc(c.mode);
          if (!offerSentRef.current) {
            offerSentRef.current = true;
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await api('/api/call', {
              method: 'PATCH',
              body: JSON.stringify({ id: c.id, action: 'offer', type: offer.type, sdp: offer.sdp }),
            });
            await flushPendingIce();
          }
        } catch (err) {
          offerSentRef.current = false;
          setError(err.message || 'Allow microphone access to call');
        } finally {
          busyRef.current = false;
        }
      }

      if (!iAmCaller && (c.status === 'accepted' || c.status === 'active') && c.offer?.sdp && !answerSentRef.current) {
        if (busyRef.current) return;
        busyRef.current = true;
        setPhase('connecting');
        try {
          const pc = await ensurePc(c.mode);
          if (!remoteDescSetRef.current) {
            await pc.setRemoteDescription(
              new RTCSessionDescription({ type: c.offer.type || 'offer', sdp: c.offer.sdp })
            );
            remoteDescSetRef.current = true;
            await flushPendingIce();
          }
          if (!answerSentRef.current) {
            answerSentRef.current = true;
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await api('/api/call', {
              method: 'PATCH',
              body: JSON.stringify({ id: c.id, action: 'answer', type: answer.type, sdp: answer.sdp }),
            });
            await flushPendingIce();
          }
        } catch (err) {
          answerSentRef.current = false;
          remoteDescSetRef.current = false;
          setError(err.message || 'Allow microphone access to answer');
        } finally {
          busyRef.current = false;
        }
      }

      if (iAmCaller && c.answer?.sdp && pcRef.current && !remoteDescSetRef.current) {
        try {
          await pcRef.current.setRemoteDescription(
            new RTCSessionDescription({ type: c.answer.type || 'answer', sdp: c.answer.sdp })
          );
          remoteDescSetRef.current = true;
          await flushPendingIce();
        } catch (err) {
          setError(err.message || 'Failed to connect media');
        }
      }

      await applyRemoteIce(iAmCaller ? c.calleeIce : c.callerIce);
    },
    [applyRemoteIce, ensurePc, flushPendingIce, user.username]
  );

  handleSignalRef.current = handleSignal;

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const data = await api('/api/call');
        if (!alive) return;
        const c = data.call;
        setCall(c);
        if (!c || !LIVE.has(c.status)) {
          if (callIdRef.current) resetCallUi();
          return;
        }
        if (c.status === 'ringing' && c.callerUsername === user.username) setPhase('calling');
        await handleSignalRef.current(c);
      } catch {
        /* ignore */
      }
    };
    tick();
    const t = setInterval(tick, 400);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [resetCallUi, user.username]);

  useEffect(() => {
    if (phase !== 'connected') return undefined;
    const t = setInterval(() => {
      if (startedAtRef.current) setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => () => cleanupMedia(), [cleanupMedia]);

  const inCall = !!(call && LIVE.has(call.status));

  useEffect(() => {
    if (!call || !mounted || !inCall) return;
    // Portal just mounted — rebind media elements
    const t = requestAnimationFrame(() => {
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.muted = true;
        localVideoRef.current.play().catch(() => {});
      }
      if (remoteStreamRef.current) attachRemoteStream(remoteStreamRef.current);
    });
    return () => cancelAnimationFrame(t);
  }, [call, mounted, inCall, attachRemoteStream]);

  async function startCall(mode) {
    setError('');
    setPhase('calling');
    try {
      // Always start fresh so a previous failed call can't poison WebRTC
      cleanupMedia();
      await ensurePc(mode);
      const data = await api('/api/call', {
        method: 'POST',
        body: JSON.stringify({ mode }),
      });
      setCall(data.call);
      callIdRef.current = data.call.id;
      await flushPendingIce();
      await handleSignal(data.call);
    } catch (err) {
      setError(err.message || 'Could not start call');
      setPhase('');
      cleanupMedia();
    }
  }

  async function acceptCall() {
    if (!call) return;
    setError('');
    setPhase('connecting');
    try {
      if (!pcRef.current) await ensurePc(call.mode);
      await playRemote();
      const data = await api('/api/call', {
        method: 'PATCH',
        body: JSON.stringify({ id: call.id, action: 'accept' }),
      });
      setCall(data.call);
      callIdRef.current = data.call.id;
      await flushPendingIce();
      await handleSignal(data.call);
    } catch (err) {
      setError(err.message || 'Could not accept');
      setPhase('');
    }
  }

  async function declineCall() {
    if (!call) return;
    try {
      await api('/api/call', {
        method: 'PATCH',
        body: JSON.stringify({ id: call.id, action: 'decline' }),
      });
    } catch {
      /* ignore */
    }
    resetCallUi();
  }

  async function hangup() {
    try {
      if (callIdRef.current) {
        await api('/api/call', {
          method: 'PATCH',
          body: JSON.stringify({ id: callIdRef.current, action: 'hangup' }),
        });
      }
    } catch {
      /* ignore */
    }
    resetCallUi();
  }

  function toggleMute() {
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setMuted((m) => !m);
  }

  function toggleCam() {
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setCamOff((v) => !v);
  }

  const partnerName = partner?.displayName || call?.callerDisplayName || call?.calleeDisplayName || 'Partner';
  const partnerUser =
    partner?.username ||
    (call ? (call.callerUsername === user.username ? call.calleeUsername : call.callerUsername) : '');
  const iAmCaller = call?.callerUsername === user.username;
  const incoming = call?.status === 'ringing' && !iAmCaller;
  const isVideo = call?.mode === 'video';

  const statusLabel = incoming
    ? 'Incoming call…'
    : phase === 'connected'
      ? 'Connected'
      : phase === 'calling' || call?.status === 'ringing'
        ? 'Ringing…'
        : 'Connecting…';

  const controlBtn = (label, onClick, bg, color = '#fff') => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      style={{
        minWidth: 100,
        borderRadius: 999,
        border: 'none',
        background: bg,
        color,
        padding: '16px 24px',
        fontSize: 16,
        fontWeight: 800,
        cursor: 'pointer',
        boxShadow: '0 10px 28px rgba(0,0,0,0.4)',
      }}
    >
      {label}
    </button>
  );

  const overlay =
    inCall && mounted
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Call"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 2147483000,
              display: 'flex',
              flexDirection: 'column',
              background: 'rgba(10, 18, 16, 0.95)',
            }}
          >
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px 16px 140px',
                overflow: 'auto',
              }}
            >
              <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    borderRadius: 999,
                    background: 'rgba(16,185,129,0.18)',
                    color: '#6ee7b7',
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '5px 12px',
                  }}
                >
                  <LockIcon /> E2E encrypted
                </span>
                {phase === 'connected' && (
                  <span style={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.75)', fontSize: 14 }}>
                    {formatCallTime(elapsed)}
                  </span>
                )}
              </div>

              {isVideo ? (
                <div style={{ position: 'relative', width: '100%', maxWidth: 480 }}>
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    style={{ width: '100%', height: 260, borderRadius: 16, background: '#000', objectFit: 'cover' }}
                  />
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      position: 'absolute',
                      right: 12,
                      bottom: 12,
                      width: 88,
                      height: 120,
                      borderRadius: 12,
                      background: '#000',
                      objectFit: 'cover',
                      border: '1px solid rgba(255,255,255,0.25)',
                    }}
                  />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <SnapAvatar username={partnerUser} size={110} className="avatar-pop" />
                  <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#fff', textTransform: 'capitalize' }}>
                    {partnerName}
                  </p>
                  <p style={{ margin: 0, fontSize: 15, color: 'rgba(255,255,255,0.7)' }}>{statusLabel}</p>
                </div>
              )}

              <audio
                ref={remoteAudioRef}
                autoPlay
                playsInline
                style={{ marginTop: 18, width: 'min(100%, 280px)' }}
                controls={needGesture}
              />

              {needGesture && (
                <button
                  type="button"
                  onClick={playRemote}
                  style={{
                    marginTop: 12,
                    borderRadius: 999,
                    background: '#fff',
                    color: '#14201b',
                    border: 'none',
                    padding: '12px 18px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Tap to hear audio
                </button>
              )}
              {error && <p style={{ marginTop: 12, color: '#fca5a5', fontSize: 14, textAlign: 'center' }}>{error}</p>}
            </div>

            <div
              style={{
                position: 'fixed',
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 2147483001,
                display: 'flex',
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: 12,
                padding: '18px 16px calc(18px + env(safe-area-inset-bottom, 0px))',
                background: 'rgba(8,14,12,0.96)',
                borderTop: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              {incoming ? (
                <>
                  {controlBtn('Decline', declineCall, '#ef4444')}
                  {controlBtn('Accept', acceptCall, '#10b981')}
                </>
              ) : (
                <>
                  {controlBtn(muted ? 'Unmute' : 'Mute', toggleMute, muted ? '#fff' : 'rgba(255,255,255,0.2)', muted ? '#14201b' : '#fff')}
                  {isVideo
                    ? controlBtn(camOff ? 'Cam on' : 'Cam off', toggleCam, camOff ? '#fff' : 'rgba(255,255,255,0.2)', camOff ? '#14201b' : '#fff')
                    : null}
                  {controlBtn('End', hangup, '#ef4444')}
                </>
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div className={`flex items-center gap-1.5 ${startButtonsClassName}`}>
        <button
          type="button"
          onClick={() => startCall('audio')}
          disabled={!!inCall}
          className="rounded-[10px] border border-[var(--line)] bg-white px-2.5 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-[#fbfdfc] disabled:opacity-40"
          title="Voice call · end-to-end encrypted"
        >
          Call
        </button>
        <button
          type="button"
          onClick={() => startCall('video')}
          disabled={!!inCall}
          className="rounded-[10px] border border-[var(--line)] bg-white px-2.5 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-[#fbfdfc] disabled:opacity-40"
          title="Video call · end-to-end encrypted"
        >
          Video
        </button>
      </div>
      {overlay}
    </>
  );
}
