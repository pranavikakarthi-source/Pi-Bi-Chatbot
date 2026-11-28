"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AvatarBadge from "./AvatarBadge";
import { formatCallDuration } from "@/lib/calling/webrtc";

function StreamVideo({ stream, muted = false, mirror = false, className = "" }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== (stream || null)) {
      el.srcObject = stream || null;
    }
    if (stream) {
      el.play().catch(() => {});
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className={`${className} ${mirror ? "-scale-x-100" : ""}`}
    />
  );
}

function RemoteAudioSink({ stream, speakerEnabled }) {
  const audioRef = useRef(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.srcObject !== (stream || null)) {
      el.srcObject = stream || null;
    }
    el.volume = speakerEnabled ? 1 : 0.75;
    if (stream) {
      el.play().catch(() => {});
    }
  }, [stream, speakerEnabled]);

  return <audio ref={audioRef} autoPlay playsInline className="hidden" />;
}

export default function CallOverlay({
  currentUser,
  incomingCall,
  activeCall,
  localStream,
  remoteStreams,
  peerStates,
  allUsers,
  callMessages = [],
  elapsedSeconds = 0,
  isMuted,
  isVideoOn,
  isScreenSharing,
  isSpeakerOn,
  callError,
  onAcceptIncoming,
  onDeclineIncoming,
  onEndCall,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onToggleSpeaker,
  onInviteUser,
  onSendCallMessage,
}) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [sidePanelTab, setSidePanelTab] = useState(null); // null | "participants" | "chat"
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [pinnedUserId, setPinnedUserId] = useState(null);
  const [callChatInput, setCallChatInput] = useState("");
  const [participantQuery, setParticipantQuery] = useState("");
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (sidePanelTab === "chat") {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [callMessages.length, sidePanelTab]);

  // Ensure every remote audio track always plays reliably even on Audio-only mode
  const remoteEntries = useMemo(
    () => Object.entries(remoteStreams || {}),
    [remoteStreams]
  );

  if (!incomingCall && !activeCall) {
    return null;
  }

  // 1. Incoming Call Ringing Card
  if (incomingCall && !activeCall) {
    const incomingDisplayName = incomingCall.isGroup
      ? incomingCall.title || incomingCall.caller?.displayName || "Group Call"
      : incomingCall.caller?.displayName || incomingCall.title || "Incoming Call";
    const incomingDisplayAvatar = incomingCall.isGroup
      ? incomingCall.avatarUrl || incomingCall.caller?.avatarUrl
      : incomingCall.caller?.avatarUrl || incomingCall.avatarUrl;

    const subtitle =
      incomingCall.callType === "video"
        ? incomingCall.isGroup
          ? "Incoming group video call..."
          : "Incoming video call..."
        : incomingCall.isGroup
          ? "Incoming group voice call..."
          : "Incoming voice call...";

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
        <div className="w-full max-w-[360px] rounded-[28px] border border-white/15 bg-[#10181d] px-6 py-8 text-center text-white shadow-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-400">
            {subtitle}
          </p>

          <div className="relative mx-auto mt-6 mb-5 flex h-28 w-28 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
            <span className="absolute inset-2 rounded-full bg-emerald-500/20 animate-pulse" />
            <AvatarBadge
              src={incomingDisplayAvatar}
              name={incomingDisplayName}
              isGroup={incomingCall.isGroup}
              size="lg"
            />
          </div>

          <h2 className="text-xl font-bold tracking-tight truncate">
            {incomingDisplayName}
          </h2>
          {incomingCall.isGroup && incomingCall.caller?.displayName && (
            <p className="mt-1 text-xs text-neutral-400">
              Started by {incomingCall.caller.displayName}
            </p>
          )}

          <div className="mt-8 flex items-center justify-center gap-10">
            <button
              type="button"
              onClick={onDeclineIncoming}
              className="flex flex-col items-center gap-2 cursor-pointer group"
            >
              <span className="h-14 w-14 rounded-full bg-red-500 group-hover:bg-red-600 flex items-center justify-center shadow-lg shadow-red-500/30 transition active:scale-95">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6 rotate-[135deg]"
                >
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </span>
              <span className="text-xs text-neutral-300">Decline</span>
            </button>

            <button
              type="button"
              onClick={onAcceptIncoming}
              className="flex flex-col items-center gap-2 cursor-pointer group"
            >
              <span className="h-14 w-14 rounded-full bg-emerald-500 group-hover:bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 transition active:scale-95">
                {incomingCall.callType === "video" ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-6 w-6"
                  >
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-6 w-6"
                  >
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                )}
              </span>
              <span className="text-xs text-neutral-300">Accept</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Active Call Details & Layouts (Audio Call Screen vs Group/1-on-1 Video Screen)
  const invitedParticipants = activeCall.participants || [];
  const otherParticipants = invitedParticipants.filter(
    (p) => p.id !== currentUser.id
  );
  const connectedCount = otherParticipants.filter(
    (p) => peerStates?.[p.id]?.connected || Boolean(remoteStreams?.[p.id])
  ).length;
  const isConnected = activeCall.status === "connected" || connectedCount > 0;

  const anyRemoteVideoOn = otherParticipants.some((p) => {
    const stream = remoteStreams?.[p.id];
    const hasTrack = stream?.getVideoTracks?.().some((t) => t.readyState === "live");
    return Boolean(hasTrack && (peerStates?.[p.id]?.isVideoOn ?? true));
  });

  const showVideoStage =
    activeCall.callType === "video" ||
    isVideoOn ||
    isScreenSharing ||
    anyRemoteVideoOn;

  const primaryPeer =
    otherParticipants.find((p) => p.id === pinnedUserId) ||
    otherParticipants.find(
      (p) =>
        peerStates?.[p.id]?.connected ||
        Boolean(remoteStreams?.[p.id])
    ) ||
    otherParticipants[0] ||
    null;

  const statusText = isConnected
    ? formatCallDuration(elapsedSeconds)
    : activeCall.direction === "incoming"
      ? "Connecting..."
      : "Ringing...";

  const invitableUsers = (allUsers || []).filter(
    (u) =>
      u.id !== currentUser.id &&
      !invitedParticipants.some((p) => p.id === u.id)
  );

  // Minimized floating bar
  if (isMinimized) {
    return (
      <>
        {remoteEntries.map(([uid, stream]) => (
          <RemoteAudioSink
            key={uid}
            stream={stream}
            speakerEnabled={isSpeakerOn}
          />
        ))}
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 rounded-2xl border border-white/15 bg-[#10181d]/95 px-4 py-2.5 text-white shadow-2xl backdrop-blur-md">
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="flex items-center gap-2.5 text-left cursor-pointer"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <p className="text-xs font-semibold max-w-[160px] truncate">
                {activeCall.title}
              </p>
              <p className="text-[11px] text-emerald-400 font-mono">
                {statusText}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            title={isMuted ? "Unmute" : "Mute"}
            className={`h-8 w-8 rounded-full flex items-center justify-center transition cursor-pointer ${
              isMuted ? "bg-white text-black" : "bg-white/10 hover:bg-white/20"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              {isMuted ? (
                <>
                  <line x1="1" y1="1" x2="23" y2="23" />
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                  <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                </>
              ) : (
                <>
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                </>
              )}
            </svg>
          </button>

          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            title="Expand Call"
            className="rounded-full bg-[#2b8c98] px-3 py-1 text-[11px] font-medium hover:bg-[#237782] transition cursor-pointer"
          >
            Expand
          </button>

          <button
            type="button"
            onClick={onEndCall}
            title="End Call"
            className="h-8 w-8 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 rotate-[135deg]"
            >
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </button>
        </div>
      </>
    );
  }

  const localHasVideo =
    Boolean(localStream?.getVideoTracks?.().some((t) => t.readyState === "live")) &&
    (isVideoOn || isScreenSharing);

  const filteredParticipants = invitedParticipants.filter((p) => {
    const q = participantQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (p.displayName || "").toLowerCase().includes(q) ||
      (p.username || "").toLowerCase().includes(q)
    );
  });

  const onTheCallList = filteredParticipants.filter(
    (p) =>
      p.id === currentUser.id ||
      peerStates?.[p.id]?.connected ||
      Boolean(remoteStreams?.[p.id])
  );
  const invitedPendingList = filteredParticipants.filter(
    (p) =>
      p.id !== currentUser.id &&
      !peerStates?.[p.id]?.connected &&
      !remoteStreams?.[p.id]
  );

  async function handleSendInCallChat(e) {
    e.preventDefault();
    const trimmed = callChatInput.trim();
    if (!trimmed || !onSendCallMessage) return;
    setCallChatInput("");
    await onSendCallMessage(trimmed);
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0b1014] text-white flex flex-col md:flex-row overflow-hidden">
      {/* Keep remote audio playing reliably regardless of layout */}
      {remoteEntries.map(([uid, stream]) => (
        <RemoteAudioSink key={uid} stream={stream} speakerEnabled={isSpeakerOn} />
      ))}

      {/* Main Call Stage */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative bg-[radial-gradient(circle_at_top,_rgba(43,140,152,0.16),_transparent_55%),#0b1014]">
        {/* Top Bar */}
        <header className="shrink-0 h-16 px-4 sm:px-6 flex items-center justify-between gap-3 border-b border-white/10 bg-black/20 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              title="Minimize call"
              aria-label="Minimize call"
              className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition cursor-pointer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-semibold truncate">
                  {activeCall.title}
                </h2>
                {activeCall.isGroup && (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-neutral-300">
                    Group
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 flex items-center gap-1.5">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    isConnected ? "bg-emerald-500" : "bg-amber-400 animate-pulse"
                  }`}
                />
                <span className="font-mono">{statusText}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {invitableUsers.length > 0 && (
              <button
                type="button"
                onClick={() => setShowInviteModal((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition cursor-pointer"
              >
                <span>+ Add user</span>
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                setSidePanelTab((prev) =>
                  prev === "participants" ? null : "participants"
                )
              }
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                sidePanelTab === "participants"
                  ? "bg-white text-black"
                  : "bg-white/10 text-neutral-200 hover:bg-white/20"
              }`}
            >
              <span>Participants ({invitedParticipants.length})</span>
            </button>

            {activeCall.conversationId && (
              <button
                type="button"
                onClick={() =>
                  setSidePanelTab((prev) => (prev === "chat" ? null : "chat"))
                }
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                  sidePanelTab === "chat"
                    ? "bg-white text-black"
                    : "bg-white/10 text-neutral-200 hover:bg-white/20"
                }`}
              >
                <span>Chat</span>
              </button>
            )}
          </div>
        </header>

        {callError && (
          <div className="mx-4 mt-3 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3.5 py-2 text-xs text-amber-200 text-center">
            {callError}
          </div>
        )}

        {/* Invite User Dropdown */}
        {showInviteModal && invitableUsers.length > 0 && (
          <div className="mx-4 mt-3 rounded-2xl border border-white/15 bg-[#151e24] p-3 shadow-xl z-20 max-w-md self-end">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-neutral-200">
                Add someone to this call
              </p>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="text-xs text-neutral-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="max-h-44 overflow-y-auto space-y-1">
              {invitableUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    onInviteUser?.(u);
                    setShowInviteModal(false);
                  }}
                  className="w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left hover:bg-white/10 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <AvatarBadge src={u.avatarUrl} name={u.displayName} size="sm" />
                    <span className="text-xs font-medium truncate">
                      {u.displayName}
                    </span>
                  </div>
                  <span className="rounded-full bg-[#2b8c98] px-2.5 py-0.5 text-[11px] font-medium">
                    Invite
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Center Stage: Voice Call Mode (Image 4) vs Video Call Mode (Images 2 & 3) */}
        {!showVideoStage ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 overflow-y-auto">
            {!activeCall.isGroup && primaryPeer ? (
              <div className="flex flex-col items-center text-center">
                <div className="relative flex h-36 w-36 items-center justify-center mb-5">
                  {!isConnected && (
                    <span className="absolute inset-0 rounded-full bg-[#2b8c98]/25 animate-ping" />
                  )}
                  <div className="relative h-32 w-32 rounded-full ring-4 ring-white/10 overflow-hidden shadow-2xl flex items-center justify-center bg-[#182329]">
                    <AvatarBadge
                      src={primaryPeer.avatarUrl}
                      name={primaryPeer.displayName}
                      size="xl"
                    />
                  </div>
                </div>
                <h3 className="text-2xl font-bold tracking-tight">
                  {primaryPeer.displayName}
                </h3>
                <p className="mt-1.5 text-sm text-neutral-400 font-mono">
                  {statusText}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-2xl">
                {invitedParticipants.map((member) => {
                  const isMe = member.id === currentUser.id;
                  const connected =
                    isMe ||
                    peerStates?.[member.id]?.connected ||
                    Boolean(remoteStreams?.[member.id]);
                  const muted = isMe ? isMuted : peerStates?.[member.id]?.isMuted;

                  return (
                    <div
                      key={member.id}
                      className="rounded-2xl border border-white/10 bg-[#131c21] p-4 flex flex-col items-center text-center gap-2.5"
                    >
                      <AvatarBadge
                        src={member.avatarUrl}
                        name={member.displayName}
                        isOnline={connected}
                        showPresence
                        size="lg"
                      />
                      <div className="min-w-0 w-full">
                        <p className="text-xs font-semibold truncate">
                          {isMe ? "You" : member.displayName}
                        </p>
                        <p className="text-[11px] text-neutral-400">
                          {connected ? (muted ? "Muted" : "On the call") : "Ringing..."}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 p-3 sm:p-4 gap-3">
            {/* Primary Spotlight Stage */}
            <div className="relative flex-1 min-h-0 rounded-3xl overflow-hidden bg-[#12191f] border border-white/10 flex items-center justify-center">
              {(() => {
                const spotlightPeer = primaryPeer;
                const peerStream = spotlightPeer
                  ? remoteStreams?.[spotlightPeer.id]
                  : null;
                const peerHasVideo =
                  Boolean(
                    peerStream?.getVideoTracks?.().some((t) => t.readyState === "live")
                  ) && (peerStates?.[spotlightPeer?.id]?.isVideoOn ?? true);

                if (spotlightPeer && peerHasVideo) {
                  return (
                    <StreamVideo
                      stream={peerStream}
                      muted
                      className="h-full w-full object-cover"
                    />
                  );
                }

                // If only local video is available (e.g. ringing before peer answers), show self big
                if (!spotlightPeer || (!peerHasVideo && !isConnected && localHasVideo)) {
                  return localHasVideo ? (
                    <StreamVideo
                      stream={localStream}
                      muted
                      mirror={!isScreenSharing}
                      className="h-full w-full object-cover"
                    />
                  ) : null;
                }

                return (
                  <div className="flex flex-col items-center gap-3 p-6 text-center">
                    <AvatarBadge
                      src={spotlightPeer.avatarUrl}
                      name={spotlightPeer.displayName}
                      size="xl"
                    />
                    <div>
                      <p className="text-lg font-semibold">
                        {spotlightPeer.displayName}
                      </p>
                      <p className="text-xs text-neutral-400">
                        {peerStates?.[spotlightPeer.id]?.connected || peerStream
                          ? "Camera is turned off"
                          : "Ringing..."}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Spotlight Label Badge (Image 3 style) */}
              {primaryPeer && (
                <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-black/55 backdrop-blur-md px-3 py-1.5 text-xs">
                  <AvatarBadge
                    src={primaryPeer.avatarUrl}
                    name={primaryPeer.displayName}
                    size="xs"
                  />
                  <span className="font-medium">{primaryPeer.displayName}</span>
                </div>
              )}

              {/* Call Timer Pill (Image 3 style) */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-black/55 backdrop-blur-md px-3 py-1 text-xs font-mono flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <span>{statusText}</span>
              </div>

              {/* Self Floating Tile (bottom-right inside main stage) */}
              {(isConnected || otherParticipants.length > 0) && (
                <div className="absolute bottom-3 right-3 w-32 sm:w-44 aspect-video rounded-2xl overflow-hidden border border-white/20 bg-[#1a242b] shadow-xl flex items-center justify-center">
                  {localHasVideo ? (
                    <StreamVideo
                      stream={localStream}
                      muted
                      mirror={!isScreenSharing}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <AvatarBadge
                        src={currentUser.avatarUrl}
                        name={currentUser.displayName}
                        size="sm"
                      />
                      <span className="text-[10px] text-neutral-300">You</span>
                    </div>
                  )}
                  <span className="absolute bottom-1.5 left-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px]">
                    You {isMuted ? "(Muted)" : ""}
                  </span>
                </div>
              )}
            </div>

            {/* Bottom Participant Filmstrip (Image 2 style for group calls) */}
            {(activeCall.isGroup || otherParticipants.length > 1) && (
              <div className="shrink-0 flex items-center gap-2.5 overflow-x-auto pb-1">
                {otherParticipants.map((member) => {
                  const stream = remoteStreams?.[member.id];
                  const hasVideo =
                    Boolean(
                      stream?.getVideoTracks?.().some((t) => t.readyState === "live")
                    ) && (peerStates?.[member.id]?.isVideoOn ?? true);
                  const pinned = primaryPeer?.id === member.id;
                  const muted = peerStates?.[member.id]?.isMuted;

                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => setPinnedUserId(member.id)}
                      className={`relative shrink-0 w-36 sm:w-40 h-24 rounded-2xl overflow-hidden border transition cursor-pointer flex items-center justify-center bg-[#151e25] ${
                        pinned
                          ? "border-[#2b8c98] ring-2 ring-[#2b8c98]/50"
                          : "border-white/10 hover:border-white/30"
                      }`}
                    >
                      {hasVideo ? (
                        <StreamVideo
                          stream={stream}
                          muted
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <AvatarBadge
                          src={member.avatarUrl}
                          name={member.displayName}
                          size="md"
                        />
                      )}
                      <div className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between gap-1 rounded-lg bg-black/60 px-2 py-0.5 text-[10px]">
                        <span className="truncate font-medium">
                          {member.displayName}
                        </span>
                        {muted && <span className="text-red-400">Muted</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Bottom Control Dock (Image 4 dark pill + Images 2/3 controls) */}
        <footer className="shrink-0 pb-6 pt-2 px-4 flex justify-center z-10">
          <div className="inline-flex flex-wrap items-center justify-center gap-3 sm:gap-4 rounded-[28px] border border-white/10 bg-[#182128]/95 px-5 py-3 shadow-2xl backdrop-blur-md">
            {/* Speaker / Audio Output */}
            <button
              type="button"
              onClick={onToggleSpeaker}
              title={isSpeakerOn ? "Speaker On" : "Speaker Low"}
              className="flex flex-col items-center gap-1 cursor-pointer group"
            >
              <span
                className={`h-11 w-11 rounded-full flex items-center justify-center transition ${
                  isSpeakerOn
                    ? "bg-white text-[#111111]"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              </span>
              <span className="text-[10px] text-neutral-300">Speaker</span>
            </button>

            {/* Camera / Video Toggle (switches Audio <-> Video mid-call) */}
            <button
              type="button"
              onClick={onToggleVideo}
              title={isVideoOn ? "Turn camera off" : "Turn camera on"}
              className="flex flex-col items-center gap-1 cursor-pointer group"
            >
              <span
                className={`h-11 w-11 rounded-full flex items-center justify-center transition ${
                  isVideoOn
                    ? "bg-white text-[#111111]"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  {isVideoOn ? (
                    <>
                      <polygon points="23 7 16 12 23 17 23 7" />
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </>
                  ) : (
                    <>
                      <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </>
                  )}
                </svg>
              </span>
              <span className="text-[10px] text-neutral-300">Video</span>
            </button>

            {/* Mute / Mic */}
            <button
              type="button"
              onClick={onToggleMute}
              title={isMuted ? "Unmute" : "Mute"}
              className="flex flex-col items-center gap-1 cursor-pointer group"
            >
              <span
                className={`h-11 w-11 rounded-full flex items-center justify-center transition ${
                  isMuted
                    ? "bg-white text-[#111111]"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  {isMuted ? (
                    <>
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </>
                  ) : (
                    <>
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </>
                  )}
                </svg>
              </span>
              <span className="text-[10px] text-neutral-300">
                {isMuted ? "Unmute" : "Mute"}
              </span>
            </button>

            {/* Screen Share */}
            <button
              type="button"
              onClick={onToggleScreenShare}
              title={isScreenSharing ? "Stop sharing" : "Share screen"}
              className="flex flex-col items-center gap-1 cursor-pointer group"
            >
              <span
                className={`h-11 w-11 rounded-full flex items-center justify-center transition ${
                  isScreenSharing
                    ? "bg-[#2b8c98] text-white"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </span>
              <span className="text-[10px] text-neutral-300">Share</span>
            </button>

            {/* End Call */}
            <button
              type="button"
              onClick={onEndCall}
              title="End call"
              className="flex flex-col items-center gap-1 cursor-pointer group"
            >
              <span className="h-11 w-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-500/30 transition active:scale-95">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 rotate-[135deg]"
                >
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </span>
              <span className="text-[10px] text-neutral-300">End</span>
            </button>
          </div>
        </footer>
      </div>

      {/* Right Sidebar Panel: Chat / Participants (Reference Images 2 & 3) */}
      {sidePanelTab && (
        <aside className="w-full md:w-[320px] lg:w-[340px] h-[45vh] md:h-auto shrink-0 bg-white dark:bg-[#111b21] text-neutral-900 dark:text-neutral-100 border-t md:border-t-0 md:border-l border-neutral-200 dark:border-neutral-800 flex flex-col">
          <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-1">
              {activeCall.conversationId && (
                <button
                  type="button"
                  onClick={() => setSidePanelTab("chat")}
                  className={`flex-1 rounded-xl py-1.5 text-xs font-semibold transition cursor-pointer ${
                    sidePanelTab === "chat"
                      ? "bg-[#2b8c98]/15 text-[#2b8c98]"
                      : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  Chat
                </button>
              )}
              <button
                type="button"
                onClick={() => setSidePanelTab("participants")}
                className={`flex-1 rounded-xl py-1.5 text-xs font-semibold transition cursor-pointer ${
                  sidePanelTab === "participants"
                    ? "bg-[#2b8c98]/15 text-[#2b8c98]"
                    : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                Participants ({invitedParticipants.length})
              </button>
            </div>
            <button
              type="button"
              onClick={() => setSidePanelTab(null)}
              aria-label="Close panel"
              className="h-7 w-7 rounded-full flex items-center justify-center text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
            >
              ✕
            </button>
          </div>

          {sidePanelTab === "participants" ? (
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              <input
                type="text"
                value={participantQuery}
                onChange={(e) => setParticipantQuery(e.target.value)}
                placeholder="Search for people..."
                className="w-full h-9 rounded-xl bg-neutral-100 dark:bg-[#0b141a] px-3 text-xs outline-none border border-transparent focus:border-[#2b8c98]"
              />

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                  On the call ({onTheCallList.length})
                </p>
                <div className="space-y-1.5">
                  {onTheCallList.map((member) => {
                    const isMe = member.id === currentUser.id;
                    const muted = isMe ? isMuted : peerStates?.[member.id]?.isMuted;
                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <AvatarBadge
                            src={member.avatarUrl}
                            name={member.displayName}
                            isOnline
                            showPresence
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate">
                              {isMe ? `${member.displayName} (You)` : member.displayName}
                            </p>
                            <p className="text-[11px] text-neutral-500 truncate">
                              {member.username ? `@${member.username}` : member.email}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            muted
                              ? "bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-300"
                              : "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                          }`}
                        >
                          {muted ? "Muted" : "Live"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {invitedPendingList.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                    Invited ({invitedPendingList.length})
                  </p>
                  <div className="space-y-1.5">
                    {invitedPendingList.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 opacity-80"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <AvatarBadge
                            src={member.avatarUrl}
                            name={member.displayName}
                            size="sm"
                          />
                          <p className="text-xs font-medium truncate">
                            {member.displayName}
                          </p>
                        </div>
                        <span className="text-[10px] text-amber-500 font-medium">
                          Ringing...
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                {callMessages.length === 0 ? (
                  <p className="text-center text-xs text-neutral-400 py-8">
                    No messages yet. Say hi during the call!
                  </p>
                ) : (
                  callMessages.map((msg) => {
                    const isMine = msg.sender_id === currentUser.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${
                          isMine ? "items-end" : "items-start"
                        }`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs ${
                            isMine
                              ? "bg-[#2b8c98] text-white"
                              : "bg-neutral-100 dark:bg-[#202c33] text-neutral-900 dark:text-neutral-100"
                          }`}
                        >
                          {msg.content || `[${msg.message_type}]`}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              <form
                onSubmit={handleSendInCallChat}
                className="p-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={callChatInput}
                  onChange={(e) => setCallChatInput(e.target.value)}
                  placeholder="Write your message..."
                  className="flex-1 h-9 rounded-full bg-neutral-100 dark:bg-[#202c33] px-3.5 text-xs outline-none"
                />
                <button
                  type="submit"
                  disabled={!callChatInput.trim()}
                  className="h-9 px-3.5 rounded-full bg-[#2b8c98] text-white text-xs font-medium disabled:opacity-45 cursor-pointer"
                >
                  Send
                </button>
              </form>
            </>
          )}
        </aside>
      )}
    </div>
  );
}
