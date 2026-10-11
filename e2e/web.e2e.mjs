// Deep end-to-end tests of the app in a real browser (Chromium), fully offline.
// Part 2 runs the app against Capacitor's real Android bridge (native-bridge.js) with a fake phone
// behind it, so plugin calls (back button, files, share) are exercised the way they run on Android.
// Run: npm run build && node e2e/web.e2e.mjs
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { check, section, summary, openApp, text, rupees, shot, setup, cashIn, localInput, ARTIFACTS } from "./harness.mjs";

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const today = new Date();
const toast = async page => text(page, "#toast");

/* ------------------------------------------------------------------ first launch */
section("First launch and setup");
{
  const { ctx, page, external, errors } = await openApp(browser);
  check(await page.isVisible("#setupForm"), "fresh install shows the setup screen");
  check(!(await page.isVisible("#btnIn")), "Cash In/Out bar is hidden during setup");
  check(await page.isVisible("img.setup-logo"), "Nimbus System logo shown on setup");
  check(await page.evaluate(() => { const i = document.querySelector("img.setup-logo"); return i.complete && i.naturalWidth > 0; }), "logo image loads from the app itself");
  await shot(page, "01-setup");
  await page.click("#setupGo");
  check(await page.isVisible("#setupForm") && /business name/i.test(await toast(page)), "business name is required");
  await page.fill("#sBiz", "   ");
  await page.click("#setupGo");
  check(await page.isVisible("#setupForm"), "blank business name rejected");
  await setup(page, { biz: "Nimbus System", book: "Shop", open: "2500.50" });
  check(await text(page, ".bizname") === "Nimbus System", "header shows the business name");
  check(await text(page, "#openBooks") === "Shop", "first book uses the name given");
  check(rupees(await text(page, ".balance .net")) === 2500.5, "opening balance with paise is recorded", await text(page, ".balance .net"));
  check((await text(page, ".entry .t")) === "Opening balance", "opening balance appears as the first entry");
  check(await page.$$eval(".entry", e => e.length) === 1, "no sample or dummy entries exist");
  await shot(page, "02-home");
  check(external.length === 0, "no network requests at all (fully offline)", external.join(", "));
  check(errors.length === 0, "no script errors", errors.join(" | "));
  await ctx.close();
}
{
  const { ctx, page } = await openApp(browser);
  await setup(page, { biz: "Zero Co", open: "" });
  check(rupees(await text(page, ".balance .net")) === 0 && (await page.$$(".entry")).length === 0, "empty opening balance starts at ₹0 with no entries");
  await ctx.close();
}

