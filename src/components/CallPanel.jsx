'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SnapAvatar } from './SnapAvatar';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
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
 * Always-mounted call controller.
 * Media is peer-to-peer DTLS-SRTP (E2E encrypted). Signaling only goes through the API.
 */
export function CallController({ user, partner, startButtonsClassName = '' }) {
  const [call, setCall] = useState(null);
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [connecting, setConnecting] = useState(false);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const callIdRef = useRef(null);
  const appliedIceRef = useRef(new Set());
  const offerSentRef = useRef(false);
  const answerSentRef = useRef(false);
  const remoteDescSetRef = useRef(false);
  const startedAtRef = useRef(null);
  const handleSignalRef = useRef(async () => {});

  const cleanupMedia = useCallback(() => {
    if (pcRef.current) {
      try {
        pcRef.current.onicecandidate = null;
        pcRef.current.ontrack = null;
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
    setConnecting(false);
    setMuted(false);
    setCamOff(false);
  }, [cleanupMedia]);

  const ensurePc = useCallback(async (mode) => {
    if (pcRef.current) return pcRef.current;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: mode === 'video',
    });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    const remote = new MediaStream();
    pc.ontrack = (ev) => {
      ev.streams[0]?.getTracks().forEach((t) => remote.addTrack(t));
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remote;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remote;
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

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected' && !startedAtRef.current) {
        startedAtRef.current = Date.now();
        setConnecting(false);
        api('/api/call', {
          method: 'PATCH',
          body: JSON.stringify({ id: callIdRef.current, action: 'active' }),
        }).catch(() => {});
      }
      if (pc.connectionState === 'failed') setError('Connection failed — try again on the same Wi‑Fi or allow camera/mic');
    };

    return pc;
  }, []);

  const applyRemoteIce = useCallback(async (list) => {
    const pc = pcRef.current;
    if (!pc || !list?.length) return;
    for (const c of list) {
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
        /* timing */
      }
    }
  }, []);

  const handleSignal = useCallback(
    async (c) => {
      if (!c || !LIVE.has(c.status)) return;
      callIdRef.current = c.id;
      const iAmCaller = c.callerUsername === user.username;

      if (iAmCaller && LIVE.has(c.status) && !offerSentRef.current) {
        setConnecting(true);
        try {
          const pc = await ensurePc(c.mode);
          if (!offerSentRef.current) {
            const offer = await pc.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: c.mode === 'video',
            });
            await pc.setLocalDescription(offer);
            offerSentRef.current = true;
            await api('/api/call', {
              method: 'PATCH',
              body: JSON.stringify({ id: c.id, action: 'offer', type: offer.type, sdp: offer.sdp }),
            });
          }
        } catch (err) {
          setError(err.message || 'Mic/camera permission needed');
          setConnecting(false);
        }
      }

      if (!iAmCaller && (c.status === 'accepted' || c.status === 'active') && c.offer?.sdp) {
        if (!answerSentRef.current) {
          setConnecting(true);
          try {
            const pc = await ensurePc(c.mode);
            if (!remoteDescSetRef.current) {
              await pc.setRemoteDescription(new RTCSessionDescription(c.offer));
              remoteDescSetRef.current = true;
            }
            if (!answerSentRef.current) {
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              answerSentRef.current = true;
              await api('/api/call', {
                method: 'PATCH',
                body: JSON.stringify({ id: c.id, action: 'answer', type: answer.type, sdp: answer.sdp }),
              });
            }
          } catch (err) {
            setError(err.message || 'Mic/camera permission needed');
            setConnecting(false);
          }
        }
      }

      if (iAmCaller && c.answer?.sdp && pcRef.current && !remoteDescSetRef.current) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(c.answer));
          remoteDescSetRef.current = true;
        } catch {
          /* ignore */
        }
      }

      const remoteIce = iAmCaller ? c.calleeIce : c.callerIce;
      if (remoteDescSetRef.current) await applyRemoteIce(remoteIce);
    },
    [applyRemoteIce, ensurePc, user.username]
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
        await handleSignalRef.current(c);
      } catch {
        /* ignore */
      }
    };
    tick();
    const t = setInterval(tick, 800);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [resetCallUi]);

  useEffect(() => {
    if (!call || call.status !== 'active') return undefined;
    const t = setInterval(() => {
      if (startedAtRef.current) setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [call]);

  useEffect(() => () => cleanupMedia(), [cleanupMedia]);

  async function startCall(mode) {
    setError('');
    setConnecting(true);
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
      setConnecting(false);
    }
  }

  async function acceptCall() {
    if (!call) return;
    setError('');
    setConnecting(true);
    try {
      const data = await api('/api/call', {
        method: 'PATCH',
        body: JSON.stringify({ id: call.id, action: 'accept' }),
      });
      setCall(data.call);
      await handleSignal(data.call);
    } catch (err) {
      setError(err.message || 'Could not accept');
      setConnecting(false);
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

      {error && !inCall && <span className="sr-only">{error}</span>}

      <audio ref={remoteAudioRef} autoPlay playsInline />

      {inCall && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0a1210]/90 p-4 backdrop-blur-sm">
          <div className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#12201a] shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[0.7rem] font-semibold text-emerald-300">
                  <LockIcon /> E2E encrypted
                </span>
                <span className="font-mono text-[0.65rem] text-white/40">DTLS-SRTP</span>
              </div>
              {(call.status === 'active' || startedAtRef.current) && (
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
                  <p className="m-0 text-sm text-white/60">
                    {incoming
                      ? 'Incoming voice call…'
                      : call.status === 'ringing'
                        ? 'Calling…'
                        : connecting
                          ? 'Connecting…'
                          : call.status === 'active'
                            ? 'Connected'
                            : 'Connecting…'}
                  </p>
                </div>
              )}

              {isVideo && (
                <p className="mt-3 m-0 text-center text-sm text-white/70">
                  {incoming
                    ? 'Incoming video call…'
                    : call.status === 'ringing'
                      ? `Calling ${partnerName}…`
                      : connecting
                        ? 'Connecting…'
                        : partnerName}
                </p>
              )}

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
