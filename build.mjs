// Copies the web app (web/) into www/, the folder Capacitor packages into the Android app,
// plus Capacitor's core runtime (vendor/capacitor.js), which the page needs to call native plugins.
import { cpSync, rmSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
rmSync("www", { recursive: true, force: true });
cpSync("web", "www", { recursive: true });
mkdirSync("www/vendor", { recursive: true });
cpSync(require.resolve("@capacitor/core/dist/capacitor.js"), "www/vendor/capacitor.js");
console.log("Built www/");