/* ------------------------------------------------------------------ cash in / out */
section("Cash In, Cash Out, editing and deleting");
{
  const { ctx, page, errors } = await openApp(browser);
  await setup(page, { open: "1000" });
  // validation
  await page.click("#btnIn"); await page.click("#saveEntry");
  check(/amount above/i.test(await toast(page)) && await page.isVisible("#scrim"), "empty amount is rejected and the panel stays open");
  await page.fill("#amt", "0"); await page.click("#saveEntry");
  check(await page.isVisible("#scrim"), "₹0 is rejected");
  await page.fill("#amt", "-50"); await page.click("#saveEntry");
  check(await page.isVisible("#scrim"), "negative amount is rejected");
  await page.click("[data-close]");
  // valid cash in
  await cashIn(page, { amount: "1500", mode: "UPI", remark: "Counter sale", category: "Sales", party: "Ramesh" });
  check(rupees(await text(page, ".balance .net")) === 2500, "cash in adds to the balance");
  const first = await text(page, ".entry");
  check(/Counter sale/.test(first) && /UPI/.test(first) && /Sales/.test(first) && /Ramesh/.test(first), "entry shows remark, mode, category and party", first);
  // cash out with products
  await page.click("#btnOut");
  await page.click('[data-pid="kirana-sugar"]'); await page.click('[data-pid="kirana-sugar"]');
  await page.click('[data-pid="travel-petrol"]');
  check(await text(page, '[data-pid="kirana-sugar"] .q') === "2", "tapping a product twice sets quantity 2");
  await page.fill('[data-price="0"]', "48");
  await page.click('[data-inc="1"]'); await page.click('[data-inc="1"]');           // petrol qty 3
  await page.fill('[data-price="1"]', "104.5");
  const expected = 2 * 48 + 3 * 104.5;
  check(rupees(await text(page, "#cartTotal")) === expected, "cart total = qty × price summed", await text(page, "#cartTotal"));
  check(Number(await page.inputValue("#amt")) === expected, "amount field follows the cart total");
  check((await page.inputValue("#rem")) === "Sugar ×2, Petrol ×3", "remark is filled in from the products", await page.inputValue("#rem"));
  await page.click('[data-dec="0"]');
  check(rupees(await text(page, "#cartTotal")) === 48 + 3 * 104.5, "minus button lowers the quantity");
  await page.click('[data-dec="0"]');
  check((await page.$$('[data-rm]')).length === 1, "quantity 0 removes the product from the cart");
  await page.click('[data-pid="kirana-sugar"]');
  await page.fill('[data-qty="1"]', "2.5");
  check(rupees(await text(page, "#cartTotal")) === 313.5 + 2.5 * 45, "decimal quantity typed by hand", await text(page, "#cartTotal"));
  await page.click("#saveEntry");
  const out1 = 313.5 + 112.5;
  check(rupees(await text(page, ".balance .net")) === 2500 - out1, "cash out subtracts the cart total", await text(page, ".balance .net"));
  check(/Travel/.test(await text(page, ".entry")), "category set automatically to the biggest spend (Travel)");
  // manual override
  await page.click("#btnOut"); await page.click('[data-pid="tea-snacks-tea"]');
  await page.fill("#amt", "100");
  await page.click("#saveEntry");
  check(rupees(await text(page, ".balance .net")) === 2500 - out1 - 100, "amount typed by hand overrides the cart total");
  // detail + edit
  await page.click(".entry");
  check(/−₹100/.test(await text(page, "#layer h2")), "tapping an entry opens its details");
  await page.click("#editEntry");
  await page.fill("#amt", "120"); await page.click("#saveEntry");
  check(rupees(await text(page, ".balance .net")) === 2500 - out1 - 120, "editing an entry updates the balance");
  check((await page.$$(".entry")).length === 4, "editing does not create a duplicate entry");
  // delete
  await page.click(".entry"); await page.click("#editEntry"); await page.click("#delEntry");
  check(await page.isVisible("#delYes"), "delete asks for confirmation");
  await page.click("#delNo");
  check((await page.$$("#layer .sheet")).length === 1 && !(await page.isVisible("#delYes")), "'Keep it' cancels the delete");
  await page.click("#delEntry"); await page.click("#delYes");
  check((await page.$$(".entry")).length === 3 && rupees(await text(page, ".balance .net")) === 2500 - out1, "deleted entry is gone and the balance is restored");
  // running balance
  const bals = await page.$$eval(".entry .bal", n => n.map(x => x.textContent));
  check(rupees(bals[0]) === 2500 - out1 && rupees(bals[bals.length - 1]) === 1000, "running balance runs from the opening balance to the current balance", bals.join(" / "));
  // totals card
  check(rupees(await text(page, ".split .i .num")) === 2500 && rupees(await text(page, ".split .o .num")) === out1, "Total in / Total out are correct");
  // XSS: entered text is shown, never run
  await cashIn(page, { amount: "1", remark: '<img src=x onerror="window.__xss=1"><b>bold</b>' });
  check(!(await page.evaluate(() => window.__xss)) && /<img src=x/.test(await text(page, ".entry .t")), "HTML in a remark is shown as text, never run");
  await page.reload(); await page.waitForTimeout(200);
  check((await page.$$(".entry")).length === 4 && rupees(await text(page, ".balance .net")) === 2500 - out1 + 1, "everything survives an app restart");
  check(errors.length === 0, "no script errors", errors.join(" | "));
  await ctx.close();
}

