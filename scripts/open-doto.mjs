import { spawn, spawnSync } from "node:child_process";
import { closeSync, openSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
const root = fileURLToPath(new URL("../", import.meta.url));
try {
  loadEnvFile(resolve(root, ".env"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const port = Number(process.env.PORT || 3000);
const url = `http://localhost:${port}`;
async function ready() {
  try {
    return (
      (
        await (
          await fetch(url + "/api/health", {
            signal: AbortSignal.timeout(1000),
          })
        ).json()
      ).app === "doto"
    );
  } catch {
    return false;
  }
}
function npm(args) {
  const result = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    args,
    {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
      windowsHide: true,
    },
  );
  if (result.status !== 0)
    throw Error("도토 준비에 실패했어요. 위의 오류를 확인해 주세요.");
}
if (!(await ready())) {
  if (!existsSync(resolve(root, "node_modules"))) npm(["ci"]);
  npm(["run", "build"]);
  const log = openSync(resolve(root, ".doto.log"), "a");
  const child = spawn(process.execPath, [resolve(root, "server/index.mjs")], {
    cwd: root,
    detached: true,
    windowsHide: true,
    stdio: ["ignore", log, log],
  });
  child.unref();
  closeSync(log);
  writeFileSync(
    resolve(root, ".doto.pid"),
    JSON.stringify({
      pid: child.pid,
      entry: resolve(root, "server/index.mjs"),
    }),
  );
  for (let n = 0; n < 20 && !(await ready()); n++)
    await new Promise((r) => setTimeout(r, 500));
}
if (!(await ready()))
  throw Error("도토를 열지 못했어요. .doto.log를 확인해 주세요.");
console.log(`도토가 열렸어요: ${url}/teacher/start`);
if (!process.argv.includes("--no-browser")) {
  const target = `${url}/teacher/start`;
  const child =
    process.platform === "win32"
      ? spawn(
          "powershell.exe",
          [
            "-NoProfile",
            "-NonInteractive",
            "-WindowStyle",
            "Hidden",
            "-Command",
            `Start-Process '${target}'`,
          ],
          { detached: true, windowsHide: true, stdio: "ignore" },
        )
      : spawn(process.platform === "darwin" ? "open" : "xdg-open", [target], {
          detached: true,
          stdio: "ignore",
        });
  child.unref();
}
