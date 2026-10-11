# Nimbus Book

A simple business cash book for Android that works **fully offline**. All data stays on the phone.

- **Books:** keep one per shop, project or person; each has its own net balance, total in and total out.
- **Cash In / Cash Out:** each entry has an amount, date and time, payment mode (Cash, UPI, Card, Bank, Cheque), category, remark and party.
- **First-time setup:** enter your business name, first book and the cash in hand right now. The app has no sample or dummy data.
- **Product list for expenses:** 70 common items in 9 categories (Kirana, Tea & Snacks, Office, Travel, Bills, Staff, Cleaning, Packaging, Repairs). Tap to add an item, set its quantity and price, and the amount and remark fill in automatically. The app **remembers the last price you paid** for each product.
- **Products tab:** add your own products, change prices and units, hide built-in items you never buy, and delete your own.
- **+ Custom button:** add any item that isn't listed while entering an expense, and optionally save it to your products.
- **Search and filters:** by date, in/out and payment mode. Each entry shows its running balance.
- **Reports:** spending by category, money in by source, top products bought, and CSV export (Excel / Google Sheets).
- **Backup & restore (Settings):** save everything to one `.json` file (share it to Drive, WhatsApp or email) and restore it on any phone. The app also keeps an automatic daily copy on the phone for the last 7 days.
- **Settings:** business name, backups, and erase all data.

## Brand

The app uses the **Nimbus System** logo. `brand/nimbus-system-logo-original.png` is the original, and `brand/nimbus-system-logo.svg` is a clean vector redraw of it (same arc, sky, mouse and cable, clouds, *Nimbus* script and *SYSTEM* lettering, with the colours taken from the original). The letters are converted to outlines, so it looks the same everywhere. The launcher icon, launch screen and in-app logo are all made from that SVG. `brand/tools/build-logo.js` is the script that generated it. It uses opentype.js and the Norican and Archivo Black fonts from `@fontsource`, set the `SP` path to where those are installed.

## Install on your phone

Open the latest release: **https://github.com/aniketpitre/nimbus-book/releases/latest**. Download the `NimbusBook-x.y.z.apk` file and open it. If Android asks, allow your browser or Files app to install unknown apps.

## How it's built

| Path | What it is |
|---|---|
| `web/index.html` | The whole app (HTML, CSS, JS), no frameworks |
| `web/fonts/` | Bundled fonts so it looks the same offline (SIL OFL) |
| `brand/`, `web/brand/` | Nimbus System logo: the original and its vector redraw |
| `build.mjs` | Copies `web/` to `www/` |
| `capacitor.config.json`, `android/` | [Capacitor 7](https://capacitorjs.com) wraps the web app as a native Android app. Plugins: App (back button), Filesystem and Share (export and backup files) |
| `.github/workflows/android-release.yml` | Builds the APK on GitHub. Pushing a `v*` tag publishes a GitHub Release with the APK attached |

Data is saved twice on the device: in the app's web storage, and as `nimbus-data.json` in the app's private data folder (plus `backups/nimbus-YYYY-MM-DD.json`, last 7 days). Uninstalling the app deletes all of it, so save a backup file first.

## Make a new release

1. Bump `versionCode` (+1) and `versionName` in `android/app/build.gradle`.
2. Commit and push, then on GitHub open **Actions → Android release → Run workflow** and enter the version (e.g. `1.0.1`). Pushing a tag `v1.0.1` works too.
3. GitHub Actions builds `NimbusBook-1.0.1.apk` and attaches it to the release.

## Develop

```sh
npm install
npm run serve      # try it in a browser at http://localhost:3000
npm run sync       # copy the web app into the Android project
npx cap open android   # open in Android Studio
```

## Signing

APKs are signed with `android/app/nimbus-test.keystore`, a **test key committed on purpose**. That way each new release installs as an update over the last one and keeps your data. Before publishing on the Play Store, create a private key, keep it out of git, and put it in GitHub secrets.
