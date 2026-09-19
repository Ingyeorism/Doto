import { test, expect } from "@playwright/test";

// Node API requests do not use Chromium's doto.test host-resolver rule.
const api = "http://127.0.0.1:3100";

test("중계 경로에서 글 변경을 묶고 게시 직전·재접속 후 마지막 입력까지 전달", async ({
  browser,
  request,
}) => {
  const auth = {
    Authorization: "Bearer isolated-playwright-test-secret-123456",
  };
  const saved = await (
    await request.get(`${api}/api/admin/server`, { headers: auth })
  ).json();
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
  ]);
  await contexts[1].addInitScript(() => {
    window.RTCPeerConnection = class {
      constructor() {
        throw Error("Test blocked RTC");
      }
    } as any;
    const native = WebSocket.prototype.send;
    (window as any).__updates = [];
    (window as any).__delays = [];
    const NativeSocket = WebSocket;
    window.WebSocket = class extends NativeSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        this.addEventListener("message", (event) => {
          const m = JSON.parse(event.data);
          if (m.type === "server-load")
            (window as any).__delays.push(m.updateDelayMs);
        });
      }
    };
    WebSocket.prototype.send = function (data) {
      const m = JSON.parse(String(data));
      if (
        m.type === "relay" &&
        m.kind === "data" &&
        JSON.parse(m.text).type === "sync"
      )
        (window as any).__updates.push({
          at: Date.now(),
          size: String(data).length,
        });
      return native.call(this, data);
    };
  });
  try {
    await request.put(`${api}/api/admin/server`, {
      headers: auth,
      data: {
        ...saved.tuning,
        normalDelayMs: 500,
        busyDelayMs: 500,
        overloadedDelayMs: 500,
      },
    });
    const t = await contexts[0].newPage(),
      a = await contexts[1].newPage();
    await t.goto("/teacher/start");
    await t.locator(".th-entry-host").click();
    await t
      .getByRole("button", { name: "방 열고 코드 받기", exact: true })
      .click();
    const code = (
      await t
        .getByRole("region", { name: "학생 입장 안내" })
        .locator(".th-room-code")
        .innerText()
    ).replace(/\s/g, "");
    await a.goto(`/join?code=${code}`);
    await a.getByLabel("출석 번호", { exact: true }).fill("4");
    await a.getByLabel("이름 또는 별명").fill("동기화검사");
    await a.getByRole("button", { name: "방 입장하기", exact: true }).click();
    await expect(a.locator(".live-app")).toHaveAttribute(
      "data-connection-status",
      "connected",
    );
    const identity = await a.evaluate(() =>
      JSON.parse(sessionStorage.getItem("doto.active-session")!),
    );
    await a.locator(".group-add").first().click();
    await a.getByLabel("글 제목", { exact: true }).fill("묶음 전송");
    await t.getByRole("button", { name: "전체 글", exact: true }).click();
    await expect(t.locator(".student-card")).toContainText("묶음 전송");
    await a.evaluate(() => {
      (window as any).__updates = [];
    });
    await a
      .locator(".tiptap")
      .pressSequentially("abcdefghijklmnopqrst", { delay: 100 });
    await a.getByRole("button", { name: "게시하기", exact: true }).click();
    await expect(a.locator(".post-body")).toHaveText("abcdefghijklmnopqrst");
    const sent = await a.evaluate(() => (window as any).__updates.length);
    expect(sent).toBeLessThan(10); // 20 input transactions; <= 4–6 batches plus sync responses.
    expect(sent).toBeGreaterThan(0);
    await request.put(`${api}/api/admin/server`, {
      headers: auth,
      data: {
        ...saved.tuning,
        normalDelayMs: 120,
        busyDelayMs: 120,
        overloadedDelayMs: 200,
      },
    });
    await expect
      .poll(() => a.evaluate(() => (window as any).__delays.at(-1)))
      .toBeLessThanOrEqual(200);
    await a.reload();
    await expect(a.locator(".live-app")).toHaveAttribute(
      "data-connection-status",
      "connected",
    );
    const resumed = await a.evaluate(() =>
      JSON.parse(sessionStorage.getItem("doto.active-session")!),
    );
    expect(resumed.id).toBe(identity.id);
    expect(resumed.lessonId).toBe(identity.lessonId);
    expect(resumed.token).toBe(identity.token);
    expect(resumed.attendanceNumber).toBe(4);
    await expect(a.locator(".post-body")).toHaveText("abcdefghijklmnopqrst");
  } finally {
    await request.put(`${api}/api/admin/server`, {
      headers: auth,
      data: saved.tuning,
    });
    await Promise.all(contexts.map((c) => c.close()));
  }
});

test("서버 관리 화면은 인증 후 기준을 저장하며 접속 전 상태에는 개인 정보를 노출하지 않음", async ({
  page,
  request,
}, info) => {
  const auth = {
    Authorization: "Bearer isolated-playwright-test-secret-123456",
  };
  const original = await (
    await request.get(`${api}/api/admin/server`, { headers: auth })
  ).json();
  try {
    await page.goto("/admin/server");
    await page.getByLabel("관리 키", { exact: true }).fill("incorrect-key");
    await page.getByRole("button", { name: "상태 확인", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText(
      "관리 키를 확인해 주세요.",
    );
    await expect(
      page.getByRole("button", { name: "설정 저장", exact: true }),
    ).toHaveCount(0);
    await page
      .getByLabel("관리 키", { exact: true })
      .fill("isolated-playwright-test-secret-123456");
    await page.getByRole("button", { name: "상태 확인", exact: true }).click();
    await page
      .getByLabel("혼잡할 때 글 전달 간격 (ms)", { exact: true })
      .fill("650");
    await page.getByRole("button", { name: "설정 저장", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("설정을 저장했어요");
    expect(
      (
        await (
          await request.get(`${api}/api/admin/server`, { headers: auth })
        ).json()
      ).tuning.busyDelayMs,
    ).toBe(650);
    await page.screenshot({
      path: info.outputPath("server-admin.png"),
      fullPage: true,
    });
    await page.reload();
    await expect(page.getByLabel("관리 키", { exact: true })).toHaveValue("");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/join?code=123456");
    await expect(
      page.getByRole("region", { name: "접속 전 서버 상태" }),
    ).toContainText("접속");
    await page.getByLabel("출석 번호", { exact: true }).fill("12");
    await page.getByLabel("이름 또는 별명").fill("입장검사");
    await page.screenshot({
      path: info.outputPath("join-status-mobile.png"),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const status = await (await request.get(`${api}/api/status`)).json();
    expect(status).not.toHaveProperty("tuning");
    expect(status).not.toHaveProperty("metrics");
    expect(status).not.toHaveProperty("participants");
    expect(status).not.toHaveProperty("token");
  } finally {
    await request.put(`${api}/api/admin/server`, {
      headers: auth,
      data: original.tuning,
    });
  }
});
