# Nimbus Book

A simple business cash book for Android that works **fully offline**. All data stays on the phone.

- **Books:** keep one per shop, project or person; each has its own net balance, total in and total out.
- **Cash In / Cash Out:** each entry has an amount, date and time, payment mode (Cash, UPI, Card, Bank, Cheque), category, remark and party.
- **Product list for expenses:** 70 common items in 9 categories (Kirana, Tea & Snacks, Office, Travel, Bills, Staff, Cleaning, Packaging, Repairs) with typical ₹ prices. Tap to add an item, set its quantity and price, and the amount and remark fill in automatically.
- **+ Custom button:** add any item that isn't listed, and optionally save it to *My products*.
- **Search and filters:** by date, in/out and payment mode. Each entry shows its running balance.
- **Reports:** spending by category, money in by source, top products bought, and CSV export (Excel / Google Sheets).
- **Backup & restore:** save every book to one `.json` file, then restore it on a new phone.

## Install on your phone

Open the latest release: **https://github.com/aniketpitre/nimbus-book/releases/latest**. Download the `NimbusBook-x.y.z.apk` file and open it. If Android asks, allow your browser or Files app to install unknown apps.

## How it's built

| Path | What it is |
|---|---|
| `web/index.html` | The whole app (HTML, CSS, JS), no frameworks |
| `web/fonts/` | Bundled fonts so it looks the same offline (SIL OFL) |
| `build.mjs` | Copies `web/` to `www/` |
| `capacitor.config.json`, `android/` | [Capacitor 7](https://capacitorjs.com) wraps the web app as a native Android app. Plugins: App (back button), Filesystem and Share (export and backup files) |
| `.github/workflows/android-release.yml` | Builds the APK on GitHub. Pushing a `v*` tag publishes a GitHub Release with the APK attached |

Data is saved in the app's local storage on the device. Uninstalling the app deletes it, so make a backup first.

## Make a new release

1. Bump `versionCode` (+1) and `versionName` in `android/app/build.gradle`.
2. Commit, then tag and push: `git tag v1.0.1 && git push origin v1.0.1`.
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
