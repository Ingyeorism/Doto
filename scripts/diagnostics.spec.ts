import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("진단: 후보가 offer보다 먼저 와도 연결하고 끊김을 서버에 기록", async ({
  browser,
}) => {
  const teacherContext = await browser.newContext();
  const studentContext = await browser.newContext();
  await teacherContext.addInitScript(() => {
    const nativeSend = WebSocket.prototype.send;
    const offers = new Map<WebSocket, string>();
    WebSocket.prototype.send = function (data) {
      if (this.url.endsWith("/signal") && typeof data === "string") {
        const message = JSON.parse(data);
        if (message.description?.type === "offer") {
          offers.set(this, data);
          return;
        }
        if (message.candidate && offers.has(this)) {
          const offer = offers.get(this)!;
          offers.delete(this);
          nativeSend.call(this, data);
          setTimeout(() => nativeSend.call(this, offer), 150);
          return;
        }
      }
      return nativeSend.call(this, data);
    };
  });
  await studentContext.addInitScript(() => {
    const Native = RTCPeerConnection;
    (window as any).__pcs = [];
    (window as any).__iceAdded = 0;
    window.RTCPeerConnection = class extends Native {
      applying = false;
      constructor(config?: RTCConfiguration) {
        super(config);
        (window as any).__pcs.push(this);
      }
      async setRemoteDescription(description: RTCSessionDescriptionInit) {
        this.applying = true;
        try {
          await new Promise((resolve) => setTimeout(resolve, 80));
          await super.setRemoteDescription(description);
        } finally {
          this.applying = false;
        }
      }
      async addIceCandidate(candidate?: RTCIceCandidateInit | null) {
        if (this.applying) throw Error("Concurrent SDP/ICE operations");
        (window as any).__iceAdded++;
        await super.addIceCandidate(candidate);
      }
    };
  });
  try {
    const teacher = await teacherContext.newPage();
    const student = await studentContext.newPage();
    const errors: string[] = [];
    student.on("pageerror", (error) => errors.push(error.message));
    await teacher.goto("/teacher/start");
    await teacher.locator(".teacher-entry").click();
    const code = (await teacher.locator(".large-code").innerText()).trim();
    await student.goto("/student/join");
    await student.getByLabel("입장 코드", { exact: true }).fill(code);
    await student.getByLabel("이름 또는 별명").fill("로그비공개이름");
    await student
      .getByRole("button", { name: "들어가기", exact: true })
      .click();
    await expect(
      student.getByText("선생님과 연결됨", { exact: true }),
    ).toBeVisible();
    expect(await student.evaluate(() => (window as any).__pcs.length)).toBe(1);
    expect(
      await student.evaluate(() => (window as any).__iceAdded),
    ).toBeGreaterThan(0);
    await expect
      .poll(() =>
        student.evaluate(() =>
          JSON.parse(
            sessionStorage.getItem("doto.diagnostics.v1")!,
          ).history.some((e: any) => e.event === "channel.open"),
        ),
      )
      .toBe(true);
    await expect
      .poll(() =>
        student.evaluate(() =>
          JSON.parse(
            sessionStorage.getItem("doto.diagnostics.v1")!,
          ).history.some(
            (e: any) => e.event === "ice.candidate" && e.remoteCandidateType,
          ),
        ),
      )
      .toBe(true);
    const attemptId = await student.evaluate(() => {
      const saved = JSON.parse(sessionStorage.getItem("doto.diagnostics.v1")!);
      return saved.history.find((e: any) => e.event === "channel.open")
        .attemptId;
    });
    await student.evaluate(() => {
      const pc = (window as any).__pcs[0] as RTCPeerConnection;
      Object.defineProperty(pc, "connectionState", { get: () => "failed" });
      pc.dispatchEvent(new Event("connectionstatechange"));
    });
    await expect(
      student.getByRole("button", { name: "다시 연결", exact: true }),
    ).toBeVisible();
    await expect
      .poll(async () => {
        const raw = await readFile(
          "test-results/diagnostics/doto.jsonl",
          "utf8",
        );
        return raw
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line))
          .some(
            (e) =>
              e.attemptId === attemptId &&
              e.event === "peer.closed" &&
              e.reason === "failed",
          );
      })
      .toBe(true);
    const downloaded = student.waitForEvent("download");
    await student
      .getByRole("button", { name: "진단 로그 저장", exact: true })
      .click();
    const exported = await readFile((await (await downloaded).path())!, "utf8");
    expect(exported).toContain('"event": "peer.closed"');
    expect(exported).not.toContain("로그비공개이름");
    expect(exported).not.toContain("candidate:");
    expect(exported).not.toContain('"sdp"');
    expect(exported).not.toContain('"token"');
    await student
      .getByRole("button", { name: "다시 연결", exact: true })
      .click();
    await expect(
      student.getByText("선생님과 연결됨", { exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await teacherContext.close();
    await studentContext.close();
  }
});

test("진단 업로드 실패 기록은 같은 탭 새로고침 후 재전송", async ({ page }) => {
  await page.route("**/api/diagnostics", (route) =>
    route.fulfill({ status: 503 }),
  );
  await page.goto("/student/join");
  const eventId = await page.evaluate(
    () =>
      JSON.parse(sessionStorage.getItem("doto.diagnostics.v1")!).pending[0]
        .eventId,
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(sessionStorage.getItem("doto.diagnostics.v1")!).pending
            .length,
      ),
    )
    .toBeGreaterThan(0);
  await page.reload();
  expect(
    await page.evaluate(
      (id) =>
        JSON.parse(sessionStorage.getItem("doto.diagnostics.v1")!).pending.some(
          (e: any) => e.eventId === id,
        ),
      eventId,
    ),
  ).toBe(true);
  await page.unroute("**/api/diagnostics");
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect
    .poll(async () =>
      (await readFile("test-results/diagnostics/doto.jsonl", "utf8")).includes(
        eventId,
      ),
    )
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(sessionStorage.getItem("doto.diagnostics.v1")!).pending
            .length,
      ),
    )
    .toBe(0);
});

