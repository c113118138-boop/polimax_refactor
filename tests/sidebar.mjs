import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";

const project = new URL("../", import.meta.url).pathname;
const data = await mkdtemp(tmpdir() + "/polimax-sidebar-");
const base = "http://127.0.0.1:18027",
  output = project + "test-results/sidebar";
await mkdir(output, { recursive: true });
const server = spawn(
  project + ".venv/bin/python",
  [
    "-m",
    "uvicorn",
    "app:app",
    "--app-dir",
    "backend",
    "--host",
    "127.0.0.1",
    "--port",
    "18027",
  ],
  {
    cwd: project,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      AMS_DATABASE_MODE: "demo",
      AMS_DATA_DIR: data,
      PREVIEW_DATA_DIR: data,
      PREVIEW_DATABASE_URL: "",
      PREVIEW_LOGIN_ENABLED: "1",
      AMS_POLICY_FILE: "",
      AMS_OPTIONS_FILE: "",
      AMS_HOLIDAYS_FILE: "",
      AMS_REPORTS_FILE: "",
    },
  },
);
let logs = "",
  browser;
server.stdout.on("data", (value) => (logs += value));
server.stderr.on("data", (value) => (logs += value));
const passes = [],
  geometry = [],
  errors = [];
function pass(name) {
  passes.push(name);
  console.log("PASS", name);
}
const approx = (actual, expected, message) =>
  assert(
    Math.abs(actual - expected) <= 1.5,
    `${message}: ${actual} / ${expected}`,
  );
