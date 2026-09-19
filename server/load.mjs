import os from "node:os";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { timingSafeEqual } from "node:crypto";

export const defaultTuning = Object.freeze({
  cpuBusyPercent: 80,
  memoryBusyPercent: 90,
  loopBusyMs: 80,
  queueBusyKiB: 1024,
  networkMbps: 0,
  normalDelayMs: 120,
  busyDelayMs: 500,
  overloadedDelayMs: 1200,
});
const bounds = {
  cpuBusyPercent: [10, 100],
  memoryBusyPercent: [10, 100],
  loopBusyMs: [20, 2000],
  queueBusyKiB: [64, 4096],
  networkMbps: [0, 100000],
  normalDelayMs: [50, 500],
  busyDelayMs: [100, 2000],
  overloadedDelayMs: [200, 3000],
};
export function validateTuning(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !Object.hasOwn(bounds, k))
  )
    throw Error("설정 항목을 확인해 주세요.");
  const next = { ...defaultTuning, ...value };
  for (const [key, [min, max]] of Object.entries(bounds)) {
    if (!Number.isFinite(next[key]) || next[key] < min || next[key] > max)
      throw Error(`${key}: ${min}~${max} 범위로 입력해 주세요.`);
  }
  if (
    next.normalDelayMs > next.busyDelayMs ||
    next.busyDelayMs > next.overloadedDelayMs
  )
    throw Error("갱신 간격은 여유 ≤ 혼잡 ≤ 매우 혼잡 순서여야 해요.");
  return next;
}
export function loadPressure(metrics, tuning) {
  return Math.max(
    metrics.cpuPercent / tuning.cpuBusyPercent,
    metrics.memoryPercent / tuning.memoryBusyPercent,
    metrics.loopP95Ms / tuning.loopBusyMs,
    metrics.queueBytes / (tuning.queueBusyKiB * 1024),
    tuning.networkMbps > 0
      ? (metrics.outBytesPerSecond * 8) / (tuning.networkMbps * 1e6 * 0.8)
      : 0,
  );
}
export function chooseDelay(pressure, tuning) {
  return pressure >= 1.2
    ? tuning.overloadedDelayMs
    : pressure >= 1
      ? tuning.busyDelayMs
      : tuning.normalDelayMs;
}
const cpuTimes = () =>
  os
    .cpus()
    .reduce(
      (v, c) => ({
        idle: v.idle + c.times.idle,
        total: v.total + Object.values(c.times).reduce((a, b) => a + b, 0),
      }),
      { idle: 0, total: 0 },
    );
const readNumber = async (path) =>
  Number((await readFile(path, "utf8")).trim());
async function cpuCapacity() {
  let capacity = os.availableParallelism();
  try {
    const [quota, period] = (await readFile("/sys/fs/cgroup/cpu.max", "utf8"))
      .trim()
      .split(/\s+/);
    if (quota !== "max")
      capacity = Math.min(capacity, Number(quota) / Number(period));
  } catch {
    try {
      const quota = await readNumber("/sys/fs/cgroup/cpu/cpu.cfs_quota_us");
      const period = await readNumber("/sys/fs/cgroup/cpu/cpu.cfs_period_us");
      if (quota > 0) capacity = Math.min(capacity, quota / period);
    } catch {
      /* Windows or no cgroup quota. */
    }
  }
  return Math.max(0.01, capacity);
}

