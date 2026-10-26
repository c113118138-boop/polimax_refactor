// Targeted checks against an explicitly isolated running preview.
import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.env.AMS_CALENDAR_PREVIEW_URL || "http://127.0.0.1:18024";
const health = await (await fetch(base + "/api/health")).json();
assert.equal(health.test_data, true, "Only an isolated demo preview may be used");
const libraries = "/home/c113118138/.cache/polimax-browser-deps/usr/lib/x86_64-linux-gnu";
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], env: { ...process.env, ...(existsSync(libraries) ? { LD_LIBRARY_PATH: libraries } : {}) } });
const project = new URL("../", import.meta.url).pathname;
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: "America/Los_Angeles" });
  const page = await context.newPage(); page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base);
  await page.getByRole("button", { name: /進入工作空間/ }).tap();
  await page.locator(".calendar-page .fc-daygrid").waitFor();
  await page.getByRole("button", { name: "天", exact: true }).tap();
  const slot = page.locator(".resource-day-lane").first().getByRole("button", { name: /20:00$/ });
  await slot.scrollIntoViewIfNeeded(); await slot.tap();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  assert.match(await dialog.locator(".muted").innerText(), /20:00.*20:30/);
  await dialog.getByRole("button", { name: "關閉", exact: true }).tap();
  await page.locator(".resource-grid-wrap").evaluate((element) => element.scrollTop = 480);
  assert(await page.locator(".resource-grid-wrap").evaluate((element) => element.scrollWidth > element.clientWidth));
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: project + "test-results/main-screen/mobile-resource-day.png", animations: "disabled" });
  const user = await (await context.request.get(base + "/api/auth/me")).json();
  user.permissions = { forms: {}, fields: {}, roles: [], ui: { "calendar.options.holidayToggle": "Hidden" } };
  const zero = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const dataRequests = [];
  await zero.route("**/api/**", (route) => {
    if (new URL(route.request().url()).pathname === "/api/auth/me") return route.fulfill({ json: user });
    dataRequests.push(route.request().url()); return route.abort();
  });
  const restricted = await zero.newPage(); restricted.on("pageerror", (error) => errors.push(error.message));
  await restricted.goto(base); await restricted.locator(".calendar-page .fc-daygrid").waitFor();
  await restricted.locator(".fc-daygrid-day-number").first().click();
  await restricted.getByRole("alert").getByText("沒有權限", { exact: true }).waitFor();
  assert.equal(await restricted.locator(".calendar-create").count(), 0);
  await restricted.waitForTimeout(2200);
  assert.deepEqual(dataRequests, [], "Zero-access users must not request data or notification APIs");
  assert.deepEqual(errors, []);
  const result = { passes: ["Real touch input opens selected 20:00–20:30", "Mobile resource grid scrolls internally without page overflow", "Zero-access date click shows permission error; no data or notification calls"], errors };
  await writeFile(project + "test-results/main-screen/touch-results.json", JSON.stringify(result, null, 2));
  console.log("PASS touch selection, mobile resource scrolling and zero-access API isolation");
} finally { await browser.close(); }
