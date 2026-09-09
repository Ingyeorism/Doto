import { test, expect, type Page } from "@playwright/test";

const acknowledgement = (page: Page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("doto.usage-consent") || "null"),
  );
const connected = (page: Page) =>
  expect(page.locator(".live-app")).toHaveAttribute(
    "data-connection-status",
    "connected",
  );

test("약관 읽기는 선택: 모바일에서 닫아도 입력과 입장 버튼을 유지하고 동의로 기록하지 않음", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/teacher/start");
  await page
    .getByRole("button", { name: "이용약관 · 개인정보 안내", exact: true })
    .click();
  const terms = page.getByRole("dialog", {
    name: "이용약관 · 개인정보 안내",
    exact: true,
  });
  await expect(terms).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(terms).toHaveCount(0);
  expect(await acknowledgement(page)).toBeNull();

  await page.goto("/student/join?code=123456");
  await page.getByLabel("이름 또는 별명").fill("도토별명");
  const enter = page.getByRole("button", { name: "방 입장하기", exact: true });
  await expect(enter).toBeEnabled();
  await expect(enter).toHaveAccessibleDescription(
    /개인정보 수집·이용에 동의해요/,
  );
  await page.getByRole("button", { name: "자세히 읽기", exact: true }).click();
  await expect(terms).toBeVisible();
  await expect(terms).toContainText("작성 중인 글과 개인 피드백");
  await expect(terms).toContainText("법정대리인 동의");
  expect(await acknowledgement(page)).toBeNull();
  expect(
    await page.evaluate(() => sessionStorage.getItem("doto.active-session")),
  ).toBeNull();
  await page.screenshot({ path: testInfo.outputPath("terms-mobile.png") });
  await terms.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(page.getByLabel("입장 코드", { exact: true })).toHaveValue(
    "123456",
  );
  await expect(page.getByLabel("이름 또는 별명")).toHaveValue("도토별명");
  await expect(enter).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "자세히 읽기", exact: true }),
  ).toBeFocused();
  expect(await acknowledgement(page)).toBeNull();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("join-mobile.png"),
    fullPage: true,
  });
});

test("약관을 열지 않고 방 생성·QR 학생 입장·교사 입장 시 버튼 동의를 기록함", async ({
  browser,
}, testInfo) => {
  const contexts = await Promise.all(
    Array.from({ length: 3 }, () => browser.newContext()),
  );
  try {
    const [host, student, teacher] = await Promise.all(
      contexts.map((context) => context.newPage()),
    );
    await host.goto("/host/setup");
    await host
      .getByLabel("수업 이름", { exact: true })
      .fill("동의 안내 확인 수업");
    await expect(host.getByRole("dialog")).toHaveCount(0);
    await expect(host.getByRole("checkbox")).toHaveCount(0);
    expect(await acknowledgement(host)).toBeNull();
    await host.screenshot({
      path: testInfo.outputPath("setup-desktop.png"),
      fullPage: true,
    });
    await host.getByLabel("수업 이름", { exact: true }).press("Enter");
    await connected(host);
    expect(await acknowledgement(host)).toMatchObject({
      action: "create",
      acceptedAt: expect.any(String),
      version: expect.any(String),
    });
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

    await student.goto(`/join?code=${code}`);
    await student.getByLabel("이름 또는 별명").fill("동의별명");
    await expect(student.getByRole("dialog")).toHaveCount(0);
    await student.getByLabel("이름 또는 별명").press("Enter");
    await connected(student);
    await expect(student).toHaveURL(/\/student\/board$/);
    const accepted = await acknowledgement(student);
    expect(accepted.action).toBe("join");
    expect(Object.keys(accepted).sort()).toEqual([
      "acceptedAt",
      "action",
      "version",
    ]);
    await teacher.goto(`/teacher/join?code=${teacherCode}`);
    await expect(teacher.getByLabel("이름 또는 별명")).toHaveCount(0);
    await expect(teacher.locator("#join-usage-consent")).toBeVisible();
    await teacher
      .getByRole("button", { name: "방 입장하기", exact: true })
      .click();
    await connected(teacher);
    expect((await acknowledgement(teacher)).action).toBe("join");

    await host
      .getByRole("button", { name: "수업 마치기", exact: true })
      .first()
      .click();
    await host
      .getByRole("dialog")
      .getByRole("button", { name: "수업 마치기", exact: true })
      .click();
    await expect(host).toHaveURL(/\/teacher\/history$/);
    await expect(host.locator("#history-usage-consent")).toBeVisible();
    await expect(
      host.getByRole("button", { name: "다시 수업 열기", exact: true }),
    ).toHaveAccessibleDescription(/개인정보 수집·이용에 동의해요/);
    await student.goto("/join");
    await student.reload();
    expect(await acknowledgement(student)).toEqual(accepted);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