/* ------------------------------------------------------------------ filters & search */
section("Filters and search");
{
  const { ctx, page } = await openApp(browser);
  await setup(page, { open: "" });
  const d = n => localInput(new Date(today.getFullYear(), today.getMonth(), today.getDate() - n, 10, 0));
  await cashIn(page, { amount: 100, mode: "Cash", remark: "today cash" });
  await cashIn(page, { amount: 200, mode: "UPI", remark: "three days upi", date: d(3) });
  await cashIn(page, { amount: 300, mode: "Bank", remark: "forty days bank", date: d(40) });
  await page.click("#btnOut"); await page.click('[data-pid="kirana-milk"]'); await page.fill("#dt", d(1)); await page.click("#saveEntry");
  const count = () => page.$$eval(".entry", e => e.length);
  check(await count() === 4, "all 4 entries listed");
  await page.click('[data-f="range"][data-v="today"]');
  check(await count() === 1, "Today shows only today's entries");
  await page.click('[data-f="range"][data-v="week"]');
  check(await count() === 3, "7 days excludes the 40-day-old entry");
  await page.click('[data-f="range"][data-v="all"]');
  await page.click('[data-f="type"][data-v="out"]');
  check(await count() === 1 && /Milk/.test(await text(page, ".entry")), "Cash out filter");
  await page.click('[data-f="type"][data-v="out"]');                       // toggle off
  await page.click('[data-f="mode"][data-v="UPI"]');
  check(await count() === 1 && /three days/.test(await text(page, ".entry")), "payment mode filter");
  await page.click('[data-f="mode"][data-v="UPI"]');
  await page.fill("#q", "forty");
  check(await count() === 1, "search by remark");
  await page.fill("#q", "milk");
  check(await count() === 1, "search by product name");
  await page.fill("#q", "200");
  check(await count() === 1, "search by amount");
  await page.fill("#q", "nothing-matches");
  check(/No entries match/.test(await text(page, ".empty")), "empty search shows a clear message");
  check((await page.inputValue("#q")) === "nothing-matches" && await page.evaluate(() => document.activeElement.id) === "q", "typing in search keeps focus");
  await ctx.close();
}

/* ------------------------------------------------------------------ books */
section("Books");
{
  const { ctx, page } = await openApp(browser);
  await setup(page, { book: "Shop", open: "500" });
  await page.click("#openBooks");
  check(!(await page.isVisible("#bkDel")), "the only book cannot be deleted");
  await page.click("#bkAdd"); await page.click("#bkSave");
  check(await page.isVisible("#bkName"), "new book needs a name");
  await page.fill("#bkName", "Site Expenses"); await page.click("#bkSave");
  check(await text(page, "#openBooks") === "Site Expenses" && rupees(await text(page, ".balance .net")) === 0, "new book starts empty and becomes active");
  await cashIn(page, { amount: 70 });
  await page.click("#openBooks");
  check((await page.$$("[data-book]")).length === 2, "book list shows both books");
  await page.click("[data-book]:first-child");
  check(await text(page, "#openBooks") === "Shop" && rupees(await text(page, ".balance .net")) === 500, "switching books shows each book's own balance");
  await page.click("#openBooks"); await page.click("#bkRename"); await page.fill("#bkName", "Main Shop"); await page.press("#bkName", "Enter");
  check(await text(page, "#openBooks") === "Main Shop", "rename a book");
  await page.click("#openBooks"); await page.click("#bkDel");
  check(await page.isVisible("#bkDelYes"), "deleting a book asks first");
  await page.click("#bkDelYes");
  check(await text(page, "#openBooks") === "Site Expenses" && rupees(await text(page, ".balance .net")) === 70, "deleted book is gone, the other remains");
  await ctx.close();
}

