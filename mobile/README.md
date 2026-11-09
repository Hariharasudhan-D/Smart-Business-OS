# Geethu's Corner – shop app (Android + browser)

A deliberately simple app for the shop: **Home** (today's sales, sales / purchases / profit, last 7 days, recent sales) and **New Sale** (who is buying → what they bought → how they paid → Save). English / தமிழ் switch in the header. Signs in with the shop admin email and password (the same as the website) and stays signed in until **Sign out** is tapped.

Built with Expo (React Native). It talks to the Smart Business OS backend (`../backend`).

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

## Notes

- A free Render backend sleeps when idle; the first open of the day can take up to a minute. The app shows "Opening the shop…" meanwhile.
- New customers and new items are reused if the same name already exists, so double taps don't create duplicates.
- Items added here are saved as "selling" products; the price is typed for each sale.
