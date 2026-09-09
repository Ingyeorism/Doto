import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const connected = (page: Page) =>
  expect(page.locator(".live-app")).toHaveAttribute(
    "data-connection-status",
    "connected",
  );
async function stored(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("keyval-store");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return new Promise<any[]>((resolve, reject) => {
      const req = db.transaction("keyval").objectStore("keyval").getAll();
      req.onsuccess = () => {
        resolve(req.result);
        db.close();
      };
      req.onerror = () => reject(req.error);
    });
  });
}

for (const relay of [false, true]) {
  test(`${relay ? "중계 혼합" : "직접 연결"}: 태블릿 호스트·원격 교사·학생 2명: 편집과 권한, PC 퇴장, 재접속 및 보관`, async ({
    browser,
  }) => {
    const contexts = await Promise.all(
      Array.from({ length: 4 }, () => browser.newContext()),
    );
    const aContext = contexts[2];
    if (relay) {
      for (const context of [contexts[1], aContext])
        await context.addInitScript(() => {
          window.RTCPeerConnection = class {
            constructor() {
              throw Error("This participant must not use WebRTC");
            }
          } as any;
          const send = WebSocket.prototype.send;
          WebSocket.prototype.send = function (data) {
            if (this.url.endsWith("/signal")) {
              (window as any).__relaySocket = this;
              const message = JSON.parse(String(data));
              if (message.type === "relay")
                (window as any).__relayChannel = message.channel;
            }
            return send.call(this, data);
          };
        });
    }
    await aContext.addInitScript(() => {
      const native = RTCDataChannel.prototype.send;
      RTCDataChannel.prototype.send = function (data: any) {
        (window as any).__testChannel = this;
        return native.call(this, data);
      };
    });
    const [host, pc, a, b] = await Promise.all(
      contexts.map((context) => context.newPage()),
    );
    const errors: string[] = [],
      signalFrames: string[] = [];
    for (const page of [host, pc, a, b]) {
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("websocket", (socket) => {
        if (socket.url().endsWith("/signal")) {
          socket.on("framesent", (f) => signalFrames.push(String(f.payload)));
          socket.on("framereceived", (f) =>
            signalFrames.push(String(f.payload)),
          );
        }
      });
    }
    try {
      await host.goto("/teacher/start");
      await host.locator(".th-entry-host").click();
      await host
        .getByLabel("수업 이름", { exact: true })
        .fill("백엔드 회귀 수업");
      await host
        .getByRole("button", { name: "방 열고 코드 받기", exact: true })
        .click();
      const code = (
        await host
          .getByRole("region", { name: "학생 입장 안내" })
          .locator(".th-room-code")
          .innerText()
      ).replace(/\s/g, "");
      const teacherCode = (
        await host
          .getByRole("region", { name: "선생님 PC 연결" })
          .locator(".th-room-code")
          .innerText()
      ).replace(/\s/g, "");
      expect(code).toMatch(/^\d{6}$/);
      expect(teacherCode).toMatch(/^\d{8}$/);
      const join = async (page: Page, entryCode: string, name?: string) => {
        await page.goto("/student/join");
        await page
          .getByLabel("입장 코드", { exact: true })
          .fill((relay && page !== b ? "*" : "") + entryCode);
        if (name) await page.getByLabel("이름 또는 별명").fill(name);
        else await expect(page.getByLabel("이름 또는 별명")).toHaveCount(0);
        await page
          .getByRole("button", { name: "방 입장하기", exact: true })
          .click();
        await connected(page);
      };
      await join(pc, teacherCode);
      const firstTeacherId = await pc.evaluate(
        () => JSON.parse(sessionStorage.getItem("doto.active-session")!).id,
      );
      await expect(
        pc.getByRole("button", { name: "전체 글", exact: true }),
      ).toBeVisible();
      await expect(
        pc.getByRole("button", { name: "서버 관리", exact: true }),
      ).toHaveCount(0);
      await expect(
        host.getByRole("region", { name: "선생님 PC 연결" }),
      ).toContainText("PC 연결 1대");
      await join(a, code, "이강우");
      await join(b, code, "박서연");
      await host
        .getByRole("button", { name: "어둡게 켜 두기", exact: true })
        .click();
      await expect(
        host.getByRole("dialog", { name: "백엔드 회귀 수업", exact: true }),
      ).toBeVisible();
      await expect(
        a.getByText("서버 태블릿에 연결됨", { exact: true }),
      ).toHaveCount(0);
      await a
        .getByRole("button", {
          name: "우리 반 이야기에 새 글 쓰기",
          exact: true,
        })
        .click();
      await a.getByLabel("글 제목", { exact: true }).fill("강우의 비공개 초안");
      await a
        .getByRole("textbox", { name: "이강우의 글 본문", exact: true })
        .fill("호스트 비밀 원고. 친구를 응원했다.");
      await expect(
        pc.locator(".student-card").filter({ hasText: "강우의 비공개 초안" }),
      ).toContainText("호스트 비밀 원고");
      await host
        .getByRole("button", { name: "밝은 화면으로 돌아가기", exact: true })
        .click();
      await host.getByRole("button", { name: "전체 글", exact: true }).click();
      await expect(
        host.locator(".student-card").filter({ hasText: "강우의 비공개 초안" }),
      ).toContainText("호스트 비밀 원고");
      await expect(
        b.getByText("강우의 비공개 초안", { exact: true }),
      ).toHaveCount(0);
      await expect
        .poll(async () => (await stored(b)).length)
        .toBeGreaterThan(0);
      expect(JSON.stringify(await stored(b))).not.toContain("호스트 비밀 원고");

      // Even a forged teacher role in a raw student DataChannel request must fail.
      const rejected = await a.evaluate(
        (relayed) =>
          new Promise<any>((resolve, reject) => {
            const channel = (
              relayed
                ? (window as any).__relaySocket
                : (window as any).__testChannel
            ) as RTCDataChannel;
            const requestId = `probe-${Date.now()}`;
            const timer = setTimeout(
              () => reject(Error("authorization probe timeout")),
              5000,
            );
            const listener = (event: MessageEvent) => {
              const packet = JSON.parse(event.data);
              if (
                relayed &&
                (packet.type !== "relay" || packet.kind !== "data")
              )
                return;
              const m = relayed ? JSON.parse(packet.text) : packet;
              if (m.requestId === requestId) {
                clearTimeout(timer);
                channel.removeEventListener("message", listener);
                resolve(m);
              }
            };
            channel.addEventListener("message", listener);
            const raw = JSON.stringify({
              type: "action",
              role: "teacher",
              actor: -1,
              requestId,
              action: {
                type: "group",
                group: {
                  id: "forged",
                  title: "권한 위조 그룹",
                  description: "",
                },
              },
            });
            channel.send(
              relayed
                ? JSON.stringify({
                    type: "relay",
                    to: -1,
                    kind: "data",
                    sequence: 999000,
                    channel: (window as any).__relayChannel,
                    text: raw,
                  })
                : raw,
            );
          }),
        relay,
      );
      expect(rejected.error).toContain("선생님만");
      await expect(
        b.getByRole("heading", { name: "권한 위조 그룹" }),
      ).toHaveCount(0);

      await pc
        .getByRole("button", { name: "이강우 글 크게 보기", exact: true })
        .click();
      await pc.getByRole("switch", { name: "직접 수정", exact: true }).click();
      await pc
        .getByRole("textbox", { name: "이강우의 글 본문", exact: true })
        .fill("교사 PC에서 함께 고친 원고.");
      await expect(
        a.getByRole("textbox", { name: "이강우의 글 본문" }),
      ).toHaveText("교사 PC에서 함께 고친 원고.");
      await pc
        .getByRole("textbox", { name: "피드백 메시지", exact: true })
        .fill("강우에게만 보이는 피드백");
      await pc.getByRole("button", { name: "보내기", exact: true }).click();
      await expect(
        a.getByText("강우에게만 보이는 피드백", { exact: true }),
      ).toBeVisible();
      expect(JSON.stringify(await stored(b))).not.toContain(
        "강우에게만 보이는 피드백",
      );
      const hostToken = await host.evaluate(
        () => JSON.parse(sessionStorage.getItem("doto.active-session")!).token,
      );
      const studentToken = await a.evaluate(
        () => JSON.parse(sessionStorage.getItem("doto.active-session")!).token,
      );
      expect(JSON.stringify(await stored(pc))).not.toContain(hostToken);
      expect(JSON.stringify(await stored(pc))).not.toContain(studentToken);
      if (relay) {
        await pc.reload();
        await connected(pc);
        expect(
          await pc.evaluate(
            () =>
              JSON.parse(sessionStorage.getItem("doto.active-session")!).relay,
          ),
        ).toBe(true);
        await expect(
          pc.locator(".student-card").filter({ hasText: "강우의 비공개 초안" }),
        ).toContainText("교사 PC에서 함께 고친 원고.");
        for (const reconnectCount of [1, 2]) {
          await a.evaluate(() => (window as any).__relaySocket.close());
          await expect
            .poll(() =>
              a.evaluate(
                () =>
                  JSON.parse(
                    sessionStorage.getItem("doto.diagnostics.v1")!,
                  ).history.filter((e: any) => e.event === "socket.open")
                    .length,
              ),
            )
            .toBeGreaterThan(reconnectCount);
          await connected(a);
        }
      }

      await pc
        .getByRole("button", { name: "PC 연결 나가기", exact: true })
        .click();
      await pc
        .getByRole("dialog")
        .getByRole("button", { name: "PC 연결 나가기", exact: true })
        .click();
      const continuedBody =
        "PC 퇴장 후에도 계속 쓰는 원고." +
        (relay ? " 큰 자료 전송 확인.".repeat(2000) : "");
      await a
        .getByRole("textbox", { name: "이강우의 글 본문", exact: true })
        .fill(continuedBody);
      await expect(
        host.locator(".student-card").filter({ hasText: "강우의 비공개 초안" }),
      ).toContainText("PC 퇴장 후에도 계속 쓰는 원고.");
      await connected(a);
      await connected(b);
      await host.evaluate(() =>
        sessionStorage.setItem("doto.active-session", "invalid-json"),
      );
      await host.reload();
      await expect(host.locator(".header-connected")).toContainText("2명");
      await a.reload();
      await connected(a);
      await expect(
        a.getByRole("textbox", { name: "이강우의 글 본문" }),
      ).toHaveText(continuedBody);
      await join(pc, teacherCode);
      expect(
        await pc.evaluate(
          () => JSON.parse(sessionStorage.getItem("doto.active-session")!).id,
        ),
      ).toBe(firstTeacherId);
      await expect(
        pc.locator(".student-card").filter({ hasText: "강우의 비공개 초안" }),
      ).toContainText("PC 퇴장 후에도 계속 쓰는 원고.");
      await a.getByRole("button", { name: "게시하기", exact: true }).click();
      await expect(b.locator(".group-post")).toContainText("이강우");
      await expect(b.locator(".group-post")).toContainText(
        "PC 퇴장 후에도 계속 쓰는 원고.",
      );
      if (!relay) {
        expect(signalFrames.join("")).not.toContain("호스트 비밀 원고");
        expect(signalFrames.join("")).not.toContain("강우에게만 보이는 피드백");
      } else {
        expect(signalFrames.join("")).toContain("강우에게만 보이는 피드백");
        const logs = await readFile(
          "test-results/diagnostics/doto.jsonl",
          "utf8",
        );
        expect(logs).not.toContain("강우에게만 보이는 피드백");
        expect(logs).not.toContain("호스트 비밀 원고");
      }
      await host
        .getByRole("button", { name: "수업 마치기", exact: true })
        .click();
      await host
        .getByRole("dialog")
        .getByRole("button", { name: "수업 마치기", exact: true })
        .click();
      await expect(pc.locator(".live-app")).toHaveAttribute(
        "data-connection-status",
        "ended",
      );
      await expect(pc.locator(".header-connected")).toHaveText("수업 종료");
      await expect(a.locator(".live-app")).toHaveAttribute(
        "data-connection-status",
        "ended",
      );
      await expect(host.locator(".history-card")).toHaveCount(1);
      expect(errors).toEqual([]);
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });
}
