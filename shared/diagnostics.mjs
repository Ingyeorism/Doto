// Only connection metadata is allowed. Never serialize errors, SDP, IPs or lesson content.
const events = new Set(
  `page.ready page.hidden page.visible page.leave network.online network.offline browser.error browser.rejection storage.failed storage.saved classroom.status classroom.error join.start join.timeout reconnect.start config.start config.ok config.failed socket.opening socket.open socket.error socket.close socket.timeout signal.send signal.receive signal.dropped signal.failed rpc.start rpc.ok rpc.failed rpc.timeout peer.created peer.closed peer.timeout peer.stats peer.stats_failed ice.candidate ice.error ice.state ice.gathering rtc.state rtc.signaling rtc.description channel.open channel.close channel.error channel.receive_failed`.split(
    " ",
  ),
);
const enums = {
  role: ["teacher", "student"],
  status: ["idle", "connecting", "connected", "offline", "ended"],
  previousStatus: ["idle", "connecting", "connected", "offline", "ended"],
  connectionState: [
    "new",
    "connecting",
    "connected",
    "disconnected",
    "failed",
    "closed",
  ],
  iceState: [
    "new",
    "checking",
    "connected",
    "completed",
    "disconnected",
    "failed",
    "closed",
  ],
  gatheringState: ["new", "gathering", "complete"],
  signalingState: [
    "stable",
    "have-local-offer",
    "have-remote-offer",
    "have-local-pranswer",
    "have-remote-pranswer",
    "closed",
  ],
  channelState: ["connecting", "open", "closing", "closed"],
  candidateType: ["host", "srflx", "prflx", "relay"],
  localCandidateType: ["host", "srflx", "prflx", "relay"],
  remoteCandidateType: ["host", "srflx", "prflx", "relay"],
  protocol: ["udp", "tcp"],
  pairState: ["frozen", "waiting", "in-progress", "failed", "succeeded"],
  descriptionType: ["offer", "answer"],
  messageType: [
    "lookup",
    "join",
    "create",
    "signal",
    "result",
    "peer",
    "teacher-ready",
    "ended",
    "replaced",
    "retry",
    "lock",
    "end",
    "action",
  ],
  reason: [
    "replaced",
    "manual",
    "disconnect",
    "timeout",
    "failed",
    "closed",
    "disconnected",
    "channel-close",
    "channel-error",
    "ended",
    "socket-close",
    "parse",
    "send",
    "configuration",
  ],
  failure: [
    "invalid-code",
    "already-joined",
    "invalid-lesson",
    "teacher-credential",
    "student-credential",
    "admission-locked",
    "invalid-name",
    "room-gone",
    "unauthorized",
    "invalid-payload",
    "unknown",
  ],
  errorName: [
    "Error",
    "TypeError",
    "SyntaxError",
    "DOMException",
    "OperationError",
    "InvalidStateError",
    "NetworkError",
    "AbortError",
    "TimeoutError",
    "NotSupportedError",
    "SecurityError",
    "QuotaExceededError",
    "UnknownError",
    "DataError",
    "RTCError",
    "InvalidAccessError",
  ],
};
const numbers = new Set(
  `peerId code durationMs localCandidates remoteCandidates queuedCandidates queuedMessages bufferedAmount bytesSent bytesReceived packetsSent packetsReceived rttMs candidatePairs succeededPairs failedPairs stunServers documentCount revision line column sequence dropped count`.split(
    " ",
  ),
);
const booleans = new Set(
  `online secure visible clean intentional reset hasCandidate hasDescription teacherOnline resumed ready nominated`.split(
    " ",
  ),
);
const ids = new Set([
  "clientId",
  "attemptId",
  "eventId",
  "requestId",
  "peerConnectionId",
  "roomId",
  "lessonId",
]);
export function safeFields(input) {
  const result = {};
  if (!input || typeof input !== "object") return result;
  for (const [key, value] of Object.entries(input)) {
    if (enums[key]?.includes(value)) result[key] = value;
    else if (
      numbers.has(key) &&
      typeof value === "number" &&
      Number.isFinite(value)
    )
      result[key] = Math.max(-1, Math.min(value, Number.MAX_SAFE_INTEGER));
    else if (booleans.has(key) && typeof value === "boolean")
      result[key] = value;
    else if (
      ids.has(key) &&
      typeof value === "string" &&
      /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value)
    )
      result[key] = value;
  }
  return result;
}
export function safeEvent(input) {
  if (!input || !events.has(input.event)) return null;
  const time = typeof input.time === "string" ? Date.parse(input.time) : NaN;
  return {
    event: input.event,
    ...(Number.isFinite(time)
      ? { clientTime: new Date(time).toISOString() }
      : {}),
    ...safeFields(input),
  };
}
