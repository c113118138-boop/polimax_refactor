import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";

const project = new URL("../", import.meta.url).pathname;
const data = await mkdtemp(tmpdir() + "/polimax-navigation-");
const base = "http://127.0.0.1:18028";
const output = project + "test-results/navigation";
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
    "18028",
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
  browser,
  page;
server.stdout.on("data", (value) => (logs += value));
server.stderr.on("data", (value) => (logs += value));
const passes = [],
  errors = [];
const headers = { "X-AMS-Client": "preview" };
function pass(name) {
  passes.push(name);
  console.log("PASS", name);
}
const prompt = () =>
  page.getByRole("dialog", { name: "尚未保存的內容", exact: true });
async function stay() {
  await prompt().getByRole("button", { name: "繼續編輯", exact: true }).click();
  await prompt().waitFor({ state: "hidden" });
}
async function discard() {
  await prompt()
    .getByRole("button", { name: "放棄變更並離開", exact: true })
    .click();
  await prompt().waitFor({ state: "hidden" });
}
async function home() {
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "日曆", exact: true })
    .click();
}
async function capture(name) {
  await page.waitForTimeout(300);
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
async function group(label) {
  const toggle = page
    .locator(".sidebar")
    .getByRole("button", { name: label, exact: true });
  if ((await toggle.getAttribute("aria-expanded")) === "false")
    await toggle.click();
}
try {
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(base + "/api/health")).ok) break;
    } catch {}
    if (server.exitCode !== null || i === 149)
      throw new Error(logs || "Preview timeout");
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  const libs =
    "/home/c113118138/.cache/polimax-browser-deps/usr/lib/x86_64-linux-gnu";
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
    env: {
      ...process.env,
      ...(existsSync(libs) ? { LD_LIBRARY_PATH: libs } : {}),
    },
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: "Asia/Taipei",
  });
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base);
  await page.getByRole("button", { name: /進入工作空間/ }).click();
  await page.locator(".calendar-page").waitFor();
  const get = async (path) => {
    const response = await context.request.get(base + "/api" + path);
    assert.equal(response.status(), 200, await response.text());
    return response.json();
  };
  const post = async (path, body) => {
    const response = await context.request.post(base + "/api" + path, {
      data: body,
      headers,
    });
    assert.equal(response.status(), 200, await response.text());
    return response.json();
  };
  let writes = 0;
  page.on("request", (request) => {
    if (
      ["POST", "PUT"].includes(request.method()) &&
      /\/api\/(bookings|stages)/.test(request.url())
    )
      writes++;
  });
  const count = (await get("/bookings")).length;

  for (const kind of ["A", "D", "E"]) {
    await page.goto(base + "/bookings/new/" + kind);
    // Untouched defaults must allow leaving without a prompt.
    await home();
    await page.waitForURL(base + "/");
    assert.equal(await prompt().count(), 0);
    await page.goto(base + "/bookings/new/" + kind);
    const input = page.locator(
      kind === "D" ? 'input[name="room.start"]' : 'textarea[name="notes"]',
    );
    const value = kind === "D" ? "2041-03-01T09:00" : kind + " 尚未保存";
    await input.fill(value);
    await home();
    await prompt().waitFor();
    assert.equal(new URL(page.url()).pathname, "/bookings/new/" + kind);
    if (kind === "A") {
      assert(
        await prompt()
          .getByRole("button", { name: "繼續編輯" })
          .evaluate((el) => document.activeElement === el),
      );
      await capture("desktop-leave-confirmation");
    }
    await stay();
    if (kind === "D")
      assert.match(await input.inputValue(), /^2041-03-01T09:00(:00)?$/);
    else assert.equal(await input.inputValue(), value);
    await page.getByRole("button", { name: "取消", exact: true }).click();
    await discard();
    await page.waitForURL(base + "/");
  }
  assert.equal(writes, 0);
  assert.equal((await get("/bookings")).length, count);
  pass("A/D/E 未修改可離開；側欄／取消提示、繼續保留、放棄離開且不寫入");

  await page.goto(base + "/bookings/new/A");
  await page.getByRole("button", { name: "新增明細", exact: true }).click();
  await home();
  await stay();
  assert.equal(await page.locator('[data-editor="明細"]').count(), 1);
  await home();
  await discard();
  await page.waitForURL(base + "/");
  pass("空白但尚未保存的明細編輯列仍受保護");

  await page.goto(base + "/bookings");
  await group("借用申請");
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "車輛借用新增", exact: true })
    .click();
  await page.locator('textarea[name="notes"]').fill("返回與刷新保留");
  await page.evaluate(() => history.back());
  await stay();
  assert.equal(new URL(page.url()).pathname, "/bookings/new/A");
  assert.equal(
    await page.locator('textarea[name="notes"]').inputValue(),
    "返回與刷新保留",
  );
  const native = page.waitForEvent("dialog");
  await page.evaluate(() => {
    setTimeout(() => location.reload(), 0);
  });
  const reloadPrompt = await native;
  assert.equal(reloadPrompt.type(), "beforeunload");
  await reloadPrompt.dismiss();
  assert.equal(
    await page.locator('textarea[name="notes"]').inputValue(),
    "返回與刷新保留",
  );
  await page.evaluate(() => history.back());
  await discard();
  await page.waitForURL(base + "/bookings");
  await page.goForward();
  await page.locator('textarea[name="notes"]').waitFor();
  assert.equal(await page.locator('textarea[name="notes"]').inputValue(), "");
  await page.reload();
  await page.locator('textarea[name="notes"]').waitFor();
  pass("瀏覽器返回／前進、取消原生刷新提示、未修改深層路由刷新");

  await page.locator('textarea[name="notes"]').fill("登出前保留");
  let logoutPosts = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().endsWith("/api/auth/logout")
    )
      logoutPosts++;
  });
  await page.locator(".account-logout").click();
  const logout = page.getByRole("dialog", {
    name: "登出工作空間",
    exact: true,
  });
  await logout.getByRole("button", { name: "確認登出", exact: true }).click();
  await stay();
  assert.equal(logoutPosts, 0);
  await page.route("**/api/auth/logout", (route) =>
    route.fulfill({ status: 503, json: { detail: "測試登出失敗" } }),
  );
  await logout.getByRole("button", { name: "確認登出", exact: true }).click();
  await discard();
  await logout.getByRole("alert").filter({ hasText: "測試登出失敗" }).waitFor();
  assert.equal(logoutPosts, 1);
  await logout.getByRole("button", { name: "取消", exact: true }).click();
  await logout.waitFor({ state: "hidden" });
  assert.equal(
    await page.locator('textarea[name="notes"]').inputValue(),
    "登出前保留",
  );
  await home();
  await discard();
  await page.unroute("**/api/auth/logout");
  pass("取消未保存登出不發送 POST；登出失敗保留內容與離頁保護");

  const car = (await get("/resources")).find((r) => r.kind === "vehicle");
  let booking = await post("/bookings", {
    kind: "A",
    content: {
      title: "離頁驗證主單",
      reason: "工案",
      total_people: 1,
      employees: ["林品安"],
      details: [
        {
          name: "隔離案件",
          city: "新竹市",
          district: "東區",
          leader: "林品安",
          sales: ["林品安"],
        },
      ],
      slots: [
        {
          resource_id: car.id,
          start: "2041-02-10T09:00:00",
          end: "2041-02-10T10:00:00",
          detail_index: 0,
        },
      ],
      purposes: [],
      notes: "原本內容",
    },
  });
  await page.goto(base + "/bookings/" + booking.id + "/edit");
  await page.locator('textarea[name="notes"]').fill("成功保存修訂");
  let finishSave;
  const saveGate = new Promise((resolve) => (finishSave = resolve));
  const bookingPath = "**/api/bookings/" + booking.id;
  await page.route(bookingPath, async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    await saveGate;
    await route.fulfill({ status: 503, json: { detail: "測試保存失敗" } });
  });
  const pendingSave = page.waitForRequest(
    (r) =>
      r.method() === "PUT" && r.url().endsWith("/api/bookings/" + booking.id),
  );
  await page.getByRole("button", { name: "儲存變更", exact: true }).click();
  await pendingSave;
  await home();
  await prompt().waitFor();
  assert(
    await prompt().getByRole("button", { name: "放棄變更並離開" }).isDisabled(),
  );
  assert.match(await prompt().innerText(), /正在保存或上傳檔案/);
  await stay();
  finishSave();
  await page.getByRole("alert").filter({ hasText: "測試保存失敗" }).waitFor();
  await home();
  await stay();
  assert.equal(
    await page.locator('textarea[name="notes"]').inputValue(),
    "成功保存修訂",
  );
  assert.equal(
    (await get("/bookings/" + booking.id)).content.title,
    "離頁驗證主單",
  );
  await page.unroute(bookingPath);
  await page.getByRole("button", { name: "儲存變更", exact: true }).click();
  await page.waitForURL((url) => /^\/bookings\/[^/]+$/.test(url.pathname));
  booking = await get(
    "/bookings/" + new URL(page.url()).pathname.split("/").at(-1),
  );
  assert.equal(await prompt().count(), 0);
  assert.equal(
    (await get("/bookings/" + booking.id)).content.notes,
    "成功保存修訂",
  );
  assert.equal(booking.content.title, "離頁驗證主單");
  pass("保存中禁止放棄；失敗保留保護；真實成功保存正常離頁");

  await page.getByRole("button", { name: "填寫發車表", exact: true }).click();
  const stage = page.getByRole("dialog", { name: "填寫發車表", exact: true });
  await stage.getByRole("button", { name: "取消", exact: true }).click();
  await stage.waitFor({ state: "hidden" });
  assert.equal(await prompt().count(), 0);
  await page.getByRole("button", { name: "填寫發車表", exact: true }).click();
  await stage.getByLabel("去程發車地點").fill("尚未保存的發車地點");
  await stage.getByRole("button", { name: "關閉" }).click();
  await stay();
  assert.equal(
    await stage.getByLabel("去程發車地點").inputValue(),
    "尚未保存的發車地點",
  );
  await stage.getByRole("button", { name: "儲存草稿", exact: true }).click();
  await stage.getByRole("button", { name: "取消", exact: true }).click();
  await stage.waitFor({ state: "hidden" });
  assert.equal(await prompt().count(), 0);
  assert.equal((await get("/bookings/" + booking.id)).status, "PENDING");
  await page.reload();
  await page.getByRole("button", { name: "填寫發車表", exact: true }).click();
  assert.equal(
    await stage.getByLabel("去程發車地點").inputValue(),
    "尚未保存的發車地點",
  );
  await stage.getByLabel("去程發車地點").fill("草稿後的新變更");
  await page.keyboard.press("Escape");
  await prompt().waitFor();
  await capture("stage-draft-leave-confirmation");
  await discard();
  await stage.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "填寫發車表", exact: true }).click();
  assert.equal(
    await stage.getByLabel("去程發車地點").inputValue(),
    "尚未保存的發車地點",
  );
  await stage.getByRole("button", { name: "取消", exact: true }).click();
  await stage.waitFor({ state: "hidden" });
  pass("B 關閉／Esc 保護、儲存草稿可關閉、刷新回填與草稿後的新修改放棄");

  const stageData = {
    driver: "林品安",
    employees: ["林品安"],
    place: "原出發地點",
    mileage: 100,
    confirmed: true,
    checks: [
      "擋風玻璃清潔",
      "照後鏡清潔",
      "油量檢查",
      "輪胎檢查",
      "車輛內部清潔",
      "車體外部檢查",
      "隨車設備檢查",
    ],
    tires: "正常",
    interior: "正常",
    exterior: "正常",
    equipment: "正常",
  };
  let advanced = await get("/bookings/" + booking.id);
  await post("/bookings/" + booking.id + "/advance", {
    expected_status: advanced.status,
    revision: advanced.revision,
    content: stageData,
  });
  advanced = await get("/bookings/" + booking.id);
  const bStage = advanced.stages.find((s) => s.kind === "B");
  await page.goto(base + "/stages/" + bStage.id);
  await page.getByRole("button", { name: "修正階段內容", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "修正階段內容", exact: true });
  await edit.getByLabel("去程發車地點").fill("取消修訂");
  await edit.getByRole("button", { name: "取消", exact: true }).click();
  await stay();
  assert.equal(await edit.getByLabel("去程發車地點").inputValue(), "取消修訂");
  await edit.getByRole("button", { name: "取消", exact: true }).click();
  await discard();
  await edit.waitFor({ state: "hidden" });
  assert.equal(
    (await get("/stages/" + bStage.id)).content.start.place,
    "原出發地點",
  );
  await page.getByRole("button", { name: "修正階段內容", exact: true }).click();
  await edit.getByLabel("去程發車地點").fill("保存修訂");
  await edit.getByRole("button", { name: "儲存修訂", exact: true }).click();
  await edit.waitFor({ state: "hidden" });
  assert.equal(await prompt().count(), 0);
  assert.equal(
    (await get("/stages/" + bStage.id)).content.start.place,
    "保存修訂",
  );
  await home();
  await page.waitForURL(base + "/");
  pass("既有 B 階段修訂取消／繼續／放棄、重新開啟成功保存與 guard 清除");

  advanced = await get("/bookings/" + booking.id);
  await post("/bookings/" + booking.id + "/advance", {
    expected_status: advanced.status,
    revision: advanced.revision,
    content: { ...stageData, mileage: 120, checks: [], place: "抵達地點" },
  });
  await page.goto(base + "/bookings/" + booking.id);
  await page.getByRole("button", { name: "填寫還車表", exact: true }).click();
  const returnStage = page.getByRole("dialog", {
    name: "填寫還車表",
    exact: true,
  });
  let finishUpload;
  const uploadGate = new Promise((resolve) => (finishUpload = resolve));
  await page.route("**/api/files", async (route) => {
    await uploadGate;
    await route.continue();
  });
  const uploadRequest = page.waitForRequest(
    (r) => r.method() === "POST" && r.url().endsWith("/api/files"),
  );
  await returnStage
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "隔離照片.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await uploadRequest;
  await returnStage.getByRole("button", { name: "關閉" }).click();
  await prompt().waitFor();
  assert(
    await prompt().getByRole("button", { name: "放棄變更並離開" }).isDisabled(),
  );
  await stay();
  finishUpload();
  await returnStage
    .getByRole("link", { name: "隔離照片.png", exact: true })
    .waitFor();
  await returnStage.getByRole("button", { name: "取消", exact: true }).click();
  await discard();
  await returnStage.waitFor({ state: "hidden" });
  assert.equal(
    (await get("/bookings/" + booking.id)).status,
    "DEPARTURE_ARRIVED",
  );
  await page.unroute("**/api/files");
  pass("C 上傳中阻擋關閉；完成後可放棄，不推進主單流程");

  await page.goto(base + "/bookings/new/E");
  await page.locator('textarea[name="notes"]').fill("手機尚未保存");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "開啟選單", exact: true }).click();
  await home();
  await prompt().waitFor();
  assert.equal(await page.locator(".main-shell").getAttribute("inert"), null);
  await capture("mobile-leave-confirmation");
  await stay();
  assert.equal(
    await page.locator('textarea[name="notes"]').inputValue(),
    "手機尚未保存",
  );
  await page.getByRole("button", { name: "開啟選單", exact: true }).click();
  await home();
  await discard();
  await page.waitForURL(base + "/");
  await page.setViewportSize({ width: 1440, height: 1000 });
  pass("390px 手機選单跳頁確認、保留輸入且解除選單 inert");

  // Only the UI permission snapshot is mocked here. Existing API policy tests
  // remain responsible for server authorization and owner restrictions.
  for (const [scenario, allowed] of [
    [
      "partial",
      {
        Lending_form: ["read"],
        Equipment_form: ["create"],
        FindMy: ["read"],
        VehicleManagement: ["read"],
      },
    ],
    ["c-only", { Departure_query: ["read"], back_form: ["read"] }],
    ["empty", {}],
  ]) {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      storageState: await context.storageState(),
    });
    const restricted = await ctx.newPage();
    restricted.on("pageerror", (error) => errors.push(error.message));
    restricted.setDefaultTimeout(15000);
    await restricted.route("**/api/auth/me", async (route) => {
      const response = await route.fetch(),
        user = await response.json();
      for (const [doc, ops] of Object.entries(user.permissions.forms)) {
        for (const op of Object.keys(ops))
          ops[op] = allowed[doc]?.includes(op) ? 1 : 0;
      }
      await route.fulfill({ response, json: user });
    });
    await restricted.goto(base);
    await restricted.locator(".sidebar-profile").waitFor();
    const toggles = restricted.locator(".sidebar-group-toggle");
    for (let i = 0; i < (await toggles.count()); i++)
      await toggles.nth(i).click();
    const links = await restricted
      .locator(".sidebar")
      .getByRole("link")
      .allTextContents();
    if (scenario === "partial") {
      for (const name of [
        "儀器借用新增",
        "車輛使用查詢",
        "車輛使用歷史紀錄",
        "設備即時位置",
        "CarList",
        "新增車輛資料",
      ]) {
        assert.equal(links.includes(name), name !== "新增車輛資料", name);
      }
      for (const name of [
        "借用紀錄",
        "車輛借用新增",
        "作業區使用查詢",
        "儀器使用查詢",
        "出回程紀錄",
        "車輛即時資訊查詢",
        "車輛行駛軌跡查詢",
        "設備場內資訊",
        "BeaconList",
        "EquipmentList",
        "資料來源與通知",
        "歷史封存",
      ])
        assert(!links.includes(name), name);
      assert.equal(
        await restricted
          .locator(".sidebar")
          .getByRole("button", { name: "儀器設備", exact: true })
          .count(),
        0,
      );
      await restricted.screenshot({
        path: output + "/partial-permission-sidebar.png",
      });
      await restricted.goto(base + "/equipment");
      await restricted
        .getByRole("heading", { name: "權限不足", exact: true })
        .waitFor();
    } else if (scenario === "c-only") {
      assert.deepEqual(links, ["日曆", "還車紀錄查詢", "料件管理"]);
      await restricted
        .getByRole("link", { name: "還車紀錄查詢", exact: true })
        .click();
      await restricted.waitForURL(base + "/stages?kind=C");
      await restricted.reload();
      assert.equal(new URL(restricted.url()).search, "?kind=C");
    } else {
      assert.equal(await toggles.count(), 0);
      assert.deepEqual(links, ["日曆", "料件管理"]);
      await restricted.screenshot({
        path: output + "/no-permission-sidebar.png",
      });
    }
    await ctx.close();
  }
  pass(
    "部分讀取／只有 C／零權限側欄、空群組隱藏、create 與 read 獨立、直接網址 guard 保留",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    output + "/results.json",
    JSON.stringify(
      {
        passes,
        errors,
        assets: await page.locator('script[type="module"]').getAttribute("src"),
        isolation:
          "Disposable SQLite; both AMS_DATA_DIR and PREVIEW_DATA_DIR; no production writes",
        mocked:
          "Failed save/logout, upload delay and UI auth/me permissions; all successful mutations use real preview API",
        nativeRefresh:
          "Chromium beforeunload dialog dismissed; input preserved",
      },
      null,
      2,
    ),
  );
  console.log(`PASS ${passes.length} groups; ${output}`);
} catch (error) {
  await page?.screenshot({ path: output + "/failure.png" }).catch(() => {});
  if (page)
    await writeFile(output + "/failure.html", await page.content()).catch(
      () => {},
    );
  await writeFile(
    output + "/failure.log",
    String(error.stack || error) + "\n" + logs,
  );
  throw error;
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await new Promise((resolve) =>
    server.exitCode !== null ? resolve() : server.once("exit", resolve),
  );
  await rm(data, { recursive: true, force: true });
}