/* ------------------------------------------------------------------ products */
section("Products tab, custom items and remembered prices");
{
  const { ctx, page, errors } = await openApp(browser);
  await setup(page, { open: "10000" });
  await page.click('[data-tab="products"]');
  const n0 = await page.$$eval("[data-prod]", e => e.length);
  check(n0 === 70, "70 built-in products listed", String(n0));
  await page.fill("#pmq", "dal");
  check(await page.$$eval("[data-prod]", e => e.length) === 2, "product search");
  await page.fill("#pmq", "");
  await page.click('[data-pmcat="Bills"]');
  check(await page.$$eval("[data-prod]", e => e.length) === 7, "category filter");
  await page.click('[data-pmcat="All"]');
  // add custom product
  await page.click("#prodAdd"); await page.click("#pSave");
  check(await page.isVisible("#pName"), "new product needs a name");
  await page.fill("#pName", "Shop Rent (Gala 4)"); await page.fill("#pPrice", "12000"); await page.fill("#pUnit", "month"); await page.selectOption("#pCat", "Bills"); await page.click("#pSave");
  check(await page.isVisible("text=Shop Rent (Gala 4)"), "custom product added");
  // edit built-in price/unit
  await page.click('[data-prod="kirana-rice-basmati-"]');
  check(!(await page.isVisible("#pName")), "built-in product name is fixed; price and unit editable");
  await page.fill("#pPrice", "135"); await page.fill("#pUnit", "kg"); await page.click("#pSave");
  check(/₹135/.test(await text(page, '[data-prod="kirana-rice-basmati-"]')), "built-in price change saved");
  // hide built-in
  await page.click('[data-prod="kirana-salt"]'); await page.click("#pHide");
  check(!(await page.isVisible('[data-prod="kirana-salt"]')), "hidden product leaves the list");
  await page.click("#btnOut");
  check(!(await page.isVisible('[data-pid="kirana-salt"]')) && await page.isVisible("text=Shop Rent (Gala 4)"), "Cash Out shows custom products and not hidden ones");
  check(/₹135/.test(await text(page, '[data-pid="kirana-rice-basmati-"]')), "Cash Out uses the edited price");
  // + Custom while entering, saved to list
  await page.click("#customBtn"); await page.fill("#cName", "Banner print"); await page.fill("#cPrice", "450"); await page.click("#cAdd");
  check((await page.$$("[data-rm]")).length === 1, "+ Custom adds the item to the entry");
  // + Custom, not saved
  await page.click("#customTile"); await page.fill("#cName", "One-off repair"); await page.fill("#cPrice", "300"); await page.uncheck("#cSave"); await page.click("#cAdd");
  check((await page.$$("[data-rm]")).length === 2, "+ Custom without saving still adds to this entry");
  await page.click('[data-pid="kirana-sugar"]'); await page.fill('[data-price="2"]', "52");
  await page.click("#saveEntry");
  await page.click('[data-tab="products"]');
  check(await page.isVisible("text=Banner print") && !(await page.isVisible("text=One-off repair")), "only the saved custom item joins the product list");
  check(/₹52/.test(await text(page, '[data-prod="kirana-sugar"]')), "price paid is remembered for next time");
  // show hidden + unhide
  await page.click("#toggleHidden");
  check(await page.isVisible('[data-prod="kirana-salt"]'), "'Show hidden' reveals hidden products");
  await page.click('[data-prod="kirana-salt"]'); await page.click("#pHide");
  await page.click("#btnOut");
  check(await page.isVisible('[data-pid="kirana-salt"]'), "unhidden product is back in Cash Out"); await page.click("[data-close]");
  // delete custom
  await page.click("text=Banner print"); await page.click("#pDel");
  check(await page.isVisible("#pDelYes"), "deleting a product asks first");
  await page.click("#pDelYes");
  check(!(await page.isVisible("text=Banner print")), "custom product deleted");
  await page.click('[data-tab="entries"]');
  check(/Banner print/.test(await text(page, ".entry .t")), "past entries keep a deleted product");
  await shot(page, "03-products");
  check(errors.length === 0, "no script errors", errors.join(" | "));
  await ctx.close();
}

