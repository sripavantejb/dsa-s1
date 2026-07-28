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

  const overlay =
    inCall && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[200] flex items-end justify-center bg-[#0a1210]/92 p-3 pb-6 backdrop-blur-sm sm:items-center sm:p-4">
            <div className="relative flex max-h-[min(920px,100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#12201a] shadow-2xl">
              <div className="flex shrink-0 items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[0.7rem] font-semibold text-emerald-300">
                    <LockIcon /> E2E encrypted
                  </span>
                  {pcState && <span className="font-mono text-[0.65rem] text-white/35">{pcState}</span>}
                </div>
                {phase === 'connected' && (
                  <span className="font-mono text-sm text-white/70">{formatCallTime(elapsed)}</span>
                )}
              </div>

              <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-4">
                {isVideo ? (
                  <>
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className="h-[220px] w-full rounded-xl bg-black object-cover sm:h-[280px]"
                    />
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="absolute bottom-4 right-4 h-24 w-16 rounded-xl border border-white/20 bg-black object-cover shadow-lg sm:bottom-6 sm:right-6 sm:h-28 sm:w-20"
                    />
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-6">
                    <SnapAvatar username={partnerUser} size={96} className="avatar-pop ring-2 ring-white/20" />
                    <p className="m-0 text-xl font-bold capitalize text-white">{partnerName}</p>
                    <p className="m-0 text-sm text-white/60">{statusLabel}</p>
                  </div>
                )}

                <audio ref={remoteAudioRef} autoPlay playsInline className="mt-3 w-full max-w-xs" controls={needGesture} />

                {isVideo && <p className="mt-3 m-0 text-center text-sm text-white/70">{statusLabel}</p>}
                {needGesture && (
                  <button
                    type="button"
                    onClick={playRemote}
                    className="mt-3 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)]"
                  >
                    Tap to hear audio
                  </button>
                )}
                {error && <p className="mt-2 m-0 text-center text-sm text-red-300">{error}</p>}
              </div>

              {/* Always pinned at bottom of the card so End/Mute never get clipped */}
              <div className="flex shrink-0 items-center justify-center gap-3 border-t border-white/10 bg-[#0d1814] px-4 py-4">
                {incoming ? (
                  <>
                    <button
                      type="button"
                      onClick={declineCall}
                      className="min-w-[7rem] rounded-full bg-red-500 px-5 py-3.5 text-sm font-bold text-white hover:bg-red-600"
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      onClick={acceptCall}
                      className="min-w-[7rem] rounded-full bg-emerald-500 px-5 py-3.5 text-sm font-bold text-white hover:bg-emerald-600"
                    >
                      Accept
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={toggleMute}
                      className={`min-w-[5.5rem] rounded-full px-4 py-3.5 text-sm font-bold ${
                        muted ? 'bg-white text-[var(--ink)]' : 'bg-white/15 text-white hover:bg-white/25'
                      }`}
                    >
                      {muted ? 'Unmute' : 'Mute'}
                    </button>
                    {isVideo && (
                      <button
                        type="button"
                        onClick={toggleCam}
                        className={`min-w-[5.5rem] rounded-full px-4 py-3.5 text-sm font-bold ${
                          camOff ? 'bg-white text-[var(--ink)]' : 'bg-white/15 text-white hover:bg-white/25'
                        }`}
                      >
                        {camOff ? 'Cam on' : 'Cam off'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={hangup}
                      className="min-w-[5.5rem] rounded-full bg-red-500 px-5 py-3.5 text-sm font-bold text-white hover:bg-red-600"
                    >
                      End
                    </button>
                  </>
                )}
              </div>
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
          className="rounded-[10px] border border-[var(--line)] px-2.5 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-[#fbfdfc] disabled:opacity-40"
          title="Voice call · end-to-end encrypted"
        >
          Call
        </button>
        <button
          type="button"
          onClick={() => startCall('video')}
          disabled={!!inCall}
          className="rounded-[10px] border border-[var(--line)] px-2.5 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-[#fbfdfc] disabled:opacity-40"
          title="Video call · end-to-end encrypted"
        >
          Video
        </button>
      </div>
      {overlay}
    </>
  );
}