test("연결 제안이 도착하지 않으면 20초 대기 초과를 기록", async ({
  browser,
}) => {
  const teacherContext = await browser.newContext();
  const studentContext = await browser.newContext();
  await teacherContext.addInitScript(() => {
    const send = WebSocket.prototype.send;
    WebSocket.prototype.send = function (data) {
      if (
        typeof data === "string" &&
        this.url.endsWith("/signal") &&
        JSON.parse(data).type === "signal"
      )
        return;
      return send.call(this, data);
    };
  });
  try {
    const teacher = await teacherContext.newPage();
    const student = await studentContext.newPage();
    await teacher.goto("/teacher/start");
    await teacher.locator(".teacher-entry").click();
    const code = (await teacher.locator(".large-code").innerText()).trim();
    await student.clock.install();
    await student.goto("/student/join");
    await student.getByLabel("입장 코드", { exact: true }).fill(code);
    await student.getByLabel("이름 또는 별명").fill("대기검사");
    await student
      .getByRole("button", { name: "들어가기", exact: true })
      .click();
    await expect(
      student.getByText("선생님과 연결하는 중이에요…", { exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        teacher.evaluate(() =>
          JSON.parse(
            sessionStorage.getItem("doto.diagnostics.v1")!,
          ).history.some((e: any) => e.event === "peer.created"),
        ),
      )
      .toBe(true);
    await expect
      .poll(
        () =>
          teacher.evaluate(() =>
            JSON.parse(
              sessionStorage.getItem("doto.diagnostics.v1")!,
            ).history.some(
              (e: any) =>
                e.event === "peer.stats" &&
                !e.ready &&
                e.connectionState !== "closed" &&
                e.durationMs >= 4500,
            ),
          ),
        { timeout: 10000 },
      )
      .toBe(true);
    await student.clock.fastForward(21000);
    await expect(
      student.getByRole("button", { name: "다시 연결", exact: true }),
    ).toBeVisible();
    await student.clock.runFor(200);
    expect(
      await student.evaluate(() =>
        JSON.parse(sessionStorage.getItem("doto.diagnostics.v1")!).history.some(
          (e: any) => e.event === "join.timeout" && e.durationMs === 20000,
        ),
      ),
    ).toBe(true);
  } finally {
    await teacherContext.close();
    await studentContext.close();
  }
});
