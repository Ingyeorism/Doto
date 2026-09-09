import { test } from "node:test";
import assert from "node:assert/strict";
import { closeRelay, renewRelay, forwardRelay } from "../server/relay.mjs";

function fixture() {
  const socket = () => ({
    readyState: 1,
    bufferedAmount: 0,
    messages: [],
    send(raw) {
      this.messages.push(JSON.parse(raw));
    },
  });
  const teacher = socket();
  const child = { id: 1, ws: socket(), relay: true };
  child.ws.student = child;
  const direct = { id: 2, ws: socket() };
  direct.ws.student = direct;
  const controller = { id: -2, ws: socket(), relay: true };
  controller.ws.student = controller;
  const room = {
    teacher,
    students: new Map([
      [1, child],
      [2, direct],
    ]),
    controllers: new Map([[-2, controller]]),
  };
  renewRelay(room, child);
  renewRelay(room, controller);
  const message = (peer, kind, to, extra = {}) => ({
    type: "relay",
    channel: peer.relayId,
    kind,
    to,
    ...extra,
  });
  function connect(peer) {
    forwardRelay(room, teacher, message(peer, "open", peer.id));
    forwardRelay(room, peer.ws, message(peer, "ready", -1));
  }
  return { room, teacher, child, direct, controller, socket, message, connect };
}

test("relay routes only authenticated, opted-in peers through their own host", () => {
  const f = fixture();
  for (const p of [f.child, f.controller]) {
    f.connect(p);
    f.forward = (ws, to, extra = {}) =>
      forwardRelay(
        f.room,
        ws,
        f.message(p, "data", to, {
          sequence: 1,
          text: "private payload",
          ...extra,
        }),
      );
    f.forward(p.ws, -1, {
      from: "forged",
      role: "teacher",
      token: "do not forward",
    });
    assert.deepEqual(f.teacher.messages.at(-1), {
      type: "relay",
      kind: "data",
      channel: p.relayId,
      from: p.id,
      sequence: 1,
      text: "private payload",
    });
    f.forward(f.teacher, p.id);
    assert.equal(p.ws.messages.at(-1).from, "teacher");
    assert.equal(p.ws.messages.at(-1).token, undefined);
    assert.throws(() => f.forward(p.ws, f.direct.id));
    assert.throws(() => f.forward(f.direct.ws, -1));
    assert.throws(() => f.forward(f.socket(), -1));
    assert.throws(() => f.forward(fixture().teacher, p.id));
    assert.throws(() => f.forward(fixture().child.ws, -1));
    assert.throws(() => f.forward(p.ws, -1, { channel: "stale" }));
    assert.throws(() => f.forward(p.ws, -1, { text: "가".repeat(23000) }));
    assert.throws(() => f.forward(p.ws, -1, { sequence: -1 }));
  }
  assert.equal(f.direct.ws.messages.length, 0);
});

test("reconnect invalidates old routes and forwarding waits for the new handshake", () => {
  const { room, teacher, child, connect, message } = fixture();
  assert.throws(() =>
    forwardRelay(
      room,
      child.ws,
      message(child, "data", -1, { sequence: 1, text: "too early" }),
    ),
  );
  assert.throws(() => forwardRelay(room, child.ws, message(child, "open", -1)));
  connect(child);
  const oldChannel = child.relayId;
  renewRelay(room, child);
  assert.notEqual(child.relayId, oldChannel);
  assert.equal(child.ws.messages.at(-1).kind, "closed");
  assert.throws(() =>
    forwardRelay(room, teacher, {
      channel: oldChannel,
      kind: "data",
      to: child.id,
      sequence: 1,
      text: "stale",
    }),
  );
  connect(child);
  const oldSocket = child.ws;
  child.ws = { ...oldSocket };
  assert.throws(() =>
    forwardRelay(
      room,
      oldSocket,
      message(child, "data", -1, { sequence: 1, text: "replaced socket" }),
    ),
  );
  closeRelay(room, child);
  assert.equal(child.relayId, undefined);
});

test("offline or congested recipients close just their route without retaining payloads", () => {
  for (const congested of [false, true]) {
    const { room, teacher, child, controller, connect, message } = fixture();
    connect(child);
    connect(controller);
    const otherChannel = controller.relayId;
    if (congested) child.ws.bufferedAmount = 5 * 1024 * 1024;
    else child.ws.readyState = 3;
    forwardRelay(
      room,
      teacher,
      message(child, "data", child.id, {
        sequence: 1,
        text: "no retained payload",
      }),
    );
    assert.equal(child.relayId, undefined);
    assert.equal(controller.relayId, otherChannel);
    assert.equal(
      child.ws.messages.some((m) => m.text),
      false,
    );
    assert.equal(teacher.messages.at(-1).kind, "closed");
  }
});
