import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";

const port = 3133;
const processServer = spawn(process.execPath, ["server/index.mjs"], {
  env: {
    ...process.env,
    PORT: String(port),
    HOST: "127.0.0.1",
    LOG_DIR: "test-results/tablet-signal-logs",
  },
  stdio: "ignore",
  windowsHide: true,
});
const sockets = [];
async function client() {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/signal`);
  sockets.push(ws);
  await once(ws, "open");
  const pending = new Map(),
    events = [];
  ws.on("message", (raw) => {
    const message = JSON.parse(String(raw));
    const finish = pending.get(message.requestId);
    if (finish) {
      pending.delete(message.requestId);
      finish(message);
    } else events.push(message);
  });
  return {
    ws,
    events,
    request: (message) =>
      new Promise((resolve, reject) => {
        const requestId = randomUUID();
        const timer = setTimeout(() => reject(Error("signal timeout")), 3000);
        pending.set(requestId, (result) => {
          clearTimeout(timer);
          resolve(result);
        });
        ws.send(JSON.stringify({ ...message, requestId }));
      }),
  };
}
try {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  const host = await client(),
    lessonId = randomUUID();
  const room = await host.request({ type: "create", lessonId });
  assert.match(room.code, /^\d{6}$/);
  assert.match(room.teacherCode, /^\d{8}$/);
  const pc = await client(),
    student = await client();
  assert.equal(
    (await pc.request({ type: "lookup", code: room.teacherCode })).role,
    "teacher",
  );
  assert.equal(
    (await student.request({ type: "lookup", code: room.code })).role,
    "student",
  );
  const teacher = await pc.request({ type: "join", code: room.teacherCode });
  const child = await student.request({
    type: "join",
    code: room.code,
    name: "이강우",
    role: "teacher",
    id: -1,
  });
  assert.equal(teacher.role, "teacher");
  assert.ok(teacher.id < -1);
  assert.equal(child.role, "student");
  assert.ok(child.id > 0);
  assert.equal(child.teacherCode, undefined);
  assert.equal(teacher.code, room.code);
  assert.ok(
    host.events.some(
      (m) => m.type === "peer" && m.id === teacher.id && m.role === "teacher",
    ),
  );
  for (const type of ["lock", "end", "rotate-teacher-code", "document-update"])
    assert.ok((await student.request({ type })).error);
  assert.ok((await pc.request({ type: "end" })).error);
  const steal = await client();
  assert.ok(
    (await steal.request({ type: "create", lessonId, token: teacher.token }))
      .error,
  );
  await host.request({ type: "lock", locked: true });
  const pc2 = await client();
  assert.equal(
    (await pc2.request({ type: "join", code: room.teacherCode })).role,
    "teacher",
  );
  pc.ws.close();
  await once(pc.ws, "close");
  assert.equal(
    (await student.request({ type: "lookup", code: room.code })).lessonId,
    lessonId,
  );
  const rotated = await host.request({ type: "rotate-teacher-code" });
  assert.notEqual(rotated.teacherCode, room.teacherCode);
  const newcomer = await client();
  assert.ok(
    (await newcomer.request({ type: "lookup", code: room.teacherCode })).error,
  );
  assert.equal(
    (
      await newcomer.request({
        type: "join",
        code: room.code,
        lessonId,
        token: teacher.token,
      })
    ).id,
    teacher.id,
  );
  const studentResume = await client();
  assert.equal(
    (
      await studentResume.request({
        type: "join",
        code: rotated.teacherCode,
        token: child.token,
        role: "teacher",
      })
    ).role,
    "student",
  );
  host.ws.close();
  await once(host.ws, "close");
  const resumedHost = await client();
  const recovered = await resumedHost.request({
    type: "create",
    lessonId,
    token: room.token,
  });
  assert.equal(recovered.code, room.code);
  assert.equal(recovered.teacherCode, rotated.teacherCode);
  await resumedHost.request({ type: "end" });
  const probe = await client();
  assert.ok((await probe.request({ type: "lookup", code: room.code })).error);
  const reopened = await probe.request({
    type: "create",
    lessonId,
    members: [{ ...child }],
    controllers: [{ ...teacher }],
  });
  const returningTeacher = await client();
  const continued = await returningTeacher.request({
    type: "join",
    code: reopened.teacherCode,
    token: teacher.token,
    lessonId,
  });
  assert.equal(continued.id, teacher.id);
  assert.equal(continued.role, "teacher");
  console.log(
    "PASS 태블릿 호스트: 코드별 역할·권한 위조 차단·교사 퇴장 후 방 유지·입장 잠금·교사 코드 갱신·기기 재접속·수업 종료·보관 수업 복원",
  );
} finally {
  for (const ws of sockets) ws.terminate();
  processServer.kill();
  await once(processServer, "exit");
}