export async function createLoadMonitor({
  file,
  clients,
  counts,
  adminToken = "",
}) {
  let tuning = { ...defaultTuning },
    configError = "";
  try {
    tuning = validateTuning(JSON.parse(await readFile(file, "utf8")));
  } catch (e) {
    if (e.code !== "ENOENT")
      configError = "저장된 설정을 읽지 못해 기본값을 사용 중이에요.";
  }
  const loop = monitorEventLoopDelay({ resolution: 20 });
  loop.enable();
  const capacity = await cpuCapacity();
  let lastCpu = cpuTimes(),
    lastProcessCpu = process.cpuUsage(),
    lastAt = performance.now();
  let outgoing = 0,
    incoming = 0,
    recovery = 0,
    pressure = 0,
    delay = tuning.normalDelayMs;
  let metrics = null,
    sampledAt = null;
  const trackSocket = (ws) => {
    const original = ws.send;
    ws.send = function (data, ...args) {
      outgoing +=
        typeof data === "string" ? Buffer.byteLength(data) : data.byteLength;
      return original.call(this, data, ...args);
    };
    ws.on("message", (raw) => {
      incoming += raw.byteLength;
    });
  };
  const publicStatus = () => ({
    ...counts(),
    sampledAt,
    status: !metrics
      ? "measuring"
      : pressure >= 1.2
        ? "overloaded"
        : pressure >= 1
          ? "busy"
          : "normal",
    updateDelayMs: delay,
  });
  const sample = () => {
    const now = performance.now(),
      seconds = (now - lastAt) / 1000;
    const cpu = cpuTimes(),
      proc = process.cpuUsage();
    const machineCpu =
      cpu.total > lastCpu.total
        ? (1 - (cpu.idle - lastCpu.idle) / (cpu.total - lastCpu.total)) * 100
        : 0;
    const processCpu =
      ((proc.user -
        lastProcessCpu.user +
        (proc.system - lastProcessCpu.system)) /
        (seconds * 1e6 * capacity)) *
      100;
    const constrained = process.constrainedMemory?.() || os.totalmem();
    const memoryLimit = Math.min(os.totalmem(), constrained);
    const available = Math.min(
      memoryLimit,
      process.availableMemory?.() ?? os.freemem(),
    );
    metrics = {
      cpuPercent: Math.min(100, Math.max(0, machineCpu, processCpu)),
      cpuCapacity: capacity,
      memoryPercent: Math.max(0, (1 - available / memoryLimit) * 100),
      memoryLimitBytes: memoryLimit,
      loopP95Ms: loop.percentile(95) / 1e6,
      queueBytes: Math.max(
        0,
        ...Array.from(clients(), (ws) => ws.bufferedAmount),
      ),
      outBytesPerSecond: outgoing / seconds,
      inBytesPerSecond: incoming / seconds,
    };
    const nextPressure = loadPressure(metrics, tuning);
    // React immediately to pressure; require 3 healthy samples before speeding up.
    if (nextPressure >= pressure) {
      pressure = nextPressure;
      recovery = 0;
    } else if (++recovery >= 3) {
      pressure = nextPressure;
      recovery = 0;
    }
    delay = chooseDelay(pressure, tuning);
    sampledAt = Date.now();
    lastAt = now;
    lastCpu = cpu;
    lastProcessCpu = proc;
    incoming = 0;
    outgoing = 0;
    loop.reset();
    for (const ws of clients())
      if (ws.room && ws.readyState === 1)
        ws.send(JSON.stringify({ type: "server-load", updateDelayMs: delay }));
  };
  const timer = setInterval(sample, 5000);
  timer.unref();
  const authorized = (req) => {
    if (!adminToken || adminToken.length < 24) return false;
    const provided = Buffer.from(String(req.headers.authorization || ""));
    const expected = Buffer.from(`Bearer ${adminToken}`);
    return (
      provided.length === expected.length && timingSafeEqual(provided, expected)
    );
  };
  let saving = Promise.resolve();
  const handleAdmin = async (req, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    const reply = (status, body) => {
      res.writeHead(status);
      res.end(JSON.stringify(body));
    };
    if (!adminToken || adminToken.length < 24)
      return reply(503, {
        error:
          "서버 환경변수 DOTO_ADMIN_TOKEN에 24자 이상 관리 키를 설정해 주세요.",
      });
    if (!authorized(req))
      return reply(401, { error: "관리 키를 확인해 주세요." });
    if (req.method === "GET")
      return reply(200, { ...publicStatus(), metrics, tuning, configError });
    if (req.method !== "PUT")
      return reply(405, { error: "지원하지 않는 요청이에요." });
    try {
      if (
        req.headers.origin &&
        new URL(req.headers.origin).host !== req.headers.host
      )
        return reply(403, {
          error: "같은 서버의 관리 화면에서 설정해 주세요.",
        });
    } catch {
      return reply(403, { error: "요청 주소를 확인해 주세요." });
    }
    try {
      let body = "",
        bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 4096) {
          req.resume();
          return reply(413, { error: "요청이 너무 커요." });
        }
        body += chunk;
      }
      const next = validateTuning(JSON.parse(body));
      const operation = saving.then(async () => {
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file + ".tmp", JSON.stringify(next, null, 2) + "\n", {
          mode: 0o600,
        });
        await rename(file + ".tmp", file);
        tuning = next;
        configError = "";
        if (metrics) {
          pressure = loadPressure(metrics, tuning);
          delay = chooseDelay(pressure, tuning);
        }
      });
      saving = operation.catch(() => {});
      await operation;
      reply(200, { ...publicStatus(), metrics, tuning, configError });
    } catch (e) {
      reply(400, {
        error: e.code
          ? "설정을 저장하지 못했어요. 서버 저장 경로를 확인해 주세요."
          : e.message,
      });
    }
  };
  return {
    publicStatus,
    trackSocket,
    handleAdmin,
    close: () => {
      clearInterval(timer);
      loop.disable();
    },
  };
}
