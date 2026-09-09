import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";

const send = (ws, message) => {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
};

// Only live, authenticated host/participant pairs have a relay route.
// Payloads are forwarded in memory and are never logged or stored.
export function closeRelay(room, peer) {
  if (!peer.relayId) return;
  const message = { type: "relay", kind: "closed", channel: peer.relayId };
  peer.relayId = undefined;
  peer.relayState = undefined;
  send(room.teacher, { ...message, from: peer.id });
  send(peer.ws, { ...message, from: "teacher" });
}

export function renewRelay(room, peer) {
  closeRelay(room, peer);
  if (peer.relay) peer.relayId = randomUUID();
}

export function forwardRelay(room, ws, message) {
  const host = room.teacher === ws;
  const peer = host
    ? room.students.get(message.to) || room.controllers.get(message.to)
    : ws.student;
  if (
    !peer ||
    (room.students.get(peer.id) || room.controllers.get(peer.id)) !== peer ||
    (!host && (peer.ws !== ws || message.to !== -1)) ||
    !peer.relay ||
    !peer.relayId ||
    message.channel !== peer.relayId
  )
    throw Error("허용되지 않은 요청이에요.");

  const { kind, sequence } = message;
  const outgoing = {
    type: "relay",
    kind,
    channel: peer.relayId,
    from: host ? "teacher" : peer.id,
  };
  if (kind === "open" && host) peer.relayState = "offered";
  else if (kind === "ready" && !host && peer.relayState === "offered")
    peer.relayState = "ready";
  else if ((kind === "data" || kind === "ack") && peer.relayState === "ready") {
    if (!Number.isSafeInteger(sequence) || sequence < 1)
      throw Error("허용되지 않은 요청이에요.");
    outgoing.sequence = sequence;
    if (kind === "data") {
      if (
        typeof message.text !== "string" ||
        Buffer.byteLength(message.text) > 64 * 1024
      )
        throw Error("허용되지 않은 요청이에요.");
      outgoing.text = message.text;
    }
  } else if (kind === "close") {
    closeRelay(room, peer);
    return;
  } else throw Error("허용되지 않은 요청이에요.");

  const target = host ? peer.ws : room.teacher;
  // Stop this route instead of retaining an unbounded queue for a slow reader.
  if (
    target?.readyState !== WebSocket.OPEN ||
    target.bufferedAmount > 4 * 1024 * 1024
  ) {
    closeRelay(room, peer);
    return;
  }
  send(target, outgoing);
}