/* ------------------------------------------------------------------ reports & CSV */
section("Reports and CSV export");
{
  const { ctx, page } = await openApp(browser);
  await setup(page, { open: "1000" });
  await cashIn(page, { amount: 400, remark: 'Sale, "special"', category: "Sales" });
  await page.click("#btnOut"); await page.click('[data-pid="kirana-milk"]'); await page.click('[data-pid="kirana-milk"]'); await page.click("#saveEntry");
  await page.click("#btnOut"); await page.click('[data-pid="travel-petrol"]'); await page.click("#saveEntry");
  await page.click('[data-tab="reports"]');
  const rep = await text(page, "#app");
  check(/Kirana\s*₹120/.test(rep) && /Travel\s*₹105/.test(rep), "spending by category", rep.slice(0, 200));
  check(/Opening Balance\s*₹1,000/.test(rep) && /Sales\s*₹400/.test(rep), "money in by source");
  check(/Milk\s*·\s*2 L\s*₹120/.test(rep), "top products bought");
  await shot(page, "04-reports");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#exportCsv")]);
  const csvPath = path.join(ARTIFACTS, "export.csv"); await dl.saveAs(csvPath);
  const csv = fs.readFileSync(csvPath, "utf8").replace(/^﻿/, "").trim().split("\n");
  check(csv[0] === "Date,Time,Type,Amount,Mode,Category,Remark,Party,Products,Balance", "CSV header row");
  check(csv.length === 5, "CSV has one row per entry", String(csv.length));
  check(csv.some(r => r.includes('"Sale, ""special"""')), "CSV quotes commas and quotes correctly");
  check(Number(csv[csv.length - 1].split(",").pop()) === 1000 + 400 - 120 - 105, "CSV running balance ends at the net balance", csv[csv.length - 1]);
  await ctx.close();
}

