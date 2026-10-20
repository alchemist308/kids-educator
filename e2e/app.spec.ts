import { test, expect, type Page, type Response } from "@playwright/test";
import type { Question } from "../src/data/questions";

const questResponse = (response: Response) =>
  response.url().endsWith("/.netlify/functions/quest") &&
  response.request().method() === "POST" &&
  response.ok();
const duelResponse = (action: string) => (response: Response) =>
  response.url().endsWith("/.netlify/functions/duel") &&
  response.request().method() === "POST" &&
  response.request().postDataJSON()?.action === action;

async function openDuel(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Дуэль с другом" }).click();
  await expect(
    page.getByRole("heading", { name: "Дружеская дуэль" }),
  ).toBeVisible();
}

test("five subject worlds render on desktop and mobile without horizontal scrolling", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveTitle(/Квестоград/);
  await expect(page.locator(".subject-card")).toHaveCount(5);
  for (const title of [
    "Математика",
    "Окружающий мир",
    "Русский язык",
    "Английский язык",
    "Литература",
  ])
    await expect(
      page.locator(".subject-label", { hasText: title }),
    ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("home-desktop.png"),
    fullPage: true,
  });
  for (const width of [390, 320, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await expect
      .poll(async () =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await expect(
      page.getByRole("button", { name: "Быстрая тренировка" }),
    ).toBeVisible();
    if (width === 390)
      await page.screenshot({
        path: testInfo.outputPath("home-mobile.png"),
        fullPage: true,
      });
  }
  expect(errors).toEqual([]);
});

test("two local profiles have separate progress and survive a reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".profile-button").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Имя игрока 1" })
    .fill("Северный Лис");
  await page
    .getByRole("textbox", { name: "Имя игрока 2" })
    .fill("Полярный Мишка");
  await page.getByRole("button", { name: "Выбрать Игрок 2" }).click();
  await page.getByRole("button", { name: "Вперёд, к открытиям" }).click();
  await expect(page.locator(".profile-button")).toContainText("Полярный Мишка");
  await page.reload();
  await expect(page.locator(".profile-button")).toContainText("Полярный Мишка");
  await page.locator(".profile-button").click();
  await page.getByRole("button", { name: "Выбрать Северный Лис" }).click();
  await page.getByRole("button", { name: "Вперёд, к открытиям" }).click();
  await expect(page.locator(".profile-button")).toContainText("Северный Лис");
  const progress = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("questograd-progress")!),
  );
  expect(progress.active).toBe(0);
  expect(progress.profiles.map((p: { xp: number }) => p.xp)).toEqual([0, 0]);
});

test("a real database-backed solo quest awards weighted XP and unlocks achievements", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const loaded = page.waitForResponse(questResponse);
  await page.getByRole("button", { name: "Быстрая тренировка" }).click();
  const payload = (await (await loaded).json()) as {
    questions: Question[];
    source: string;
  };
  expect(payload.source).toBe("hybrid");
  expect(payload.questions).toHaveLength(8);
  expect(new Set(payload.questions.map((q) => q.subject)).size).toBe(5);
  let expectedXP = 0;
  for (let i = 0; i < payload.questions.length; i++) {
    const question = payload.questions[i];
    await expect(page.locator(".question-card h1")).toHaveText(question.prompt);
    await page.locator(".answer").nth(question.answer).click();
    await expect(page.getByRole("status")).toContainText("Верно");
    expectedXP += { 1: 8, 2: 12, 3: 16 }[question.difficulty];
    await page
      .getByRole("button", {
        name: i === 7 ? "Результаты" : "Дальше",
        exact: true,
      })
      .click();
  }
  await expect(page.locator(".result-card")).toContainText("8 из 8");
  const progress = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("questograd-progress")!),
  );
  expect(progress.profiles[0].xp).toBe(expectedXP);
  expect(progress.profiles[0].games).toBe(1);
  expect(progress.profiles[0].perfect).toBe(1);
  expect(progress.profiles[1].xp).toBe(0);
  await page
    .getByRole("button", { name: "К карте миров", exact: true })
    .click();
  await page.getByRole("button", { name: "Достижения", exact: true }).click();
  await expect(
    page
      .locator(".achievement-card.earned")
      .filter({ hasText: "Первое открытие" }),
  ).toBeVisible();
  await expect(
    page
      .locator(".achievement-card.earned")
      .filter({ hasText: "Безупречный квест" }),
  ).toBeVisible();
  await page.reload();
  const reloaded = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("questograd-progress")!),
  );
  expect(reloaded.profiles[0].xp).toBe(expectedXP);
  await page.locator(".profile-button").click();
  await page.getByRole("button", { name: "Выбрать Игрок 2" }).click();
  await page.getByRole("button", { name: "Вперёд, к открытиям" }).click();
  await expect(
    page.locator(".progress-strip .stat-item").first(),
  ).toContainText("0 XP");
  await page.locator(".profile-button").click();
  await page.getByRole("button", { name: "Выбрать Игрок 1" }).click();
  await page.getByRole("button", { name: "Вперёд, к открытиям" }).click();
  await expect(
    page.locator(".progress-strip .stat-item").first(),
  ).toContainText(`${expectedXP} XP`);
  expect(errors).toEqual([]);
});

