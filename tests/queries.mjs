import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";

const project = new URL("../", import.meta.url).pathname;
const data = await mkdtemp(tmpdir() + "/polimax-queries-");
const base = "http://127.0.0.1:18029",
  output = project + "test-results/queries";
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
    "18029",
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
  errors = [],
  geometry = [];
function pass(name) {
  passes.push(name);
  console.log("PASS", name);
}
async function login(page, role = "admin") {
  page.on("pageerror", (error) => errors.push(error.message));
  page.setDefaultTimeout(15000);
  await page.goto(base + "/bookings?kind=A");
  if (role === "viewer")
    await page.getByRole("button", { name: /唯讀使用者/ }).click();
  await page.getByRole("button", { name: /進入工作空間/ }).click();
  await page.locator(".sidebar-profile").waitFor();
  await page.goto(base + "/bookings?kind=A");
  await page.locator(".source-query-A .query-table").waitFor();
}
function group(page, id) {
  return page.locator(`.query-table tbody tr[data-booking-id="${id}"]`);
}
async function screen(page, name) {
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
    if (server.exitCode !== null || i === 149)
      throw Error(logs || "Preview timeout");
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: "America/Los_Angeles",
  });
  const page = await context.newPage();
  await login(page);
  async function get(path) {
    const response = await context.request.get(base + "/api" + path);
    assert(response.ok(), await response.text());
    return response.json();
  }
  async function create(kind, slots, reason = "工案") {
    const response = await context.request.post(base + "/api/bookings", {
      headers: { "X-AMS-Client": "preview" },
      data: {
        kind,
        content: {
          title: "舊申請標題不當成車牌",
          ...(kind === "E" ? { equipment_id: slots[0].id } : {}),
          reason,
          total_people: 2,
          employees: ["林品安", "陳予晴"],
          details: [
            {
              name: "QUERY-001",
              city: "新竹市",
              district: "東區",
              sales: ["第一位業務"],
            },
            {
              name: "QUERY-002",
              city: "臺北市",
              district: "中正區",
              sales: ["第二位業務"],
            },
          ],
          slots: slots.map((resource, index) => ({
            resource_id: resource.id,
            start: `2042-07-${kind === "A" ? "12" : "13"}T${index ? "15" : "09"}:00:17`,
            end: `2042-07-${kind === "A" ? "12" : "13"}T${index ? "16" : "10"}:00:33`,
            detail_index: index,
          })),
          notes: "查詢入口測試",
          purposes: [],
        },
      },
    });
    assert(response.ok(), await response.text());
    return response.json();
  }
  const resources = await get("/resources"),
    cars = resources.filter((r) => r.kind === "vehicle"),
    rooms = resources.filter((r) => r.kind === "room"),
    equipment = resources.find((r) => r.kind === "equipment");
  assert(cars.length >= 2 && rooms.length >= 2 && equipment);
  const a = await create("A", cars.slice(0, 2));
  const d = await create("D", rooms.slice(0, 2), "作業區租用");
  const e = await create("E", [equipment, equipment], "儀器設備維修");
  await page.reload();
  await group(page, a.id).first().waitFor();
  assert.deepEqual(await page.locator(".query-table th").allTextContents(), [
    "表單編號",
    "車牌",
    "申請緣由",
    "地點",
    "開始時間",
    "結束時間",
    "業務人員",
    "申請人",
    "狀態",
    "申請時間",
    "操作",
  ]);
  assert.equal(await group(page, a.id).count(), 2);
  assert.deepEqual(
    await group(page, a.id)
      .first()
      .locator("td[rowspan]")
      .evaluateAll((cells) => cells.map((cell) => cell.rowSpan)),
    [2, 2, 2],
  );
  assert.equal(
    await group(page, a.id).first().locator("td").nth(1).innerText(),
    cars[0].label,
  );
  assert.match(
    await group(page, a.id).first().innerText(),
    /2042-07-12 09:00:17/,
  );
  assert.match(
    await group(page, a.id).nth(1).innerText(),
    /臺北市中正區[\s\S]*第二位業務/,
  );
  assert.doesNotMatch(
    await group(page, a.id).first().innerText(),
    /舊申請標題/,
  );
  const bookings = await get("/bookings"),
    allACount = bookings.filter((b) => b.kind === "A").length;
  assert.equal(
    await page.locator(".query-heading h2").innerText(),
    `借用紀錄表（共 ${allACount} 筆）`,
  );
  assert.equal(await page.locator(".list-tabs").count(), 0);
  await screen(page, "A-desktop");
  await page
    .locator(".query-table-scroll")
    .evaluate((element) => (element.scrollLeft = element.scrollWidth));
  await screen(page, "A-desktop-actions");
  await page
    .locator(".query-table-scroll")
    .evaluate((element) => (element.scrollLeft = 0));
  pass("A來源11欄、多時段3欄合併、表單數量、車牌／需求映射與台北完整秒數");

  const filter = page.getByRole("combobox", { name: "篩選條件", exact: true });
  await filter.selectOption("plate");
  await page
    .getByRole("textbox", { name: "依車牌", exact: true })
    .fill(cars[1].label);
  assert.equal(await group(page, a.id).count(), 1);
  assert.equal(
    await group(page, a.id).locator("td").first().getAttribute("rowspan"),
    "1",
  );
  await filter.selectOption("employees");
  await page
    .getByRole("textbox", { name: "依業務人員", exact: true })
    .fill("第二位業務");
  assert.equal(await group(page, a.id).count(), 1);
  await filter.selectOption("place");
  await page
    .getByRole("textbox", { name: "依地點", exact: true })
    .fill("臺北市");
  assert.equal(await group(page, a.id).count(), 1);
  await filter.selectOption("start");
  await page.getByLabel("開始日期", { exact: true }).fill("2042-07-12");
  await page.getByLabel("結束日期", { exact: true }).fill("2042-07-12");
  assert.equal(await group(page, a.id).count(), 2); // End date includes the entire Taipei day.
  await page.getByLabel("結束日期", { exact: true }).fill("2042-07-11");
  assert.equal(
    await page.locator(".query-empty").getAttribute("colspan"),
    "11",
  );
  await page.getByRole("button", { name: "清除", exact: true }).click();
  assert.equal(await group(page, a.id).count(), 2);
  await filter.selectOption("reason");
  await page.getByLabel("緣由篩選", { exact: true }).selectOption("工案");
  assert.equal(await group(page, a.id).count(), 2);
  await page.getByRole("button", { name: "已完成", exact: true }).click();
  assert.equal(await filter.inputValue(), "all");
  assert.equal(await group(page, a.id).count(), 0);
  await filter.selectOption("status");
  assert.equal(await page.locator(".query-status-filters").count(), 0);
  await page.getByLabel("狀態篩選", { exact: true }).selectOption("PENDING");
  assert.equal(await group(page, a.id).count(), 2);
  await screen(page, "A-status-filter");
  await page.getByRole("button", { name: "清除", exact: true }).click();
  pass(
    "A動態篩選、逐時段匹配／重新合併、日期含結束當日、狀態快選與清除／無結果",
  );

  const action = group(page, a.id).first();
  assert.match(
    await action
      .getByRole("link", { name: "編輯", exact: true })
      .getAttribute("href"),
    new RegExp(a.id + "/edit$"),
  );
  const map = new URL(
    await action
      .getByRole("link", { name: "查看行駛軌跡", exact: true })
      .getAttribute("href"),
    base,
  );
  assert.equal(map.searchParams.get("resource"), String(cars[0].id));
  assert.equal(map.searchParams.get("start"), a.slots[0].start);
  await action.getByRole("button", { name: "填寫發車表", exact: true }).click();
  const stage = page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "填寫發車表", exact: true }),
  });
  await stage.waitFor();
  await stage.getByLabel(/^駕駛人員/).fill("林品安");
  await stage.locator("select").first().selectOption(String(cars[0].id));
  await stage.getByLabel(/^去程發車地點/).fill("查詢入口出發");
  for (const label of [
    "擋風玻璃清潔",
    "照後鏡清潔",
    "油量檢查",
    "輪胎檢查",
    "車輛內部清潔",
    "車體外部檢查",
    "隨車設備檢查",
  ])
    await stage.getByLabel(label, { exact: true }).check();
  await stage.locator("input[type=number]").fill("100");
  await stage.getByLabel("我已確認本階段里程").check();
  await stage
    .getByRole("button", { name: "確認提交本階段", exact: true })
    .click();
  await stage.waitFor({ state: "hidden" });
  assert.equal((await get("/bookings/" + a.id)).status, "DEPARTURE");
  await group(page, a.id)
    .first()
    .getByRole("button", { name: "填寫發車抵達", exact: true })
    .waitFor();
  assert.equal(
    await group(page, a.id)
      .first()
      .getByRole("link", { name: "編輯", exact: true })
      .count(),
    0,
  );
  await group(page, a.id)
    .first()
    .getByRole("button", { name: "填寫發車抵達", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "取消", exact: true })
    .click();
  pass(
    "A列內下一階段取得最新revision、真實API保存發車與清單更新；編輯／軌跡深層入口",
  );

  await page.goto(base + "/bookings?kind=D");
  await group(page, d.id).first().waitFor();
  assert.deepEqual(await page.locator(".query-table th").allTextContents(), [
    "表單編號",
    "申請原因",
    "使用空間",
    "開始時間",
    "結束時間",
    "申請人",
    "建立時間",
    "操作",
  ]);
  assert.equal(await page.locator(".query-filters, .list-tabs").count(), 0);
  assert.deepEqual(
    await group(page, d.id)
      .first()
      .locator("td[rowspan]")
      .evaluateAll((cells) => cells.map((cell) => cell.rowSpan)),
    [2, 2],
  );
  assert.match(
    await group(page, d.id).nth(1).innerText(),
    new RegExp(rooms[1].label),
  );
  assert.equal(
    await page.locator(".query-heading h2").innerText(),
    `作業區預約紀錄（共 ${bookings.filter((b) => b.kind === "D").reduce((n, b) => n + Math.max(1, b.slots.length), 0)} 筆）`,
  );
  await screen(page, "D-desktop");
  await page.getByRole("link", { name: "新增", exact: true }).click();
  await page.locator(".source-form-page").waitFor();
  assert.equal(new URL(page.url()).pathname, "/bookings/new/D");
  await page.goto(base + "/bookings?kind=D");
  await group(page, d.id)
    .first()
    .getByRole("link", { name: "查看", exact: true })
    .click();
  await page.getByRole("dialog").locator(".source-readonly-form").waitFor();
  assert.equal(new URL(page.url()).pathname, "/bookings");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "關閉", exact: true })
    .last()
    .click();
  await page.goto(base + "/bookings/" + d.id);
  await page.reload();
  await page.getByRole("button", { name: "編輯", exact: true }).waitFor();
  await page.goto(base + "/bookings?kind=D");
  await group(page, d.id)
    .first()
    .getByRole("link", { name: "編輯", exact: true })
    .click();
  await page.locator('input[name="room.start"]').fill("2042-07-13T08:00:17");
  await page.locator('input[name="room.end"]').fill("2042-07-13T11:00:33");
  await page.getByRole("button", { name: "儲存變更", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(new URL(page.url()).pathname, "/bookings");
  assert(
    (await get("/bookings/" + d.id)).slots.every((slot) =>
      slot.end.includes("11:00:33"),
    ),
  );
  await page.goto(base + "/bookings?kind=D");
  await page.reload();
  await group(page, d.id).first().waitFor();
  pass("D來源8欄、表單／操作合併、時段數量、新增／查看／編輯保存回讀與刷新");

  await page.goto(base + "/bookings?kind=E");
  await group(page, e.id).first().waitFor();
  assert.deepEqual(await page.locator(".query-table th").allTextContents(), [
    "表單編號",
    "借用類別",
    "儀器設備",
    "開始時間",
    "結束時間",
    "使用人員",
    "申請人",
    "狀態",
    "建立時間",
    "操作",
  ]);
  assert.equal(
    await page.locator(".list-tabs, .list-filters, .query-filters").count(),
    0,
  );
  const eRows = (await get("/bookings"))
    .filter((b) => b.kind === "E")
    .reduce((sum, b) => sum + Math.max(1, b.slots.length), 0);
  assert.equal(
    await page.locator(".query-heading h2").innerText(),
    `儀器借用紀錄（共 ${eRows} 筆）`,
  );
  assert.equal(await group(page, e.id).count(), 2);
  assert.deepEqual(
    await group(page, e.id)
      .first()
      .locator("td[rowspan]")
      .evaluateAll((cells) => cells.map((cell) => cell.rowSpan)),
    [2, 2, 2],
  );
  assert.match(
    await group(page, e.id).first().locator("td").nth(2).innerText(),
    new RegExp(equipment.name || equipment.label),
  );
  assert.match(
    await group(page, e.id).first().locator("td").nth(2).innerText(),
    new RegExp(equipment.label),
  );
  assert.equal(
    await group(page, e.id).first().locator("td").nth(5).innerText(),
    "林品安, 陳予晴",
  );
  assert.equal(
    await page
      .getByRole("link", { name: "新增", exact: true })
      .getAttribute("href"),
    "/bookings/new/E",
  );
  await group(page, e.id)
    .first()
    .getByRole("link", { name: "查看", exact: true })
    .click();
  const eView = page
    .getByRole("dialog")
    .filter({
      has: page.getByRole("heading", { name: "查看表單", exact: true }),
    });
  await eView.locator(".source-readonly-form").waitFor();
  assert(await eView.locator('textarea[name="notes"]').isDisabled());
  await eView.getByRole("button", { name: "關閉", exact: true }).last().click();
  await group(page, e.id)
    .first()
    .getByRole("link", { name: "編輯", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .locator('textarea[name="notes"]')
    .fill("儀器查詢編輯保存驗證");
  await page.getByRole("button", { name: "儲存變更", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(new URL(page.url()).search, "?kind=E");
  assert.equal(
    (await get("/bookings/" + e.id)).content.notes,
    "儀器查詢編輯保存驗證",
  );
  await page.reload();
  await group(page, e.id).first().waitFor();
  await screen(page, "E-desktop");
  pass(
    "E儀器表格、多時段合併、設備名稱／編碼／人員、無分類列、查看唯讀／編輯保存回讀與刷新",
  );

  for (const kind of ["A", "D", "E"]) {
    await page.goto(base + "/bookings?kind=" + kind);
    await page.locator(".query-table").waitFor();
    for (const width of [1440, 900, 769, 768, 390]) {
      await page.setViewportSize({
        width,
        height: width === 1440 ? 1000 : 844,
      });
      const boxes = await page.evaluate(() => {
        const box = (selector) => {
          const { x, y, width, height } = document
            .querySelector(selector)
            .getBoundingClientRect();
          return { x, y, width, height };
        };
        const scroll = document.querySelector(".query-table-scroll"),
          first = document.querySelector(".query-table th");
        return {
          overflow: document.documentElement.scrollWidth - innerWidth,
          page: box(".source-query"),
          heading: box(".query-heading"),
          filters: document.querySelector(".query-filters")
            ? box(".query-filters")
            : null,
          table: box(".query-table-scroll"),
          th: box(".query-table th"),
          scrollWidth: scroll.scrollWidth,
          clientWidth: scroll.clientWidth,
          font: getComputedStyle(first).fontSize,
          border: getComputedStyle(first).borderLeftWidth,
          background: getComputedStyle(first).backgroundColor,
        };
      });
      assert.equal(boxes.overflow, 0);
      assert(Math.abs(boxes.table.x - boxes.page.x - 20) <= 1);
      assert.equal(boxes.font, "14px");
      assert.equal(boxes.border, "1px");
      assert.equal(boxes.background, "rgb(240, 240, 240)");
      assert(boxes.th.width >= 119);
      assert(
        boxes.table.y >=
          boxes.heading.y + boxes.heading.height + (kind === "A" ? 19 : 9),
      );
      if (width === 390) {
        assert(boxes.scrollWidth > boxes.clientWidth);
        await page
          .locator(".query-table-scroll")
          .evaluate((element) => (element.scrollLeft = element.scrollWidth));
        assert(
          await page
            .locator(".query-table-scroll")
            .evaluate((element) => element.scrollLeft > 0),
        );
        await screen(page, kind + "-mobile-actions");
        await page
          .locator(".query-table-scroll")
          .evaluate((element) => (element.scrollLeft = 0));
        await screen(page, kind + "-mobile");
      }
      geometry.push({ kind, width, ...boxes });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  pass(
    "A/D/E 1440/900/769/768/390比例、20px內距、灰色表頭／欄寬／字級／框線、表內橫捲且頁面無溢出",
  );

  const readonly = await browser.newContext(),
    viewer = await readonly.newPage();
  await login(viewer, "viewer");
  assert.equal(
    await viewer
      .locator(
        ".query-actions button, .query-actions .query-edit, .query-actions .query-next",
      )
      .count(),
    0,
  );
  await viewer.goto(base + "/bookings?kind=D");
  await viewer.locator(".query-table").waitFor();
  assert.equal(
    await viewer.locator(".query-add, .query-edit, .query-delete").count(),
    0,
  );
  assert(
    (await viewer.locator(".query-actions a[aria-label='查看']").count()) > 0,
  );
  await viewer.goto(base + "/bookings?kind=E");
  await group(viewer, e.id).first().waitFor();
  assert.equal(
    await viewer.locator(".query-add, .query-edit, .query-delete").count(),
    0,
  );
  assert.equal(
    await group(viewer, e.id)
      .first()
      .getByRole("link", { name: "查看", exact: true })
      .count(),
    1,
  );
  await readonly.close();
  const limitedContext = await browser.newContext(),
    limited = await limitedContext.newPage();
  await login(limited);
  const admin = await get("/auth/me");
  let denyRoomRead = false,
    denyEquipmentRead = false;
  await limited.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        ...admin,
        permissions: {
          ...admin.permissions,
          roles: [],
          forms: {
            ...admin.permissions.forms,
            Room_form: {
              ...admin.permissions.forms.Room_form,
              read: !denyRoomRead,
            },
            Equipment_form: {
              ...admin.permissions.forms.Equipment_form,
              read: !denyEquipmentRead,
            },
          },
          owner_only: {
            Room_form: { write: 1, delete: 1 },
            Equipment_form: { write: 1, delete: 1 },
          },
        },
      },
    }),
  );
  await limited.route("**/api/bookings", (route) =>
    route.fulfill({
      json: [
        {
          ...a,
          detail_allowed: false,
          content: { applicant: "其他人", title: "借用紀錄" },
        },
        {
          ...d,
          owner: "其他人",
          content: { ...d.content, applicant: "其他人" },
        },
        {
          ...e,
          owner: "其他人",
          content: { ...e.content, applicant: "其他人" },
        },
      ],
    }),
  );
  await limited.reload();
  await group(limited, a.id).first().waitFor();
  assert.equal(await group(limited, a.id).locator("a, button").count(), 0);
  await limited.goto(base + "/bookings?kind=D");
  await group(limited, d.id).first().waitFor();
  assert.equal(
    await group(limited, d.id).locator(".query-edit, .query-delete").count(),
    0,
  );
  denyRoomRead = true;
  await limited.reload();
  await limited
    .getByRole("heading", { name: "權限不足", exact: true })
    .waitFor();
  assert.equal(await limited.locator(".source-query-D").count(), 0);
  await limited.goto(base + "/bookings?kind=E");
  await group(limited, e.id).first().waitFor();
  assert.equal(
    await group(limited, e.id).locator(".query-edit, .query-delete").count(),
    0,
  );
  denyEquipmentRead = true;
  await limited.reload();
  await limited
    .getByRole("heading", { name: "權限不足", exact: true })
    .waitFor();
  assert.equal(await limited.locator(".source-query-E").count(), 0);
  await limitedContext.close();
  await page.goto(base + "/bookings?kind=A&resource=" + cars[1].id);
  await group(page, a.id).first().waitFor();
  assert.equal(await group(page, a.id).count(), 1);
  assert.match(
    await page.locator(".query-source-hint").innerText(),
    new RegExp(cars[1].label),
  );
  assert.equal(
    await page
      .getByRole("link", { name: "返回車輛管理", exact: true })
      .getAttribute("href"),
    "/vehicles/" + cars[1].id,
  );
  await page.goto(base + "/bookings?kind=E");
  await page.locator(".source-query-E .query-table").waitFor();
  await page.goto(base + "/bookings?history=1");
  await page
    .getByRole("heading", { name: "車輛使用歷史", exact: true })
    .waitFor();
  pass("唯讀／摘要／owner限制、指定車輛來源提示與返回、E及歷史查詢相容");

  const emptyContext = await browser.newContext(),
    empty = await emptyContext.newPage();
  await empty.route("**/api/bookings", (route) => route.fulfill({ json: [] }));
  await login(empty);
  assert.equal(await empty.locator(".query-empty").innerText(), "暫無資料");
  await screen(empty, "A-empty");
  await empty.goto(base + "/bookings?kind=D");
  await empty.locator(".query-empty").waitFor();
  assert.equal(
    await empty.locator(".query-empty").getAttribute("colspan"),
    "8",
  );
  await empty.goto(base + "/bookings?kind=E");
  await empty.locator(".query-empty").waitFor();
  assert.equal(
    await empty.locator(".query-empty").getAttribute("colspan"),
    "10",
  );
  await screen(empty, "E-empty");
  await emptyContext.close();
  const failureContext = await browser.newContext(),
    failure = await failureContext.newPage();
  let failed = true;
  await failure.route("**/api/bookings", (route) =>
    failed
      ? route.fulfill({ status: 503, json: { detail: "查詢服務測試失敗" } })
      : route.continue(),
  );
  await failure.goto(base + "/bookings?kind=A");
  await failure.getByRole("button", { name: /進入工作空間/ }).click();
  await failure.locator(".sidebar-profile").waitFor();
  await failure.goto(base + "/bookings?kind=A");
  await failure
    .getByRole("alert")
    .filter({ hasText: "查詢服務測試失敗" })
    .waitFor();
  assert.equal(await failure.locator(".query-empty").count(), 0);
  failed = false;
  await failure
    .locator(".source-query")
    .getByRole("button", { name: "重試", exact: true })
    .click();
  await failure.locator(".query-table").waitFor();
  await failureContext.close();
  const snapshotContext = await browser.newContext(),
    snapshot = await snapshotContext.newPage();
  await snapshot.route("**/api/resources", (route) =>
    route.fulfill({ status: 503, json: { detail: "資源清單測試失敗" } }),
  );
  await login(snapshot);
  await group(snapshot, a.id).first().waitFor();
  assert.equal(
    await group(snapshot, a.id).first().locator("td").nth(1).innerText(),
    cars[0].label,
  );
  await snapshot
    .locator(".source-query")
    .getByRole("alert")
    .filter({ hasText: "資源清單測試失敗" })
    .waitFor();
  await snapshotContext.close();
  await page.goto(base + "/bookings?kind=D");
  await group(page, d.id)
    .first()
    .getByRole("button", { name: "刪除", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "返回", exact: true })
    .click();
  assert.equal((await get("/bookings/" + d.id)).id, d.id);
  let failDelete = true;
  await page.route("**/api/bookings/" + d.id, (route) =>
    route.request().method() === "DELETE" && failDelete
      ? route.fulfill({ status: 503, json: { detail: "刪除測試失敗" } })
      : route.continue(),
  );
  await group(page, d.id)
    .first()
    .getByRole("button", { name: "刪除", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "確認刪除", exact: true })
    .click();
  await page.getByRole("alert").filter({ hasText: "刪除測試失敗" }).waitFor();
  assert.equal(await group(page, d.id).count(), 2);
  failDelete = false;
  await group(page, d.id)
    .first()
    .getByRole("button", { name: "刪除", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "確認刪除", exact: true })
    .click();
  await group(page, d.id).first().waitFor({ state: "hidden" });
  assert.equal(
    (await context.request.get(base + "/api/bookings/" + d.id)).status(),
    404,
  );
  pass("A/D空資料、載入失敗與重試、刪除取消／失敗保留／真實刪除同步");
  await page.goto(base + "/bookings?kind=E");
  await group(page, e.id).first().waitFor();
  await group(page, e.id)
    .first()
    .getByRole("button", { name: "刪除", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "確認刪除", exact: true })
    .click();
  await group(page, e.id).first().waitFor({ state: "hidden" });
  assert.equal(
    (await context.request.get(base + "/api/bookings/" + e.id)).status(),
    404,
  );
  pass("E刪除確認及真實刪除同步；無車輛出回程操作");
  assert.deepEqual(errors, []);
  await writeFile(
    output + "/results.json",
    JSON.stringify(
      {
        passes,
        geometry,
        errors,
        isolation:
          "Disposable SQLite and uploads; API fixtures only for redaction/owner/errors; no production writes or services restarted",
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
  if (browser)
    for (const context of browser.contexts())
      for (const page of context.pages())
        await page
          .screenshot({ path: output + "/failure.png" })
          .catch(() => {});
  throw error;
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
  await new Promise((resolve) =>
    server.exitCode === null ? server.once("exit", resolve) : resolve(),
  );
  await rm(data, { recursive: true, force: true });
}
