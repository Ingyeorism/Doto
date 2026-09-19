import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createLoadMonitor,
  defaultTuning,
  validateTuning,
  loadPressure,
  chooseDelay,
} from "../server/load.mjs";

test("adaptive pressure uses resource ratios, optional network capacity and bounded delays", () => {
  const quiet = {
    cpuPercent: 10,
    memoryPercent: 20,
    loopP95Ms: 21,
    queueBytes: 0,
    outBytesPerSecond: 1000000,
  };
  assert.equal(
    chooseDelay(loadPressure(quiet, defaultTuning), defaultTuning),
    120,
  );
  assert.equal(
    chooseDelay(
      loadPressure({ ...quiet, cpuPercent: 80 }, defaultTuning),
      defaultTuning,
    ),
    500,
  );
  assert.equal(
    chooseDelay(
      loadPressure({ ...quiet, loopP95Ms: 200 }, defaultTuning),
      defaultTuning,
    ),
    1200,
  );
  assert.equal(
    chooseDelay(
      loadPressure(quiet, { ...defaultTuning, networkMbps: 10 }),
      defaultTuning,
    ),
    500,
  );
  assert.throws(() => validateTuning({ normalDelayMs: 500, busyDelayMs: 100 }));
  assert.throws(() => validateTuning({ overloadedDelayMs: 5000 }));
  assert.throws(() => validateTuning({ memoryBusyPercent: NaN }));
  assert.throws(() => validateTuning({ unexpected: 1 }));
});

test("admin settings require a secret, reject invalid writes, persist and reload", async () => {
  const dir = await mkdtemp(join(tmpdir(), "doto-load-test-"));
  const file = join(dir, "tuning.json");
  const adminToken = "isolated-test-secret-1234567890";
  const make = () =>
    createLoadMonitor({
      file,
      clients: () => [],
      counts: () => ({ connections: 0 }),
      adminToken,
    });
  let monitor = await make();
  const server = createServer((req, res) => monitor.handleAdmin(req, res));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const headers = {
    Authorization: `Bearer ${adminToken}`,
    "Content-Type": "application/json",
  };
  try {
    assert.equal((await fetch(url)).status, 401);
    assert.equal(
      (await fetch(url, { headers: { Authorization: "Bearer wrong" } })).status,
      401,
    );
    assert.equal(
      (await fetch(url, { method: "PUT", headers, body: '{"busyDelayMs":-1}' }))
        .status,
      400,
    );
    assert.equal(
      (
        await fetch(url, {
          method: "PUT",
          headers: { ...headers, Origin: "https://foreign.invalid" },
          body: "{}",
        })
      ).status,
      403,
    );
    const updated = { ...defaultTuning, busyDelayMs: 700 };
    assert.equal(
      (
        await fetch(url, {
          method: "PUT",
          headers,
          body: JSON.stringify(updated),
        })
      ).status,
      200,
    );
    assert.equal(JSON.parse(await readFile(file, "utf8")).busyDelayMs, 700);
    monitor.close();
    monitor = await make();
    assert.equal(
      (await (await fetch(url, { headers })).json()).tuning.busyDelayMs,
      700,
    );
    assert.equal(
      JSON.stringify(monitor.publicStatus()).includes("secret"),
      false,
    );
  } finally {
    monitor.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