test("a failed quest request explains the problem and can retry the real service", async ({
  page,
}) => {
  await page.route("**/.netlify/functions/quest", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Хранилище временно недоступно. Попробуй ещё раз.",
      }),
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Быстрая тренировка" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Квест пока не загрузился",
  );
  await expect(page.getByRole("alert")).toContainText(
    "Хранилище временно недоступно",
  );
  await page.unroute("**/.netlify/functions/quest");
  const response = page.waitForResponse(questResponse);
  await page.getByRole("button", { name: "Попробовать снова" }).click();
  expect((await response).ok()).toBe(true);
  await expect(page.locator(".answer")).toHaveCount(4);
  await expect(page.locator(".quiz-progress")).toContainText("Задание 1 из 8");
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("questograd-progress")!).profiles[0].xp,
    ),
  ).toBe(0);
});

test("two browsers join one room, resume it and finish a fair eight-round duel", async ({
  browser,
}) => {
  const first = await browser.newContext();
  const second = await browser.newContext();
  const a = await first.newPage();
  const b = await second.newPage();
  const errors: string[] = [];
  for (const page of [a, b])
    page.on("pageerror", (error) => errors.push(error.message));
  try {
    await openDuel(a);
    await a.getByRole("textbox", { name: "Твоё игровое имя" }).fill("Лис");
    await a.getByRole("button", { name: "Создать комнату" }).click();
    await expect(a.locator(".large-code")).toHaveText(/^[A-Z2-9]{6}$/);
    const code = (await a.locator(".large-code").innerText()).trim();
    await a.reload();
    await a.getByRole("button", { name: "Дуэль с другом" }).click();
    await expect(a.locator(".large-code")).toHaveText(code);
    await openDuel(b);
    await b.getByRole("textbox", { name: "Твоё игровое имя" }).fill("Мишка");
    await b.getByRole("textbox", { name: "Код комнаты" }).fill(code);
    await b
      .getByRole("button", { name: "Присоединиться", exact: true })
      .click();
    await expect(a.locator(".players-bar")).toContainText("Мишка");
    for (let round = 0; round < 8; round++) {
      for (const page of [a, b])
        await expect(page.locator(".quiz-progress")).toContainText(
          `задание ${round + 1} из 8`,
        );
      const prompt = await a.locator(".question-card>h2").innerText();
      await expect(b.locator(".question-card>h2")).toHaveText(prompt);
      expect(
        await a.locator(".answer>span:last-child").allInnerTexts(),
      ).toEqual(await b.locator(".answer>span:last-child").allInnerTexts());
      const responses = [
        a.waitForResponse(duelResponse("answer")),
        b.waitForResponse(duelResponse("answer")),
      ];
      await Promise.all([
        a.locator(".answer").first().click(),
        b.locator(".answer").first().click(),
      ]);
      for (const response of await Promise.all(responses)) {
        expect(response.ok()).toBe(true);
        const data = await response.json();
        expect(
          data.room.players.every(
            (p: { score: number }) =>
              p.score >= 0 && p.score <= 80 && p.score % 10 === 0,
          ),
        ).toBe(true);
        if (data.room.currentQuestion) {
          expect(data.room.currentQuestion).not.toHaveProperty("answer");
          expect(data.room.currentQuestion).not.toHaveProperty("explanation");
        }
      }
      await Promise.all([
        a.getByRole("button", { name: "Продолжить", exact: true }).click(),
        b.getByRole("button", { name: "Продолжить", exact: true }).click(),
      ]);
    }
    for (const page of [a, b]) {
      await expect(
        page.getByRole("heading", { name: "Дружеская ничья!" }),
      ).toBeVisible();
      await expect(page.locator(".result-card")).toContainText(
        "Твой результат:",
      );
    }
    expect(errors).toEqual([]);
  } finally {
    await first.close();
    await second.close();
  }
});

test("an unknown room gives a useful error and leaves the join form usable", async ({
  page,
}) => {
  await openDuel(page);
  await page.getByRole("textbox", { name: "Код комнаты" }).fill("AAAAAA");
  await page
    .getByRole("button", { name: "Присоединиться", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    /не найдена|время игры истекло/,
  );
  await expect(
    page.getByRole("textbox", { name: "Код комнаты" }),
  ).toBeEditable();
  await expect(
    page.getByRole("button", { name: "Создать комнату" }),
  ).toBeEnabled();
});
