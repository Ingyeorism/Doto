import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { createDiagnostics } from "./diagnostics.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const diagnostics = createDiagnostics(root);
const log = diagnostics.log;
const dev = process.argv.includes("--dev");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
const rooms = new Map();
const token = () => randomBytes(32).toString("hex");
const rejectionReasons = new Map([
  ["입장 코드를 확인해 주세요. 수업이 끝났을 수도 있어요.", "invalid-code"],
  ["이미 수업에 연결되어 있어요.", "already-joined"],
  ["수업 정보가 올바르지 않아요.", "invalid-lesson"],
  ["이 수업을 만든 브라우저에서 열어 주세요.", "teacher-credential"],
  [
    "이 수업의 재입장 정보를 확인하지 못했어요. 다른 이름으로 새로 입장을 선택해 주세요.",
    "student-credential",
  ],
  ["선생님이 새 입장을 잠갔어요.", "admission-locked"],
  ["이름을 적어 주세요.", "invalid-name"],
  ["수업에 다시 연결해 주세요.", "room-gone"],
  ["허용되지 않은 요청이에요.", "unauthorized"],
]);
const send = (ws, value) => {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(value));
};
const vite = dev
  ? await (
      await import("vite")
    ).createServer({ server: { middlewareMode: true }, appType: "spa" })
  : null;
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/api/diagnostics") return diagnostics.ingest(req, res);
  if (url.pathname === "/api/health") {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    return res.end(
      JSON.stringify({
        app: "doto",
        ok: true,
        logging: diagnostics.status(),
        rooms: rooms.size,
        sockets: wss.clients.size,
      }),
    );
  }
  if (url.pathname === "/api/config") {
    log("http.config", {});
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        publicUrl: process.env.PUBLIC_URL || "",
        stun: (process.env.STUN_URLS || "stun:stun.l.google.com:19302")
          .split(",")
          .filter((s) => /^stun:/.test(s)),
      }),
    );
  }
  if (vite) return vite.middlewares(req, res);
  try {
    const base = resolve(root, "dist");
    let path = resolve(base, "." + decodeURIComponent(url.pathname));
    if (path !== base && !path.startsWith(base + sep)) {
      res.writeHead(403);
      return res.end();
    }
    if (!(await stat(path).catch(() => null))?.isFile())
      path = resolve(base, "index.html");
    res.setHeader(
      "Content-Type",
      mime[extname(path)] || "application/octet-stream",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Cache-Control",
      extname(path) === ".html" ? "no-cache" : "public, max-age=3600",
    );
    res.end(await readFile(path));
  } catch (error) {
    log("http.failed", { errorName: error.name });
    res.writeHead(503);
    res.end("먼저 npm run build를 실행해 주세요.");
  }
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 128 * 1024 });
server.on("upgrade", (req, socket, head) => {
  if (new URL(req.url, "http://localhost").pathname !== "/signal")
    return socket.destroy();
  if (req.headers.origin) {
    try {
      if (new URL(req.headers.origin).host !== req.headers.host) {
        log("socket.rejected", {});
        return socket.destroy();
      }
    } catch {
      return socket.destroy();
    }
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws));
});
function endRoom(room, reason = "ended") {
  log("room.ended", { roomId: room.id, lessonId: room.lessonId, reason });
  clearTimeout(room.expiry);
  rooms.delete(room.id);
  for (const p of room.students.values()) send(p.ws, { type: "ended" });
}
wss.on("connection", (ws) => {
  ws.connectionId = randomUUID();
  const context = () => ({
    peerConnectionId: ws.connectionId,
    roomId: ws.room?.id,
    lessonId: ws.room?.lessonId,
    role: ws.role,
    peerId: ws.student?.id,
    clientId: ws.clientId,
    attemptId: ws.attemptId,
  });
  log("socket.open", context());
  ws.alive = true;
  ws.on("pong", () => (ws.alive = true));
  ws.on("error", (error) =>
    log("socket.error", { ...context(), errorName: error.name }),
  );
  ws.on("message", (raw) => {
    let m;
    try {
      m = JSON.parse(raw.toString());
      if (!m || typeof m !== "object") throw Error("잘못된 요청이에요.");
      if (typeof m.clientId === "string") ws.clientId = m.clientId;
      if (typeof m.attemptId === "string") ws.attemptId = m.attemptId;
      log("signal.receive", {
        ...context(),
        messageType: m.type,
        requestId: m.requestId,
        descriptionType: m.description?.type,
        hasCandidate: !!m.candidate,
      });
      const reply = (value) =>
        send(ws, { type: "result", requestId: m.requestId, ...value });
      if (m.type === "lookup") {
        const room = [...rooms.values()].find((r) => r.code === m.code);
        if (!room)
          throw Error("입장 코드를 확인해 주세요. 수업이 끝났을 수도 있어요.");
        log("room.lookup", {
          ...context(),
          roomId: room.id,
          lessonId: room.lessonId,
          teacherOnline: room.teacher?.readyState === WebSocket.OPEN,
        });
        reply({ lessonId: room.lessonId });
      } else if (m.type === "create") {
        if (ws.room) throw Error("이미 수업에 연결되어 있어요.");
        if (typeof m.lessonId !== "string" || m.lessonId.length > 100)
          throw Error("수업 정보가 올바르지 않아요.");
        let room = [...rooms.values()].find((r) => r.lessonId === m.lessonId);
        if (room && room.teacherToken !== m.token)
          throw Error("이 수업을 만든 브라우저에서 열어 주세요.");
        if (!room) {
          let code;
          do {
            code = String(randomInt(100000, 1000000));
          } while ([...rooms.values()].some((r) => r.code === code));
          room = {
            id: randomUUID(),
            lessonId: m.lessonId,
            code,
            teacherToken: token(),
            students: new Map(),
            locked: !!m.locked,
          };
          // Only reconnect credentials go through signaling. No lesson content.
          for (const p of (Array.isArray(m.members) ? m.members : []).slice(
            0,
            1000,
          )) {
            if (
              Number.isSafeInteger(p.id) &&
              typeof p.token === "string" &&
              p.token.length >= 32 &&
              typeof p.name === "string"
            )
              room.students.set(p.id, {
                id: p.id,
                token: p.token,
                name: p.name.slice(0, 40),
              });
          }
          rooms.set(room.id, room);
          log("room.created", { roomId: room.id, lessonId: room.lessonId });
        }
        clearTimeout(room.expiry);
        if (room.teacher && room.teacher !== ws) {
          send(room.teacher, { type: "replaced" });
          room.teacher.close();
        }
        room.teacher = ws;
        ws.room = room;
        ws.role = "teacher";
        log("room.teacher_ready", context());
        reply({
          roomId: room.id,
          lessonId: room.lessonId,
          code: room.code,
          token: room.teacherToken,
        });
        for (const p of room.students.values())
          if (p.ws?.readyState === WebSocket.OPEN) {
            send(ws, { type: "peer", id: p.id, name: p.name, token: p.token });
            send(p.ws, { type: "teacher-ready" });
          }
      } else if (m.type === "join") {
        if (ws.room) throw Error("이미 수업에 연결되어 있어요.");
        const room = [...rooms.values()].find((r) => r.code === m.code);
        if (!room)
          throw Error("입장 코드를 확인해 주세요. 수업이 끝났을 수도 있어요.");
        let p = [...room.students.values()].find((p) => p.token === m.token);
        if (m.token && !p)
          throw Error(
            "이 수업의 재입장 정보를 확인하지 못했어요. 다른 이름으로 새로 입장을 선택해 주세요.",
          );
        if (!p) {
          if (room.locked) throw Error("선생님이 새 입장을 잠갔어요.");
          if (typeof m.name !== "string" || !m.name.trim())
            throw Error("이름을 적어 주세요.");
          const name = m.name.trim().slice(0, 16);
          const count = [...room.students.values()].filter(
            (p) =>
              p.baseName === name ||
              p.name === name ||
              p.name.startsWith(name + " ("),
          ).length;
          p = {
            id: randomInt(1, 2 ** 48),
            name: count ? `${name} (${count + 1})` : name,
            baseName: name,
            token: token(),
          };
          room.students.set(p.id, p);
        }
        if (p.ws && p.ws !== ws) {
          send(p.ws, { type: "replaced" });
          p.ws.close();
        }
        p.ws = ws;
        ws.room = room;
        ws.role = "student";
        ws.student = p;
        log("room.join", {
          ...context(),
          teacherOnline: room.teacher?.readyState === WebSocket.OPEN,
          resumed: !!m.token,
        });
        reply({
          roomId: room.id,
          lessonId: room.lessonId,
          code: room.code,
          id: p.id,
          name: p.name,
          token: p.token,
          teacherOnline: room.teacher?.readyState === WebSocket.OPEN,
        });
        send(room.teacher, {
          type: "peer",
          id: p.id,
          name: p.name,
          token: p.token,
        });
      } else {
        const room = ws.room;
        if (!room || rooms.get(room.id) !== room)
          throw Error("수업에 다시 연결해 주세요.");
        if (m.type === "signal") {
          // Explicit allowlist: the central socket never forwards document messages.
          const data = m.description
            ? {
                description: {
                  type: m.description.type,
                  sdp: m.description.sdp,
                },
              }
            : {
                candidate: m.candidate && {
                  candidate: m.candidate.candidate,
                  sdpMid: m.candidate.sdpMid,
                  sdpMLineIndex: m.candidate.sdpMLineIndex,
                  usernameFragment: m.candidate.usernameFragment,
                },
              };
          if (
            m.description &&
            (!["offer", "answer"].includes(m.description.type) ||
              typeof m.description.sdp !== "string" ||
              !m.description.sdp.startsWith("v=0"))
          ) {
            log("signal.rejected", {
              ...context(),
              failure: "invalid-payload",
            });
            return;
          }
          if (
            !m.description &&
            (!m.candidate || typeof m.candidate.candidate !== "string")
          ) {
            log("signal.rejected", {
              ...context(),
              failure: "invalid-payload",
            });
            return;
          }
          const authorized =
            ws.role === "teacher" ? room.teacher === ws : ws.student?.ws === ws;
          const target =
            ws.role === "teacher" ? room.students.get(m.to)?.ws : room.teacher;
          log(
            authorized && target?.readyState === WebSocket.OPEN
              ? "signal.forward"
              : "signal.dropped",
            {
              ...context(),
              descriptionType: m.description?.type,
              hasCandidate: !!m.candidate,
              peerId: ws.role === "teacher" ? m.to : ws.student?.id,
            },
          );
          if (ws.role === "teacher" && room.teacher === ws)
            send(room.students.get(m.to)?.ws, {
              type: "signal",
              from: "teacher",
              ...data,
            });
          else if (ws.student?.ws === ws)
            send(room.teacher, {
              type: "signal",
              from: ws.student.id,
              ...data,
            });
        } else if (m.type === "retry" && ws.role === "student") {
          send(room.teacher, {
            type: "peer",
            id: ws.student.id,
            name: ws.student.name,
            token: ws.student.token,
          });
        } else if (
          m.type === "lock" &&
          ws.role === "teacher" &&
          room.teacher === ws
        ) {
          room.locked = !!m.locked;
          reply({ ok: true });
        } else if (
          m.type === "end" &&
          ws.role === "teacher" &&
          room.teacher === ws
        ) {
          endRoom(room);
          reply({ ok: true });
        } else throw Error("허용되지 않은 요청이에요.");
      }
    } catch (error) {
      log("signal.rejected", {
        ...context(),
        messageType: m?.type,
        requestId: m?.requestId,
        errorName: error.name,
        failure:
          rejectionReasons.get(error.message) ||
          (error instanceof SyntaxError ? "invalid-payload" : "unknown"),
      });
      send(ws, {
        type: "result",
        requestId: m?.requestId,
        error: error.message || "요청을 처리하지 못했어요.",
      });
    }
  });
  ws.on("close", (code) => {
    log("socket.close", { ...context(), code });
    const room = ws.room;
    if (!room || rooms.get(room.id) !== room) return;
    if (ws.role === "teacher" && room.teacher === ws) {
      room.teacher = null;
      log("room.teacher_offline", context());
      room.expiry = setTimeout(() => endRoom(room, "timeout"), 5 * 60 * 1000);
    }
    if (ws.role === "student" && ws.student.ws === ws) {
      ws.student.ws = null;
    }
  });
});
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) {
      log("socket.heartbeat_timeout", {
        peerConnectionId: ws.connectionId,
        roomId: ws.room?.id,
        role: ws.role,
      });
      ws.terminate();
    } else {
      ws.alive = false;
      ws.ping();
    }
  }
}, 30000);
server.listen(port, host, () =>
  console.log(`도토: http://localhost:${port}/teacher/start`),
);
async function shutdown() {
  log("server.stopping", {});
  clearInterval(heartbeat);
  for (const ws of wss.clients) ws.terminate();
  await vite?.close();
  server.close(() => process.exit());
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("uncaughtExceptionMonitor", (error) =>
  log("server.crash", { errorName: error.name }),
);
