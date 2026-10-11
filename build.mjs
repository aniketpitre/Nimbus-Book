// Vercel build: copy the app into dist/ and write config.js from the GOOGLE_CLIENT_ID env var.
import { mkdirSync, copyFileSync, writeFileSync } from "node:fs";
mkdirSync("dist", { recursive: true });
copyFileSync("index.html", "dist/index.html");
const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
writeFileSync("dist/config.js", `window.NIMBUS_CONFIG=${JSON.stringify({ googleClientId })};\n`);
console.log(googleClientId ? "Google sign-in enabled" : "GOOGLE_CLIENT_ID not set: Google sign-in disabled");
