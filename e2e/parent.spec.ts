import { test, expect, type Page, type Response } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { blankProfile } from "../src/progress";
import type { Question } from "../src/data/questions";

const activationToken = process.env.E2E_PARENT_ACTIVATION_TOKEN;
const password = "Родительский тестовый пароль 2026";
const nextPassword = "Новый родительский пароль 2026";
const names = ["Рыжий Следопыт", "Медвежонок"];
const questResponse = (response: Response) =>
  response.url().endsWith("/.netlify/functions/quest") && response.ok();

async function answerQuestion(
  page: Page,
  question: Question,
  index: number,
  wrong = false,
) {
  await expect(page.locator(".question-card h1")).toHaveText(question.prompt);
  await page
    .locator(".answer")
    .nth(wrong ? (question.answer + 1) % 4 : question.answer)
    .click();
  await page
    .getByRole("button", {
      name: index === 7 ? "Результаты" : "Дальше",
      exact: true,
    })
    .click();
}

async function expectOutboxEmpty(page: Page) {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const queue = JSON.parse(
            localStorage.getItem("kvestograd-family-queue") || "null",
          );
          return queue?.events?.length ?? 0;
        }),
      { timeout: 30_000 },
    )
    .toBe(0);
}

test("password parent account observes two paired child profiles, offline answers, errors and yearly progress", async ({
  page: parent,
  browser,
}, testInfo) => {
  test.skip(
    !activationToken,
    "Set E2E_PARENT_ACTIVATION_TOKEN and matching private PARENT_BOOTSTRAP on a fresh local server.",
  );
  test.setTimeout(180_000);
  const errors: string[] = [];
  parent.on("pageerror", (error) => errors.push(error.message));
  const childContext = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
  });
  const child = await childContext.newPage();
  child.on("pageerror", (error) => errors.push(error.message));
  try {
    await parent.goto(`/parent#activate=${activationToken}`);
    await expect(
      parent.getByRole("heading", { name: "Создайте родительский пароль" }),
    ).toBeVisible();
    await expect(parent).toHaveURL(/\/parent$/); // The token leaves the address bar immediately.
    await parent.getByLabel("Игровое имя ребёнка 1").fill(names[0]);
    await parent.getByLabel("Игровое имя ребёнка 2").fill(names[1]);
    await parent.getByLabel("Пароль", { exact: true }).fill(password);
    await parent.getByLabel("Повторите пароль", { exact: true }).fill(password);
    await parent
      .getByRole("button", { name: "Создать кабинет", exact: true })
      .click();
    await expect(
      parent.getByRole("tab", { name: "Обзор", exact: true }),
    ).toBeVisible();
    const session = (await parent.context().cookies()).find(
      (cookie) => cookie.name === "kvestograd_parent",
    );
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite).toBe("Strict");
    expect(
      (
        await child.request.post("/.netlify/functions/parent", {
          data: { action: "dashboard" },
        })
      ).status(),
    ).toBe(401);

    await parent.getByRole("tab", { name: "Семья и доступ" }).click();
    await parent
      .getByRole("button", { name: "Создать код подключения" })
      .click();
    const pairingCode = (
      await parent.locator(".parent-pairing > strong").innerText()
    ).trim();
    expect(pairingCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    await child.goto("/");
    // Import an older browser profile without pretending its detailed history exists.
    const old = blankProfile("Старый Лис", 0);
    Object.assign(old, {
      xp: 12,
      correct: 1,
      answered: 2,
      subjects: { math: 1 },
      rewardedQuestionIds: ["legacy-question"],
    });
    await child.evaluate(
      (profiles) =>
        localStorage.setItem(
          "questograd-progress",
          JSON.stringify({ active: 0, profiles }),
        ),
      [old, blankProfile("Старый Мишка", 1)],
    );
    await child.reload();
    await child.locator(".profile-button").click();
    const dialog = child.getByRole("dialog");
    await dialog.getByLabel("Название устройства").fill("Тестовый ноутбук");
    await dialog.getByLabel("Код подключения").fill(pairingCode);
    await dialog
      .getByRole("button", { name: "Подключить к семье", exact: true })
      .click();
    await expect(
      dialog.getByRole("heading", { name: "Подключено к семье" }),
    ).toBeVisible();
    await expect(dialog.locator(".family-sync-status")).toContainText(
      "Весь прогресс передан",
    );
    await expect(
      dialog.getByRole("textbox", { name: "Имя игрока 1" }),
    ).toHaveValue(names[0]);
    await expect(
      dialog.getByRole("textbox", { name: "Имя игрока 1" }),
    ).toBeDisabled();
    await dialog.getByRole("button", { name: "Вперёд, к открытиям" }).click();
    const reusedPair = await child.request.post("/.netlify/functions/parent", {
      data: { action: "pair", code: pairingCode, deviceName: "Повтор" },
    });
    expect(reusedPair.status()).toBe(403);

    const loaded = child.waitForResponse(questResponse);
    await child
      .getByRole("button", { name: "Быстрая тренировка", exact: true })
      .click();
    const firstQuest = (await (await loaded).json()).questions as Question[];
    await expect(child.locator(".answer")).toHaveCount(4);
    await childContext.setOffline(true);
    for (let index = 0; index < 2; index++)
      await answerQuestion(child, firstQuest[index], index, index === 0);
    await expect
      .poll(async () =>
        child.evaluate(() => {
          const queue = JSON.parse(
            localStorage.getItem("kvestograd-family-queue") || "null",
          );
          return (
            queue?.events.filter(
              (event: { type: string }) => event.type === "answer",
            ).length ?? 0
          );
        }),
      )
      .toBeGreaterThanOrEqual(2);
    await childContext.setOffline(false);
    await child.evaluate(() => window.dispatchEvent(new Event("online")));
    for (let index = 2; index < 8; index++)
      await answerQuestion(child, firstQuest[index], index);
    await expect(child.locator(".result-card")).toContainText("7 из 8");
    await child
      .getByRole("button", { name: "К карте миров", exact: true })
      .click();
    await expectOutboxEmpty(child);
    await parent.getByRole("tab", { name: "Обзор", exact: true }).click();
    await parent.getByRole("button", { name: "Обновить статистику" }).click();
    await expect(
      parent
        .locator(".parent-kpis .panel")
        .filter({ hasText: "Верные ответы" }),
    ).toContainText("8 из 10 за всё время");
    await expect(
      parent.getByText("Сохранено 2 прежних ответов из браузеров.", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(parent.locator(".parent-quiz-row").first()).toContainText(
      "7 / 8",
    );
    await expect(parent.locator(".history-event.has-mistake")).toHaveCount(1);
    await parent.screenshot({
      path: testInfo.outputPath("parent-overview.png"),
      fullPage: true,
    });

    await parent.getByRole("tab", { name: "История ответов" }).click();
    await expect(parent.locator(".event-list > .history-event")).toHaveCount(
      10,
    );
    await parent.getByRole("checkbox", { name: "Только ошибки" }).check();
    await expect(parent.locator(".event-list > .history-event")).toHaveCount(1);
    await parent.locator(".event-list > .history-event > summary").click();
    await expect(parent.locator(".event-list")).toContainText(
      firstQuest[0].explanation,
    );
    await expect(parent.locator(".event-list")).toContainText(
      firstQuest[0].choices[firstQuest[0].answer],
    );
    const downloaded = parent.waitForEvent("download");
    await parent.getByRole("button", { name: "CSV", exact: true }).click();
    const download = await downloaded;
    const csv = await readFile((await download.path())!, "utf8");
    expect(csv).toContain(firstQuest[0].prompt.replaceAll('"', '""'));
    expect(csv).toContain(firstQuest[0].explanation.replaceAll('"', '""'));

    // The second child has an independent year route, XP and answer history.
    await child.locator(".profile-button").click();
    await child.getByRole("button", { name: `Выбрать ${names[1]}` }).click();
    await child.getByRole("button", { name: "Вперёд, к открытиям" }).click();
    await child
      .getByRole("button", { name: "Маршрут на год", exact: true })
      .click();
    const yearlyLoaded = child.waitForResponse(questResponse);
    await child
      .locator(".week-quest.subject-math")
      .getByRole("button", { name: "Начать квест" })
      .click();
    const secondQuest = (await (await yearlyLoaded).json())
      .questions as Question[];
    for (let index = 0; index < 8; index++)
      await answerQuestion(child, secondQuest[index], index);
    await child
      .getByRole("button", { name: "К маршруту на год", exact: true })
      .click();
    await expectOutboxEmpty(child);
    await parent.getByRole("tab", { name: "Обзор", exact: true }).click();
    await parent.getByRole("button", { name: "Обновить статистику" }).click();
    await parent.locator(".parent-child-tabs button").nth(1).click();
    await expect(
      parent
        .locator(".parent-kpis .panel")
        .filter({ hasText: "Годовой маршрут" }),
    ).toContainText("1 / 260");
    await expect(
      parent
        .locator(".parent-kpis .panel")
        .filter({ hasText: "Верные ответы" }),
    ).toContainText("8 из 8 за всё время");
    await parent.locator(".parent-child-tabs button").first().click();
    await expect(
      parent
        .locator(".parent-kpis .panel")
        .filter({ hasText: "Верные ответы" }),
    ).toContainText("8 из 10 за всё время");

    const deviceToken = await child.evaluate(
      () =>
        JSON.parse(localStorage.getItem("kvestograd-family-device")!)
          .deviceToken as string,
    );
    const forbidden = await child.request.post("/.netlify/functions/parent", {
      data: { action: "dashboard", deviceToken },
    });
    expect(forbidden.status()).toBe(401);
    expect(await forbidden.json()).not.toHaveProperty("children");
    for (const testedPage of [parent, child]) {
      expect(
        await testedPage.evaluate(
          (sensitive) =>
            !Object.keys(localStorage).some((key) =>
              sensitive.some((value) =>
                localStorage.getItem(key)?.includes(value),
              ),
            ),
          [password, nextPassword, activationToken!],
        ),
      ).toBe(true);
    }
    for (const width of [390, 320]) {
      await parent.setViewportSize({ width, height: 844 });
      for (const tab of ["Обзор", "История ответов", "Семья и доступ"]) {
        await parent.getByRole("tab", { name: tab, exact: true }).click();
        await expect
          .poll(() =>
            parent.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          )
          .toBe(true);
      }
      if (width === 390)
        await parent.screenshot({
          path: testInfo.outputPath("parent-mobile.png"),
          fullPage: true,
        });
    }
    await parent.setViewportSize({ width: 1440, height: 1000 });

    // Logout removes the server session; knowing a child device token grants no parent role.
    await parent.getByRole("button", { name: "Выйти", exact: true }).click();
    await expect(
      parent.getByRole("heading", { name: "Вход для родителя" }),
    ).toBeVisible();
    expect(
      (
        await parent.request.post("/.netlify/functions/parent", {
          data: { action: "dashboard" },
        })
      ).status(),
    ).toBe(401);
    await parent.getByLabel("Пароль", { exact: true }).fill(password);
    await parent.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(
      parent.getByRole("tab", { name: "Семья и доступ" }),
    ).toBeVisible();
    await parent.getByRole("tab", { name: "Семья и доступ" }).click();
    await parent.getByLabel("Текущий пароль", { exact: true }).fill(password);
    await parent.getByLabel("Новый пароль", { exact: true }).fill(nextPassword);
    await parent
      .getByLabel("Повторите новый пароль", { exact: true })
      .fill(nextPassword);
    await parent
      .getByRole("button", { name: "Изменить пароль", exact: true })
      .click();
    await expect(
      parent.getByRole("heading", { name: "Вход для родителя" }),
    ).toBeVisible();
    await parent.getByLabel("Пароль", { exact: true }).fill(nextPassword);
    await parent.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(
      parent.getByRole("tab", { name: "Обзор", exact: true }),
    ).toBeVisible();
    await parent.getByRole("tab", { name: "Семья и доступ" }).click();
    await parent
      .locator(".parent-device")
      .filter({ hasText: "Тестовый ноутбук" })
      .getByRole("button", { name: "Отключить", exact: true })
      .click();
    await expect(
      parent.locator(".parent-device").filter({ hasText: "Тестовый ноутбук" }),
    ).toContainText("Отключено");
    expect(
      (
        await child.request.post("/.netlify/functions/parent", {
          data: { action: "childProgress", deviceToken },
        })
      ).status(),
    ).toBe(401);
    expect(errors).toEqual([]);
  } finally {
    await childContext.close();
  }
});
