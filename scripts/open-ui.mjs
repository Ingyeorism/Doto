import { spawn } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const url = "http://127.0.0.1:5173/";

async function isReady() {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return (
      response.ok && (await response.text()).includes("도토 · 우리 반 글쓰기")
    );
  } catch {
    return false;
  }
}

if (!(await isReady())) {
  const log = openSync(resolve(root, ".ui-preview.log"), "a");
  const child = spawn(
    process.execPath,
    [
      resolve(root, "node_modules/vite/bin/vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      "5173",
      "--strictPort",
    ],
    {
      cwd: root,
      detached: true,
      windowsHide: true,
      stdio: ["ignore", log, log],
    },
  );
  child.unref();
  closeSync(log);
  for (let attempt = 0; attempt < 15 && !(await isReady()); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

if (!(await isReady())) {
  console.error(
    "도토 미리보기를 열지 못했습니다. .ui-preview.log 파일을 확인해 주세요.",
  );
  process.exitCode = 1;
} else {
  const child = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-WindowStyle",
      "Hidden",
      "-Command",
      "Start-Process 'http://127.0.0.1:5173/teacher/overview?preview=1'",
    ],
    { detached: true, windowsHide: true, stdio: "ignore" },
  );
  child.unref();
}
