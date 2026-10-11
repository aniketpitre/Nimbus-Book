// Copies the web app (web/) into www/, the folder Capacitor packages into the Android app.
import { cpSync, rmSync } from "node:fs";
rmSync("www", { recursive: true, force: true });
cpSync("web", "www", { recursive: true });
console.log("Built www/");
