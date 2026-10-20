import { test, expect } from "@playwright/test";
import type { Question } from "../src/data/questions";

const loadedQuest = (url: string) => url.endsWith("/.netlify/functions/quest");

test("the annual route records a planned slot once, restores it and keeps two profiles independent", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "Начать приключение", exact: true })
    .click();
  await expect(page.locator(".year-page h1")).toContainText("длиной в год");
  await expect(page.locator(".week-quest")).toHaveCount(5);
  await expect(page.locator(".year-summary")).toContainText("260 квестов");
  const loaded = page.waitForResponse(
    (response) => loadedQuest(response.url()) && response.ok(),
  );
  await page
    .locator(".week-quest")
    .first()
    .getByRole("button", { name: "Начать квест" })
    .click();
  const payload = (await (await loaded).json()) as {
    questions: Question[];
    year: { week: number };
  };
  expect(payload.year.week).toBe(1);
  expect(
    payload.questions.every((question) => question.subject === "math"),
  ).toBe(true);
  for (const [index, question] of payload.questions.entries()) {
    await page.locator(".answer").nth(question.answer).click();
    await page
      .getByRole("button", {
        name: index === 7 ? "Результаты" : "Дальше",
        exact: true,
      })
      .click();
  }
  await page
    .getByRole("button", { name: "К маршруту на год", exact: true })
    .click();
  await expect(page.locator(".year-summary")).toContainText("1 из 260");
  await expect(page.locator(".week-quest").first()).toContainText(
    "Лучший результат: 8 из 8",
  );
  const year = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("questograd-year")!),
  );
  expect(Object.keys(year.profiles[0].quests)).toEqual(["1-math"]);
  expect(Object.keys(year.profiles[1].quests)).toHaveLength(0);
  await page.reload();
  await page
    .getByRole("button", { name: "Маршрут на год", exact: true })
    .click();
  await expect(page.locator(".year-summary")).toContainText("1 из 260");
  await page.locator(".profile-button").click();
  await page.getByRole("button", { name: "Выбрать Игрок 2" }).click();
  await page.getByRole("button", { name: "Вперёд, к открытиям" }).click();
  await expect(page.locator(".year-summary")).toContainText("0 из 260");
  expect(errors).toEqual([]);
});

test("reading quests display their original text and the year map fits phone and tablet screens", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Маршрут на год", exact: true })
    .click();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 1440 || width === 390)
      await page.screenshot({
        path: testInfo.outputPath(`year-${width}.png`),
        fullPage: true,
      });
  }
  const loaded = page.waitForResponse(
    (response) => loadedQuest(response.url()) && response.ok(),
  );
  await page
    .locator(".week-quest")
    .last()
    .getByRole("button", { name: "Начать квест" })
    .click();
  const payload = (await (await loaded).json()) as { questions: Question[] };
  const readingIndex = payload.questions.findIndex(
    (question) => question.passage,
  );
  expect(readingIndex).toBeGreaterThanOrEqual(0);
  for (let index = 0; index < readingIndex; index++) {
    await page.locator(".answer").nth(payload.questions[index].answer).click();
    await page.getByRole("button", { name: "Дальше", exact: true }).click();
  }
  await expect(page.locator(".reading-text")).toHaveText(
    payload.questions[readingIndex].passage!.text,
  );
  await expect(page.locator(".reading-author")).toContainText(
    "Авторский текст Квестограда",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
