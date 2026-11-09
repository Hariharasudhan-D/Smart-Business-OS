// Where the backend lives. Set EXPO_PUBLIC_API_URL in mobile/.env, for example
//   EXPO_PUBLIC_API_URL=https://your-backend.onrender.com/api
// Without it the app talks to a backend on the same computer (useful when testing in a PC browser).
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api').replace(/\/$/, '');
