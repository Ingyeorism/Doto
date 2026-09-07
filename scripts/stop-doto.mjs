import { readFileSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const pidPath = fileURLToPath(new URL("../.doto.pid", import.meta.url));
let record;
try {
  record = JSON.parse(readFileSync(pidPath, "utf8"));
} catch {
  console.log(
    "도토 열기로 시작한 서버가 없어요. 개발 터미널에서 실행했다면 Ctrl+C로 종료해 주세요.",
  );
  process.exit(0);
}
if (!Number.isInteger(record.pid) || record.pid < 1)
  throw Error("실행 정보를 확인할 수 없어요.");
const entry = fileURLToPath(new URL("../server/index.mjs", import.meta.url));
if (record.entry !== entry)
  throw Error("다른 서버의 실행 정보이므로 종료하지 않았어요.");
if (process.platform === "win32") {
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-WindowStyle",
      "Hidden",
      "-Command",
      `(Get-CimInstance Win32_Process -Filter 'ProcessId = ${record.pid}').CommandLine`,
    ],
    { encoding: "utf8", windowsHide: true },
  );
  if (result.status !== 0) throw Error("실행 중인 서버를 확인하지 못했어요.");
  if (!result.stdout.trim()) {
    unlinkSync(pidPath);
    console.log("이미 종료되어 있어요.");
    process.exit(0);
  }
  if (!result.stdout.toLowerCase().includes(entry.toLowerCase()))
    throw Error("다른 프로그램이므로 종료하지 않았어요.");
} else {
  const result = spawnSync("ps", ["-p", String(record.pid), "-o", "args="], {
    encoding: "utf8",
  });
  if (!result.stdout.includes(entry))
    throw Error("도토 서버를 확인하지 못했어요.");
}
process.kill(record.pid, "SIGTERM");
unlinkSync(pidPath);
console.log("도토 서버를 종료했어요. 보관한 수업은 브라우저에 남아 있어요.");