/* ------------------------------------------------------------------ settings, backup, restore, erase */
section("Settings: business name, backup, restore, erase");
{
  const { ctx, page } = await openApp(browser);
  await setup(page, { biz: "Old Name", open: "700" });
  await page.click("#openSettings");
  await page.fill("#bizName", "Nimbus System"); await page.press("#bizName", "Tab"); await page.waitForTimeout(80);
  check(await text(page, ".bizname") === "Nimbus System", "business name can be changed");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#backupBtn")]);
  const bpath = path.join(ARTIFACTS, "backup.json"); await dl.saveAs(bpath);
  const backup = JSON.parse(fs.readFileSync(bpath, "utf8"));
  check(backup.app === "nimbus-book" && backup.data.books[0].entries.length === 1 && backup.data.business.name === "Nimbus System", "backup file contains the books and business");
  await page.click("[data-close]");
  await cashIn(page, { amount: 50 });
  // restore: bad file
  const bad = path.join(ARTIFACTS, "not-a-backup.json"); fs.writeFileSync(bad, '{"hello":1}');
  await page.click("#openSettings"); await page.setInputFiles("#restoreFile", bad); await page.waitForTimeout(80);
  check(/isn't a Nimbus Book backup/.test(await toast(page)), "a wrong file is refused");
  // restore: good file, cancel then confirm
  await page.setInputFiles("#restoreFile", bpath); await page.waitForTimeout(80);
  check(await page.isVisible("#restoreYes"), "restore asks before overwriting");
  await page.click("#restoreNo");
  check(rupees(await text(page, ".balance .net")) === 750, "cancelled restore changes nothing");
  await page.setInputFiles("#restoreFile", bpath); await page.waitForTimeout(80); await page.click("#restoreYes");
  check(rupees(await text(page, ".balance .net")) === 700, "restore brings back the backed-up data");
  // erase
  await page.click("#openSettings"); await page.click("#eraseBtn"); await page.click("#eraseYes");
  check(await page.isVisible("#eraseConfirm"), "erase needs ERASE typed");
  await page.fill("#eraseConfirm", "erase"); await page.click("#eraseYes"); await page.waitForTimeout(100);
  check(await page.isVisible("#setupForm"), "erase returns to setup");
  await page.reload(); await page.waitForTimeout(150);
  check(await page.isVisible("#setupForm"), "erased data stays erased after restart");
  await page.setInputFiles("#restoreFile", bpath); await page.waitForTimeout(120);
  check(rupees(await text(page, ".balance .net")) === 700 && await text(page, ".bizname") === "Nimbus System", "restore straight from the setup screen");
  await ctx.close();
}

/* ------------------------------------------------------------------ upgrades and bad data */
section("Upgrades from 1.0.0 and damaged data");
{
  const { ctx, page, errors } = await openApp(browser);
  const v1 = { v: 1, activeId: "a", custom: [], books: [{ id: "a", name: "Sample: Shop Ledger", sample: true, entries: [
    { id: "1", type: "in", amount: 4800, ts: 1, remark: "Counter sales", category: "Sales", mode: "Cash", items: [] },
    { id: "2", type: "in", amount: 10000, ts: 2, remark: "Opening balance", category: "Owner Capital", mode: "Bank", items: [] },
    { id: "3", type: "out", amount: 300, ts: 3, remark: "My real expense", category: "Other", mode: "Cash", items: [] }] }] };
  await page.evaluate(s => localStorage.setItem("nimbus-data", JSON.stringify(s)), v1); await page.reload(); await page.waitForTimeout(150);
  check((await page.$$(".entry")).length === 1 && await text(page, "#openBooks") === "My Book", "1.0.0 sample entries removed, the user's own entry kept");
  v1.books[0].entries.pop();
  await page.evaluate(s => localStorage.setItem("nimbus-data", JSON.stringify(s)), v1); await page.reload(); await page.waitForTimeout(150);
  check(await page.isVisible("#setupForm"), "untouched 1.0.0 sample book leads to setup");
  await page.evaluate(() => localStorage.setItem("nimbus-data", "{not json")); await page.reload(); await page.waitForTimeout(150);
  check(await page.isVisible("#setupForm") && errors.length === 0, "corrupted saved data does not crash the app", errors.join(" | "));
  await ctx.close();
}

/* ------------------------------------------------------------------ layout, themes, scale */
section("Layout, dark mode and large data");
for (const [w, scheme] of [[360, "light"], [400, "dark"], [768, "light"]]) {
  const { ctx, page, errors } = await openApp(browser, { width: w, colorScheme: scheme });
  await setup(page, { biz: "A very long business name that should not break the header", open: "100" });
  await page.click("#btnOut"); await page.click('[data-pid="kirana-sugar"]');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 0, `no sideways scrolling at ${w}px (${scheme})`, String(overflow));
  await shot(page, `05-${w}-${scheme}`);
  check(errors.length === 0, `no script errors at ${w}px (${scheme})`);
  await ctx.close();
}
{
  const { ctx, page } = await openApp(browser);
  await setup(page, { open: "0" });
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("nimbus-data")), b = s.books[0], now = Date.now();
    for (let i = 0; i < 3000; i++) b.entries.push({ id: "e" + i, type: i % 3 ? "out" : "in", amount: 10 + (i % 50), ts: now - i * 3600e3, remark: "Entry " + i, category: "Other", mode: "Cash", party: "", items: [] });
    localStorage.setItem("nimbus-data", JSON.stringify(s));
  });
  const t0 = Date.now(); await page.reload(); await page.waitForSelector(".entry"); const ms = Date.now() - t0;
  check(ms < 4000, "3,000 entries open in under 4 seconds", ms + " ms");
  const t1 = Date.now(); await page.click("#btnIn"); await page.fill("#amt", "5"); await page.click("#saveEntry"); const ms2 = Date.now() - t1;
  check(ms2 < 2500, "saving with 3,000 entries stays quick", ms2 + " ms");
  check(await page.$$eval(".entry", e => e.length) === 200 && /Show 200 more \(2801 older\)/.test(await text(page, "#showMore")), "big books show the newest 200 with 'Show more'", await text(page, "#showMore"));
  await page.click("#showMore");
  check(await page.$$eval(".entry", e => e.length) === 400, "'Show more' loads the next 200");
  const bals = await page.$$eval(".entry .bal", n => n.map(x => x.textContent));
  check(rupees(bals[0]) === rupees(await text(page, ".balance .net")), "top running balance equals the net balance in a big book");
  await ctx.close();
}

