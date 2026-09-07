import {
  mkdirSync,
  appendFileSync,
  writeFileSync,
  statSync,
  renameSync,
  existsSync,
} from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { safeEvent, safeFields } from "../shared/diagnostics.mjs";

export function createDiagnostics(root) {
  const directory = resolve(root, process.env.LOG_DIR || "logs");
  const file = resolve(directory, "doto.jsonl");
  const maxBytes = Math.max(
    1024,
    Number(process.env.LOG_MAX_BYTES) || 5 * 1024 * 1024,
  );
  const keep = Math.floor(
    Math.max(1, Math.min(20, Number(process.env.LOG_FILES) || 5)),
  );
  const runId = randomUUID();
  let healthy = true,
    size = 0,
    written = 0,
    clientEvents = 0;
  try {
    mkdirSync(directory, { recursive: true });
    size = existsSync(file) ? statSync(file).size : 0;
  } catch {
    healthy = false;
  }
  function write(source, event, fields = {}) {
    const line =
      JSON.stringify({
        time: new Date().toISOString(),
        runId,
        source,
        event,
        ...fields,
      }) + "\n";
    try {
      if (size + Buffer.byteLength(line) > maxBytes) {
        // Keep active + bounded backups, including across restarts.
        for (let i = keep - 1; i >= 1; i--) {
          const from = i === 1 ? file : `${file}.${i - 1}`;
          if (existsSync(from)) renameSync(from, `${file}.${i}`);
        }
        if (keep === 1 || existsSync(file)) {
          // Truncate only this logger's active file after rotating it.
          writeFileSync(file, "");
        }
        size = 0;
      }
      appendFileSync(file, line, { mode: 0o600 });
      size += Buffer.byteLength(line);
      written++;
      healthy = true;
      return true;
    } catch {
      if (healthy || written === 0)
        console.error(
          "도토 진단 로그를 기록하지 못했습니다. LOG_DIR 쓰기 권한과 저장 공간을 확인하세요.",
        );
      healthy = false;
      return false;
    }
  }
  const log = (event, data) => write("server", event, safeFields(data));
  const budgets = new Map();
  async function ingest(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") {
      res.writeHead(405);
      return res.end();
    }
    try {
      if (
        req.headers.origin &&
        new URL(req.headers.origin).host !== req.headers.host
      ) {
        res.writeHead(403);
        return res.end();
      }
    } catch {
      res.writeHead(403);
      return res.end();
    }
    const now = Date.now();
    for (const [key, value] of budgets)
      if (now - value.at > 60000) budgets.delete(key);
    const key = req.socket.remoteAddress;
    const budget = budgets.get(key) || { at: now, count: 0 };
    if ((budgets.size >= 1000 && !budgets.has(key)) || ++budget.count > 6000) {
      res.writeHead(429);
      return res.end();
    }
    budgets.set(key, budget);
    let bytes = 0;
    const parts = [];
    try {
      for await (const part of req) {
        bytes += part.length;
        if (bytes > 48 * 1024) {
          res.writeHead(413);
          res.end();
          return;
        }
        parts.push(part);
      }
      const body = JSON.parse(Buffer.concat(parts).toString("utf8"));
      if (!Array.isArray(body.events) || body.events.length > 50) {
        res.writeHead(400);
        return res.end();
      }
      for (const item of body.events) {
        const entry = safeEvent(item);
        if (!entry) continue;
        const { event, ...fields } = entry;
        if (!write("browser", event, fields)) {
          res.writeHead(503);
          return res.end();
        }
        clientEvents++;
      }
      res.writeHead(204);
      res.end();
    } catch {
      if (!res.writableEnded) {
        res.writeHead(400);
        res.end();
      }
    }
  }
  log("server.started", {});
  return {
    log,
    ingest,
    status: () => ({
      enabled: true,
      writable: healthy,
      written,
      clientEvents,
      runId,
    }),
  };
}
