import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";

const project = new URL("../", import.meta.url).pathname;
const data = await mkdtemp(tmpdir() + "/polimax-forms-");
const base = "http://127.0.0.1:18026",
  output = project + "test-results/forms";
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
    "18026",
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
      AMS_POLICY_FILE: "",
      AMS_OPTIONS_FILE: "",
      AMS_HOLIDAYS_FILE: "",
      AMS_REPORTS_FILE: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let logs = "",
  browser;
server.stdout.on("data", (b) => (logs += b));
server.stderr.on("data", (b) => (logs += b));
const errors = [],
  passes = [],
  geometry = [];
const pass = (name) => {
  passes.push(name);
  console.log("PASS", name);
};
const png = {
  name: "照片.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  ),
};
try {
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(base + "/api/health")).ok) break;
    } catch {}
    if (server.exitCode !== null) throw Error(logs);
    await new Promise((r) => setTimeout(r, 200));
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
    timezoneId: "America/Los_Angeles",
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.setDefaultTimeout(15000);
  await page.goto(base);
  await page.getByRole("button", { name: /進入工作空間/ }).click();
  await page.locator(".calendar-page").waitFor();
  const get = async (path) => {
    const r = await context.request.get(base + "/api" + path);
    assert.equal(r.status(), 200);
    return r.json();
  };
  const resources = await get("/resources"),
    car = resources.find((r) => r.kind === "vehicle"),
    equipment = resources.find((r) => r.kind === "equipment");
  async function capture(filename, fullPage = true) {
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.querySelectorAll(".modal-content").forEach((el) => {
        el.scrollTop = 0;
      });
    });
    await page.waitForTimeout(350);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
      0,
    );
    await page.screenshot({ path: output + "/" + filename, fullPage });
  }
  async function detail(name, city = "新竹市") {
    await page.getByRole("button", { name: "新增明細", exact: true }).click();
    await page.locator('[data-editor="明細"] input[name$=".name"]').fill(name);
    const cities = page.locator('[data-editor="明細"] select[name$=".city"]');
    if (await cities.count()) {
      await cities.selectOption(city);
      await page
        .locator('[data-editor="明細"] select[name$=".district"]')
        .selectOption("東區");
    }
    await page.getByRole("button", { name: "保存明細", exact: true }).click();
    assert.equal(await page.locator('[data-editor="明細"]').count(), 0);
  }
  async function time(rid, day) {
    await page.getByRole("button", { name: "新增時段", exact: true }).click();
    await page
      .locator('[data-editor="時段"] select[name$=".resource_id"]')
      .selectOption(String(rid));
    await page
      .locator('[data-editor="時段"] input[name$=".start"]')
      .fill(`2040-02-${String(day).padStart(2, "0")}T09:00:17`);
    await page
      .locator('[data-editor="時段"] input[name$=".end"]')
      .fill(`2040-02-${String(day).padStart(2, "0")}T10:00:33`);
    await page.getByRole("button", { name: "保存時段", exact: true }).click();
  }
  async function send() {
    await page.getByRole("button", { name: "確認送出", exact: true }).click();
    await page.waitForURL(/\/bookings\/\d/);
    return get("/bookings/" + page.url().split("/").at(-1));
  }
  let firstA;
  for (const [index, reason] of [
    "工案",
    "材料送貨",
    "新開發案",
    "客戶拜訪",
    "成交案回訪",
    "參展",
    "其他",
  ].entries()) {
    await page.goto(base + "/bookings/new/A");
    assert.equal(await page.getByLabel("申請緣由").count(), 0);
    await page.locator('select[name="reason"]').selectOption(reason);
    assert.equal(await page.locator(".steps").count(), 0);
    assert.deepEqual(
      await page
        .locator(".source-form > fieldset > .source-panel > h2")
        .allTextContents(),
      ["預約基本資訊", "車輛借用用途及細項", "車輛借用資訊", "需求選項清單"],
    );
    await page.getByRole("button", { name: "確認送出", exact: true }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "至少新增一筆需求明細" })
      .waitFor();
    await detail(reason === "材料送貨" ? "" : reason + "-001");
    if (!index) {
      await page
        .getByRole("button", { name: "編輯明細 1", exact: true })
        .click();
      await page.locator('input[name="details.0.name"]').fill("取消的修改");
      await page.getByRole("button", { name: "取消明細", exact: true }).click();
      assert.match(
        await page.locator('[data-grid="明細"] tbody').innerText(),
        /工案-001/,
      );
      await page.getByRole("button", { name: "新增明細", exact: true }).click();
      await page.getByRole("button", { name: "保存明細", exact: true }).click();
      await page
        .getByRole("alert")
        .filter({ hasText: "請填寫工案編號" })
        .waitFor();
      await page.getByRole("button", { name: "取消明細", exact: true }).click();
      await detail("刪除的明細");
      await page
        .getByRole("button", { name: "移除明細 2", exact: true })
        .click();
      assert.equal(
        await page.locator('[data-grid="明細"] tbody tr').count(),
        1,
      );
      await page
        .getByRole("button", { name: "編輯明細 1", exact: true })
        .click();
      await page.locator('input[name="details.0.leader"]').fill("手填組長");
      await page.getByLabel("第二位業務人員", { exact: true }).fill("手填業務");
      await page.getByRole("button", { name: "保存明細", exact: true }).click();
      await page
        .getByLabel("第二位車輛使用人員", { exact: true })
        .fill("手填借用人");
      await page.getByLabel("其他", { exact: true }).check();
      await page.getByLabel("其他用途說明").fill("現場測試");
    }
    await time(car.id, index + 1);
    if (!index) {
      await page
        .getByRole("button", { name: "編輯時段 1", exact: true })
        .click();
      await page.locator('input[name="slots.0.end"]').fill("2040-02-01T08:00");
      await page.getByRole("button", { name: "保存時段", exact: true }).click();
      await page.getByRole("alert").filter({ hasText: "結束時間" }).waitFor();
      await page.getByRole("button", { name: "取消時段", exact: true }).click();
      await capture("A-desktop.png");
      for (const width of [1440, 900, 769, 768, 481, 480, 390]) {
        await page.setViewportSize({ width, height: width < 769 ? 844 : 1000 });
        await page.waitForTimeout(100);
        const g = await page.evaluate(() => ({
          width: innerWidth,
          overflow: document.documentElement.scrollWidth - innerWidth,
          panels: [
            ...document.querySelectorAll(
              ".source-form > fieldset > .source-panel",
            ),
          ].map((el) => {
            const b = el.getBoundingClientRect();
            return { x: b.x, y: b.y, width: b.width };
          }),
          tableScroll: document.querySelector(
            '[data-grid="時段"] .source-table-scroll',
          )?.scrollWidth,
          slotColumns: [
            ...document.querySelectorAll('[data-grid="時段"] thead th'),
          ].map((el) => el.getBoundingClientRect().width),
        }));
        assert.equal(g.overflow, 0);
        assert(g.panels.every((p) => p.x >= 0 && p.x + p.width <= width + 1));
        const total = g.slotColumns.reduce((a, b) => a + b, 0);
        for (const [i, ratio] of [2, 2, 3, 3, 2].entries())
          assert(Math.abs(g.slotColumns[i] / total - ratio / 12) < 0.005);
        geometry.push(g);
        if (width === 390) await capture("A-mobile.png");
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    const saved = await send();
    assert.equal(saved.content.reason, reason);
    assert.equal(saved.content.title, reason);
    assert.equal(saved.content.details.length, 1);
    assert.match(saved.slots[0].start, /09:00:17/);
    if (!index) {
      firstA = saved;
      assert.equal(saved.content.details[0].leader, "手填組長");
      assert(saved.content.details[0].sales.includes("手填業務"));
      assert(saved.content.employees.includes("手填借用人"));
    }
    await page.goto(base + "/bookings/" + saved.id + "/edit");
    await page.reload();
    await page.locator('[data-grid="時段"] tbody').waitFor();
    assert.match(
      await page.locator('[data-grid="時段"] tbody').innerText(),
      /09:00/,
    );
  }
  pass(
    "A 七種需求新增／保存回讀、明細 CRUD 與取消、時段驗證、手填人員、七種寬度與刷新",
  );
  // Switching categories preserves a local draft but refuses to abandon an open editor.
  await page.goto(base + "/bookings/new/A");
  await detail("保留的工案");
  await page.locator('select[name="reason"]').selectOption("參展");
  await detail("展覽");
  await page.locator('select[name="reason"]').selectOption("工案");
  assert.match(
    await page.locator('[data-grid="明細"] tbody').innerText(),
    /保留的工案/,
  );
  await page.getByRole("button", { name: "新增明細", exact: true }).click();
  await page.locator('select[name="reason"]').selectOption("其他");
  assert.equal(
    await page.locator('select[name="reason"]').inputValue(),
    "工案",
  );
  await page.getByRole("button", { name: "取消明細", exact: true }).click();
  pass("A 條件切換保留草稿，未保存列不被丟棄");
  for (const [index, reason] of [
    "開案",
    "成案（施工前量測）",
    "成案（完工量測）",
    "成案（服務回訪）",
    "儀器設備保養／校正",
    "儀器設備維修",
    "其它",
  ].entries()) {
    await page.goto(base + "/bookings/new/E");
    assert.equal(await page.getByLabel("申請緣由").count(), 0);
    await page.getByLabel("外借項目名稱").selectOption(String(equipment.id));
    await page.locator('select[name="reason"]').selectOption(reason);
    assert.deepEqual(
      await page
        .locator(".source-form > fieldset > .source-panel > h2")
        .allTextContents(),
      ["借用人資料", "外借需求", "使用時段登記"],
    );
    await detail(reason + "案件／廠商");
    await time(equipment.id, index + 10);
    if (index === 1) await capture("E-desktop.png");
    const saved = await send();
    assert.equal(saved.kind, "E");
    assert.equal(saved.content.reason, reason);
    assert.equal(saved.content.title, reason);
    assert.equal(saved.content.equipment_id, equipment.id);
    assert.equal(saved.stages?.length || 0, 0);
    await page.goto(base + "/bookings/" + saved.id + "/edit");
    await page.getByRole("button", { name: "編輯明細 1", exact: true }).click();
    assert.equal(
      await page.locator('input[name="details.0.name"]').inputValue(),
      reason + "案件／廠商",
    );
    await page.locator('input[name="details.0.name"]').fill(reason + "修訂");
    await page.getByRole("button", { name: "保存明細", exact: true }).click();
    if (index === 6) {
      await page.setViewportSize({ width: 390, height: 844 });
      await capture("E-mobile.png");
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    await page.getByRole("button", { name: "儲存變更", exact: true }).click();
    await page.waitForURL(base + "/bookings/" + saved.id);
    assert.equal(
      (await get("/bookings/" + saved.id)).content.details[0].name,
      reason + "修訂",
    );
  }
  pass("E 七種類別正常保存、重新讀取、修改保存，設備／位置帶入且無車輛流程");
  await page.goto(base + "/bookings/new/D");
  await page.locator('input[name="room.start"]').fill("2040-03-01T09:00:17");
  await page.locator('input[name="room.end"]').fill("2040-03-01T10:00:33");
  await page.getByLabel("1F施工區域", { exact: true }).check();
  await page.getByLabel("批覆區", { exact: true }).check();
  assert.equal(
    await page.locator('input[name="room.start"]').inputValue(),
    "2040-03-01T09:00:17",
  );
  await page.getByRole("button", { name: "確認送出", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "編號" }).waitFor();
  await page.getByLabel("1-1", { exact: true }).check();
  await page.getByLabel("2F辦公區", { exact: true }).first().check();
  await page.getByLabel("會議室", { exact: true }).check();
  await capture("D-desktop.png");
  const d = await send();
  assert.equal(d.slots.length, 2);
  assert(d.slots.every((s) => /2040-03-01T09:00:17/.test(s.start)));
  assert.equal(await page.locator(".steps").count(), 0);
  await page.goto(base + "/bookings/" + d.id + "/edit");
  await page.reload();
  await page.getByLabel("1-1", { exact: true }).waitFor();
  assert(await page.getByLabel("1-1", { exact: true }).isChecked());
  assert(await page.getByLabel("會議室", { exact: true }).isChecked());
  await page.setViewportSize({ width: 390, height: 844 });
  await capture("D-mobile.png");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('input[name="room.end"]').fill("2040-03-01T11:00:33");
  await page.getByRole("button", { name: "儲存變更", exact: true }).click();
  await page.waitForURL(base + "/bookings/" + d.id);
  assert.match((await get("/bookings/" + d.id)).slots[0].end, /11:00:33/);
  await page.goto(base + "/bookings/new/D");
  await page.locator('input[name="room.start"]').fill("2040-03-01T10:00");
  await page.locator('input[name="room.end"]').fill("2040-03-01T12:00");
  await page.getByLabel("1F施工區域", { exact: true }).check();
  await page.getByLabel("批覆區", { exact: true }).check();
  await page.getByLabel("1-1", { exact: true }).check();
  await page.getByRole("button", { name: "確認送出", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "衝突" }).waitFor();
  pass("D 樓層／區域／編號条件、多區保存與編輯回填、衝突阻擋");
  const checksB = [
    "擋風玻璃清潔",
    "照後鏡清潔",
    "油量檢查",
    "輪胎檢查",
    "車輛內部清潔",
    "車體外部檢查",
    "隨車設備檢查",
  ];
  const checksC = [
    "車輛內部清潔",
    "車輛內部物品歸位",
    "車輛鑰匙歸位",
    "油量檢查",
    "車體外部檢查",
    "隨車設備檢查",
  ];
  await page.goto(base + "/bookings/" + firstA.id);
  for (const [index, button] of [
    "填寫發車表",
    "填寫發車抵達",
    "填寫還車表",
    "填寫還車抵達",
  ].entries()) {
    await page.getByRole("button", { name: button, exact: true }).click();
    let dialog = page.getByRole("dialog");
    if (index % 2 === 0) {
      await dialog.getByLabel(/^駕駛人員/).fill("測試管理員");
      await dialog.getByLabel("副駕人員（兩人以上必填）").fill("手填借用人");
      await dialog
        .getByLabel(index === 0 ? "去程發車地點" : "回程發車地點")
        .fill("表單測試地點");
      for (const label of index === 0 ? checksB : checksC)
        await dialog.getByLabel(label, { exact: true }).check();
      if (!index) {
        await dialog
          .getByRole("button", { name: "儲存草稿", exact: true })
          .click();
        await dialog.getByRole("button", { name: "取消", exact: true }).click();
        await page.reload();
        await page.getByRole("button", { name: button, exact: true }).click();
        dialog = page.getByRole("dialog");
        assert.equal(
          await dialog.getByLabel("去程發車地點").inputValue(),
          "表單測試地點",
        );
        assert.equal((await get("/bookings/" + firstA.id)).status, "PENDING");
        await dialog.locator('input[name="B-start-tires"]').last().check();
        await dialog.getByLabel("輪胎異狀說明").fill("輪胎待檢");
      } else {
        await page.route("**/api/files", async (route) => {
          await new Promise((resolve) => setTimeout(resolve, 700));
          await route.continue();
        });
        for (const key of ["exterior", "equipment"]) {
          await dialog.locator(`input[name="C-start-${key}"]`).last().check();
          await dialog
            .getByLabel(
              (key === "exterior" ? "車體外部" : "隨車設備") + "異狀說明",
            )
            .fill("測試異狀");
        }
        for (const [i, name] of [
          "內部.png",
          "外部.png",
          "設備.png",
          "停放.png",
        ].entries()) {
          await dialog
            .locator("input[type=file]")
            .nth(i)
            .setInputFiles({ ...png, name });
          assert(
            await dialog
              .getByRole("button", { name: "確認提交本階段", exact: true })
              .isDisabled(),
          );
          await dialog.getByRole("link", { name, exact: true }).waitFor();
        }
        const images = dialog.locator("img");
        await images.first().waitFor();
        assert.equal(await images.count(), 4);
        await page.unroute("**/api/files");
      }
    } else {
      await dialog.getByLabel("維修", { exact: true }).check();
      await dialog.getByLabel("車輛問題部位").fill("測試部位");
      await dialog.getByLabel("車輛故障地點").fill("測試故障地點");
      await dialog.getByLabel("維修地點／維修廠").fill("測試維修廠");
      await dialog.getByLabel("維修", { exact: true }).uncheck();
      await dialog.getByLabel("維修", { exact: true }).check();
      assert.equal(
        await dialog.getByLabel("車輛問題部位").inputValue(),
        "測試部位",
      );
    }
    await dialog
      .locator("input[type=number]:enabled")
      .fill(String(100 + index * 20));
    await dialog.locator("form").getByLabel("我已確認本階段里程").check();
    await page.setViewportSize({ width: 1440, height: 1600 });
    await capture(`stage-${index}-desktop.png`, false);
    if (index === 2) {
      await page.locator(".modal-content").evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await page.screenshot({ path: output + "/C-desktop-bottom.png" });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    if (index === 2) {
      await page.setViewportSize({ width: 390, height: 844 });
      await capture("C-mobile.png", false);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
        0,
      );
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    await dialog
      .getByRole("button", { name: "確認提交本階段", exact: true })
      .click();
    await dialog.waitFor({ state: "hidden" });
  }
  const complete = await get("/bookings/" + firstA.id);
  assert.equal(complete.status, "RETURN_ARRIVED");
  const c = complete.stages.find((s) => s.kind === "C");
  for (const key of [
    "interior_files",
    "exterior_files",
    "equipment_files",
    "parking_files",
  ]) {
    assert.equal(c.content.start[key].length, 1);
    assert.equal(
      (
        await context.request.get(
          base + "/api/files/" + c.content.start[key][0].id + "?preview=true",
        )
      ).status(),
      200,
    );
  }
  assert.equal(
    complete.stages.find((s) => s.kind === "B").content.arrival.anomaly_details
      .維修.reason,
    "測試部位",
  );
  await page.goto(base + "/stages/" + c.id);
  await page.getByRole("button", { name: "修正階段內容", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "修正階段內容", exact: true });
  await dialog.locator("img").first().waitFor();
  assert.equal(await dialog.locator("img").count(), 4);
  await dialog
    .getByRole("button", { name: "移除 內部.png", exact: true })
    .click();
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  const leavePrompt = page.getByRole("dialog", { name: "尚未保存的內容" });
  await leavePrompt.waitFor();
  await leavePrompt
    .getByRole("button", { name: "繼續編輯", exact: true })
    .click();
  await leavePrompt.waitFor({ state: "hidden" });
  await dialog.locator("img").first().waitFor();
  assert.equal(await dialog.locator("img").count(), 3);
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await leavePrompt
    .getByRole("button", { name: "放棄變更並離開", exact: true })
    .click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(
    (await get("/stages/" + c.id)).content.start.interior_files.length,
    1,
  );
  await page.getByRole("button", { name: "修正階段內容", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "修正階段內容", exact: true });
  await dialog
    .getByRole("button", { name: "移除 內部.png", exact: true })
    .click();
  await dialog.getByRole("button", { name: "儲存修訂", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(
    (await get("/stages/" + c.id)).content.start.interior_files.length,
    0,
  );
  assert.equal((await get("/bookings/" + firstA.id)).status, "RETURN_ARRIVED");
  pass(
    "B/C 四階段、異狀與途中異常、分頁草稿重開、四種照片上傳／預覽／回填／取消移除／保存移除",
  );
  await page.route("**/api/auth/me", async (route) => {
    const response = await route.fetch(),
      user = await response.json();
    user.permissions.fields.Lending_form = {
      ...user.permissions.fields.Lending_form,
      notes: { read: 1, write: 0 },
      details: { read: 1, write: 0 },
      purposes: { read: 0, write: 0 },
    };
    await route.fulfill({ response, json: user });
  });
  await page.goto(base + "/bookings/new/A");
  assert(
    await page
      .getByRole("button", { name: "新增明細", exact: true })
      .isDisabled(),
  );
  assert(await page.locator('textarea[name="notes"]').isDisabled());
  assert.equal(await page.locator(".source-purpose-table").count(), 0);
  await page.unroute("**/api/auth/me");
  pass("欄位唯讀限制保存列與備註，隱藏欄位不顯示控制");
  assert.deepEqual(errors, []);
  await writeFile(
    output + "/results.json",
    JSON.stringify({ passes, geometry, errors }, null, 2),
  );
} catch (e) {
  console.error(logs.slice(-3500));
  throw e;
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await new Promise((r) => server.once("exit", r));
  await rm(data, { recursive: true, force: true });
}