async function login(page, role = "admin") {
  page.on("pageerror", (error) => errors.push(error.message));
  page.setDefaultTimeout(15000);
  await page.goto(base);
  if (role === "viewer")
    await page.getByRole("button", { name: /唯讀使用者/ }).click();
  await page.getByRole("button", { name: /進入工作空間/ }).click();
  await page.locator(".sidebar-profile").waitFor();
}
async function group(page, label, open = true) {
  const toggle = page
    .locator(".sidebar")
    .getByRole("button", { name: label, exact: true });
  if ((await toggle.getAttribute("aria-expanded")) !== String(open))
    await toggle.click();
}
function dialog(page, title) {
  return page
    .getByRole("dialog")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
}
async function screenshot(page, name) {
  await page.waitForTimeout(350);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
    0,
  );
  await page.screenshot({
    path: output + "/" + name + ".png",
    animations: "disabled",
  });
}
try {
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(base + "/api/health")).ok) break;
    } catch {}
    if (server.exitCode !== null) throw new Error(logs);
    if (i === 149) throw new Error("Preview timeout");
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  const libraries =
    "/home/c113118138/.cache/polimax-browser-deps/usr/lib/x86_64-linux-gnu";
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
    env: {
      ...process.env,
      ...(existsSync(libraries)
        ? {
            LD_LIBRARY_PATH:
              libraries +
              (process.env.LD_LIBRARY_PATH
                ? ":" + process.env.LD_LIBRARY_PATH
                : ""),
          }
        : {}),
    },
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: "Asia/Taipei",
  });
  const page = await context.newPage();
  let originalResources;
  await page.route("**/api/resources", async (route) => {
    const response = await route.fetch();
    originalResources = await response.json();
    // Anonymous browser-only fixtures force scroll and exercise legacy deletion flags.
    const extra = Array.from({ length: 36 }, (_, index) => ({
      id: 9000 + index,
      kind: "vehicle",
      label: "SCROLL-" + String(index).padStart(2, "0"),
    }));
    await route.fulfill({
      response,
      json: [
        ...originalResources,
        { id: 8001, kind: "vehicle", label: "DELETED-INT", isdelete: 1 },
        { id: 8002, kind: "vehicle", label: "DELETED-STRING", isdelete: "1" },
        ...extra,
      ],
    });
  });
  await login(page);
  await page.locator(".fc-daygrid").waitFor();
  assert.deepEqual(
    await page
      .locator(".sidebar-menu > .sidebar-group > button .sidebar-row-label")
      .allTextContents(),
    ["借用申請", "借用中", "公務車使用管理", "設備管理", "後台資訊管理"],
  );
  assert.equal(
    await page.locator(".sidebar-group-toggle[aria-expanded=false]").count(),
    6,
  );
  assert.equal(await page.locator(".sidebar-children").count(), 0);
  await screenshot(page, "desktop-closed");
  const below = page
    .locator(".sidebar")
    .getByRole("button", { name: "借用中", exact: true });
  const before = await below.boundingBox();
  await group(page, "借用申請");
  const after = await below.boundingBox();
  approx(
    after.y - before.y,
    3 * 48,
    "next group moves below three application links",
  );
  assert.deepEqual(
    await page.locator(".sidebar").getByRole("link").allTextContents(),
    ["日曆", "車輛借用新增", "作業區借用新增", "儀器借用新增", "料件管理"],
  );
  await group(page, "公務車使用管理");
  await group(page, "借用申請", false);
  assert.equal(
    await page
      .locator(".sidebar")
      .getByRole("link", { name: "車輛行駛軌跡查詢" })
      .count(),
    1,
  );
  await group(page, "公務車使用管理", false);
  pass("來源群組順序、初始收合、原位展開與其他群組独立狀態");

  await group(page, "資產設備資訊|管理");
  await group(page, "公務車");
  await group(page, "儀器設備");
  const realCar = originalResources.find(
    (resource) => resource.kind === "vehicle",
  );
  const realEquipment = originalResources.find(
    (resource) => resource.kind === "equipment",
  );
  await page
    .locator(".sidebar")
    .getByRole("link", { name: realCar.label, exact: true })
    .waitFor();
  assert.equal(
    await page
      .locator(".sidebar")
      .getByRole("link", { name: /DELETED/ })
      .count(),
    0,
  );
  const shownCars = await page
    .locator('.sidebar a[href^="/vehicles/"] .sidebar-row-label')
    .allTextContents();
  assert.deepEqual(
    shownCars.slice(
      0,
      originalResources.filter((resource) => resource.kind === "vehicle")
        .length,
    ),
    originalResources
      .filter((resource) => resource.kind === "vehicle")
      .map((resource) => resource.label),
  );
  const boxes = () =>
    page.evaluate(() => {
      const box = (selector) => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      };
      return {
        logo: box(".sidebar-logo-area"),
        profile: box(".sidebar-profile"),
        actions: box(".sidebar-fixed-actions"),
        menu: box(".sidebar-menu"),
        sidebar: box(".sidebar"),
        scrollHeight: document.querySelector(".sidebar-menu").scrollHeight,
        sideScroll: document.querySelector(".sidebar").scrollTop,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
  const fixedBefore = await boxes();
  await group(page, "借用申請");
  await page
    .locator(".sidebar-menu")
    .evaluate((element) => (element.scrollTop = 0));
  await screenshot(page, "desktop-expanded");
  await page
    .locator(".sidebar-menu")
    .evaluate((element) => (element.scrollTop = element.scrollHeight));
  const fixedAfter = await boxes();
  assert.deepEqual(fixedAfter.logo, fixedBefore.logo);
  assert.deepEqual(fixedAfter.actions, fixedBefore.actions);
  assert(fixedAfter.scrollHeight > fixedAfter.menu.height);
  assert.equal(fixedAfter.sideScroll, 0);
  approx(
    fixedAfter.actions.y + fixedAfter.actions.height,
    1000,
    "bottom actions stay in viewport",
  );
  await screenshot(page, "desktop-assets-bottom");
  pass("車輛／設備巢狀展開、API順序與刪除旗標，中間選單捲動且品牌／底部固定");

  await page
    .locator(".sidebar")
    .getByRole("link", { name: realCar.label, exact: true })
    .click();
  await page
    .getByRole("heading", { name: realCar.label, exact: true, level: 1 })
    .waitFor();
  const detailPath = new URL(page.url()).pathname;
  await page.reload();
  await page
    .getByRole("heading", { name: realCar.label, exact: true, level: 1 })
    .waitFor();
  assert.equal(new URL(page.url()).pathname, detailPath);
  await group(page, "資產設備資訊|管理");
  await group(page, "儀器設備");
  await page
    .locator(".sidebar")
    .getByRole("link", {
      name: realEquipment.name || realEquipment.label,
      exact: true,
    })
    .click();
  await page
    .getByRole("heading", {
      name: realEquipment.name || realEquipment.label,
      exact: true,
      level: 1,
    })
    .waitFor();
  await group(page, "公務車");
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "新增車輛資料", exact: true })
    .click();
  const createCar = dialog(page, "新增車輛");
  await createCar.waitFor();
  await createCar.getByRole("button", { name: "取消", exact: true }).click();
  assert.equal(new URL(page.url()).search, "");
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "新增車輛資料", exact: true })
    .click();
  await createCar.waitFor();
  await createCar.getByRole("button", { name: "取消", exact: true }).click();
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "新增儀器設備資料", exact: true })
    .click();
  const createEquipment = dialog(page, "新增設備");
  await createEquipment.waitFor();
  await createEquipment
    .getByRole("button", { name: "取消", exact: true })
    .click();
  await group(page, "借用中");
  for (const label of ["借用紀錄", "出回程紀錄"])
    assert.equal(
      await page
        .locator(".sidebar")
        .getByRole("link", { name: label, exact: true })
        .count(),
      0,
    );
  for (const [label, kind] of [
    ["車輛使用查詢", "A"],
    ["作業區使用查詢", "D"],
    ["儀器使用查詢", "E"],
  ]) {
    await page
      .locator(".sidebar")
      .getByRole("link", { name: label, exact: true })
      .click();
    await page.locator(".source-query-" + kind + " .query-table").waitFor();
    assert.equal(await page.locator(".list-tabs").count(), 0);
    assert.equal(new URL(page.url()).searchParams.get("kind"), kind);
  }
  await page.reload();
  await page.locator(".source-query-E .query-table").waitFor();
  await group(page, "借用申請");
  for (const [label, kind] of [
    ["車輛借用新增", "A"],
    ["作業區借用新增", "D"],
    ["儀器借用新增", "E"],
  ]) {
    await page
      .locator(".sidebar")
      .getByRole("link", { name: label, exact: true })
      .click();
    await page.locator(".source-form").waitFor();
    assert.equal(new URL(page.url()).pathname, "/bookings/new/" + kind);
  }
  await group(page, "公務車使用管理");
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "車輛行駛軌跡查詢", exact: true })
    .click();
  await page.getByLabel("選擇車輛", { exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("view"), "history");
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "車輛即時資訊查詢", exact: true })
    .click();
  await page.locator(".source-location-list").waitFor();
  assert.equal(await page.getByLabel("選擇車輛", { exact: true }).count(), 0);
  const materials = page.locator(".sidebar-materials");
  assert.equal(
    await materials.getAttribute("href"),
    "https://materials.54ucl.com",
  );
  assert.equal(await materials.getAttribute("target"), "_blank");
  await page.locator(".sidebar-logout").click();
  await dialog(page, "登出工作空間")
    .getByRole("button", { name: "取消", exact: true })
    .click();
  assert.equal(
    (await context.request.get(base + "/api/auth/me")).status(),
    200,
  );
  pass(
    "A/D/E新增與分類查詢、資產詳情／刷新／新增重開、即時與軌跡模式、料件連結及取消登出",
  );

  await page.goto(base);
  for (const width of [1440, 900, 769, 768, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(350);
    if (width <= 768)
      await page.getByRole("button", { name: "開啟選單", exact: true }).click();
    const measured = await boxes();
    approx(measured.sidebar.width, width <= 768 ? 280 : 250, "sidebar width");
    assert.equal(measured.overflow, 0);
    approx(
      measured.actions.y + measured.actions.height,
      844,
      "fixed footer at each width",
    );
    approx(measured.logo.height, width <= 768 ? 60 : 80, "logo height");
    approx(measured.profile.height, 140, "profile height");
    assert(
      measured.profile.x >= measured.sidebar.x &&
        measured.profile.x + measured.profile.width <=
          measured.sidebar.x + measured.sidebar.width,
    );
    geometry.push({ width, ...measured });
    if (width === 900) await screenshot(page, "tablet-closed");
    if (width <= 768)
      await page.getByRole("button", { name: "關閉選單", exact: true }).click();
  }
  await page.getByRole("button", { name: "開啟選單", exact: true }).click();
  await group(page, "借用申請");
  await screenshot(page, "mobile-expanded");
  assert.equal(await page.locator(".main-shell[inert]").count(), 1);
  await page.locator(".sidebar-logout").focus();
  await page.keyboard.press("Tab");
  assert.equal(
    await page
      .getByRole("button", { name: "關閉選單", exact: true })
      .evaluate((element) => element === document.activeElement),
    true,
  );
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await page
      .locator(".sidebar-logout")
      .evaluate((element) => element === document.activeElement),
    true,
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".sidebar.is-open").count(), 0);
  assert.equal(
    await page
      .getByRole("button", { name: "開啟選單", exact: true })
      .evaluate((element) => element === document.activeElement),
    true,
  );
  assert.equal(await page.locator(".main-shell[inert]").count(), 0);
  await page.getByRole("button", { name: "開啟選單", exact: true }).click();
  await group(page, "資產設備資訊|管理");
  await group(page, "公務車");
  await group(page, "儀器設備");
  await page
    .locator(".sidebar-menu")
    .evaluate((element) => (element.scrollTop = element.scrollHeight));
  await screenshot(page, "mobile-assets-bottom");
  await page
    .locator(".sidebar")
    .getByRole("link", {
      name: realEquipment.name || realEquipment.label,
      exact: true,
    })
    .click();
  await page
    .getByRole("heading", {
      name: realEquipment.name || realEquipment.label,
      exact: true,
      level: 1,
    })
    .waitFor();
  assert.equal(await page.locator(".sidebar.is-open").count(), 0);
  await page.getByRole("button", { name: "開啟選單", exact: true }).click();
  await page
    .locator(".sidebar-shade.visible")
    .click({ position: { x: 350, y: 500 } });
  assert.equal(await page.locator(".sidebar.is-open").count(), 0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "收合側欄", exact: true }).click();
  assert.equal(await page.locator(".sidebar[inert]").count(), 1);
  await page.getByRole("button", { name: "展開側欄", exact: true }).click();
  await page.waitForFunction(
    () => !document.querySelector(".sidebar").hasAttribute("inert"),
  );
  pass(
    "1440/900/769/768/390比例與無橫溢出、桌面收合、手機焦點循環／Esc／遮罩／選項關閉",
  );

  const readonly = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const viewer = await readonly.newPage();
  await login(viewer, "viewer");
  assert.equal(
    await viewer
      .locator(".sidebar")
      .getByRole("button", { name: "借用申請", exact: true })
      .count(),
    0,
  );
  await group(viewer, "資產設備資訊|管理");
  await group(viewer, "公務車");
  await group(viewer, "儀器設備");
  assert.equal(await viewer.locator(".sidebar-add").count(), 0);
  await group(viewer, "後台資訊管理");
  assert.equal(
    await viewer
      .locator(".sidebar")
      .getByRole("link", { name: "資料來源與通知", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await viewer
      .locator(".sidebar")
      .getByRole("link", { name: "歷史封存", exact: true })
      .count(),
    0,
  );
  await viewer.goto(base + "/vehicles?create=1");
  await viewer.getByRole("table", { name: "CarList" }).waitFor();
  assert.equal(await dialog(viewer, "新增車輛").count(), 0);
  pass("唯讀使用者無借用／資產新增入口，管理／封存條件及直接URL新增權限保留");

  for (const [state, json] of [
    ["empty", []],
    ["error", null],
  ]) {
    const isolated = await browser.newContext();
    const example = await isolated.newPage();
    await example.route("**/api/resources", (route) =>
      route.fulfill({
        status: state === "error" ? 503 : 200,
        json: json ?? { detail: "測試不可用" },
      }),
    );
    await login(example);
    await group(example, "資產設備資訊|管理");
    await group(example, "公務車");
    await example
      .locator(".sidebar-list-status")
      .filter({ hasText: state === "empty" ? "無車輛資料" : "清單載入失敗" })
      .waitFor();
    if (state === "error")
      assert.equal(
        await example
          .locator(".sidebar")
          .getByRole("button", { name: "重試", exact: true })
          .count(),
        1,
      );
    await isolated.close();
  }
  pass("空清單與API失敗保留可辨識狀態及重試入口");
  assert.deepEqual(errors, []);
  await writeFile(
    output + "/results.json",
    JSON.stringify(
      {
        passes,
        geometry,
        errors,
        isolation:
          "Disposable SQLite; browser-only scroll/delete/empty/error fixtures; no production changes",
      },
      null,
      2,
    ),
  );
  console.log(`PASS ${passes.length} groups; ${output}`);
} catch (error) {
  await writeFile(
    output + "/failure.log",
    String(error.stack || error) + "\n" + logs,
  );
  throw error;
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
  await new Promise((resolve) =>
    server.exitCode === null ? server.once("exit", resolve) : resolve(),
  );
  await rm(data, { recursive: true, force: true });
}
