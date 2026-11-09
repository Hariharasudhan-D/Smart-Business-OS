// Where the backend lives.
//
// PRODUCTION_API_URL: your Render backend address + /api. Put it here ONCE (it is not a secret).
// Both the installed APK and every later over-the-air update use it, so an update can never ship
// without it. While developing on the computer (expo start), the app talks to http://localhost:8080.
// EXPO_PUBLIC_API_URL in mobile/.env, if set, wins over both (handy for testing another server).
const PRODUCTION_API_URL = 'https://REPLACE-WITH-YOUR-RENDER-BACKEND.onrender.com/api';
const DEVELOPMENT_API_URL = 'http://localhost:8080/api';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? DEVELOPMENT_API_URL : PRODUCTION_API_URL)).replace(/\/$/, '');
