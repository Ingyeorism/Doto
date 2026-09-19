import { test, expect, type Page, type Browser } from "@playwright/test";

test.use({ actionTimeout: 15000 });

const connected = (page: Page) =>
  expect(page.locator(".live-app")).toHaveAttribute(
    "data-connection-status",
    "connected",
  );
async function fixture(browser: Browser) {
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
  ]);
  const [teacher, a, b] = await Promise.all(contexts.map((c) => c.newPage()));
  await teacher.goto("/teacher/start");
  await expect(
    teacher.getByRole("region", { name: "접속 전 서버 상태" }),
  ).toContainText("접속");
  await teacher.locator(".th-entry-host").click();
  await teacher
    .getByRole("button", { name: "방 열고 코드 받기", exact: true })
    .click();
  const code = (
    await teacher
      .getByRole("region", { name: "학생 입장 안내" })
      .locator(".th-room-code")
      .innerText()
  ).replace(/\s/g, "");
  for (const [p, name, number] of [
    [a, "열두번", "12"],
    [b, "세번", "3"],
  ] as const) {
    await p.goto(`/join?code=${code}`);
    await p.getByLabel("이름 또는 별명").fill(name);
    await expect(
      p.getByRole("button", { name: "방 입장하기", exact: true }),
    ).toBeDisabled();
    await p.getByLabel("출석 번호", { exact: true }).fill(number);
    await p.getByRole("button", { name: "방 입장하기", exact: true }).click();
    await connected(p);
  }
  return {
    teacher,
    a,
    b,
    close: () => Promise.all(contexts.map((c) => c.close())),
  };
}
async function create(page: Page, title: string, body = "", index = 0) {
  await page.locator(".group-add").nth(index).click();
  if (title) await page.getByLabel("글 제목", { exact: true }).fill(title);
  if (body) await page.locator(".tiptap").fill(body);
}
const back = (page: Page) =>
  page.getByRole("button", { name: "게시판으로", exact: true }).click();

test("번호순·제목/본문 단독 게시·그룹 필터·빈 글 숨김·스크롤 유지", async ({
  browser,
}, info) => {
  const f = await fixture(browser);
  const { teacher: t, a, b } = f;
  try {
    await create(a, "제목만 게시");
    await expect(a.locator(".writing-save")).toHaveText("");
    await a.getByRole("button", { name: "게시하기", exact: true }).click();
    await expect(a.locator(".group-post")).toContainText("제목만 게시");
    await create(b, "", "본문만 게시해도 보이는 글입니다.");
    await b.getByRole("button", { name: "게시하기", exact: true }).click();
    await expect(
      a.locator(".group-post").filter({ hasText: "본문만 게시해도" }),
    ).toContainText("제목 없는 글");
    await create(a, "");
    await expect(
      a.getByRole("button", { name: "게시하기", exact: true }),
    ).toBeDisabled();
    await back(a);
    await t.getByRole("button", { name: "전체 글", exact: true }).click();
    await expect(t.getByLabel("학생 글 정렬", { exact: true })).toHaveValue(
      "number",
    );
    await expect(t.locator(".student-number")).toHaveText(["03", "12", "12"]);
    await t.getByLabel("제목·내용이 모두 빈 글 숨기기").check();
    await expect(t.locator(".student-number")).toHaveText(["03", "12"]);
    await t.getByRole("button", { name: /^게시판/ }).click();
    await t.getByRole("button", { name: "그룹 만들기", exact: true }).click();
    await t.getByLabel("그룹 이름", { exact: true }).fill("어제 있었던 일");
    await t.getByRole("button", { name: "저장하기", exact: true }).click();
    await expect(a.locator(".group-add")).toHaveCount(2);
    for (let i = 0; i < 6; i++) {
      await create(a, `이번 수업 ${i}`, "문장을 드래그해 피드백합니다.", 1);
      await back(a);
    }
    await t.getByRole("button", { name: "전체 글", exact: true }).click();
    await expect(t.locator(".overview-topic")).toHaveCount(2);
    await t
      .getByRole("navigation", { name: "수업 주제 필터" })
      .getByRole("button", { name: "어제 있었던 일", exact: true })
      .click();
    await expect(t.locator(".student-card")).toHaveCount(6);
    await expect(t.locator(".class-board")).not.toContainText("제목만 게시");
    await t.reload();
    await connected(t);
    await expect(t.getByLabel("주제 그룹별 원고 보기")).not.toHaveValue("all");
    await expect(t.locator(".student-card")).toHaveCount(6);
    await t.setViewportSize({ width: 1440, height: 720 });
    const card = t.locator(".student-card").last();
    await card.scrollIntoViewIfNeeded();
    const before = await t.evaluate(() => scrollY);
    expect(before).toBeGreaterThan(100);
    await card.locator(".card-heading").dispatchEvent("click");
    await expect(t.locator(".detail-panel")).toBeVisible();
    expect(await t.evaluate(() => scrollY)).toBeGreaterThan(100);
    await t.screenshot({
      path: info.outputPath("grouped-overview.png"),
      fullPage: true,
    });
  } finally {
    await f.close();
  }
});

