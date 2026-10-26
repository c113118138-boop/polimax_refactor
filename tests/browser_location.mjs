// UI contract test with isolated demo login and mocked location responses.
// Real PostGIS reads and NULL behavior are covered by test_retention.py.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
const project = new URL("../", import.meta.url).pathname;
const dir = await mkdtemp(tmpdir() + "/polimax-location-ui-");
const base = "http://127.0.0.1:18022";
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
    "18022",
  ],
  {
    cwd: project,
    env: {
      ...process.env,
      PREVIEW_DATA_DIR: dir,
      AMS_DATA_DIR: dir,
      AMS_DATABASE_MODE: "demo",
      PREVIEW_DATABASE_URL: "",
      PREVIEW_LOGIN_ENABLED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let log = "",
  browser;
server.stdout.on("data", (b) => (log += b));
server.stderr.on("data", (b) => (log += b));
const errors = [],
  calls = [];
try {
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(base + "/api/health")).ok) break;
    } catch {}
    if (server.exitCode !== null || i === 149) throw new Error(log);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => errors.push(error.message));
  // Demo's existing auth middleware protects auth/config; mock its public mode.
  await page.route("**/api/auth/config", (route) =>
    route.fulfill({ json: { mode: "demo", configured: true } }),
  );
  await page.goto(base);
  await page.getByRole("button", { name: /進入工作空間/ }).click();
  await page.locator(".calendar-page").waitFor();
  const resources = await (
    await context.request.get(base + "/api/resources")
  ).json();
  const car = resources.find((r) => r.kind === "vehicle");
  const beacons = await (
    await context.request.get(base + "/api/beacons")
  ).json();
  const beacon = beacons[0];
  const stamp = "2026-09-30T09:00:00";
  const point = () => ({
    lat: 25.1,
    lng: 121.1,
    time: stamp,
    created_at: stamp,
  });
  for (const path of ["positions*", "trajectory/*", "findmy/*"]) {
    await page.route("**/api/" + path, async (route) => {
      const url = new URL(route.request().url());
      const source = url.searchParams.get("coordinate_source");
      assert.equal(source, null);
      calls.push(url.pathname);
      let body;
      if (url.pathname === "/api/positions")
        body = [
          {
            resource_id: car.id,
            label: car.label,
            source: "gps",
            ...point(),
          },
        ];
      else if (url.pathname.startsWith("/api/trajectory/"))
        body = {
          points: [point(), { ...point(), lat: null, lng: null }, point()],
          count: 3,
          total: 3,
        };
      else body = { beacon, points: [] };
      await route.fulfill({ json: body });
    });
  }
  await page.goto(base + "/positions");
  await page.getByRole("button", { name: new RegExp(car.label) }).click();
  await page.getByText("25.10000, 121.10000", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("座標來源").count(), 0);
  await Promise.all([
    page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/positions",
    ),
    page.getByRole("button", { name: "刷新位置", exact: true }).click(),
  ]);
  assert(calls.filter((call) => call === "/api/positions").length >= 2);
  await page.goto(base + "/positions?view=history");
  await page
    .getByLabel("選擇車輛", { exact: true })
    .selectOption(String(car.id));
  await page.getByRole("button", { name: "查詢", exact: true }).click();
  await page
    .getByText("1 筆記錄無座標，未顯示於地圖。", { exact: true })
    .waitFor();
  assert(calls.includes("/api/trajectory/" + car.id));
  assert.equal(await page.getByText(/上次查詢/).count(), 0);
  await page.goto(base + "/findmy");
  await page.getByLabel("定位設備", { exact: true }).selectOption(beacon.id);
  await page.getByText("此設備沒有有效定位報告", { exact: true }).waitFor();
  assert(calls.includes("/api/findmy/" + beacon.id));
  assert.deepEqual(errors, []);
  console.log(
    "PASS numeric queries, refresh, no selector or timings, NULL trajectory gaps and Beacon empty state",
  );
} catch (error) {
  if (browser) {
    const page = browser.contexts()[0]?.pages()[0];
    console.error("UI errors:", errors);
    if (page)
      console.error(
        "Page:",
        page.url(),
        await page.locator("body").innerText(),
      );
  }
  throw error;
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
  await new Promise((resolve) =>
    server.exitCode !== null ? resolve() : server.once("exit", resolve),
  );
  await rm(dir, { recursive: true, force: true });
}
