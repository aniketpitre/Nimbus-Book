// Shared helpers for the end-to-end tests.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const WWW = path.join(ROOT, "www");
export const ARTIFACTS = path.join(ROOT, "e2e-artifacts");
fs.mkdirSync(ARTIFACTS, { recursive: true });

let passed = 0, failed = 0;
const failures = [];
export function check(cond, name, detail = "") {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; failures.push(name + (detail ? ` (${detail})` : "")); console.log(`  FAIL  ${name}${detail ? "  -> " + detail : ""}`); }
}
export function section(name) { console.log(`\n# ${name}`); }
export function summary() {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) { console.log("Failures:\n" + failures.map(f => "  - " + f).join("\n")); process.exitCode = 1; }
}

// Fake Android: answers plugin calls the way Capacitor's native side does, through the REAL
// native-bridge.js that Capacitor injects into the WebView. Files persist in localStorage["__mockfs"].
const BRIDGE = fs.readFileSync(path.join(ROOT, "node_modules/@capacitor/android/capacitor/src/main/assets/native-bridge.js"), "utf8");
const HEADERS = [
  { name: "App", methods: [["addListener", "callback"], ["removeListener", "promise"], ["removeAllListeners", "promise"], ["exitApp", "promise"], ["minimizeApp", "promise"], ["getInfo", "promise"]] },
  { name: "Filesystem", methods: [["writeFile", "promise"], ["readFile", "promise"], ["readdir", "promise"], ["deleteFile", "promise"], ["mkdir", "promise"], ["stat", "promise"], ["getUri", "promise"], ["addListener", "callback"]] },
  { name: "Share", methods: [["share", "promise"], ["canShare", "promise"], ["addListener", "callback"]] },
].map(p => ({ name: p.name, methods: p.methods.map(([name, rtype]) => ({ name, rtype })) }));
const MOCK = `(() => {
  const load = () => { try { return JSON.parse(localStorage.getItem("__mockfs") || "{}") } catch (e) { return {} } };
  const N = window.__native = { calls: [], listeners: {}, exited: false, shared: [], failWrites: false, cancelShare: false,
    get files() { return load() } };
  const saveFiles = f => localStorage.setItem("__mockfs", JSON.stringify(f));
  const reply = (c, ok, data, error) => setTimeout(() => window.Capacitor.fromNative({ callbackId: c.callbackId, pluginId: c.pluginId,
    methodName: c.methodName, success: ok, data, error, save: c.methodName === "addListener" }), 5);
  window.androidBridge = { postMessage(json) {
    const c = JSON.parse(json), o = c.options || {}, key = (o.directory || "") + ":" + o.path;
    N.calls.push({ p: c.pluginId, m: c.methodName, o });
    if (c.pluginId === "App") {
      if (c.methodName === "addListener") { N.listeners[o.eventName] = c.callbackId; return; }
      if (c.methodName === "exitApp") N.exited = true;
      return reply(c, true, {});
    }
    if (c.pluginId === "Filesystem") {
      const f = load();
      if (c.methodName === "writeFile") { if (N.failWrites) return reply(c, false, null, { message: "No space left on device" });
        f[key] = o.data; saveFiles(f); return reply(c, true, { uri: "file:///" + o.directory + "/" + o.path }); }
      if (c.methodName === "readFile") return key in f ? reply(c, true, { data: f[key] }) : reply(c, false, null, { message: "File does not exist." });
      if (c.methodName === "readdir") { const pre = (o.directory || "") + ":" + o.path + "/";
        const names = Object.keys(f).filter(k => k.startsWith(pre)).map(k => k.slice(pre.length));
        return names.length ? reply(c, true, { files: names.map(name => ({ name, type: "file" })) }) : reply(c, false, null, { message: "Directory does not exist" }); }
      if (c.methodName === "deleteFile") { delete f[key]; saveFiles(f); return reply(c, true, {}); }
    }
    if (c.pluginId === "Share") { N.shared.push(o); return N.cancelShare ? reply(c, false, null, { message: "Share canceled" }) : reply(c, true, {}); }
    reply(c, false, null, { message: "not mocked: " + c.pluginId + "." + c.methodName });
  } };
  window.__fire = (ev, data) => window.Capacitor.fromNative({ callbackId: N.listeners[ev], pluginId: "App", methodName: "addListener", success: true, data: data || {}, save: true });
})();`;
export const NATIVE_INIT = MOCK + "\n" + BRIDGE + `\n;window.Capacitor.PluginHeaders = ${JSON.stringify(HEADERS)};`;

// Serve www/ at http://app.local/ and block every other request (the app must be fully offline).
export async function openApp(browser, { native = false, colorScheme = "light", width = 400, height = 860 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, acceptDownloads: true, colorScheme });
  const external = [], errors = [];
  await ctx.route("**/*", route => {
    const u = route.request().url();
    if (u.startsWith("http://app.local/")) {
      const rel = decodeURIComponent(u.slice(17).split(/[?#]/)[0]) || "index.html";
      const file = path.join(WWW, rel);
      return fs.existsSync(file) ? route.fulfill({ path: file }) : route.fulfill({ status: 404, body: "" });
    }
    external.push(u); return route.abort();
  });
  if (native) await ctx.addInitScript(NATIVE_INIT);
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("http://app.local/");
  await page.waitForTimeout(250);
  return { ctx, page, external, errors };
}

export const text = async (page, sel) => ((await page.textContent(sel)) || "").replace(/\s+/g, " ").trim();
export const rupees = s => Number(String(s).replace(/[^0-9.\-−]/g, "").replace("−", "-"));
export const shot = (page, name) => page.screenshot({ path: path.join(ARTIFACTS, name + ".png") });

export async function setup(page, { biz = "Nimbus System", book = "Main Book", open = "" } = {}) {
  await page.fill("#sBiz", biz);
  await page.fill("#sBook", book);
  await page.fill("#sOpen", String(open));
  await page.click("#setupGo");
  await page.waitForTimeout(150);
}
export async function cashIn(page, { amount, mode = "Cash", remark = "", category, party = "", date } = {}) {
  await page.click("#btnIn");
  await page.fill("#amt", String(amount));
  await page.click(`[data-mode="${mode}"]`);
  if (remark) await page.fill("#rem", remark);
  if (category) await page.selectOption("#cat", category);
  if (party) await page.fill("#party", party);
  if (date) await page.fill("#dt", date);
  await page.click("#saveEntry");
  await page.waitForTimeout(80);
}
export function localInput(d) { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); }
