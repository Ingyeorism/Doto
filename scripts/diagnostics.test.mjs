import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";
import { once } from "node:events";
import { createDiagnostics } from "../server/diagnostics.mjs";
import { safeEvent } from "../shared/diagnostics.mjs";

test("허용 필드만 저장하고 이름/토큰/원본 SDP/주소/오류 원문은 제거", () => {
  const safe = safeEvent({
    event: "ice.error",
    code: 701,
    name: "private-name",
    token: "secret",
    sdp: "v=0",
    address: "192.168.0.1",
    message: "private-text",
    errorName: "private-error",
    candidateType: "secret",
  });
  assert.deepEqual(safe, { event: "ice.error", code: 701 });
  assert.equal(safeEvent({ event: "private-text" }), null);
});

test("서버 재시작을 넘어 파일 크기와 보관 개수를 제한", () => {
  const root = mkdtempSync(join(tmpdir(), "doto-log-rotation-"));
  process.env.LOG_DIR = root;
  process.env.LOG_MAX_BYTES = "1024";
  process.env.LOG_FILES = "3";
  for (let run = 0; run < 2; run++) {
    const diagnostics = createDiagnostics(root);
    for (let i = 0; i < 80; i++) diagnostics.log("rotation.test", { count: i });
    assert.equal(diagnostics.status().writable, true);
  }
  const files = readdirSync(root);
  assert.equal(files.length, 3);
  for (const file of files) {
    assert.ok(statSync(join(root, file)).size <= 1024);
    for (const line of readFileSync(join(root, file), "utf8")
      .trim()
      .split("\n"))
      JSON.parse(line);
  }
  delete process.env.LOG_DIR;
  delete process.env.LOG_MAX_BYTES;
  delete process.env.LOG_FILES;
});

test("진단 API: 수집 확인, 필드 제거, 잘못된 origin/대용량 거절", async () => {
  const root = mkdtempSync(join(tmpdir(), "doto-log-api-"));
  const diagnostics = createDiagnostics(root);
  const server = http.createServer(
    (req, res) => void diagnostics.ingest(req, res),
  );
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const post = (body, headers = {}) =>
      fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
    assert.equal(
      (
        await post({
          events: [
            {
              event: "ice.error",
              code: 701,
              token: "private-token",
              name: "private-name",
            },
          ],
        })
      ).status,
      204,
    );
    assert.equal(diagnostics.status().clientEvents, 1);
    const raw = readFileSync(join(root, "logs/doto.jsonl"), "utf8");
    assert.ok(raw.includes('"code":701'));
    assert.ok(!raw.includes("private-"));
    assert.equal(
      (await post({ events: [] }, { Origin: "http://foreign.invalid" })).status,
      403,
    );
    assert.equal(
      (await post({ events: Array(51).fill({ event: "page.ready" }) })).status,
      400,
    );
    assert.equal((await post({ text: "x".repeat(50 * 1024) })).status, 413);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("로그 저장 경로 장애가 서버를 중단하지 않고 상태에 드러남", () => {
  const root = mkdtempSync(join(tmpdir(), "doto-log-unwritable-"));
  writeFileSync(join(root, "logs"), "blocked by a file");
  const diagnostics = createDiagnostics(root);
  assert.equal(diagnostics.status().writable, false);
  assert.equal(diagnostics.log("server.test", {}), false);
});
