# Geethu's Corner – shop app (Android + browser)

A deliberately simple app for the shop: **Home** (today's sales, sales / purchases / profit, last 7 days, recent sales) and **New Sale** (who is buying → what they bought → how they paid → Save). English / தமிழ் switch in the header. Signs in with the shop admin email and password (the same as the website) and stays signed in until **Sign out** is tapped.

Built with Expo (React Native). It talks to the Smart Business OS backend (`../backend`).

Current signed Android release: **1.1.1 (version code 3)**. Download it from
https://smart-business-os.vercel.app/download after the website deployment completes.
APK SHA-256: `A0248000ADCC62ABC3246E0BE6105798F9220DD09658FD510A215B1AEAD3B3B6`.

## 1. Point the app at the backend

Copy `.env.example` to `.env` and set the backend address:

```
EXPO_PUBLIC_API_URL=https://your-backend.onrender.com/api
```

## 2. Try it

```bash
cd mobile
npm install
npx expo start          # scan the QR code with the Expo Go app on the phone
npx expo start --web    # or open it in a PC browser
```

When testing in a browser, the backend must allow the browser's address: add it to `CORS_ORIGINS` (for example `http://localhost:8081`). The phone app itself does not need this.

## 3. Build the Android app (APK) for the phone

1. Put the real backend address in `eas.json` (`EXPO_PUBLIC_API_URL` under `preview`).
2. Create a free account at https://expo.dev, then:

```bash
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview
```

3. When the build finishes, open the download link on the phone and install the APK (Android will ask to allow installing from this source).

## Publishing future updates

Install Android version 1.1.1 or newer once to enable manual updates. Tap **Update** on the
sign-in screen or on Home to check for and install a compatible Expo update. If a new
APK is available, the button offers to open the download page.

Add an Expo access token as the GitHub Actions repository secret `EXPO_TOKEN`. The Android
workflow publishes to the production channel when a push to `main` changes files under
`mobile/`. Keep the same `expo.version` for compatible JavaScript, styling, and asset changes.

For native dependency, permission, Expo SDK, or breaking API changes:

1. Increase `expo.version` and `expo.android.versionCode` in `app.json`.
2. Build a signed APK with `npx eas-cli@latest build -p android --profile preview`.
3. Put the APK at `frontend/public/downloads/geethus-corner-VERSION.apk` and update the website's
   `APP_VERSION` in `frontend/src/pages/DownloadApp.jsx`.
4. Set `MOBILE_LATEST_VERSION` and `MOBILE_RELEASE_NOTES` on the backend, then deploy the backend
   and website. The stable `/download` page will be offered to users the next time they tap **Update**.

Never change `android.package` or the EAS Android signing credential. Those two values allow a new
APK to install over the existing app and preserve its data.

## Notes

- A free Render backend sleeps when idle; the first open of the day can take up to a minute. The app shows "Opening the shop…" meanwhile.
- New customers and new items are reused if the same name already exists, so double taps don't create duplicates.
- Items added here are saved as "selling" products; the price is typed for each sale.
