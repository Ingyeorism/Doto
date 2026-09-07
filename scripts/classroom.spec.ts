import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("교사와 두 학생: 비공개 협업, 게시와 댓글, 재입장, 수업 보관", async ({
  browser,
}, testInfo) => {
  const tc = await browser.newContext(),
    ac = await browser.newContext(),
    bc = await browser.newContext();
  await ac.addInitScript(() => {
    const Native = window.RTCPeerConnection;
    (window as any).__pcs = [];
    window.RTCPeerConnection = class extends Native {
      constructor(config?: RTCConfiguration) {
        super(config);
        (window as any).__pcs.push(this);
      }
    };
  });
  const t = await tc.newPage(),
    a = await ac.newPage(),
    b = await bc.newPage();
  const errors: string[] = [];
  const centralFrames: string[] = [];
  for (const page of [t, a, b])
    page.on("websocket", (ws) => {
      if (ws.url().includes("/signal")) {
        ws.on("framesent", (f) => centralFrames.push(String(f.payload)));
        ws.on("framereceived", (f) => centralFrames.push(String(f.payload)));
      }
    });
  for (const page of [t, a, b])
    page.on("pageerror", (e) => {
      errors.push(e.message);
      console.log("PAGE ERROR", page.url(), e.stack);
    });
  await t.goto("/teacher/start");
  if (testInfo.project.name === "http-lan") {
    // A real HTTP origin catches secure-context restrictions that localhost hides.
    expect(
      await t.evaluate(() => ({
        secure: window.isSecureContext,
        randomUUID: typeof crypto.randomUUID,
        getRandomValues: typeof crypto.getRandomValues,
      })),
    ).toEqual({
      secure: false,
      randomUUID: "undefined",
      getRandomValues: "function",
    });
  }
  await t.locator(".teacher-entry").click();
  const code = (await t.locator(".large-code").innerText()).trim();
  await expect(t.getByAltText("학생 입장 QR 코드")).toBeVisible();
  await t.getByRole("button", { name: "닫기", exact: true }).click();
  const join = async (p: Page, name: string) => {
    await p.goto("/student/join");
    await p.getByLabel("입장 코드", { exact: true }).fill(code);
    await p.getByLabel("이름 또는 별명").fill(name);
    await p.getByRole("button", { name: "들어가기", exact: true }).click();
    await expect(p.getByText("선생님과 연결됨", { exact: true })).toBeVisible();
  };
  await join(a, "하늘");
  await join(b, "지우");
  await expect(t.locator(".header-connected")).toContainText("2명");
  const write = async (p: Page, title: string, body: string) => {
    await p.locator(".group-add").first().click();
    await p.getByLabel("글 제목", { exact: true }).fill(title);
    await p.locator(".tiptap").fill(body);
    await expect(p.locator(".writing-save")).toContainText("이 기기에 저장됨");
  };
  await write(
    a,
    "하늘의 비공개 원고",
    "오늘 학교에서 친구를 도와주었다. 마음이 따뜻했다.",
  );
  await write(
    b,
    "지우의 비공개 원고",
    "이 내용은 다른 학생에게 전달하면 안 되는 비밀초안입니다.",
  );
  // Enter paragraphs, empty lines and a trailing Shift+Enter survive read views.
  await a.locator(".tiptap").press("ControlOrMeta+End");
  await a.keyboard.press("Enter");
  await a.keyboard.press("Enter");
  await a.keyboard.press("Enter");
  await a.keyboard.type(
    "빈 줄 뒤 이야기. " + "친구와 함께한 하루를 기억하고 싶다. ".repeat(35),
  );
  await a.keyboard.press("Shift+Enter");
  await a.getByRole("button", { name: "더 보기", exact: true }).click();
  await expect(a.getByLabel("줄간격", { exact: true })).toHaveValue("1.6");
  await a.locator(".tiptap").press("ControlOrMeta+A");
  await a.getByLabel("줄간격", { exact: true }).selectOption("0.6");
  await expect(a.locator(".tiptap p").first()).toHaveCSS(
    "line-height",
    "10.8px",
  );
  await expect(
    t
      .locator(".card-prose")
      .filter({ hasText: "하늘의 비공개 원고" })
      .locator(".document-body p")
      .first(),
  ).toHaveAttribute("style", /line-height: 0.6/);
  await a.getByLabel("줄간격", { exact: true }).selectOption("1.6");
  await a.getByRole("button", { name: "더 보기", exact: true }).click();
  const blankLines = t
    .locator(".card-prose")
    .filter({ hasText: "하늘의 비공개 원고" })
    .locator(".document-body p:empty");
  await a.locator(".tiptap p").first().click();
  await expect(blankLines).toHaveCount(2);
  await t.bringToFront();
  await expect
    .poll(() =>
      blankLines.first().evaluate((e) => e.getBoundingClientRect().height),
    )
    .toBeGreaterThan(0);
  await expect(a.locator(".tiptap p").first()).toHaveCSS(
    "margin-bottom",
    "0px",
  );
  await a
    .getByRole("button", { name: "선생님께 도움 요청", exact: true })
    .click();
  await a.getByLabel("덧붙일 말 · 선택").fill("어떤 장면을 더 쓰면 좋을까요?");
  await a
    .getByRole("button", { name: "선생님께 요청하기", exact: true })
    .click();
  await expect(
    a.getByRole("button", { name: "도움 요청 중", exact: true }),
  ).toBeVisible();
  await a.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  await a
    .getByLabel("선생님께 보낼 메시지")
    .fill("비공개질문: 첫 문장 다음이 막막해요.");
  await a
    .getByRole("dialog")
    .getByRole("button", { name: "메시지 보내기", exact: true })
    .click();
  await expect(a.locator(".message-history")).toContainText("비공개질문");
  await a.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(
    t.locator(".student-card").filter({ hasText: "하늘의 비공개 원고" }),
  ).toContainText("새 메시지");
  await expect(t.locator(".card-prose")).toHaveCount(2);
  await expect(
    t.getByText("오늘 학교에서 친구를 도와주었다. 마음이 따뜻했다.", {
      exact: true,
    }),
  ).toBeVisible();
  await t.getByText("하늘의 비공개 원고", { exact: true }).click();
  await expect(t.locator(".teacher-help-request")).toContainText(
    "어떤 장면을 더 쓰면 좋을까요?",
  );
  await t.getByRole("button", { name: "요청 확인 완료", exact: true }).click();
  await expect(
    a.getByRole("button", { name: "선생님께 도움 요청", exact: true }),
  ).toBeVisible();
  await expect(t.locator(".message-history")).toContainText("비공개질문");
  await t
    .getByLabel("학생에게 답장")
    .fill("비공개답장: 친구의 표정을 떠올려 보세요.");
  await t.getByRole("button", { name: "답장 보내기", exact: true }).click();
  await expect(a.getByLabel("새 답장 1개")).toBeVisible();
  await a.getByRole("button", { name: /메시지 보내기/ }).click();
  await expect(a.locator(".message-history")).toContainText("비공개답장");
  await a.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(a.getByLabel("새 답장 1개")).toHaveCount(0);
  const paperTop = () =>
    a
      .locator(".paper-rule")
      .evaluate((e) => e.getBoundingClientRect().top + window.scrollY);
  const beforePresence = await paperTop();
  await t.getByRole("switch", { name: "직접 수정", exact: true }).click();
  await expect(a.locator(".teacher-presence")).toBeVisible();
  expect(await paperTop()).toBe(beforePresence);
  await t.locator(".tiptap").press("ControlOrMeta+End");
  await t.locator(".tiptap").pressSequentially(" 선생님의 응원.");
  await expect(a.locator(".tiptap")).toContainText("선생님의 응원.");
  await expect(
    a.getByText("선생님이 수정 중이에요", { exact: true }),
  ).toBeVisible();
  await t
    .getByLabel("피드백 메시지")
    .fill("도와준 모습을 더 자세히 써 볼까요?");
  await t
    .locator(".feedback-composer")
    .getByRole("button", { name: "보내기", exact: true })
    .click();
  await expect(
    a.getByText("도와준 모습을 더 자세히 써 볼까요?", { exact: true }),
  ).toBeVisible();
  // Select the actual text positions in the teacher editor, then use its feedback UI.
  await t.locator(".tiptap").evaluate((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const n = walker.nextNode()!;
    const range = document.createRange();
    range.setStart(n, 0);
    range.setEnd(n, 5);
    const s = window.getSelection()!;
    s.removeAllRanges();
    s.addRange(range);
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await t.getByRole("button", { name: "피드백 하기", exact: true }).click();
  await t.getByLabel("선생님의 한마디").fill("언제 있었던 일인지 잘 드러나요.");
  await t.getByRole("button", { name: "피드백 남기기", exact: true }).click();
  await expect(a.locator(".feedback-highlight")).toHaveCount(1);
  // Boundary insertions stay outside the teacher's range.
  await a.locator(".tiptap").press("ControlOrMeta+Home");
  await a.locator(".tiptap").pressSequentially("먼저 ");
  await expect(a.locator(".feedback-highlight")).toHaveText("오늘 학교");
  await expect(t.locator(".feedback-highlight")).toHaveText("오늘 학교");
  // Cut the direct connection, independently edit both copies, then merge.
  await a.evaluate(() =>
    (window as any).__pcs.forEach((p: RTCPeerConnection) => p.close()),
  );
  await expect(
    a.getByRole("button", { name: "다시 연결", exact: true }),
  ).toBeVisible();
  await a.locator(".tiptap").press("ControlOrMeta+End");
  await a.keyboard.type(" 학생의 오프라인 생각.");
  await t.locator(".tiptap").press("ControlOrMeta+End");
  await t.keyboard.type(" 교사의 별도 도움.");
  await a.getByRole("button", { name: "다시 연결", exact: true }).click();
  await expect(a.locator(".tiptap")).toContainText("교사의 별도 도움.");
  await expect(t.locator(".tiptap")).toContainText("학생의 오프라인 생각.");
  await expect
    .poll(async () => (await a.locator(".tiptap").innerText()).trim())
    .toBe((await t.locator(".tiptap").innerText()).trim());
  // Replace precisely the highlighted range, then undo/redo from the student.
  await a.locator(".tiptap").focus();
  await a.locator(".feedback-highlight").evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const s = window.getSelection()!;
    s.removeAllRanges();
    s.addRange(range);
  });
  await a.keyboard.type("새로운 문장");
  await expect(a.locator(".feedback-highlight")).toHaveCount(0);
  await expect(t.locator(".feedback-highlight")).toHaveCount(0);
  await a.getByRole("button", { name: "실행 취소", exact: true }).click();
  await expect(a.locator(".feedback-highlight")).toHaveText("오늘 학교");
  await expect(t.locator(".feedback-highlight")).toHaveText("오늘 학교");
  await a.getByRole("button", { name: "다시 실행", exact: true }).click();
  await expect(a.locator(".feedback-highlight")).toHaveCount(0);
  await expect(t.locator(".feedback-highlight")).toHaveCount(0);
  await a.getByRole("button", { name: "실행 취소", exact: true }).click();
  await expect(t.locator(".feedback-highlight")).toHaveText("오늘 학교");
  await a.locator(".feedback-highlight").hover();
  await expect(
    a.getByText("언제 있었던 일인지 잘 드러나요.").first(),
  ).toBeVisible();
  await a.getByRole("button", { name: "게시하기", exact: true }).click();
  await expect(a).toHaveURL(/\/student\/board$/);
  await expect(a.locator(".post-body p:empty")).toHaveCount(2);
  await a.getByRole("button", { name: "펼치기", exact: true }).click();
  expect(
    await a
      .locator(".post-body")
      .evaluate((e) => e.clientHeight >= e.scrollHeight),
  ).toBe(true);
  await expect(a.getByRole("dialog")).toHaveCount(0);
  await a.getByRole("button", { name: "접기", exact: true }).click();
  await t.getByRole("button", { name: "상세 패널 닫기", exact: true }).click();
  await t
    .locator(".product-tabs")
    .getByRole("button", { name: /게시판/ })
    .click();
  await t.getByRole("button", { name: "그룹 설정", exact: true }).click();
  await t.getByRole("checkbox", { name: /게시글 자동으로 펼치기/ }).check();
  await t.getByRole("button", { name: "저장하기", exact: true }).click();
  await expect(a.locator(".post-expand")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await b.getByRole("button", { name: "게시판으로", exact: true }).click();
  await expect(b.locator(".post-expand")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(
    b.getByText("하늘의 비공개 원고", { exact: true }),
  ).toBeVisible();
  await b.getByText("하늘의 비공개 원고", { exact: true }).click();
  await b.getByLabel("지우의 댓글").fill("친구를 도와줘서 멋져!");
  await b.getByRole("button", { name: "남기기", exact: true }).click();
  await expect(
    b.getByText("친구를 도와줘서 멋져!", { exact: true }),
  ).toBeVisible();
  await a.reload();
  await expect(a.locator(".post-body")).toContainText("선생님의 응원.");
  await expect(a.locator(".post-expand")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await a.getByRole("button", { name: "내 글 수정", exact: true }).click();
  await a.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  await expect(a.locator(".message-history")).toContainText("비공개질문");
  await expect(a.locator(".message-history")).toContainText("비공개답장");
  await a.getByRole("button", { name: "닫기", exact: true }).click();
  await a.setViewportSize({ width: 390, height: 844 });
  expect(
    await a.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await a.screenshot({
    path: testInfo.outputPath("student-writing-mobile.png"),
    fullPage: true,
  });
  await a.setViewportSize({ width: 1440, height: 1000 });
  await expect(a.getByText("선생님과 연결됨", { exact: true })).toBeVisible();
  await t
    .locator(".product-tabs")
    .getByRole("button", { name: "전체 글", exact: true })
    .click();
  await t.reload();
  await expect(t.locator(".card-prose")).toHaveCount(2);
  await expect(t.locator(".header-connected")).toContainText("2명");
  // Inspect persisted student data: the private manuscript and private feedback of peers must not exist there.
  const stored = async (p: Page) =>
    p.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((res, rej) => {
        const r = indexedDB.open("keyval-store");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      return await new Promise<any[]>((res, rej) => {
        const r = db.transaction("keyval").objectStore("keyval").getAll();
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    });
  expect(JSON.stringify(await stored(a))).not.toContain("비밀초안");
  expect(JSON.stringify(await stored(b))).not.toContain(
    "도와준 모습을 더 자세히",
  );
  expect(JSON.stringify(await stored(b))).not.toContain("비공개질문");
  expect(JSON.stringify(await stored(b))).not.toContain("비공개답장");
  expect((await stored(a))[0].lesson.board.docs).toHaveLength(1);
  expect((await stored(b))[0].lesson.board.docs).toHaveLength(1);
  await t.getByRole("button", { name: "수업 종료", exact: true }).click();
  await t.getByRole("button", { name: "수업 마치기", exact: true }).click();
  await expect(t.locator(".history-card")).toHaveCount(1);
  const download = t.waitForEvent("download");
  await t.getByRole("button", { name: "결과 내보내기", exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.html$/);
  const html = await readFile((await file.path())!, "utf8");
  expect(html).toContain("친구를 도와줘서 멋져!");
  expect(html).toContain("도와준 모습을 더 자세히");
  await expect(
    a.getByText("수업이 끝났어요. 내 글은 이 기기에 남아 있어요.", {
      exact: true,
    }),
  ).toBeVisible();
  await t.getByRole("button", { name: "다시 수업 열기", exact: true }).click();
  await expect(t.locator(".large-code")).not.toHaveText(code);
  const nextCode = (await t.locator(".large-code").innerText()).trim();
  await a.goto("/student/join");
  await a.getByLabel("입장 코드", { exact: true }).fill(nextCode);
  await a.getByLabel("이름 또는 별명").fill("하늘");
  await a.getByRole("button", { name: "들어가기", exact: true }).click();
  await expect(
    a.getByText("하늘의 비공개 원고", { exact: true }),
  ).toBeVisible();
  expect(
    (await stored(a)).filter((r) => r.session?.role === "student"),
  ).toHaveLength(1);
  expect(centralFrames.join("")).not.toContain("비밀초안");
  expect(centralFrames.join("")).not.toContain("선생님의 응원");
  expect(centralFrames.join("")).not.toContain("더 자세히");
  expect(centralFrames.join("")).not.toContain("비공개질문");
  expect(centralFrames.join("")).not.toContain("비공개답장");
  expect(errors).toEqual([]);
  await Promise.all([tc.close(), ac.close(), bc.close()]);
});
