'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SnapAvatar } from './SnapAvatar';

/** STUN + public TURN so calls work across different networks/NATs */
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
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

/**
 * WebRTC voice/video — media is DTLS-SRTP E2E; signaling via /api/call.
 */
export function CallController({ user, partner, startButtonsClassName = '' }) {
  const [call, setCall] = useState(null);
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState(''); // calling | connecting | connected
  const [pcState, setPcState] = useState('');

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
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

  const attachRemoteStream = useCallback((stream) => {
    if (!stream) return;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = stream;
      remoteAudioRef.current.volume = 1;
      remoteAudioRef.current.muted = false;
      remoteAudioRef.current.play().catch(() => {});
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, []);

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
  }, [cleanupMedia]);

  const flushPendingIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !remoteDescSetRef.current) return;
    const queued = pendingIceRef.current.splice(0);
    for (const c of queued) {
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
        video: mode === 'video',
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

      pc.ontrack = (ev) => {
        const remote = ev.streams?.[0] || new MediaStream([ev.track]);
        attachRemoteStream(remote);
      };

      pc.onicecandidate = (ev) => {
        if (!ev.candidate || !callIdRef.current) return;
        api('/api/call', {
          method: 'PATCH',
          body: JSON.stringify({
            id: callIdRef.current,
            action: 'ice',
            candidate: {
              candidate: ev.candidate.candidate,
              sdpMid: ev.candidate.sdpMid,
              sdpMLineIndex: ev.candidate.sdpMLineIndex,
            },
          }),
        }).catch(() => {});
      };

      const onConn = () => {
        const state = pc.connectionState || pc.iceConnectionState;
        setPcState(state);
        if ((pc.connectionState === 'connected' || pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') && !startedAtRef.current) {
          startedAtRef.current = Date.now();
          setPhase('connected');
          // Ensure audio is playing once connected
          if (remoteAudioRef.current?.srcObject) {
            remoteAudioRef.current.play().catch(() => {});
          }
          api('/api/call', {
            method: 'PATCH',
            body: JSON.stringify({ id: callIdRef.current, action: 'active' }),
          }).catch(() => {});
        }
        if (pc.connectionState === 'failed' || pc.iceConnectionState === 'failed') {
          setError('Could not connect — check mic permission, or try again');
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
    [attachRemoteStream]
  );

  const applyRemoteIce = useCallback(
    async (list) => {
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
    },
    []
  );

  const handleSignal = useCallback(
    async (c) => {
      if (!c || !LIVE.has(c.status)) return;
      callIdRef.current = c.id;
      const iAmCaller = c.callerUsername === user.username;

      // Wait until callee accepts before creating WebRTC offer (avoids stale ICE)
      if (iAmCaller && (c.status === 'accepted' || c.status === 'active') && !offerSentRef.current) {
        if (busyRef.current) return;
        busyRef.current = true;
        setPhase('connecting');
        try {
          const pc = await ensurePc(c.mode);
          if (!offerSentRef.current) {
            offerSentRef.current = true;
            const offer = await pc.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: c.mode === 'video',
            });
            await pc.setLocalDescription(offer);
            await api('/api/call', {
              method: 'PATCH',
              body: JSON.stringify({ id: c.id, action: 'offer', type: offer.type, sdp: offer.sdp }),
            });
          }
        } catch (err) {
          offerSentRef.current = false;
          setError(err.message || 'Allow microphone access to call');
          setPhase('');
        } finally {
          busyRef.current = false;
        }
      }

      // Callee answers after accept when offer is ready
      if (!iAmCaller && (c.status === 'accepted' || c.status === 'active') && c.offer?.sdp && !answerSentRef.current) {
        if (busyRef.current) return;
        busyRef.current = true;
        setPhase('connecting');
        try {
          const pc = await ensurePc(c.mode);
          if (!remoteDescSetRef.current) {
            await pc.setRemoteDescription(new RTCSessionDescription({ type: c.offer.type || 'offer', sdp: c.offer.sdp }));
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
          }
        } catch (err) {
          answerSentRef.current = false;
          remoteDescSetRef.current = false;
          setError(err.message || 'Allow microphone access to answer');
          setPhase('');
        } finally {
          busyRef.current = false;
        }
      }

      // Caller applies answer
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

      // Exchange ICE
      const remoteIce = iAmCaller ? c.calleeIce : c.callerIce;
      await applyRemoteIce(remoteIce);
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
    const t = setInterval(tick, 500);
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

  // Re-attach local preview when video element mounts in overlay
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      localVideoRef.current.muted = true;
      localVideoRef.current.play().catch(() => {});
    }
  }, [call?.mode, call?.status]);

  async function startCall(mode) {
    setError('');
    setPhase('calling');
    try {
      const data = await api('/api/call', {
        method: 'POST',
        body: JSON.stringify({ mode }),
      });
      setCall(data.call);
      callIdRef.current = data.call.id;
      await handleSignal(data.call);
    } catch (err) {
      setError(err.message || 'Could not start call');
      setPhase('');
    }
  }

  async function acceptCall() {
    if (!call) return;
    setError('');
    setPhase('connecting');
    try {
      // Unlock audio playback with this user gesture
      if (remoteAudioRef.current) {
        remoteAudioRef.current.play().catch(() => {});
      }
      const data = await api('/api/call', {
        method: 'PATCH',
        body: JSON.stringify({ id: call.id, action: 'accept' }),
      });
      setCall(data.call);
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
  const inCall = call && LIVE.has(call.status);
  const isVideo = call?.mode === 'video';

  const statusLabel = incoming
    ? 'Incoming call…'
    : phase === 'connected' || call?.status === 'active'
      ? 'Connected'
      : phase === 'calling' || call?.status === 'ringing'
        ? 'Calling…'
        : phase === 'connecting'
          ? 'Connecting…'
          : 'Connecting…';

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

      {/* Always in DOM so autoplay unlock + audio works */}
      <audio ref={remoteAudioRef} autoPlay playsInline controls={false} className="pointer-events-none fixed h-px w-px opacity-0" />

      {inCall && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0a1210]/90 p-4 backdrop-blur-sm">
          <div className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#12201a] shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3">
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

            <div className="relative flex min-h-[280px] flex-col items-center justify-center px-4 pb-4">
              {isVideo ? (
                <>
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="h-[280px] w-full rounded-xl bg-black object-cover"
                  />
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute bottom-6 right-6 h-28 w-20 rounded-xl border border-white/20 bg-black object-cover shadow-lg"
                  />
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 py-8">
                  <SnapAvatar username={partnerUser} size={96} className="avatar-pop ring-2 ring-white/20" />
                  <p className="m-0 text-xl font-bold capitalize text-white">{partnerName}</p>
                  <p className="m-0 text-sm text-white/60">{statusLabel}</p>
                </div>
              )}

              {isVideo && <p className="mt-3 m-0 text-center text-sm text-white/70">{statusLabel}</p>}
              {error && <p className="mt-2 m-0 text-center text-sm text-red-300">{error}</p>}
            </div>

            <div className="flex items-center justify-center gap-3 border-t border-white/10 bg-black/20 px-4 py-4">
              {incoming ? (
                <>
                  <button
                    type="button"
                    onClick={declineCall}
                    className="rounded-full bg-red-500 px-5 py-3 text-sm font-semibold text-white hover:bg-red-600"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    onClick={acceptCall}
                    className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-600"
                  >
                    Accept
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={toggleMute}
                    className={`rounded-full px-4 py-3 text-sm font-semibold ${
                      muted ? 'bg-white text-[var(--ink)]' : 'bg-white/15 text-white hover:bg-white/25'
                    }`}
                  >
                    {muted ? 'Unmute' : 'Mute'}
                  </button>
                  {isVideo && (
                    <button
                      type="button"
                      onClick={toggleCam}
                      className={`rounded-full px-4 py-3 text-sm font-semibold ${
                        camOff ? 'bg-white text-[var(--ink)]' : 'bg-white/15 text-white hover:bg-white/25'
                      }`}
                    >
                      {camOff ? 'Cam on' : 'Cam off'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={hangup}
                    className="rounded-full bg-red-500 px-5 py-3 text-sm font-semibold text-white hover:bg-red-600"
                  >
                    End
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
