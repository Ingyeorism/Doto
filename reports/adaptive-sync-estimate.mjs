// Reproducible traffic estimate, not a CPU benchmark or production capacity claim.
import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as sync from "y-protocols/sync";
import { writeFile } from "node:fs/promises";
const eventsPerSecond = 5,
  durationSeconds = 60,
  students = 30;
const source = new Y.Doc();
source.clientID = 123456789;
const body = source.getXmlFragment("body");
const paragraph = new Y.XmlElement("paragraph"),
  text = new Y.XmlText();
paragraph.insert(0, [text]);
body.insert(0, [paragraph]);
const initial = Y.encodeStateAsUpdate(source),
  updates = [];
source.on("update", (bytes) => updates.push(bytes));
for (let i = 0; i < eventsPerSecond * durationSeconds; i++)
  text.insert(i, "가");
const costs = (update, sequence) => {
  const encoder = encoding.createEncoder();
  sync.writeUpdate(encoder, update);
  const packet = JSON.stringify({
    type: "sync",
    docId: 1234567890123456,
    data: Buffer.from(encoding.toUint8Array(encoder)).toString("base64"),
  });
  const relay = JSON.stringify({
    type: "relay",
    to: -1,
    channel: "12345678-1234-1234-1234-123456789abc",
    kind: "data",
    sequence,
    text: packet,
  });
  const ack = JSON.stringify({
    type: "relay",
    kind: "ack",
    channel: "12345678-1234-1234-1234-123456789abc",
    sequence,
  });
  return Buffer.byteLength(relay) + Buffer.byteLength(ack);
};
const rows = [];
for (const delayMs of [0, 120, 500, 1200]) {
  const sink = new Y.Doc();
  Y.applyUpdate(sink, initial);
  let pending = [],
    deadline = Infinity,
    messages = 0,
    bytes = 0;
  const flush = () => {
    if (!pending.length) return;
    const merged = Y.mergeUpdates(pending);
    Y.applyUpdate(sink, merged);
    messages++;
    bytes += costs(merged, messages);
    pending = [];
    deadline = Infinity;
  };
  updates.forEach((update, i) => {
    const at = (i * 1000) / eventsPerSecond;
    if (at >= deadline) flush();
    if (!pending.length) deadline = at + delayMs;
    pending.push(update);
    if (!delayMs) flush();
  });
  flush();
  if (sink.getXmlFragment("body").toString() !== body.toString())
    throw Error("Merged document mismatch");
  rows.push({
    delayMs,
    messagesPerStudent: messages,
    messagesPerClass: messages * students,
    relayJsonBytesPerClassOneDirectionWithAck: bytes * students,
    messageReductionPercent: +(100 * (1 - messages / updates.length)).toFixed(
      1,
    ),
  });
  sink.destroy();
}
const baseline = rows[0].relayJsonBytesPerClassOneDirectionWithAck;
for (const row of rows)
  row.jsonByteReductionPercent = +(
    100 *
    (1 - row.relayJsonBytesPerClassOneDirectionWithAck / baseline)
  ).toFixed(1);
const report = {
  eventsPerSecond,
  durationSeconds,
  students,
  caveats: [
    "Synthetic continuous single-character Yjs edits; excludes initial sync, TLS/WebSocket framing, snapshots, presence and diagnostic traffic.",
    "Direct WebRTC edits do not traverse the central relay. CPU and hosting cost reductions are not measured.",
    "Publish, page exit and save deadlines may flush batches early.",
  ],
  rows,
};
await writeFile(
  new URL("adaptive-sync-estimate.json", import.meta.url),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
