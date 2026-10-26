import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";

const project = new URL("../", import.meta.url).pathname;
const data = await mkdtemp(tmpdir() + "/polimax-site-parity-");
const base = "http://127.0.0.1:18030",
  output = project + "test-results/site-parity";
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
    "18030",
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
server.stdout.on("data", (b) => (logs += b));
server.stderr.on("data", (b) => (logs += b));
const passes = [],
  errors = [],
  geometry = [];
const pass = (name) => {
  passes.push(name);
  console.log("PASS", name);
};
const photo = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
try {
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(base + "/api/health")).ok) break;
    } catch {}
    if (server.exitCode !== null || i === 149) throw Error(logs);
    await new Promise((r) => setTimeout(r, 200));
  }
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: "America/Los_Angeles",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => errors.push(e.message));
  const request = async (path, method = "GET", body) => {
    const response = await context.request.fetch(base + "/api" + path, {
      method,
      headers: { "X-AMS-Client": "preview" },
      ...(body === undefined ? {} : { data: body }),
    });
    assert(response.ok(), `${method} ${path}: ${await response.text()}`);
    return response.json();
  };
  const shot = async (name) =>
    page.screenshot({
      path: output + "/" + name + ".png",
      animations: "disabled",
    });
  await page.goto(base);
  await page.getByRole("button", { name: /進入工作空間/ }).click();
  await page.locator(".calendar-page").waitFor();
  const resources = await request("/resources"),
    cars = resources.filter((r) => r.kind === "vehicle"),
    rooms = resources.filter((r) => r.kind === "room"),
    me = await request("/auth/me");
  await page.goto(base + "/vehicles");
  await page.getByRole("table", { name: "CarList" }).waitFor();
  assert.deepEqual(
    await page.locator(".source-data-table th").allTextContents(),
    ["編號", "車牌號碼", "車輛類型", "持有人", "備註", "操作"],
  );
  await shot("CarList-desktop");
  await page.goto(base + "/equipment");
  await page.getByRole("table", { name: "EquipmentList" }).waitFor();
  assert.deepEqual(
    await page.locator(".source-data-table th").allTextContents(),
    ["編號", "工具位置編號", "工具名稱", "保管人", "操作"],
  );
  await shot("EquipmentList-desktop");
  pass("原 CarList / EquipmentList 欄序與操作表格");

  await page.getByRole("button", { name: "新增設備", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^工具位置編號/).fill("PARITY-Z1");
  await dialog.getByLabel(/^工具名稱/).fill("全站重建測試儀器");
  await dialog.getByLabel(/^儀器設備編碼/).fill("PARITY-EQ");
  await dialog.locator('input[list="accessories"]').fill("主機");
  await dialog.getByRole("button", { name: "加入", exact: true }).click();
  await dialog.getByLabel("主機數量", { exact: true }).fill("3");
  await dialog.getByRole("button", { name: "增加 主機", exact: true }).click();
  assert.equal(
    await dialog.getByLabel("主機數量", { exact: true }).inputValue(),
    "4",
  );
  await dialog.getByRole("button", { name: "減少 主機", exact: true }).click();
  await dialog.getByText("總計：3 個配件", { exact: true }).waitFor();
  assert.equal(Math.round((await dialog.boundingBox()).width), 1200);
  await page.setViewportSize({ width: 390, height: 844 });
  assert((await dialog.boundingBox()).width <= 390);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
    0,
  );
  await shot("Equipment-create-mobile");
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const label of ["使用手冊", "保固書", "採購文件"]) {
    await dialog
      .locator(".field")
      .filter({ has: page.getByText(label, { exact: true }) })
      .locator('input[type="file"]')
      .setInputFiles({
        name: label + ".txt",
        mimeType: "text/plain",
        buffer: Buffer.from(label),
      });
    await dialog
      .getByRole("link", { name: label + ".txt", exact: true })
      .waitFor();
  }
  await shot("Equipment-create-desktop");
  await dialog.getByRole("button", { name: "儲存資料", exact: true }).click();
  await page.waitForURL(/\/equipment\/\d+$/);
  await page.locator(".source-profile-banner").waitFor();
  const equipmentId = Number(new URL(page.url()).pathname.split("/").at(-1));
  await page.reload();
  await page.locator(".source-file-grid").waitFor();
  for (const label of ["使用手冊", "保固書", "採購文件"])
    await page
      .getByRole("link", { name: label + ".txt", exact: true })
      .waitFor();
  const equipment = (await request("/resources")).find(
    (r) => r.id === equipmentId,
  );
  assert.equal(equipment.accessories[0].quantity, 3);
  for (const key of ["manual_files", "warranty_files", "purchase_files"])
    assert.equal(equipment[key].length, 1);
  assert.equal(await page.locator(".source-asset-tabs").count(), 0);
  await shot("Equipment-profile-desktop");
  pass("儀器新增、配件數量、三類文件真實 API 保存／刷新回讀與原資訊卡布局");

  const upload = async (name, mime, buffer) => {
    const response = await context.request.post(base + "/api/files", {
      headers: {
        "X-AMS-Client": "preview",
        "X-File-Name": encodeURIComponent(name),
        "Content-Type": mime,
      },
      data: buffer,
    });
    assert(response.ok());
    return response.json();
  };
  const picture = await upload("preview.png", "image/png", photo),
    pdf = await upload(
      "preview.pdf",
      "application/pdf",
      Buffer.from(
        "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
      ),
    );
  await request("/resources/" + equipmentId, "PUT", {
    kind: "equipment",
    label: equipment.label,
    data: {
      ...equipment,
      manual_files: [...equipment.manual_files, picture, pdf],
    },
  });
  await page.reload();
  await page.getByLabel("選擇附件", { exact: true }).selectOption("1");
  await page
    .getByRole("button", { name: "預覽：preview.png", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "預覽：preview.png", exact: true });
  await dialog.getByRole("img", { name: "preview.png", exact: true }).waitFor();
  await shot("Asset-file-preview");
  await dialog.getByRole("button", { name: "關閉預覽", exact: true }).click();
  await page.getByLabel("選擇附件", { exact: true }).selectOption("2");
  await page
    .getByRole("button", { name: "預覽：preview.pdf", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "預覽：preview.pdf", exact: true });
  await dialog.locator('iframe[title="preview.pdf"]').waitFor();
  const pdfResponse = await context.request.get(
    base + "/api/files/" + pdf.id + "?preview=true",
  );
  assert(pdfResponse.headers()["content-disposition"].startsWith("inline"));
  assert.equal(pdfResponse.headers()["content-type"], "application/pdf");
  await dialog.getByRole("button", { name: "關閉預覽", exact: true }).click();
  await page.getByLabel("選擇附件", { exact: true }).selectOption("1");
  await page.route("**/api/files/" + picture.id + "?preview=true", (r) =>
    r.fulfill({ status: 404, json: { detail: "測試附件缺失" } }),
  );
  await page
    .getByRole("button", { name: "預覽：preview.png", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "預覽：preview.png", exact: true });
  await dialog.getByRole("alert").filter({ hasText: "測試附件缺失" }).waitFor();
  await dialog.getByRole("button", { name: "關閉預覽", exact: true }).click();
  await page.unroute("**/api/files/" + picture.id + "?preview=true");
  pass("多附件選擇、圖片／PDF 頁內預覽、inline 契約及缺檔錯誤可關閉");

  await page.goto(base + "/vehicles/" + cars[0].id);
  await page.locator(".source-asset-tabs").waitFor();
  assert.deepEqual(
    await page.locator(".source-asset-tabs button").allTextContents(),
    [
      "車輛基本資料",
      "車輛保險紀錄",
      "車輛使用成本",
      "保養維護記錄",
      "車輛使用紀錄",
    ],
  );
  await shot("Vehicle-profile-desktop");
  const addRecord = async (tab, button, fields) => {
    await page.getByRole("button", { name: tab, exact: true }).click();
    await page.getByRole("button", { name: button, exact: true }).click();
    const d = page.getByRole("dialog");
    for (const [label, value, select] of fields) {
      const field = d.getByLabel(new RegExp("^" + label));
      if (select) await field.selectOption(value);
      else await field.fill(value);
    }
    await d.getByRole("button", { name: "儲存紀錄", exact: true }).click();
    await d.waitFor({ state: "hidden" });
  };
  await addRecord("車輛保險紀錄", "新增紀錄", [
    ["保險公司", "全站測試保險"],
    ["有效期限", "2044-12-31"],
  ]);
  assert.deepEqual(
    await page.locator(".source-data-table th").allTextContents(),
    [
      "保險公司名稱",
      "公司電話",
      "有效期限",
      "業務人員",
      "業務人員電話",
      "道路救援",
      "保單檔案",
      "出險資料",
      "操作",
    ],
  );
  await shot("Insurance-desktop");
  await addRecord("車輛使用成本", "新增紀錄", [
    ["類型", "保養", true],
    ["緣由", "重建測試費用"],
    ["金額", "1350"],
  ]);
  assert.deepEqual(
    await page.locator(".source-data-table th").allTextContents(),
    ["類型", "緣由", "金額", "備註", "附件", "操作"],
  );
  await shot("Cost-desktop");
  await addRecord("保養維護記錄", "新增紀錄", [
    ["記錄類型", "定期保養", true],
    ["記錄日期", "2044-11-01"],
  ]);
  await addRecord("保養維護記錄", "新增管理人員", [
    ["管理人員姓名", "重建測試管理員"],
  ]);
  await page.getByRole("button", { name: "上傳檔案", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "garage.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("garage"),
  });
  await dialog.getByRole("link", { name: "garage.txt", exact: true }).waitFor();
  await dialog.getByRole("button", { name: "儲存紀錄", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.deepEqual(
    await page.locator(".source-record-section>header h2").allTextContents(),
    ["保養維護記錄", "保養廠檔案", "車輛管理人員"],
  );
  await page.getByRole("link", { name: "garage.txt", exact: true }).waitFor();
  await shot("Maintenance-desktop");
  const records = await request("/resources/" + cars[0].id + "/records");
  assert(
    records.some((r) => r.category === "cost" && Number(r.amount) === 1350),
  );
  assert(
    records.some(
      (r) => r.category === "manager" && r.name === "重建測試管理員",
    ),
  );
  pass("車輛五分頁、保險／成本原表格與新增、保養／檔案／人員同頁真實保存");

  const booking = await request("/bookings", "POST", {
    kind: "A",
    content: {
      reason: "工案",
      title: "重建驗證",
      total_people: 1,
      employees: [me.name],
      details: [
        {
          name: "PARITY-A",
          city: "新竹市",
          district: "東區",
          sales: [me.name],
        },
      ],
      slots: cars.slice(0, 2).map((r, i) => ({
        resource_id: r.id,
        start: `2044-11-15T${i ? "13" : "09"}:00:17`,
        end: `2044-11-15T${i ? "14" : "10"}:00:33`,
        detail_index: 0,
      })),
      notes: "查詢彈窗與總里程驗證",
      purposes: [],
    },
  });
  let current = booking;
  const checksB = [
      "擋風玻璃清潔",
      "照後鏡清潔",
      "油量檢查",
      "輪胎檢查",
      "車輛內部清潔",
      "車體外部檢查",
      "隨車設備檢查",
    ],
    checksC = [
      "車輛內部清潔",
      "車輛內部物品歸位",
      "車輛鑰匙歸位",
      "油量檢查",
      "車體外部檢查",
      "隨車設備檢查",
    ];
  for (const [i, mileage] of [100, 110, 115, 145].entries())
    current = await request("/bookings/" + booking.id + "/advance", "POST", {
      expected_status: current.status,
      revision: current.revision,
      content: {
        resource_id: cars[0].id,
        driver: me.name,
        employees: [me.name],
        place: "驗證公司",
        mileage,
        confirmed: true,
        checks: i < 2 ? checksB : checksC,
        tires: "正常",
        interior: "正常",
        exterior: "正常",
        equipment: "正常",
      },
    });
  await page.goto(base + "/bookings?history=1");
  const rows = page.locator(`tr[data-booking-id="${booking.id}"]`);
  await rows.first().getByText("45 km", { exact: true }).waitFor();
  assert.deepEqual(await page.locator(".query-table th").allTextContents(), [
    "表單編號",
    "車牌",
    "申請緣由",
    "地點",
    "開始時間",
    "結束時間",
    "業務人員",
    "申請人",
    "申請時間",
    "總里程數",
    "操作",
  ]);
  assert.equal(await rows.count(), 2);
  assert.equal(await rows.first().locator("td[rowspan]").count(), 3);
  assert.equal(await page.locator(".query-status-filters").count(), 0);
  await shot("History-desktop");
  await rows
    .first()
    .getByRole("button", { name: "查看主表單", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.locator('textarea[name="notes"]').waitFor();
  assert.equal(
    await dialog.locator('textarea[name="notes"]').isDisabled(),
    true,
  );
  assert.equal(
    await dialog.getByRole("button", { name: "儲存變更", exact: true }).count(),
    0,
  );
  await shot("History-main-dialog");
  await dialog
    .getByRole("button", { name: "關閉", exact: true })
    .last()
    .click();
  await rows
    .first()
    .getByRole("button", { name: "查看發車記錄", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.locator(".source-stage-form").first().waitFor();
  assert.equal(await dialog.locator('input[type="number"]').count(), 2);
  await shot("History-stage-dialog");
  await dialog
    .getByRole("button", { name: "關閉", exact: true })
    .last()
    .click();
  pass("歷史 11 欄、多占用合併、實際四階段總里程、主表與雙階段唯讀彈窗");

  for (const kind of ["B", "C"]) {
    await page.goto(base + "/stages?kind=" + kind);
    await page.locator(".query-table").waitFor();
    assert.deepEqual(await page.locator(".query-table th").allTextContents(), [
      "表單編號",
      "日期",
      "駕駛人",
      "車牌",
      "操作",
    ]);
    await page.getByLabel("篩選條件", { exact: true }).selectOption("driver");
    await page.getByLabel("依駕駛人", { exact: true }).fill(me.name);
    assert((await page.locator("tr[data-stage-id]").count()) > 0);
    await shot("Stage-" + kind + "-desktop");
  }
  const c = (await request("/stages?kind=C")).find(
    (s) => s.parent_id === booking.id,
  );
  await page
    .locator(`tr[data-stage-id="${c.id}"]`)
    .getByRole("button", { name: "編輯", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.locator("textarea").first().fill("原彈窗修訂保存");
  await dialog.getByRole("button", { name: "儲存修訂", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(
    (await request("/stages/" + c.id)).content.start.notes,
    "原彈窗修訂保存",
  );
  assert.equal(
    (await request("/bookings/" + booking.id)).status,
    "RETURN_ARRIVED",
  );
  await page.goto(base + "/stages/" + c.id);
  await page.reload();
  await page
    .getByRole("button", { name: "修正階段內容", exact: true })
    .waitFor();
  pass("B/C 分頁、原五欄與動態篩選、彈窗修訂實際保存、狀態不倒退、深層刷新");

  const d = await request("/bookings", "POST", {
    kind: "D",
    content: {
      reason: "作業區租用",
      slots: [
        {
          resource_id: rooms[0].id,
          start: "2044-11-16T09:00:00",
          end: "2044-11-16T10:00:00",
        },
      ],
    },
  });
  await page.goto(base + "/bookings?kind=D");
  await page
    .locator(`tr[data-booking-id="${d.id}"]`)
    .getByRole("link", { name: "編輯", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.locator('input[name="room.end"]').fill("2044-11-16T11:00:33");
  await dialog.getByRole("button", { name: "儲存變更", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert(
    (await request("/bookings/" + d.id)).slots[0].end.includes("11:00:33"),
  );
  assert.equal(new URL(page.url()).pathname, "/bookings");
  pass("D 原編輯彈窗保存與回到原查詢位置");

  const stamp = "2026-10-11T09:00:00+08:00",
    beacon = (await request("/beacons"))[0];
  await page.route("**/api/positions", (r) =>
    r.fulfill({
      json: [
        {
          resource_id: cars[0].id,
          lat: 25.1,
          lng: 121.1,
          time: stamp,
          source: "gps",
          updated_at: stamp,
        },
      ],
    }),
  );
  await page.route("**/api/trajectory/*", (r) =>
    r.fulfill({
      json: {
        points: [
          { lat: 25.1, lng: 121.1, time: stamp },
          { lat: null, lng: null, time: stamp },
          { lat: 25.2, lng: 121.2, time: stamp },
        ],
      },
    }),
  );
  await page.route("**/api/findmy/*", (r) =>
    r.fulfill({
      json: {
        beacon,
        points: [{ lat: 25.1, lng: 121.1, time: stamp, created_at: stamp }],
      },
    }),
  );
  await page.route("**/api/stations", (r) =>
    r.fulfill({ json: ["STATION-A", "STATION-B"] }),
  );
  await page.route("**/api/scans?*", (r) =>
    r.fulfill({
      json: [
        {
          id: "1",
          name: "設備一",
          rssi: -65,
          power: 99,
          time: stamp,
          status: "online",
        },
        {
          id: "2",
          name: "設備二",
          rssi: -70,
          power: 50,
          time: stamp,
          status: "offline",
        },
      ],
    }),
  );
  for (const [path, name] of [
    ["/positions", "Positions"],
    ["/positions?view=history", "Trajectory"],
    ["/findmy", "FindMy"],
    ["/scans", "Scans"],
  ]) {
    await page.goto(base + path);
    await page.locator(".source-map-layout").waitFor();
    if (name === "Positions")
      await page
        .getByRole("button", { name: new RegExp(cars[0].label) })
        .click();
    if (name === "Trajectory") {
      await page
        .getByLabel("選擇車輛", { exact: true })
        .selectOption(String(cars[0].id));
      await page.getByRole("button", { name: "查詢", exact: true }).click();
      await page
        .getByText("1 筆記錄無座標，未顯示於地圖。", { exact: true })
        .waitFor();
    }
    if (name === "FindMy") {
      await page
        .getByLabel("定位設備", { exact: true })
        .selectOption(beacon.id);
      await page
        .getByText("精確座標: 25.100000, 121.100000", { exact: true })
        .waitFor();
    }
    if (name === "Scans") {
      await page
        .getByRole("button", { name: "STATION-A", exact: true })
        .click();
      await page.locator(".source-scan-table").waitFor();
      assert.deepEqual(
        await page.locator(".source-scan-table th").allTextContents(),
        ["設備名稱", "更新時間", "設備狀態"],
      );
    }
    assert.equal(await page.locator(".list-tabs").count(), 0);
    await shot(name + "-desktop");
    for (const width of [1440, 769, 768, 390]) {
      await page.setViewportSize({
        width,
        height: width === 1440 ? 1000 : 844,
      });
      const box = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - innerWidth,
        sideWidth: document
          .querySelector(".source-map-sidebar")
          .getBoundingClientRect().width,
        sideDisplay: getComputedStyle(
          document.querySelector(".source-map-sidebar"),
        ).display,
        rightWidth: document
          .querySelector(".source-map-main")
          .getBoundingClientRect().width,
      }));
      assert.equal(box.overflow, 0);
      if (width > 768) assert.equal(box.sideWidth, 350);
      else assert.equal(box.sideDisplay, "none");
      geometry.push({ name, width, ...box });
      if (width === 390) {
        await page.locator(".source-map-menu").click();
        await page.locator(".source-map-drawer .MuiDrawer-paper").waitFor();
        await page.waitForFunction(
          () =>
            Math.abs(
              document
                .querySelector(".source-map-drawer .MuiDrawer-paper")
                .getBoundingClientRect().right - innerWidth,
            ) < 1,
        );
        assert(
          Math.abs(
            (
              await page
                .locator(".source-map-drawer .MuiDrawer-paper")
                .boundingBox()
            ).width -
              width * 0.9,
          ) < 1,
        );
        assert(
          Math.abs(
            (
              await page
                .locator(".source-map-drawer .MuiDrawer-paper")
                .boundingBox()
            ).x -
              width * 0.1,
          ) < 1,
        );
        await shot(name + "-mobile-drawer");
        await page
          .getByRole("button", { name: "關閉查詢面板", exact: true })
          .click();
        if (name === "FindMy") {
          await page
            .locator(".source-map-mobile-status")
            .filter({ hasText: beacon.id })
            .waitFor();
          await page
            .getByRole("button", { name: "開啟選單", exact: true })
            .click();
          await page.locator(".sidebar.is-open").waitFor();
          await page
            .getByRole("button", { name: "關閉選單", exact: true })
            .click();
        }
        await shot(name + "-mobile");
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  pass(
    "四定位頁分開布局、原 350px 側欄、769/768 斷點、手機 90vw 抽屜、點位與掃描狀態映射",
  );
  await page.goto(base + "/beacons");
  await page.locator(".source-data-table").waitFor();
  assert.deepEqual(
    await page.locator(".source-data-table th").allTextContents(),
    ["編號", "可視化", "擁有者", "操作"],
  );
  await shot("BeaconList-desktop");
  for (const [path, name] of [
    ["/vehicles", "CarList"],
    ["/equipment/" + equipmentId, "Equipment-profile"],
    ["/vehicles/" + cars[0].id, "Vehicle-profile"],
    ["/bookings?history=1", "History"],
    ["/stages?kind=C", "Stage-C"],
    ["/beacons", "BeaconList"],
  ]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + path);
    await page.locator(".page-heading").waitFor();
    await page.waitForTimeout(150);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
      0,
    );
    await shot(name + "-mobile");
  }
  pass("Beacon 原四欄及資產／歷史／階段手機無頁面橫向溢出");
  const borrowerContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    borrower = await borrowerContext.newPage();
  borrower.on("pageerror", (e) => errors.push(e.message));
  await borrower.goto(base);
  await borrower.getByRole("button", { name: /借用人/ }).click();
  await borrower.getByRole("button", { name: /進入工作空間/ }).click();
  await borrower.locator(".calendar-page").waitFor();
  const br = async (path, method = "GET", body) => {
    const response = await borrowerContext.request.fetch(base + "/api" + path, {
      method,
      headers: { "X-AMS-Client": "preview" },
      ...(body === undefined ? {} : { data: body }),
    });
    assert(response.ok(), await response.text());
    return response.json();
  };
  const bm = await br("/auth/me"),
    own = await br("/bookings", "POST", {
      kind: "A",
      content: {
        reason: "工案",
        title: "BORROWER-OWN",
        total_people: 1,
        employees: [bm.name],
        details: [
          {
            name: "BORROWER-OWN",
            city: "新竹市",
            district: "東區",
            sales: [bm.name],
          },
        ],
        slots: [
          {
            resource_id: cars[0].id,
            start: "2044-12-15T09:00:00",
            end: "2044-12-15T10:00:00",
            detail_index: 0,
          },
        ],
      },
    });
  const progressed = await br("/bookings/" + own.id + "/advance", "POST", {
    expected_status: own.status,
    revision: own.revision,
    content: {
      resource_id: cars[0].id,
      driver: bm.name,
      employees: [bm.name],
      place: "測試出發地",
      mileage: 100,
      confirmed: true,
      checks: checksB,
      tires: "正常",
      interior: "正常",
      exterior: "正常",
      equipment: "正常",
    },
  });
  const ownB = (await br("/bookings/" + own.id)).stages.find(
    (s) => s.kind === "B",
  );
  assert.equal((await br("/stages/" + ownB.id)).applicant_owner, bm.id);
  await borrower.goto(base + "/stages?kind=B");
  const ownRow = borrower.locator(`tr[data-stage-id="${ownB.id}"]`);
  await ownRow.getByRole("button", { name: "編輯", exact: true }).click();
  const bd = borrower.getByRole("dialog", { name: "編輯表單", exact: true });
  await bd.locator("textarea").last().fill("借用人自行修訂");
  await bd.getByRole("button", { name: "儲存修訂", exact: true }).click();
  await bd.waitFor({ state: "hidden" });
  assert.equal(
    (await br("/stages/" + ownB.id)).content.start.notes,
    "借用人自行修訂",
  );
  const otherB = (await request("/bookings/" + booking.id)).stages.find(
    (s) => s.kind === "B",
  );
  assert.equal(
    await borrower
      .locator(`tr[data-stage-id="${otherB.id}"]`)
      .getByRole("button", { name: "編輯", exact: true })
      .count(),
    0,
  );
  assert.match(
    await ownRow.locator("td").nth(1).innerText(),
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,
  );
  await borrowerContext.close();
  pass("借用人可修訂自己的 B，其他申請人的 B 不顯示編輯，日期保留台北分鐘");
  const viewerContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    viewer = await viewerContext.newPage();
  viewer.on("pageerror", (e) => errors.push(e.message));
  await viewer.goto(base);
  await viewer.getByRole("button", { name: /唯讀使用者/ }).click();
  await viewer.getByRole("button", { name: /進入工作空間/ }).click();
  await viewer.locator(".calendar-page").waitFor();
  for (const path of [
    "/vehicles",
    "/equipment",
    "/beacons",
    "/stages?kind=C",
    "/bookings?history=1",
  ]) {
    await viewer.goto(base + path);
    await viewer.locator(".page-heading").waitFor();
    assert.equal(
      await viewer
        .locator(".query-edit,.query-delete,.source-row-actions button")
        .count(),
      0,
    );
  }
  await viewerContext.close();
  pass("唯讀身分保留查詢、移除新增／編輯／刪除操作");
  assert.deepEqual(errors, []);
  await writeFile(
    output + "/results.json",
    JSON.stringify(
      {
        passes,
        geometry,
        errors,
        isolation:
          "Disposable SQLite/uploads on 18030; location fixtures explicitly mocked; no production writes/restarts",
      },
      null,
      2,
    ),
  );
  console.log(`PASS ${passes.length} groups; ${output}`);
} catch (e) {
  await writeFile(output + "/failure.log", String(e.stack || e) + "\n" + logs);
  if (browser)
    for (const c of browser.contexts())
      for (const p of c.pages())
        await p.screenshot({ path: output + "/failure.png" }).catch(() => {});
  throw e;
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
  await new Promise((r) =>
    server.exitCode === null ? server.once("exit", r) : r(),
  );
  await rm(data, { recursive: true, force: true });
}