/* ================================================================== PART 2: native bridge */
section("Android bridge: plugins reachable");
{
  const { ctx, page, errors } = await openApp(browser, { native: true });
  const N = () => page.evaluate(() => ({ calls: window.__native.calls, listeners: window.__native.listeners, exited: window.__native.exited, files: window.__native.files, shared: window.__native.shared }));
  check(await page.evaluate(() => window.Capacitor.isNativePlatform()), "app sees itself running on Android");
  let n = await N();
  check(!!n.listeners.backButton, "back button listener registered with Android");
  check(!!n.listeners.pause, "pause listener registered with Android");
  // back on the setup screen: press twice to exit
  await page.evaluate(() => window.__fire("backButton", { canGoBack: false })); await page.waitForTimeout(60);
  check(/Press back again to exit/.test(await toast(page)) && !(await N()).exited, "back on setup: first press asks to press again");
  await page.evaluate(() => window.__fire("backButton", { canGoBack: false })); await page.waitForTimeout(60);
  check((await N()).exited, "back pressed twice exits the app");
  await page.evaluate(() => { window.__native.exited = false; });
  await setup(page, { open: "900" });
  await page.waitForTimeout(450);
  n = await N();
  check("DATA:nimbus-data.json" in n.files && JSON.parse(n.files["DATA:nimbus-data.json"]).books[0].entries.length === 1, "data file written to the app's private folder");
  const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  check(`DATA:backups/nimbus-${day}.json` in n.files, "today's automatic backup written", Object.keys(n.files).join(", "));
  // back: sheet -> closes
  await page.click("#btnOut");
  await page.evaluate(() => window.__fire("backButton", { canGoBack: false })); await page.waitForTimeout(60);
  check(!(await page.isVisible("#scrim")) && !(await N()).exited, "back closes an open panel");
  await page.click("#openSettings");
  await page.evaluate(() => window.__fire("backButton", { canGoBack: false })); await page.waitForTimeout(60);
  check(!(await page.isVisible("#scrim")), "back closes Settings");
  await page.click('[data-tab="products"]');
  await page.evaluate(() => window.__fire("backButton", { canGoBack: false })); await page.waitForTimeout(60);
  check(await page.getAttribute('[data-tab="entries"]', "aria-selected") === "true" && !(await N()).exited, "back from Products returns to Entries");
  await page.evaluate(() => window.__fire("backButton", { canGoBack: false })); await page.waitForTimeout(60);
  check(!(await N()).exited, "first back on Entries does not exit");
  await page.waitForTimeout(2100);
  await page.evaluate(() => window.__fire("backButton", { canGoBack: false })); await page.waitForTimeout(60);
  check(!(await N()).exited, "presses more than 2 seconds apart do not exit");
  await page.evaluate(() => window.__fire("backButton", { canGoBack: false })); await page.waitForTimeout(60);
  check((await N()).exited, "two quick presses on Entries exit the app");
  // pause flushes immediately
  await page.click("#btnIn"); await page.fill("#amt", "11"); await page.click("#saveEntry");
  await page.evaluate(() => window.__fire("pause")); await page.waitForTimeout(40);
  check(JSON.parse((await N()).files["DATA:nimbus-data.json"]).books[0].entries.length === 2, "going to the background saves the file at once");
  // CSV export through Filesystem + Share
  await page.click('[data-tab="reports"]'); await page.click("#exportCsv"); await page.waitForTimeout(80);
  n = await N();
  const csvWrite = n.calls.find(c => c.p === "Filesystem" && c.m === "writeFile" && c.o.directory === "CACHE" && /\.csv$/.test(c.o.path));
  check(!!csvWrite && /^﻿Date,Time,Type/.test(csvWrite.o.data), "CSV written to a shareable file");
  check(n.shared.length === 1 && /\.csv$/.test(n.shared[0].url), "Android share menu opened with the CSV", JSON.stringify(n.shared));
  check(/ready to save or share/.test(await toast(page)), "export confirms success");
  await page.evaluate(() => { window.__native.cancelShare = true; });
  await page.click("#exportCsv"); await page.waitForTimeout(80);
  check(!/Couldn't/.test(await toast(page)), "closing the share menu is not reported as an error");
  await page.evaluate(() => { window.__native.cancelShare = false; });
  // backup through share
  await page.click("#openSettings"); await page.click("#backupBtn"); await page.waitForTimeout(80);
  n = await N();
  const bk = n.calls.filter(c => c.p === "Filesystem" && c.m === "writeFile" && /backup.*\.json$/.test(c.o.path)).pop();
  check(!!bk && JSON.parse(bk.o.data).data.books[0].entries.length === 2 && n.shared.length === 3, "backup file shared through Android");
  await page.click("[data-close]");
  // web storage wiped -> restored from the file
  await page.evaluate(() => localStorage.removeItem("nimbus-data"));
  await page.reload(); await page.waitForTimeout(300);
  check(!(await page.isVisible("#setupForm")) && rupees(await text(page, ".balance .net")) === 911, "if web storage is wiped, data comes back from the file", await text(page, ".balance .net"));
  // newer file beats older web storage
  await page.evaluate(() => { const f = JSON.parse(localStorage.getItem("__mockfs")); const s = JSON.parse(f["DATA:nimbus-data.json"]); s.updatedAt = Date.now() + 60000; s.business.name = "From File"; f["DATA:nimbus-data.json"] = JSON.stringify(s); localStorage.setItem("__mockfs", JSON.stringify(f)); });
  await page.reload(); await page.waitForTimeout(300);
  check(await text(page, ".bizname") === "From File", "the newer copy wins when phone storage and file differ");
  await shot(page, "06-native");
  check(errors.length === 0, "no script errors on Android bridge", errors.join(" | "));
  await ctx.close();
}
section("Android bridge: automatic backups and failures");
{
  const { ctx, page, errors } = await openApp(browser, { native: true });
  await page.evaluate(() => {   // nine old daily backups already on the phone
    const f = {}; const s = { v: 2, activeId: "b", books: [{ id: "b", name: "Old Book", entries: [{ id: "x", type: "in", amount: 42, ts: 1, remark: "old", category: "Sales", mode: "Cash", items: [] }] }], custom: [], overrides: {}, hidden: [], business: { name: "Backup Co" } };
    for (let i = 1; i <= 9; i++) f["DATA:backups/nimbus-2026-01-0" + i + ".json"] = JSON.stringify(s);
    localStorage.setItem("__mockfs", JSON.stringify(f));
  });
  await page.reload(); await page.waitForTimeout(200);
  await setup(page, { open: "10" }); await page.waitForTimeout(500);
  const names = Object.keys(await page.evaluate(() => window.__native.files)).filter(k => k.startsWith("DATA:backups/"));
  check(names.length === 7 && names.some(n => n.includes(String(today.getFullYear()))), "only the 7 newest daily backups are kept", names.join(", "));
  await page.click("#openSettings"); await page.waitForTimeout(200);
  const autos = await page.$$eval("[data-auto]", e => e.map(x => x.dataset.auto));
  check(autos.length === 7 && autos[0] > autos[autos.length - 1], "Settings lists automatic backups, newest first");
  await page.click(`[data-auto="${autos[autos.length - 1]}"]`); await page.waitForTimeout(150);
  check(await page.isVisible("#restoreYes"), "restoring an automatic backup asks first");
  await page.click("#restoreYes");
  check(await text(page, ".bizname") === "Backup Co" && rupees(await text(page, ".balance .net")) === 42, "automatic backup restored");
  await page.evaluate(() => { window.__native.failWrites = true; });
  await page.click("#btnIn"); await page.fill("#amt", "1"); await page.click("#saveEntry"); await page.waitForTimeout(450);
  check(/Couldn't save/.test(await toast(page)), "a failed save tells the user");
  await page.evaluate(() => { window.__native.failWrites = false; });
  await page.click("#openSettings"); await page.click("#eraseBtn"); await page.fill("#eraseConfirm", "ERASE"); await page.click("#eraseYes"); await page.waitForTimeout(250);
  const left = Object.keys(await page.evaluate(() => window.__native.files));
  check(left.length === 0 && await page.isVisible("#setupForm"), "erase also deletes the data file and automatic backups", left.join(", "));
  check(errors.filter(e => !/No space left/.test(e)).length === 0, "no unexpected script errors", errors.join(" | "));
  await ctx.close();
}

await browser.close();
summary();
