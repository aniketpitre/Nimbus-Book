// End-to-end test of the real Android app on an emulator (runs in GitHub Actions).
// Installs the debug APK, drives the app's WebView with Playwright, presses the real hardware
// back key, checks the files the app writes on the device, and opens the real share menu.
// Run: adb install -r android/app/build/outputs/apk/debug/app-debug.apk && node e2e/android.e2e.mjs
import { _android as android } from "playwright";
import path from "node:path";
import { check, section, summary, rupees, ARTIFACTS } from "./harness.mjs";

const PKG = "tech.aniketpitre.nimbusbook";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const [device] = await android.devices();
if (!device) { console.error("No Android device/emulator found"); process.exit(1); }
console.log(`Device: ${device.model()} (serial ${device.serial()})`);
const sh = async cmd => (await device.shell(cmd)).toString();
const shot = name => device.screenshot({ path: path.join(ARTIFACTS, `android-${name}.png`) });
const resumed = async () => (await sh("dumpsys activity activities")).split("\n").filter(l => /ResumedActivity/.test(l)).join(" ");
const appInFront = async () => (await resumed()).includes(PKG);
const back = async () => { await sh("input keyevent KEYCODE_BACK"); await sleep(700); };
const pid = async () => (await sh(`pidof ${PKG}`)).trim();
const appFile = async rel => sh(`run-as ${PKG} cat files/${rel}`).catch(() => "");
const appLs = async rel => sh(`run-as ${PKG} ls files/${rel}`).catch(() => "");

async function stop() { await sh(`am force-stop ${PKG}`); await sleep(800); }
// Start the app in a fresh process and attach to its WebView. (After the app closes itself Android may
// keep the old process, whose WebView entry is stale, so always force-stop first.)
async function launch() {
  await stop();
  await sh(`monkey -p ${PKG} -c android.intent.category.LAUNCHER 1`);
  for (let i = 0; i < 60; i++) {
    const p = await pid();
    const wv = p && device.webViews().find(w => String(w.pid()) === p);
    if (wv) {
      try {
        const page = await wv.page();
        await page.waitForFunction(() => document.querySelector("#setupForm, .balance"), null, { timeout: 30000 });
        await sleep(600);
        return page;
      } catch (e) { console.log("  (WebView not ready yet: " + e.message.split("\n")[0] + ")"); }
    }
    await sleep(500);
  }
  throw new Error("App WebView did not appear");
}
const t = async (page, sel) => ((await page.textContent(sel)) || "").replace(/\s+/g, " ").trim();

section("Install and first launch");
console.log("  " + (await sh(`dumpsys package ${PKG} | grep -E "versionName|versionCode"`)).trim().replace(/\s+/g, " "));
await sh(`pm clear ${PKG}`);
let page = await launch();
check(await appInFront(), "app opens and is in front");
check(await page.evaluate(() => !!window.capacitorExports && window.Capacitor.isNativePlatform()), "Capacitor core loaded and running natively");
check(await page.isVisible("#setupForm"), "first launch shows setup");
check(await page.evaluate(() => { const i = document.querySelector("img.setup-logo"); return i.complete && i.naturalWidth > 0; }), "Nimbus System logo loads");
await shot("01-setup");

section("Hardware back key on the setup screen");
await back();
check(await appInFront(), "first back press keeps the app open");
check(/Press back again to exit/.test(await t(page, "#toast")), "shows 'Press back again to exit'");
await sh("input keyevent KEYCODE_BACK"); await sleep(250); await sh("input keyevent KEYCODE_BACK"); await sleep(1200);
check(!(await appInFront()), "two quick back presses close the app");

section("Setup and saving to the device");
page = await launch();
await page.fill("#sBiz", "Nimbus System"); await page.fill("#sOpen", "2500"); await page.click("#setupGo");
await page.waitForSelector(".balance");
await page.click("#btnOut"); await page.click('[data-pid="kirana-sugar"]'); await page.click('[data-pid="kirana-sugar"]'); await page.click("#saveEntry");
await sleep(1500);
check(rupees(await t(page, ".balance .net")) === 2410, "balance after setup and a cash out", await t(page, ".balance .net"));
await shot("02-home");
const dataFile = await appFile("nimbus-data.json");
check(/"Nimbus System"/.test(dataFile) && /Sugar/.test(dataFile), "data file written to the app's private storage", dataFile.slice(0, 120));
const backups = await appLs("backups");
check(/nimbus-\d{4}-\d{2}-\d{2}\.json/.test(backups), "today's automatic backup exists", backups.trim());

section("Hardware back key inside the app");
await page.click("#btnIn"); await sleep(400);
check(await page.isVisible("#scrim"), "Cash In panel open");
await back();
check(!(await page.isVisible("#scrim")) && await appInFront(), "back closes the panel and keeps the app open");
await page.click("#openSettings"); await sleep(300);
await back();
check(!(await page.isVisible("#scrim")) && await appInFront(), "back closes Settings");
await page.click('[data-tab="reports"]');
await back();
check((await page.getAttribute('[data-tab="entries"]', "aria-selected")) === "true" && await appInFront(), "back from Reports returns to Entries");

section("Share menu (CSV export)");
await page.click('[data-tab="reports"]'); await page.click("#exportCsv"); await sleep(2500);
const front = await resumed();
await shot("03-share-menu");
check(!front.includes(PKG + "/") || /Chooser|intentresolver|ResolverActivity/i.test(front), "Android share menu opens for the CSV", front.trim().slice(0, 200));
await back(); await sleep(500);
check(await appInFront(), "back from the share menu returns to the app");
check(!/Couldn't/.test(await t(page, "#toast")), "no export error shown");

section("Data survives restarts");
await page.click('[data-tab="entries"]');
await page.click("#btnIn"); await page.fill("#amt", "90"); await page.click("#saveEntry");
await sh("input keyevent KEYCODE_HOME"); await sleep(1200);
check(/"amount":90/.test(await appFile("nimbus-data.json")), "going to the home screen saves straight away");
page = await launch();
check(rupees(await t(page, ".balance .net")) === 2500, "data is still there after the app is force-stopped", await t(page, ".balance .net"));
await page.evaluate(() => localStorage.removeItem("nimbus-data"));
page = await launch();
await sleep(800);
check(rupees(await t(page, ".balance .net")) === 2500 && !(await page.isVisible("#setupForm")), "if web storage is wiped, data is restored from the file");
await shot("04-restored");

section("Leaving the app from the Entries screen");
await back();
check(await appInFront(), "first back on Entries keeps the app open");
await sh("input keyevent KEYCODE_BACK"); await sleep(1200);
check(!(await appInFront()), "second quick back press closes the app");

summary();
process.exit(process.exitCode || 0);
