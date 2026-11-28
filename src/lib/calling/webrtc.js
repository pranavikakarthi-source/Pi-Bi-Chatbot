"use client";

export function getRtcConfiguration() {
  const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
  ];

  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL?.trim();
  if (turnUrl) {
    const turnConfig = { urls: turnUrl };
    if (process.env.NEXT_PUBLIC_TURN_USERNAME?.trim()) {
      turnConfig.username = process.env.NEXT_PUBLIC_TURN_USERNAME.trim();
    }
    if (process.env.NEXT_PUBLIC_TURN_CREDENTIAL?.trim()) {
      turnConfig.credential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL.trim();
    }
    iceServers.push(turnConfig);
  }

  return {
    iceServers,
    iceCandidatePoolSize: 4,
  };
}

export async function acquireCallMedia({ video = false } = {}) {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    return {
      stream: null,
      hasAudio: false,
      hasVideo: false,
      errorMessage: "Camera/Microphone is not supported in this browser.",
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: video
        ? {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          }
        : false,
    });

    return {
      stream,
      hasAudio: stream.getAudioTracks().length > 0,
      hasVideo: stream.getVideoTracks().length > 0,
      errorMessage: "",
    };
  } catch (err) {
    // If video failed (no webcam or camera denied), fall back to audio-only.
    if (video) {
      try {
        const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
        return {
          stream: audioOnlyStream,
          hasAudio: audioOnlyStream.getAudioTracks().length > 0,
          hasVideo: false,
          errorMessage: "Camera unavailable — joined with microphone only.",
        };
      } catch {
        // Ignore secondary failure and report below.
      }
    }

    const msg =
      err instanceof Error && err.name === "NotAllowedError"
        ? "Microphone/Camera permission denied. Allow access in browser/app settings."
        : "Unable to access microphone or camera.";

    return {
      stream: null,
      hasAudio: false,
      hasVideo: false,
      errorMessage: msg,
    };
  }
}

export async function acquireScreenShareStream() {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.getDisplayMedia
  ) {
    throw new Error("Screen sharing is not supported on this device.");
  }

  return navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: false,
  });
}

export function stopMediaStream(stream) {
  if (!stream) return;
  try {
    stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        // Ignore stop failures.
      }
    });
  } catch {
    // Ignore cleanup errors.
  }
}

export function formatCallDuration(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const mm = String(mins).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");
  if (hrs > 0) {
    return `${String(hrs).padStart(2, "0")}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

export function startRingtone(kind = "incoming") {
  if (typeof window === "undefined") return () => {};

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return () => {};

  let ctx;
  try {
    ctx = new AudioCtx();
  } catch {
    return () => {};
  }

  let stopped = false;
  let intervalId = null;

  function playBurst() {
    if (stopped || !ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    try {
      if (kind === "incoming") {
        // Warm dual chime ring for incoming calls
        const notes = [
          { freq: 523.25, start: 0, dur: 0.18 },
          { freq: 659.25, start: 0.2, dur: 0.22 },
          { freq: 523.25, start: 0.52, dur: 0.18 },
          { freq: 659.25, start: 0.72, dur: 0.26 },
        ];
        notes.forEach(({ freq, start, dur }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + start);
          gain.gain.setValueAtTime(0.001, now + start);
          gain.gain.exponentialRampToValueAtTime(0.11, now + start + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + start);
          osc.stop(now + start + dur + 0.02);
        });
      } else {
        // Gentle outgoing ringback tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.055, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.8);
      }
    } catch {
      // Ignore WebAudio playback restrictions.
    }
  }

  playBurst();
  intervalId = window.setInterval(playBurst, kind === "incoming" ? 2300 : 2800);

  return () => {
    stopped = true;
    if (intervalId) {
      window.clearInterval(intervalId);
    }
    try {
      ctx?.close?.().catch?.(() => {});
    } catch {
      // Ignore close error.
    }
  };
}