test("피드백 선택은 학생의 동시 입력과 스크롤 후에도 유지", async ({
  browser,
}) => {
  const f = await fixture(browser);
  const { teacher: t, a } = f;
  try {
    await create(a, "선택 유지 확인", "처음 문장은 그대로 두고 뒤를 고칩니다.");
    await t.getByRole("button", { name: "전체 글", exact: true }).click();
    await t
      .locator(".student-card")
      .filter({ hasText: "선택 유지 확인" })
      .locator(".card-heading")
      .click();
    await expect(t.locator(".tiptap")).toHaveText(
      "처음 문장은 그대로 두고 뒤를 고칩니다.",
    );
    await t.locator(".tiptap").evaluate((el) => {
      const node = document
        .createTreeWalker(el, NodeFilter.SHOW_TEXT)
        .nextNode()!;
      const range = document.createRange();
      range.setStart(node, 0);
      range.setEnd(node, 6);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });
    await expect(
      t.getByRole("button", { name: "피드백 하기", exact: true }),
    ).toBeVisible();
    await a.locator(".tiptap").press("ControlOrMeta+End");
    await a
      .locator(".tiptap")
      .pressSequentially(" 새로운 문장을 덧붙여요.", { delay: 60 });
    await expect(t.locator(".tiptap")).toContainText("덧붙여요");
    await t.locator(".detail-scroll").evaluate((el) => {
      el.scrollTop = 60;
      el.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await t.getByRole("button", { name: "피드백 하기", exact: true }).click();
    await expect(t.locator(".range-feedback-composer blockquote")).toHaveText(
      "처음 문장은",
    );
    await t.getByLabel("선생님의 한마디").fill("처음 문장이 좋아요.");
    await t.getByRole("button", { name: "피드백 남기기", exact: true }).click();
    await expect(a.locator(".feedback-highlight")).toHaveText("처음 문장은");
  } finally {
    await f.close();
  }
});

test("버튼 강조는 같은 게시판 화면에서만 3초, 글쓰기와 다른 글에서는 표시 안 함", async ({
  browser,
}, info) => {
  const f = await fixture(browser);
  const { teacher: t, a, b } = f;
  try {
    await t.getByRole("button", { name: /^게시판/ }).click();
    await create(b, "다른 화면에 있어요", "글쓰기 중");
    await t.locator(".group-add").first().click({ button: "right" });
    await t
      .getByRole("menuitem", { name: "이 버튼 강조", exact: true })
      .click();
    await expect(a.locator(".group-add").first()).toHaveClass(
      /teacher-button-highlight/,
    );
    await expect(b.locator(".teacher-button-highlight")).toHaveCount(0);
    await a.screenshot({
      path: info.outputPath("student-button-highlight.png"),
    });
    await expect(a.locator(".teacher-button-highlight")).toHaveCount(0, {
      timeout: 5000,
    });
    await create(a, "친구 글 A", "내용 A");
    await a.getByRole("button", { name: "게시하기", exact: true }).click();
    await b.getByRole("button", { name: "게시하기", exact: true }).click();
    await t.locator(".post-open").filter({ hasText: "친구 글 A" }).click();
    await a.locator(".post-open").filter({ hasText: "친구 글 A" }).click();
    await b
      .locator(".post-open")
      .filter({ hasText: "다른 화면에 있어요" })
      .click();
    await t
      .getByRole("dialog")
      .getByRole("button", { name: "닫기", exact: true })
      .click({ button: "right" });
    await t
      .getByRole("menuitem", { name: "이 버튼 강조", exact: true })
      .click();
    await expect(
      a.getByRole("dialog").getByRole("button", { name: "닫기", exact: true }),
    ).toHaveClass(/teacher-button-highlight/);
    await expect(b.locator(".teacher-button-highlight")).toHaveCount(0);
  } finally {
    await f.close();
  }
});
