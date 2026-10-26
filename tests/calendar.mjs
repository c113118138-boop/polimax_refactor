import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";

const project = new URL("../", import.meta.url).pathname;
const data = await mkdtemp(tmpdir() + "/polimax-calendar-");
const port = 18022,
  base = `http://127.0.0.1:${port}`;
const output = project + "test-results/main-screen";
await mkdir(output, { recursive: true });
const server = spawn(
  project + ".venv/bin/python",
  [
    "-m",
    "uvicorn",
    "app:app",
    "--app-dir",
    project + "backend",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    cwd: project,
    env: {
      ...process.env,
      AMS_DATA_DIR: data,
      PREVIEW_DATA_DIR: data,
      AMS_DATABASE_MODE: "demo",
      PREVIEW_DATABASE_URL: "",
      PREVIEW_LOGIN_ENABLED: "1",
      AMS_OPTIONS_FILE: "",
      AMS_HOLIDAYS_FILE: "",
      AMS_REPORTS_FILE: "",
      AMS_POLICY_FILE: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let logs = "",
  browser;
server.stdout.on("data", (value) => (logs += value));
server.stderr.on("data", (value) => (logs += value));
const errors = [],
  passes = [],
  geometry = [];
function pass(name) {
  passes.push(name);
  console.log("PASS", name);
}
const approx = (actual, expected, note) =>
  assert(
    Math.abs(actual - expected) < 2,
    `${note}: ${actual} expected ${expected}`,
  );
async function login(page, role = "admin") {
  await page.goto(base);
  if (role !== "admin")
    await page
      .getByRole("button", {
        name: role === "viewer" ? /唯讀使用者/ : /草稿測試員/,
      })
      .click();
  await page.getByRole("button", { name: /進入工作空間/ }).click();
  await page.locator(".calendar-page .fc-daygrid").waitFor();
}
async function measure(page, width) {
  await page.setViewportSize({ width, height: width < 769 ? 844 : 1000 });
  await page.waitForTimeout(300);
  const result = await page.evaluate(() => {
    const box = (selector) => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    return {
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      sidebar: box(".sidebar"),
      topbar: box(".topbar"),
      calendar: box(".calendar-panel"),
      filter: box(".calendar-filter-desktop"),
      mini: box(".mini-calendar"),
      toolbar: box(".calendar-controls"),
    };
  });
  approx(result.topbar.height, width <= 768 ? 60 : 85, "header height");
  assert(
    result.scrollWidth <= width + 1,
    `page overflow at ${width}: ${result.scrollWidth}`,
  );
  if (width > 768) {
    approx(result.sidebar.width, 250, "sidebar width");
    approx(result.filter.width, 300, "filter width");
    approx(result.calendar.x, 250, "calendar follows sidebar");
    approx(result.calendar.y, 85, "calendar follows topbar");
    approx(
      result.filter.x,
      result.calendar.x + result.calendar.width,
      "filter adjacent to calendar",
    );
    assert(result.mini.y > result.filter.y);
  } else {
    approx(result.calendar.x, 0, "mobile calendar x");
    approx(result.calendar.y, 60, "mobile calendar y");
    assert.equal(
      await page.locator(".calendar-filter-desktop").isVisible(),
      false,
    );
  }
  geometry.push(result);
}
try {
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(base + "/api/health")).ok) break;
    } catch {}
    if (server.exitCode !== null) throw new Error(logs);
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (i === 149) throw new Error("Server timeout: " + logs);
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
    timezoneId: "America/Los_Angeles",
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page);
  assert.equal(
    await page
      .locator(
        ".stats-grid, .upcoming-panel, .tip-card, .calendar-page .page-heading",
      )
      .count(),
    0,
  );
  for (const width of [1440, 1101, 1100, 900, 769, 768, 481, 480, 390])
    await measure(page, width);
  pass("1440 / 900 / 769 / 768 / 390 geometry, breakpoint and page overflow");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: output + "/desktop-month.png" });
  await page.getByRole("button", { name: "收合側欄", exact: true }).click();
  approx(
    (await page.locator(".calendar-panel").boundingBox()).x,
    0,
    "collapsed calendar x",
  );
  await page.getByRole("button", { name: "展開側欄", exact: true }).click();
  const originalDay = await page
    .locator(".calendar-page")
    .getAttribute("data-date");
  await page.getByRole("button", { name: "下一期", exact: true }).click();
  assert.notEqual(
    await page.locator(".calendar-page").getAttribute("data-date"),
    originalDay,
  );
  await page.getByRole("button", { name: "今天", exact: true }).click();
  const day = await page.locator(".calendar-page").getAttribute("data-date");
  await page
    .locator(`.mini-calendar button[aria-label="選擇 ${day}"]`)
    .waitFor();
  assert.equal(
    await page
      .locator(".mini-calendar-days .selected")
      .getAttribute("aria-label"),
    "選擇 " + day,
  );
  pass(
    "sidebar collapse, month navigation, today and mini-calendar sync in Los Angeles timezone",
  );
  const resources = await (
    await context.request.get(base + "/api/resources")
  ).json();
  const cars = resources.filter((r) => r.kind === "vehicle"),
    car = cars[0];
  const filters = page.locator(".calendar-filter-desktop");
  await filters.getByRole("button", { name: "車牌：" }).click();
  await filters.getByRole("checkbox", { name: "全選", exact: true }).uncheck();
  await filters.getByRole("checkbox", { name: car.label, exact: true }).check();
  assert.equal(await filters.locator(".vehicle-chip").count(), 1);
  await filters.getByRole("button", { name: "移除 " + car.label }).click();
  assert.equal(await filters.locator(".vehicle-chip").count(), 0);
  await filters.getByRole("checkbox", { name: "全選", exact: true }).check();
  await filters.getByRole("button", { name: "車牌：" }).click();
  await filters.getByRole("button", { name: "車牌：" }).click();
  assert.equal(await filters.locator(".vehicle-chip").count(), cars.length);
  await page.screenshot({ path: output + "/desktop-filters.png" });
  pass(
    "vehicle expand/collapse, all/select individual, chip remove and retained selection",
  );
  for (const [label, view] of [
    ["週", "timeGridWeek"],
    ["活動列表", "listWeek"],
    ["天", "resourceDay"],
    ["月", "dayGridMonth"],
  ]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    assert.equal(
      await page.locator(".calendar-page").getAttribute("data-view"),
      view,
    );
    assert.equal(
      await page.locator(".calendar-page").getAttribute("data-date"),
      day,
    );
  }
  await page.getByRole("button", { name: "隱藏節日", exact: true }).click();
  await page.getByRole("button", { name: "顯示節日", exact: true }).click();
  await page
    .locator(`.fc-daygrid-day[data-date="${day}"] .fc-daygrid-day-number`)
    .click();
  assert.equal(
    await page.locator(".calendar-page").getAttribute("data-view"),
    "resourceDay",
  );
  assert.equal(
    await page.locator(".calendar-page").getAttribute("data-date"),
    day,
  );
  await page.getByRole("button", { name: "月", exact: true }).click();
  pass("four calendar views retain selected date and filters; holiday toggle");
  // Real isolated API writes and readback for A/D/E; no production database.
  const testDay = "2028-02-10",
    created = [];
  for (const [kind, resource] of [
    ["A", car],
    ["D", resources.find((r) => r.kind === "room")],
    ["E", resources.find((r) => r.kind === "equipment" && r.state !== "停用")],
  ]) {
    const content = {
      title: "主畫面驗證 " + kind,
      reason: kind === "A" ? "工案" : kind === "D" ? "作業區租用" : "開案",
      total_people: 1,
      employees: ["林品安"],
      details: [
        {
          name: "CALENDAR-001",
          city: "新竹市",
          district: "東區",
          leader: "林品安",
          sales: ["林品安"],
        },
      ],
      slots: [
        {
          resource_id: resource.id,
          start: testDay + "T09:00:00",
          end: testDay + "T10:00:00",
        },
      ],
      purposes: [],
      notes: "隔離測試",
    };
    const response = await context.request.post(base + "/api/bookings", {
      data: { kind, content },
      headers: { "X-AMS-Client": "preview" },
    });
    assert.equal(response.status(), 200, await response.text());
    const booking = await response.json();
    const read = await (
      await context.request.get(base + "/api/bookings/" + booking.id)
    ).json();
    assert.equal(read.content.title, content.title);
    created.push(read);
  }
  await page.reload();
  await page.locator(".calendar-page .fc-daygrid").waitFor();
  // Select a test date without hundreds of repeated month-arrow clicks.
  await page.getByRole("button", { name: "天", exact: true }).click();
  const current = await page
    .locator(".calendar-page")
    .getAttribute("data-date");
  // Mini calendar arrows only change displayed month, and preserve main selection.
  const months =
    (2028 - Number(current.slice(0, 4))) * 12 + 2 - Number(current.slice(5, 7));
  for (let i = 0; i < Math.abs(months); i++)
    await page
      .getByRole("button", {
        name: months > 0 ? "小日曆下個月" : "小日曆上個月",
      })
      .click();
  await page
    .getByRole("button", { name: "選擇 " + testDay, exact: true })
    .click();
  assert.equal(
    await page.locator(".calendar-page").getAttribute("data-date"),
    testDay,
  );
  assert.equal(await page.locator(".resource-event").count(), 3);
  const event = page.locator(
    `.resource-event[data-booking-id="${created[0].id}"]`,
  );
  approx(
    Number(await event.evaluate((el) => parseFloat(el.style.top))),
    540,
    "9am event top regardless of browser timezone",
  );
  approx(
    Number(await event.evaluate((el) => parseFloat(el.style.height))),
    60,
    "one-hour event height",
  );
  await event.click();
  await page
    .getByRole("dialog")
    .getByText("主畫面驗證 A", { exact: true })
    .waitFor();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "關閉", exact: true })
    .last()
    .click();
  await filters.getByRole("checkbox", { name: "作業區預約" }).uncheck();
  assert.equal(
    await page
      .locator(`.resource-event[data-booking-id="${created[1].id}"]`)
      .count(),
    0,
  );
  await filters.getByRole("checkbox", { name: "作業區預約" }).check();
  await filters.getByRole("checkbox", { name: "儀器設備" }).uncheck();
  assert.equal(
    await page
      .locator(`.resource-event[data-booking-id="${created[2].id}"]`)
      .count(),
    0,
  );
  await filters.getByRole("checkbox", { name: "儀器設備" }).check();
  await page
    .locator(".resource-grid-wrap")
    .evaluate((element) => (element.scrollTop = 480));
  await page.screenshot({ path: output + "/desktop-resource-day.png" });
  pass(
    "A/D/E saved-readback, resource-day timing, event detail, workshop and E filtering",
  );
  await page
    .getByRole("button", { name: `預約 ${car.label} 23:30`, exact: true })
    .click();
  assert.match(
    await page.getByRole("dialog").locator(".muted").innerText(),
    /02\/11 00:00/,
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "關閉", exact: true })
    .last()
    .click();
  const startSlot = page.getByRole("button", {
    name: `預約 ${car.label} 12:00`,
    exact: true,
  });
  await startSlot.scrollIntoViewIfNeeded();
  const startBox = await startSlot.boundingBox();
  const endBox = await page
    .getByRole("button", { name: `預約 ${car.label} 13:00`, exact: true })
    .boundingBox();
  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + 10);
  await page.mouse.down();
  await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + 10, {
    steps: 8,
  });
  await page.mouse.up();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "車輛借用", exact: true })
    .click();
  await page.waitForURL(/\/bookings\/new\/A/);
  await page.locator('textarea[name="notes"]').fill("主畫面帶值測試");
  await page.getByRole("button", { name: "新增明細", exact: true }).click();
  await page.locator('input[name="details.0.name"]').fill("CALENDAR-PREFILL");
  await page.locator('select[name="details.0.city"]').selectOption("新竹市");
  await page.locator('select[name="details.0.district"]').selectOption("東區");
  await page.getByRole("button", { name: "保存明細", exact: true }).click();
  await page.getByRole("button", { name: "新增時段", exact: true }).click();
  assert.equal(
    await page.locator('select[name="slots.0.resource_id"]').inputValue(),
    String(car.id),
  );
  assert.match(
    await page.locator('input[name="slots.0.start"]').inputValue(),
    /2028-02-10T12:00/,
  );
  assert.match(
    await page.locator('input[name="slots.0.end"]').inputValue(),
    /2028-02-10T13:30/,
  );
  pass("resource/time selection prefills reconstructed A form");
  await page.goto(base + "/bookings");
  await page.reload();
  await page.locator(".page-heading").waitFor();
  assert.equal(new URL(page.url()).pathname, "/bookings");
  await page.goto(base);
  await page.locator(".calendar-page .fc-daygrid").waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: output + "/mobile-month.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "開啟日曆篩選" }).click();
  const drawer = page.getByRole("dialog", { name: "篩選選項" });
  approx((await drawer.boundingBox()).width, 300, "mobile filter drawer width");
  await drawer.getByRole("button", { name: "車牌：" }).click();
  await page.screenshot({ path: output + "/mobile-filters.png" });
  await page.keyboard.press("Escape");
  assert.equal(await drawer.count(), 0);
  assert.equal(
    await page
      .getByRole("button", { name: "開啟日曆篩選" })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.getByRole("button", { name: "開啟選單" }).click();
  approx(
    (await page.locator(".sidebar").boundingBox()).width,
    280,
    "mobile sidebar width",
  );
  await page.getByRole("button", { name: "後台資訊管理", exact: true }).click();
  await page.getByRole("link", { name: "CarList", exact: true }).click();
  assert.equal(await page.locator(".sidebar.is-open").count(), 0);
  pass(
    "direct route refresh, mobile filter drawer/Esc/focus return and sidebar navigation",
  );
  const viewer = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    timezoneId: "Asia/Taipei",
  });
  const phone = await viewer.newPage();
  phone.on("pageerror", (error) => errors.push(error.message));
  await login(phone, "viewer");
  assert.equal(await phone.getByRole("button", { name: /節日/ }).count(), 0);
  assert.equal(await phone.locator(".calendar-create").count(), 0);
  await phone.getByRole("button", { name: "天", exact: true }).click();
  assert((await phone.locator(".resource-slot:disabled").count()) > 0);
  await phone.screenshot({ path: output + "/mobile-readonly.png" });
  pass(
    "read-only user has no create, holiday toggle or resource selection access",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    output + "/results.json",
    JSON.stringify(
      {
        passes,
        geometry,
        errors,
        isolation:
          "Disposable SQLite; explicit AMS_DATA_DIR; no production writes",
        timezone: "America/Los_Angeles + Asia/Taipei",
      },
      null,
      2,
    ),
  );
  console.log(
    `PASS ${passes.length} groups; screenshots and geometry: ${output}`,
  );
} catch (error) {
  await writeFile(
    output + "/failure.log",
    String(error.stack || error) + "\n" + logs,
  );
  throw error;
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await new Promise((resolve) => {
    if (server.exitCode !== null) resolve();
    else server.once("exit", resolve);
  });
  await rm(data, { recursive: true, force: true });
}
