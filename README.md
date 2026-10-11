# Nimbus Book

A CashBook-style business cash book: books, Cash In / Cash Out, a ready product list for expenses with a custom-item button, filters, reports and CSV export. Users sign in with Google, and each user's data is saved to their own Google Drive.

## How it works

- **Sign up / log in:** "Continue with Google" (Google Identity Services). The first sign-in creates the account, and later sign-ins log in.
- **Database:** each user's books are one JSON file (`nimbus-book.json`) in the hidden *app data* folder of **their own Google Drive** (`drive.appdata` scope). Only this app can read that folder. A copy is cached in the browser so the app opens instantly and works offline, then syncs.
- **Guest mode:** "Try without an account" keeps data in the browser only. Signing in later moves those books into the account.
- No server and no database to run: it's a static site on Vercel.

## Files

- `index.html` is the whole app (HTML + CSS + JS).
- `build.mjs` is the Vercel build: it copies the app to `dist/` and writes `dist/config.js` from the `GOOGLE_CLIENT_ID` env var.
- `vercel.json` holds the build settings and headers (`Cross-Origin-Opener-Policy: same-origin-allow-popups`, which the Google sign-in popup needs).

## One-time Google setup

1. Go to https://console.cloud.google.com and create a project (e.g. "Nimbus Book").
2. In **APIs & Services → Library**, enable the **Google Drive API**.
3. Open **Google Auth Platform**:
   - **Branding:** set the app name, support email and developer email.
   - **Audience:** choose External. While the app is in *Testing*, add your Gmail (and any testers) under **Test users**.
   - **Data access:** add the scopes `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` and `.../auth/drive.appdata`.
   - **Clients → Create client → Web application:** under *Authorized JavaScript origins*, add the site URL (e.g. `https://nimbus-book.vercel.app`, plus `http://localhost:3000` for local testing). No redirect URI is needed.
4. Copy the **Client ID** (`….apps.googleusercontent.com`). In Vercel, open the project's **Settings → Environment Variables**, add `GOOGLE_CLIENT_ID` = that value, then redeploy.

## Run locally

```sh
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com node build.mjs
npx serve dist -l 3000
```
